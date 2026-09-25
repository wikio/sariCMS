'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, DatabaseZap, DownloadCloud, FlaskConical, Play, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/admin/Toast';
import { cmsHealth, cmsImportCatalog, cmsStatus } from '@/lib/cms-admin';
import { CmsError } from '@/lib/cms';
import { seedDemoWorkspace } from '@/lib/demo-seed';

/**
 * Import du catalogue et jeu de démonstration.
 *
 * Ces trois boutons vivaient sur la page d'accueil de l'administration, au
 * milieu des compteurs. Deux d'entre eux écrivent dans la base :
 *
 * - l'import du catalogue lit `data/{fr,en,ar}` et alimente les listes — utile à
 *   l'installation, sans interest une fois le contenu en place ;
 * - le jeu de démonstration, lui, appelle `saveOrders()` et `saveQuotes()`, qui
 *   répliquent vers l'API : onze commandes et six devis fictifs, avec leurs
 *   montants, venaient s'ajouter aux vrais dans `orders` et `quotes`. Sur un poste
 *   de production, c'est une pollution comptable irréversible à l'œil — aucune
 *   colonne ne dit « ceci est un bac à sable ».
 *
 * Ils sont donc descendus ici, derrière une case à cocher qui n'est mémorisée
 * nulle part : elle doit être re-cochée à chaque séance, et elle disparaît quand
 * on ferme l'onglet. `lib/demo-seed.ts` refuse de surcroit d'écrire dans une base
 * qui contient déjà des commandes ou des devis ; le déverrouillage explicite
 * existe, parce qu'un environnement de recette doit pouvoir forcer.
 */
export default function DemoDataSection() {
  const { showToast } = useToast();
  const [driver, setDriver] = useState('');
  const [connected, setConnected] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [armed, setArmed] = useState(false);
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<
    { reason: 'base-occupée' | 'base-inconnue'; orders: number; quotes: number } | null
  >(null);

  const refresh = useCallback(async () => {
    const [health, status] = await Promise.all([cmsHealth(), cmsStatus()]);
    setConnected(Boolean(health || status?.connected));
    setDriver(status?.driver || (health as { driver?: string } | null)?.driver || '');
    if (status?.counts) setCounts(status.counts);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const importCatalog = async (replace: boolean) => {
    setBusy(true);
    try {
      const result = await cmsImportCatalog(replace);
      const total = Object.values(result.imported || {}).reduce((a, b) => a + Number(b), 0);
      showToast(total ? `${total} fiches importées` : 'Catalogue déjà présent', 'success');
      await refresh();
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : 'Import impossible', 'error');
    } finally {
      setBusy(false);
    }
  };

  const seedDemo = async () => {
    setBusy(true);
    setRefused(null);
    try {
      const result = await seedDemoWorkspace({ force });
      if (!result.ok) {
        // Le refus est un résultat, pas une erreur : l'écran le dit avec les
        // chiffres qui l'ont provoqué, pour que la décision de forcer se prenne
        // en connaissance de cause.
        setRefused({ reason: result.reason, orders: result.orders, quotes: result.quotes });
        showToast(
          result.reason === 'base-occupée'
            ? 'Base déjà peuplée : amorçage refusé'
            : 'Compteurs indisponibles : amorçage refusé',
          'warning',
        );
      } else {
        showToast(
          `Jeu de démonstration posé : ${result.orders} commandes, ${result.quotes} devis, ` +
            `${result.applications} candidatures, ${result.people} fiches CRM, ${result.imported} fiches de catalogue`,
          'success',
        );
        setArmed(false);
        setForce(false);
        await refresh();
      }
    } catch {
      showToast('Amorçage partiel (API injoignable pour le catalogue ou le CRM)', 'warning');
    } finally {
      setBusy(false);
    }
  };

  const seeded = (Number(counts.orders) || 0) + (Number(counts.quotes) || 0);

  return (
    <div className="space-y-4">
      <section className="ad-card p-5">
        <h3 className="ad-section-title">
          <DownloadCloud className="w-4 h-4" /> Import du catalogue
        </h3>
        <p className="text-sm mb-1" style={{ color: 'var(--ad-muted)' }}>
          Repart des jeux <code>data/fr|en|ar</code> pour alimenter produits, services, actualités et pages.
          « Réimporter » remplace les fiches existantes par le contenu des fichiers : à ne pas lancer après
          une semaine de saisie à la main, le fichier ne connaît pas vos modifications.
        </p>
        <p className="text-xs mb-4" style={{ color: 'var(--ad-muted)' }}>
          API {connected ? `connectée (${driver || 'sans pilote annoncé'})` : 'hors ligne — import indisponible'}.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="ad-btn ad-btn-primary" disabled={busy || !connected} onClick={() => importCatalog(false)}>
            <Play className="w-4 h-4" /> {busy ? 'Import…' : 'Importer ce qui manque'}
          </button>
          <button className="ad-btn ad-btn-ghost" disabled={busy || !connected} onClick={() => importCatalog(true)}>
            <RefreshCw className="w-4 h-4" /> Réimporter en remplaçant
          </button>
        </div>
      </section>

      <section className="ad-card p-5">
        <h3 className="ad-section-title">
          <FlaskConical className="w-4 h-4" /> Jeu de démonstration
        </h3>
        <p className="text-sm mb-4" style={{ color: 'var(--ad-muted)' }}>
          Commandes, devis, candidatures et fiches CRM de vitrine, pour une maquette ou une recette.
          Cette écriture n'est pas anodine : les lignes partent en base comme une saisie réelle, avec les
          mêmes écrans et les mêmes totaux.
        </p>

        <div className="ad-chip mb-4" style={{ marginRight: 8 }}>
          <DatabaseZap className="w-3 h-3" /> pilote&nbsp;: {driver || 'inconnu'}
        </div>
        <div className={`ad-chip mb-4 ${seeded ? 'ad-chip-warn' : 'ad-chip-ok'}`}>
          base&nbsp;: {Number(counts.orders) || 0} commande(s), {Number(counts.quotes) || 0} devis
        </div>

        {seeded > 0 && (
          <p className="text-sm mb-4 flex items-start gap-2" style={{ color: 'var(--ad-warn, #b45309)' }}>
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              Des lignes existent déjà. Les compteurs ci-dessus viennent de la base, pas du cache du
              navigateur : c'est donc bien l'environnement partagé qui est peuplé, et le jeu de démo se
              mélangerait au chiffre d'affaires réel.
            </span>
          </p>
        )}

        <label className="flex items-start gap-2 text-sm mb-3 cursor-pointer">
          <input type="checkbox" checked={armed} onChange={(e) => setArmed(e.target.checked)} />
          <span>
            J'écris dans un environnement de test, pas dans la base du client. À cocher à chaque séance —
            l'état n'est pas conservé.
          </span>
        </label>
        {armed && seeded > 0 && (
          <label className="flex items-start gap-2 text-sm mb-3 cursor-pointer">
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
            <span>Forcer malgré les {Number(counts.orders) || 0} commandes et {Number(counts.quotes) || 0} devis déjà présents.</span>
          </label>
        )}

        <button className="ad-btn ad-btn-lime" disabled={busy || !armed || !connected} onClick={seedDemo}>
          {busy ? 'Chargement…' : 'Charger le jeu de démonstration'}
        </button>
        {!connected && (
          <p className="text-xs mt-2" style={{ color: 'var(--ad-muted)' }}>
            L'API ne répond pas : le bouton reste inactif, pour ne pas écrire un demi-jeu dans le seul cache local.
          </p>
        )}
        {refused && (
          <p className="text-sm mt-3" style={{ color: 'var(--ad-warn, #b45309)' }}>
            {refused.reason === 'base-occupée' ? (
              <>
                Amorçage refusé : la base contient {refused.orders} commande(s) et {refused.quotes} devis.
                Cochez « Forcer » ci-dessus si cet environnement est bien un bac à sable.
              </>
            ) : (
              <>
                Amorçage refusé : les compteurs de commandes et de devis n'ont pas pu être lus
                (table absente de la base, ou droits insuffisants sur « settings »). Une base dont
                on ne sait rien est traitée comme une base à risque — vérifiez l'état, ou créez la
                table (« npm run db:schema-check » puis « db:schema-fix » dans backend/), puis
                cochez « Forcer » en connaissance de cause.
              </>
            )}
          </p>
        )}
      </section>
    </div>
  );
}
