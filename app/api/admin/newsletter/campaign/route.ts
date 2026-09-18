/**
 * POST /api/admin/newsletter/campaign — diffusion de la lettre d'information.
 *
 * L'événement `newsletter_campaign` existait dans le catalogue du centre de
 * courrier sans qu'aucun écran ne l'appelle. Voici l'appelant.
 *
 * Trois décisions structurantes :
 *
 * 1. **La boucle tourne ici, pas dans le navigateur.** `sendMailCenterEvent` est
 *    serveur uniquement (il lit `data/mail/*.json` et porte la clé interne ou le
 *    jeton d'administration). Un navigateur qui enverrait 300 requêtes perdrait
 *    la moitié de la diffusion au premier onglet fermé.
 *
 * 2. **Le gabarit n'est pas composé ici.** Il vit dans `data/mail/modules.json`,
 *    modifiable depuis l'écran Centre de courrier — c'est le parti pris du
 *    projet : les messages sont des fichiers sur le serveur, pas des lignes en
 *    base. Cet écran choisit *à qui* envoyer et remplit les variables ; il ne
 *    réécrit pas le message.
 *
 * 3. **Les garde-fous sont vérifiés ici, pas supposés.** Le client peut demander
 *    n'importe quelle sélection ; ne partent que les adresses réellement au
 *    statut « abonné » **avec consentement**, conformément à la description de
 *    l'événement. Un écran qui cocherait tout ne contourne rien.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cmsFetch } from '@/lib/cms';
import { bearer } from '@/lib/server/cms-or';
import { listSubscribers, type SubscriberRow } from '@/lib/newsletter-store';
import { companyVars, requestOrigin, sendMailCenterEvent } from '@/lib/mail-center-send';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Plafond par requête. Une diffusion se fait par lots : au-delà, la requête
 * HTTP mettrait plus de temps que le délai du proxy. L'écran propose de
 * continuer tant que `remaining` n'est pas nul — et le plafond quotidien du
 * centre de courrier (`dailyCap`) arrêtera de toute façon bien avant dans la
 * configuration par défaut.
 */
const MAX_PER_SEND = 250;
/** Envois simultanés : ménager le serveur SMTP sans le laisser idle. */
const CONCURRENCY = 4;
/** Pages de 100 (plafond de `QueryDto.limit`) lues au plus. */
const MAX_PAGES = 50;

const EMAIL_RE = /^[^@\s@]+@[^@\s@]+\.[a-z]{2,}$/i;

type Row = Record<string, unknown> & { token?: string };

interface CampaignBody {
  filters?: { status?: string; locale?: string; source?: string; search?: string };
  /** Centres d'intérêt : suffit d'en partager un. */
  topics?: string[];
  /** Sélection explicite (cases cochées) : prime sur les filtres. */
  ids?: string[];
  /** Cible du « Lire la suite » du gabarit. */
  lien_document?: string;
  locale?: string;
  /** Portée de la clé d'unicité ; absent, un identifiant est produit. */
  campaignId?: string;
  /** Résout les destinataires et compte, sans rien envoyer. */
  dryRun?: boolean;
}

function unwrapRows(payload: unknown): Row[] {
  if (Array.isArray(payload)) return payload as Row[];
  const data = (payload as { data?: unknown })?.data;
  if (Array.isArray(data)) return data as Row[];
  const nested = (data as { data?: unknown })?.data;
  if (Array.isArray(nested)) return nested as Row[];
  return [];
}

/**
 * Destinataires éligibles, depuis le CMS ou — en secours — le fichier local.
 *
 * Le filtre d'éligibilité est appliqué **après** la résolution et dans les deux
 * branches : un statut ou un consentement ne se négocie pas selon l'endroit où
 * la liste est rangée.
 */
async function resolveRecipients(
  token: string | null,
  body: CampaignBody,
): Promise<{ rows: Row[]; via: 'api' | 'local' }> {
  const filters = body.filters || {};
  const only = body.ids && body.ids.length ? new Set(body.ids.map(String)) : null;
  const wantedTopics = (body.topics || []).map((t) => String(t).trim().toLowerCase()).filter(Boolean);

  const eligible = (row: Row): boolean => {
    if (row.deleted) return false;
    if (String(row.status ?? '') !== 'subscribed') return false;
    if (row.consent !== true) return false;
    if (!EMAIL_RE.test(String(row.email ?? ''))) return false;
    if (only && !only.has(String(row.id ?? ''))) return false;
    if (wantedTopics.length) {
      const owned = (Array.isArray(row.topics) ? (row.topics as unknown[]) : [])
        .map((t) => String(t).trim().toLowerCase());
      if (!wantedTopics.some((t) => owned.includes(t))) return false;
    }
    return true;
  };

  try {
    // Les filtres passent par le paramètre `filter` (JSON) : un `status=` en
    // paramètre simple fait répondre 400 « property status should not exist »,
    // et la bascule de secours ci-dessous masquerait l'erreur en diffusant à la
    // mauvaise liste.
    const filter: Record<string, string> = { status: 'subscribed' };
    if (filters.locale) filter.locale = filters.locale;
    if (filters.source) filter.source = filters.source;
    const parts = new URLSearchParams({
      view: 'block',
      limit: '100',
      filter: JSON.stringify(filter),
    });
    if (filters.search) parts.set('search', filters.search);
    const collected: Row[] = [];
    for (let page = 0; page < MAX_PAGES; page += 1) {
      if (page > 0) parts.set('offset', String(page * 100));
      const payload = await cmsFetch<unknown>(`/newsletter?${parts.toString()}`, {
        token: token || undefined,
        timeoutMs: 12000,
      });
      const rows = unwrapRows(payload);
      collected.push(...rows);
      if (rows.length < 100) break;
    }
    return { rows: collected.filter(eligible), via: 'api' };
  } catch (err) {
    // Secours fichier, comme le reste de l'écran. L'erreur est journalisée :
    // une bascule invisible ferait diffuser depuis une liste qui n'est pas
    // celle que l'administrateur croit.
    console.warn('[newsletter/campaign] API injoignable, secours fichier :', err);
    const rows: SubscriberRow[] = await listSubscribers({
      status: 'subscribed',
      locale: filters.locale,
      source: filters.source,
      search: filters.search,
    });
    return { rows: (rows as unknown as Row[]).filter(eligible), via: 'local' };
  }
}

export async function POST(req: NextRequest) {
  const token = bearer(req);
  // Sans jeton d'administration, rien : la diffusion passe par `/mail/send`, qui
  // exige `settings:admin`. Autant le dire tout de suite plutôt que de renvoyer
  // 200 avec une liste d'erreurs par destinataire.
  if (!token) {
    return NextResponse.json(
      { ok: false, error: 'Session d’administration requise pour diffuser.' },
      { status: 401 },
    );
  }

  // Le rétrécissement de type ne traverse pas la fermeture `worker` ci-dessous :
  // on fixe une valeur sûrement non nulle au lieu de re-tester à chaque envoi.
  const adminToken: string = token;

  const body = (await req.json().catch(() => null)) as CampaignBody | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'Corps JSON attendu.' }, { status: 400 });
  }

  const link = String(body.lien_document || '').trim();
  if (!body.dryRun && !/^https?:\/\//i.test(link)) {
    return NextResponse.json(
      { ok: false, error: 'Un lien valide est requis pour le « Lire la suite ».' },
      { status: 400 },
    );
  }

  const locale = String(body.locale || 'fr');
  const { rows, via } = await resolveRecipients(token, body);
  const remaining = Math.max(0, rows.length - MAX_PER_SEND);
  const batch = rows.slice(0, MAX_PER_SEND);

  if (body.dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      stored: via,
      eligible: rows.length,
      wouldSend: batch.length,
      remaining,
      sample: batch.slice(0, 5).map((row) => String(row.email)),
    });
  }

  const origin = requestOrigin(req);
  const campaignId = String(body.campaignId || '').trim() || `campagne-${Date.now()}`;
  const shared = await companyVars(locale, origin);

  const tally: Record<string, number> = {};
  let sent = 0;
  const failures: Array<{ email: string; reason: string; detail?: string }> = [];

  // File à concurrence bornée : `Promise.all` sur 250 envois ouvrirait 250
  // connexions SMTP d'un coup.
  let cursor = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= batch.length) return;
      const row = batch[index];
      const email = String(row.email || '').trim();
      const subToken = String(row.token || '');
      const vars: Record<string, string> = {
        ...shared,
        nom_client: String(row.name || '').trim() || email.split('@')[0],
        email_client: email,
        societe_client: '',
        lien_document: link,
        // Sans jeton, pas de lien de désinscription personnel : on laisse la
        // variable vide plutôt que de pointer vers une page qui rejetterait la
        // demande. Le destinataire garde l'adresse de contact du pied de page.
        lien_desinscription: subToken
          ? `${origin}/${locale}/newsletter/unsubscribe?token=${encodeURIComponent(subToken)}`
          : '',
      };

      let res: Awaited<ReturnType<typeof sendMailCenterEvent>>;
      try {
        res = await sendMailCenterEvent({
          event: 'newsletter_campaign',
          to: email,
          toName: String(row.name || '').trim() || undefined,
          // La clé porte l'identifiant de campagne : relancer la même diffusion
          // ne renvoie pas deux fois, mais une campagne suivante passe.
          dedupeKey: `newsletter_campaign-${campaignId}-${email}`,
          vars,
          bearer: adminToken,
        });
      } catch (err) {
        res = { sent: false, reason: 'transport_error', detail: err instanceof Error ? err.message : String(err) };
      }

      if (res.sent) {
        sent += 1;
      } else {
        const reason = String(res.reason || 'unknown');
        tally[reason] = (tally[reason] || 0) + 1;
        // Dix exemples suffisent à diagnostiquer ; 250 lignes noieraient l'écran.
        if (failures.length < 10) failures.push({ email, reason, detail: res.detail });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batch.length) }, () => worker()));

  return NextResponse.json({
    ok: true,
    stored: via,
    campaignId,
    eligible: rows.length,
    attempted: batch.length,
    sent,
    remaining,
    skipped: tally,
    failures,
  });
}
