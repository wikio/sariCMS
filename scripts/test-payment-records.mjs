#!/usr/bin/env node
/**
 * Enregistrements de paiement : ce qui est lu est ce qui a été saisi.
 *
 *   npm run payments:test
 *
 * Le magasin `sari_payment_records` est comptable. Trois comportements y étaient
 * possibles, tous vérifiés ici parce qu'aucun ne fait de bruit :
 *
 * 1. `loadPaymentRecords()` **écrivait** un jeu de démonstration dans le
 *    `localStorage` du premier navigateur qui ouvrait l'écran — virements
 *    « rapprochés », carte `**** 4242` validée, 4 500 € encaissés. Une page sans
 *    aucune transaction affichait donc des encaissements, et leur total entrait
 *    dans les chiffres présentés à l'opérateur (et dans l'export CSV).
 * 2. Un cache illisible tombait sur le même jeu fictif.
 * 3. Un poste qui avait reçu ces lignes avant le correctif les garde : elles sont
 *    reconnaissables à leur `id` (`pr1`…`pr5`, contre `pay-<horodatage>-<aléa>`),
 *    donc elles doivent être purgées **à la lecture**, sans toucher aux lignes
 *    réelles du même cache.
 *
 * Le module importé n'a qu'un `import type` : `--experimental-strip-types` le
 * charge sans Resolve Alias, comme `scripts/test-shop-sync.mjs`.
 */
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let failures = 0;
const check = (label, ok, detail = '') => {
  if (ok) {
    console.log(`  ok    ${label}`);
    return;
  }
  failures += 1;
  console.log(`  ÉCHEC ${label}${detail ? `\n          ${detail}` : ''}`);
};

/** `localStorage` de fortune : assez fidèle pour compter les écritures. */
function makeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  const writes = [];
  return {
    writes,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => {
      writes.push(k);
      data.set(k, String(v));
    },
    removeItem: (k) => data.delete(k),
    dump: () => Object.fromEntries(data),
  };
}

function installEnv(initial) {
  const storage = makeStorage(initial);
  globalThis.localStorage = storage;
  globalThis.window = { localStorage: storage, dispatchEvent() {}, addEventListener() {}, removeEventListener() {} };
  return storage;
}

const mod = await import(pathToFileURL(join(ROOT, 'lib/payments.ts')).href);
const KEY = 'sari_payment_records';

console.log('\nEnregistrements de paiement — lecture sans fabrication\n');

// ── 1. un poste neuf ne reçoit plus rien ─────────────────────────────────────
{
  const storage = installEnv({});
  const rows = mod.loadPaymentRecords();
  check('cache vide : liste vide', Array.isArray(rows) && rows.length === 0, JSON.stringify(rows));
  check(
    'cache vide : RIEN n’est écrit dans le navigateur (l’ancien comportement y posait 5 faux encaissements)',
    !storage.writes.includes(KEY),
    `écritures observées: ${JSON.stringify(storage.writes)}`,
  );
  check('et la clé reste absente du cache', !(KEY in storage.dump()), JSON.stringify(storage.dump()));
}

// ── 2. un cache illisible ne devient pas fictif ─────────────────────────────
{
  installEnv({ [KEY]: '{ceci n’est pas du JSON' });
  const rows = mod.loadPaymentRecords();
  check('cache corrompu : liste vide, pas de lignes inventées', rows.length === 0, JSON.stringify(rows));
}

// ── 3. purge des lignes de démonstration, sans toucher aux vraies ──────────
/*
 * Les lignes fictives viennent de `DEMO_PAYMENT_RECORDS`, exporté par le module
 * testé : les recopier ici serait un deuxième endroit où le jeu de démonstration
 * change, et un test qui purge sur une copie périmée ne prouve rien.
 */
{
  const demo = mod.DEMO_PAYMENT_RECORDS;
  const real = {
    id: 'pay-1737000000000-ab12x',
    orderId: 42,
    client: 'Clinique El Afia',
    email: 'direction@eliafia.dz',
    method: 'transfer',
    methodName: 'Virement',
    amount: 1200,
    status: 'pending',
    date: '2026-03-01T10:00:00.000Z',
  };
  const legacy = [demo[0], real, demo[2]];
  const storage = installEnv({ [KEY]: JSON.stringify(legacy) });
  const rows = mod.loadPaymentRecords();
  check(
    'les lignes de démonstration intactes sont écartées de la lecture',
    rows.length === 1 && rows[0].id === real.id,
    JSON.stringify(rows.map((r) => r.id)),
  );
  check(
    'la purge est réécrite en cache, pour que le total cesse de les compter',
    JSON.parse(storage.getItem(KEY)).length === 1,
    storage.getItem(KEY),
  );

  // Un opérateur qui a corrigé une ligne de démonstration en a fait une donnée
  // réelle. Son `id` reste `pr…`, et c'est précisément pour ça que l'id seul ne
  // suffit pas à décider d'une destruction.
  const edited = [{ ...demo[0], amount: 9999, note: 'ramené à la réalité' }];
  installEnv({ [KEY]: JSON.stringify(edited) });
  const kept = mod.loadPaymentRecords();
  check(
    'une ligne de démonstration RETOUCHÉE est conservée (id `pr…` mais donnée réelle)',
    kept.length === 1 && kept[0].amount === 9999,
    JSON.stringify(kept.map((r) => r.amount)),
  );
}

// ── 4. un poste uniquement peuplé de faux est vidé, pas supprimé ────────────
{
  const storage = installEnv({
    [KEY]: JSON.stringify([mod.DEMO_PAYMENT_RECORDS[1], mod.DEMO_PAYMENT_RECORDS[2]]),
  });
  check('que des faux intacts : lecture vide', mod.loadPaymentRecords().length === 0);
  check(
    'et la clé passe à [] (effacer la clé la ferait se repeupler à la prochaine lecture)',
    storage.getItem(KEY) === '[]',
    String(storage.getItem(KEY)),
  );
}

// ── 5. une saisie réelle survit, et n’attire aucun fictif ──────────────────
{
  installEnv({});
  const rec = mod.addPaymentRecord({
    orderId: 7,
    orderCode: 'SARI-WCMD26-00007',
    client: 'Cabinet du Parc',
    email: 'secretariat@cabinet-parc.dz',
    method: 'transfer',
    methodName: 'Virement',
    amount: 3400,
  });
  const rows = mod.loadPaymentRecords();
  check('un encaissement saisi est relu', rows.length === 1 && rows[0].id === rec.id, JSON.stringify(rows.map((r) => r.id)));
  check('un virement reste en attente de validation manuelle', rec.status === 'pending', rec.status);
  check(
    'aucune ligne fictive n’accompagne la saisie',
    rows.every((r) => !/^pr\d+$/.test(String(r.id))),
    JSON.stringify(rows.map((r) => r.id)),
  );
}

// ── 6. l’export ne peut plus emporter de fictif ─────────────────────────────
/*
 * `exportPaymentsCsv(rows)` ne relit pas le magasin : c'est l'écran qui lui passe
 * `loadPaymentRecords()`. La ligne de défense est donc la lecture, et l'appeler ici
 * ne prouverait rien de plus — de surcroît elle touche `document` et déclenche un
 * téléchargement, hors de portée d'un test Node. Ce qui est vérifié : ce que
 * l'écran exporterait depuis un cache mêlant fictif intact et saisie réelle est
 * réduit à la saisie réelle.
 */
{
  installEnv({
    [KEY]: JSON.stringify([
      mod.DEMO_PAYMENT_RECORDS[3],
      { id: 'pay-1737000000001-zz99', amount: 1200, status: 'pending', client: 'Cabinet du Parc', methodName: 'Virement', date: '2026-05-01T10:00:00.000Z' },
    ]),
  });
  const exported = mod.loadPaymentRecords();
  check(
    'un export depuis ce cache ne contiendrait que la ligne réelle',
    exported.length === 1 && exported[0].amount === 1200,
    JSON.stringify(exported.map((r) => r.amount)),
  );
}

console.log(
  failures === 0
    ? '\n  \u2713 le relev\u00e9 ne contient que ce qui a \u00e9t\u00e9 r\u00e9ellement saisi\n'
    : `\n  ${failures} probl\u00e8me(s) \u2014 voir ci-dessus\n`,
);
process.exit(failures === 0 ? 0 : 1);
