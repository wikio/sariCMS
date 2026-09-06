#!/usr/bin/env node
/**
 * Aligne les menus de toutes les langues sur une langue de référence.
 *
 *   node scripts/sync-menus.mjs --dry-run                  # simulation
 *   node scripts/sync-menus.mjs --from fr --to en,ar
 *   node scripts/sync-menus.mjs --from fr --email admin@… --password '…'
 *   node scripts/sync-menus.mjs --from fr --token <jwt>
 *
 * À quoi cela sert : les menus sont enregistrés par langue (une ligne par
 * emplacement et par langue). Composer un menu depuis l'administration ne crée
 * donc rien pour les autres langues, qui continuent d'afficher le menu de
 * repli livré avec le code — d'où des menus différents d'une langue à l'autre.
 *
 * Ce script recopie la structure de la langue de référence : liens, ordre,
 * règles de sous-menu automatique et sous-liens. Les libellés déjà traduits
 * dans la langue cible sont conservés lorsque l'entrée existe encore (même
 * identifiant) ; les nouvelles entrées reprennent le libellé de la référence
 * et restent à traduire.
 *
 * Il nettoie au passage les sous-menus vides : un tableau vide est vrai en
 * JavaScript et produit un chevron ouvrant un panneau sans contenu.
 *
 * L'écriture passe par l'API d'administration, qui exige une authentification :
 * indiquez --email et --password (le script obtient le jeton lui-même), ou
 * directement --token. Les variables ADMIN_EMAIL, ADMIN_PASSWORD et
 * ADMIN_TOKEN sont également lues dans l'environnement.
 */

const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  if (i >= 0 && argv[i + 1]) return argv[i + 1];
  // Certaines versions de npm avalent les options : --api=X reste lisible.
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  return fallback;
};
const has = (name) => argv.includes(`--${name}`);

const API = (
  argOf('api', process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3001/api/v1')
).replace(/\/$/, '');
const FROM = argOf('from', 'fr');
const TO = argOf('to', '').split(',').map((s) => s.trim()).filter(Boolean);
let TOKEN = argOf('token', process.env.ADMIN_TOKEN || '');
const EMAIL = argOf('email', process.env.ADMIN_EMAIL || '');
const PASSWORD = argOf('password', process.env.ADMIN_PASSWORD || '');
const DRY = has('dry-run');

const C = process.stdout.isTTY
  ? { r: '\x1b[31m', g: '\x1b[32m', y: '\x1b[33m', b: '\x1b[1m', d: '\x1b[2m', x: '\x1b[0m' }
  : { r: '', g: '', y: '', b: '', d: '', x: '' };
const line = (s = '') => console.log(s);

const EMPLACEMENTS = ['main', 'footer-nav', 'footer-legal', 'social'];
const NOMS = {
  main: 'Menu principal',
  'footer-nav': 'Pied — navigation',
  'footer-legal': 'Pied — légal',
  social: 'Réseaux sociaux',
};

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const msg = body?.message || res.statusText;
    throw new Error(`HTTP ${res.status} — ${msg}`);
  }
  return body;
}

/**
 * Menus d'une langue, indexés par emplacement.
 *
 * En simulation on interroge l'endpoint public, qui ne demande pas de jeton :
 * on peut ainsi contrôler ce qui serait écrit sans disposer d'un accès
 * d'administration. L'écriture, elle, reste réservée à l'API authentifiée.
 */
async function menusOf(locale) {
  const path = DRY && !TOKEN
    ? `/public/menus?view=block&limit=100&locale=${encodeURIComponent(locale)}`
    : `/menus?view=block&limit=100&filter=${encodeURIComponent(JSON.stringify({ locale }))}`;
  const payload = await api(path);
  const rows = payload?.data?.data ?? payload?.data ?? [];
  const byLocation = {};
  for (const row of Array.isArray(rows) ? rows : []) byLocation[row.location] = row;
  return byLocation;
}

/**
 * Recopie une entrée vers la langue cible.
 * Le libellé déjà traduit est préservé : seule la structure est alignée.
 */
const SOURCES_AUTO = ['solutions', 'services', 'products', 'news', 'events'];

/**
 * Remet une règle « auto » en conformité avec ce que l'API accepte.
 *
 * D'anciens enregistrements portent une règle incomplète — typiquement sans
 * `mode`, ajouté depuis. L'API refuse alors l'écriture du menu entier
 * (HTTP 400 « mode must be one of… »), et un seul emplacement fautif faisait
 * échouer tout l'alignement. On complète donc la règle avec les valeurs par
 * défaut ; une source inconnue fait retirer la règle, l'entrée restant un
 * lien simple.
 */
function assainirAuto(auto) {
  if (!auto || typeof auto !== 'object') return null;
  if (!SOURCES_AUTO.includes(auto.source)) return null;
  const mode = ['all', 'pick', 'groups'].includes(auto.mode) ? auto.mode : 'all';
  const regle = { source: auto.source, mode };
  if (Array.isArray(auto.ids) && auto.ids.length) regle.ids = auto.ids;
  if (Number.isInteger(auto.limit) && auto.limit >= 0) regle.limit = auto.limit;
  for (const cle of ['showDesc', 'showIcon', 'group']) {
    if (auto[cle] !== undefined) regle[cle] = auto[cle];
  }
  return regle;
}

function port(item, translated) {
  const known = translated?.get(item.id);
  const children = Array.isArray(item.submenu)
    ? item.submenu.map((child) => port(child, known?.children))
    : [];
  const out = {
    ...item,
    label: known?.label || item.label,
    ...(item.desc !== undefined ? { desc: known?.desc ?? item.desc } : {}),
  };
  // Un sous-menu vide produirait un chevron sans contenu : on l'omet.
  if (children.length) out.submenu = children;
  else delete out.submenu;
  // Une règle « auto » héritée peut être incomplète et faire rejeter l'écriture.
  const auto = assainirAuto(item.auto);
  if (auto) out.auto = auto;
  else delete out.auto;
  return out;
}

/** Index des libellés existants dans la cible, pour ne pas perdre les traductions. */
function indexLabels(items) {
  const map = new Map();
  for (const it of items || []) {
    map.set(it.id, {
      label: it.label,
      desc: it.desc,
      children: indexLabels(it.submenu),
    });
  }
  return map;
}

/**
 * Échange un couple email / mot de passe contre un jeton d'accès.
 * Évite d'avoir à extraire un JWT du navigateur à la main.
 */
async function connexion() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = body?.message || res.statusText;
    throw new Error(`connexion refusée (HTTP ${res.status}) — ${detail}`);
  }
  const data = body?.data ?? body;
  if (data?.requires2fa) {
    throw new Error(
      "double authentification activée sur ce compte : passez --token <jwt>, " +
        'copié depuis les outils de développement du navigateur.',
    );
  }
  const token = data?.accessToken || data?.access_token;
  if (!token) throw new Error("réponse de connexion sans jeton d'accès");
  return token;
}

async function main() {
  line(`${C.b}Alignement des menus${C.x}`);
  line(`API       : ${API}`);
  line(`Référence : ${FROM}`);
  if (DRY) line(`${C.y}Mode simulation — aucune écriture${C.x}`);
  if (!TOKEN && EMAIL && PASSWORD) {
    try {
      TOKEN = await connexion();
      line(`Connecté  : ${EMAIL}`);
    } catch (err) {
      line(`\n${C.r}Échec de la connexion : ${err.message}${C.x}`);
      process.exit(1);
    }
  }
  if (!TOKEN && !DRY) {
    line(`\n${C.r}Authentification requise pour écrire.${C.x}`);
    line(`${C.d}Indiquez --email <adresse> --password <mot de passe>,${C.x}`);
    line(`${C.d}ou --token <jwt>. Ajoutez --dry-run pour simuler sans écrire.${C.x}`);
    process.exit(1);
  }

  const source = await menusOf(FROM);
  const present = EMPLACEMENTS.filter((loc) => source[loc]?.items?.length);
  if (!present.length) {
    line(`\n${C.r}Aucun menu enregistré pour « ${FROM} » — rien à copier.${C.x}`);
    process.exit(1);
  }
  line(`Emplacements trouvés : ${present.map((l) => NOMS[l] || l).join(', ')}`);

  const targets = TO.length ? TO : ['fr', 'en', 'ar'].filter((l) => l !== FROM);
  let written = 0;
  let failed = 0;

  for (const target of targets) {
    line();
    line(`${C.b}→ ${target}${C.x}`);
    const existing = await menusOf(target);

    for (const location of present) {
      const src = source[location];
      const dst = existing[location];
      const translated = indexLabels(dst?.items);
      const items = (src.items || []).map((it) => port(it, translated));

      const kept = items.filter((it) => translated.has(it.id)).length;
      const added = items.length - kept;
      const label = NOMS[location] || location;

      if (DRY) {
        line(`  ${C.d}(simulation)${C.x} ${label} : ${items.length} entrée(s) — ${kept} libellé(s) conservé(s), ${added} à traduire`);
        continue;
      }

      const payload = {
        name: src.name || label,
        location,
        locale: target,
        status: 'published',
        items,
      };
      try {
        if (dst?.id) await api(`/menus/${dst.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        else await api('/menus', { method: 'POST', body: JSON.stringify(payload) });
        written += 1;
        line(`  ${C.g}✓${C.x} ${label} : ${items.length} entrée(s) — ${kept} libellé(s) conservé(s), ${added} à traduire`);
      } catch (err) {
        failed += 1;
        line(`  ${C.r}✗${C.x} ${label} : ${err.message}`);
      }
    }
  }

  line();
  if (DRY) {
    line(`${C.y}Simulation terminée. Relancez sans --dry-run pour appliquer.${C.x}`);
    return;
  }
  if (failed) {
    line(`${C.r}${failed} écriture(s) en échec, ${written} réussie(s).${C.x}`);
    process.exit(1);
  }
  line(`${C.g}${written} menu(s) alignés. Vérifiez avec : node scripts/check-menus.mjs${C.x}`);
}

main().catch((err) => {
  line(`${C.r}Échec : ${err.message}${C.x}`);
  process.exit(1);
});
