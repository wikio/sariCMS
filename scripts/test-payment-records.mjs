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
 * Depuis la mise en base (`payment_records`), le même magasin a deux contrats de
 * plus à tenir, et ils sont vérifiés dans la seconde partie : la conversion vers
 * l'API ne doit rien perdre (un montant qui repartirait en chaîne se additionne
 * en concaténation), et les retraits doivent être calculés à partir de l'écart
 * entre avant et après — jamais déclarés par l'écran, qui peut les oublier.
 *
 * Les deux modules importés n'ont que des `import type` : le premier
 * (`lib/payments.ts`) ne lit que le `localStorage` stubbé ci-dessous, le second
 * (`lib/payment-records-mapping.ts`) est pur. `--experimental-strip-types` les
 * charge donc sans Resolve Alias, comme `scripts/test-shop-sync.mjs`.
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


/* -------------------------------------------------------------------------- */
 /* Mappage avec la base (`lib/payment-records-mapping.ts`).                  */
 /*                                                                            */
 /* Le module de synchronisation, lui, n'est pas testé ici : comme son         */
 /* homologue des coupons (`scripts/test-shop-sync.mjs`), il dépend de         */
 /* `@/lib/cms-admin` et d'un `window`, et n'est donc pas importable sous      */
 /* Node. Ce qui peut détruire une donnée — les conversions et le calcul des  */
 /* retraits — est pur et se trouve ici.                                       */
 /* -------------------------------------------------------------------------- */

const map = await import(pathToFileURL(join(ROOT, 'lib/payment-records-mapping.ts')).href);

// 1. Ce que le poste envoie.
const sent = map.recordToApi({
  id: 'pay-1737000000000-aa11',
  client: 'Cabinet du Parc',
  method: 'transfer',
  amount: 1200,
  status: 'pending',
  date: '2026-05-01T10:00:00.000Z',
});
check(
  "l'identifiant local part en `externalId`, la clé d'idempotence",
  sent.externalId === 'pay-1737000000000-aa11' && !('id' in sent),
  JSON.stringify(sent),
);
check('un montant nombre reste un nombre', typeof sent.amount === 'number' && sent.amount === 1200);

const avecNull = map.recordToApi({ id: 'x', client: 'A', amount: 1, status: 'pending', date: '2026-05-01', orderId: null });
const sansCle = map.recordToApi({ id: 'x', client: 'A', amount: 1, status: 'pending', date: '2026-05-01' });
check(
  '`orderId: null` (non rattaché) se distingue de l’absence (je ne sais pas)',
  sansCle.orderId === undefined && avecNull.orderId === null && 'orderId' in avecNull && !('orderId' in sansCle),
  JSON.stringify({ avecNull, sansCle }),
);

const masque = map.recordToApi({
  id: 'x', client: 'A', amount: 1, status: 'pending', date: '2026-05-01',
  cardMasked: '**** **** **** 4242',
});
check('les quatre derniers chiffres sont relus dans le masque', masque.cardLast4 === '4242', JSON.stringify(masque));

const jumeau = map.recordToApi({ id: 'pay-1-x', dbId: 41, client: 'A', amount: 1, status: 'pending', date: '2026-05-01' });
check("un poste qui connaît l'identifiant de base le nomme", jumeau.id === 41, JSON.stringify(jumeau));

// 2. Ce que la base rend.
const back = map.recordFromApi({
  id: 7,
  externalId: 'pay-1737000000000-aa11',
  client: 'Cabinet du Parc',
  method: 'card',
  amount: '1200.00',
  status: 'validé',
  cardLast4: '4242',
  date: '2026-05-01T10:00:00.000Z',
});
check('un montant DECIMAL redevient un nombre', typeof back.amount === 'number' && back.amount === 1200, `${typeof back.amount} ${back.amount}`);
check('un statut que la base ne connaît pas devient `pending`', back.status === 'pending', String(back.status));
check('le masque est déduit à la lecture', back.cardMasked === '**** **** **** 4242', String(back.cardMasked));
check(
  "l'identifiant du navigateur est conservé, celui de la base aussi",
  back.id === 'pay-1737000000000-aa11' && back.dbId === 7,
  `${back.id} / ${back.dbId}`,
);

const orphelin = map.recordFromApi({ id: 9, client: 'A', amount: 0, status: 'pending', date: '' });
check(
  "une ligne sans `externalId` s'adresse par son identifiant de base",
  orphelin.id === '9' && orphelin.dbId === 9,
  JSON.stringify(orphelin),
);

// 3. Aller-retour : ce que lopérateur a saisi doit revenir tel quel.
const original = {
  id: 'pay-1737000000000-aa11',
  orderId: null,
  client: 'Clinique Atlas',
  email: 'compta@atlas.dz',
  method: 'transfer',
  methodName: 'Virement CCP',
  amount: 18500,
  status: 'validated',
  note: 'Rapproché le 3',
  date: '2026-09-01T10:00:00.000Z',
  validatedAt: '2026-09-03T08:00:00.000Z',
};
const roundTrip = map.recordFromApi(map.recordToApi(original));
const differents = Object.keys(original).filter((field) => {
  const a = original[field];
  const b = roundTrip[field];
  return !(a === b || (a === undefined && (b === null || b === undefined)) || (a === null && b === undefined));
});
check(
  'aller-retour sans perte sur les champs saisis',
  differents.length === 0,
  differents.map((field) => `${field}: ${JSON.stringify(original[field])} → ${JSON.stringify(roundTrip[field])}`).join(', '),
);

// 4. Les retraits — le seul chemin par lequel une suppression atteint la base.
const avant = [
  { id: 'a', amount: 100, status: 'pending', date: '2026-09-01' },
  { id: 'b', amount: 200, status: 'validated', date: '2026-09-02' },
  { id: 'c', amount: 300, status: 'pending', date: '2026-09-03' },
];
check('rien retiré quand rien ne change', map.planPaymentRemoved(avant, avant).length === 0);
check('une ligne ajoutée n’en retire aucune', map.planPaymentRemoved(avant, [...avant, { id: 'd', amount: 400 }]).length === 0);
check('la ligne disparue est nommée', map.planPaymentRemoved(avant, [avant[0], avant[2]]).join() === 'b', map.planPaymentRemoved(avant, [avant[0], avant[2]]).join());
check('un cache vidé à la main ne décrète pas la purge du journal', map.planPaymentRemoved(avant, []).join() === 'a,b,c');
check('un relevé qui n’a encore jamais été envoyé ne produit aucun retrait', map.planPaymentRemoved([], []).length === 0);
check('un identifiant vide n’est pas envoyé comme retrait', map.planPaymentRemoved([{ id: '  ' }, { id: 'z' }], []).join() === 'z');
check(
  'un identifiant fautif d’une espace ne fait pas disparaître une écriture',
  map.planPaymentRemoved([{ id: ' b ' }], [{ id: 'b' }]).length === 0,
  map.planPaymentRemoved([{ id: ' b ' }], [{ id: 'b' }]).join(),
);

console.log(
  failures === 0
    ? '\n  \u2713 le relev\u00e9 ne contient que ce qui a \u00e9t\u00e9 saisi, et le mappage ne perd rien\n'
    : `\n  ${failures} probl\u00e8me(s) \u2014 voir ci-dessus\n`,
);
process.exit(failures === 0 ? 0 : 1);
