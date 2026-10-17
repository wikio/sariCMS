#!/usr/bin/env node
// scripts/test-intl-tree.mjs
/**
 * Le contrôle de la règle qui range l'atelier de traduction.
 *
 * `npm run intl:sync` réécrit ~250 fichiers par langue et l'écran « Traductions »
 * écrit dans les messages à chaque enregistrement : si la règle de découpage est
 * fausse de quelque façon que ce soit, ce n'est pas un avertissement dans la console,
 * c'est un écran qui perd ses chaînes. D'où un test sans serveur ni dépendance :
 * aller-retour messages → arbre → messages, `_root.json` qui ne mange pas les
 * enfants-objets, plan de synchronisation lu sur un atelier de fortune.
 *
 *   node scripts/test-intl-tree.mjs      (npm run intl:test)
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyNamespace,
  joinTree,
  listJsonFiles,
  namespaceForFile,
  planSync,
  ROOT_FILE,
  sameContent,
  splitMessages,
} from '../lib/intl-tree.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let done = 0;
let failed = 0;
const ok = (label, condition, detail) => {
  if (condition) {
    done += 1;
    console.log(`  ✅ ${label}`);
  } else {
    failed += 1;
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
};
const eq = (label, got, want) =>
  ok(label, sameContent(got, want), `obtenu ${JSON.stringify(got)}, voulu ${JSON.stringify(want)}`);

// ---------------------------------------------------------------------------
// Le découpage
// ---------------------------------------------------------------------------
console.log('\n— la règle de découpage —');

const sample = {
  admin: {
    title: 'Admin',
    newsletter: { list: 'Liste', empty: '' },
    fields: { _groups: { Identite: 'Identité' }, label: 'Champ' },
  },
  common: { nav: { home: 'Accueil' } },
  faq: [{ q: 'Question', a: 'Réponse' }],
};

const files = splitMessages(sample);
eq(
  'un objet sans enfant-objet tient dans un fichier, un nœud à enfants-objets devient un dossier',
  [...files.keys()].sort(),
  [
    '_root.json',
    'admin/_root.json',
    'admin/newsletter.json',
    'admin/fields/_root.json',
    'admin/fields/_groups.json',
    'common/nav.json',
  ].sort(),
);
eq('les feuilles d’un nœud à dossier vont dans _root.json', files.get('admin/_root.json'), {
  title: 'Admin',
});
eq('un tableau reste une feuille : il voyage dans le _root.json du parent', files.get('_root.json'), {
  faq: [{ q: 'Question', a: 'Réponse' }],
});

const joined = joinTree(files);
eq('aller-retour messages → atelier → messages', joined, sample);

for (const locale of ['fr', 'en', 'ar']) {
  const messages = JSON.parse(readFileSync(join(ROOT, 'messages', `${locale}.json`), 'utf8'));
  eq(`${locale} : l’aller-retour est fidèle sur les vrais messages`, joinTree(splitMessages(messages)), messages);
  const wanted = splitMessages(messages);
  const dirs = new Set(
    [...wanted.keys()]
      .filter((rel) => rel.includes('/'))
      .map((rel) => rel.slice(0, rel.lastIndexOf('/'))),
  );
  const alsoFile = [...dirs].filter((d) => wanted.has(`${d}.json`));
  ok(`${locale} : la règle ne produit jamais doublon fichier/dossier`, alsoFile.length === 0, alsoFile.join(', '));
}

// ---------------------------------------------------------------------------
// Les chemins et les namespaces
// ---------------------------------------------------------------------------
console.log('\n— un fichier, une branche des messages —');

const ns = (label, rel, want) => eq(label, namespaceForFile(rel), want);
ns('admin/newsletter.json → admin.newsletter', 'admin/newsletter.json', ['admin', 'newsletter']);
ns('admin/_root.json → admin', 'admin/_root.json', ['admin']);
ns('_root.json → la racine', ROOT_FILE, []);
ns('admin.json → admin', 'admin.json', ['admin']);
ns('un fichier sans extension n’est pas un namespace', 'admin/notes.txt', null);
ns('un nom vide non plus', '/.json', null);

// ---------------------------------------------------------------------------
// La propagation d’un enregistrement
// ---------------------------------------------------------------------------
console.log('\n— enregistrer depuis l’écran écrit aussi dans les messages —');

{
  const root = { admin: { title: 'Vieux titre', newsletter: { list: 'Liste' }, menu: { dashboard: 'Tableau' } } };
  applyNamespace(root, ['admin', 'newsletter'], { list: 'Liste des abonnés', empty: 'Aucun abonné' }, false);
  eq(
    'la branche est remplacée, ses voisines restent intactes',
    root,
    {
      admin: {
        title: 'Vieux titre',
        newsletter: { list: 'Liste des abonnés', empty: 'Aucun abonné' },
        menu: { dashboard: 'Tableau' },
      },
    },
  );
}

{
  const root = { admin: { title: 'Titre', ghost: 'Fantôme', newsletter: { list: 'Liste' } } };
  applyNamespace(root, ['admin'], { title: 'Admin', sousTitre: 'Sous-titre' }, true);
  eq(
    '_root.json remplace les feuilles et laisse les enfants-objets vivre',
    root,
    { admin: { newsletter: { list: 'Liste' }, title: 'Admin', sousTitre: 'Sous-titre' } },
  );
}

{
  const root = {};
  applyNamespace(root, ['pages', 'solutions'], { title: 'Solutions' }, false);
  eq('un namespace qui n’existait pas est créé avec ses parents', root, {
    pages: { solutions: { title: 'Solutions' } },
  });
}

// ---------------------------------------------------------------------------
// Le plan de synchronisation, sur un atelier de fortune
// ---------------------------------------------------------------------------
console.log('\n— planSync : ce qui manque, ce qui fâche —');

const sandbox = mkdtempSync(join(tmpdir(), 'intl-tree-'));
try {
  const tree = join(sandbox, 'translate', 'fr');
  mkdirSync(tree, { recursive: true });
  mkdirSync(join(sandbox, 'messages'), { recursive: true });
  const write = (rel, value) => {
    const full = join(tree, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, JSON.stringify(value, null, 2), 'utf8');
  };
  // Des messages absents doivent se signaler, pas vider l'atelier.

  let plan = planSync(sandbox, 'fr');
  ok('des messages absents se signalent au lieu de tout écraser', plan.missing === true);
  writeFileSync(join(sandbox, 'messages', 'fr.json'), JSON.stringify(sample, null, 2) + '\n', 'utf8');
  writeFileSync(join(sandbox, 'translate', 'fr.json'), 'pas du json', 'utf8'); // copie illisible = obsolète

  plan = planSync(sandbox, 'fr');
  ok('atelier vide : tout est à écrire', plan.toWrite.length === 6, `${plan.toWrite.length}`);
  ok('et la copie du site est déclarée obsolète', plan.runtimeStale === true);

  for (const [rel, value] of splitMessages(sample)) write(rel, value);
  writeFileSync(join(sandbox, 'translate', 'fr.json'), readFileSync(join(sandbox, 'messages', 'fr.json'), 'utf8'), 'utf8');
  plan = planSync(sandbox, 'fr');
  ok('atelier d’aplomb : rien à écrire', plan.toWrite.length === 0 && plan.clean === 6, `propres : ${plan.clean}`);
  ok('atelier d’aplomb : copie du site à jour', plan.runtimeStale === false);
  ok('aucun doublon signalé', plan.duplicates.length === 0, plan.duplicates.join(','));

  write('admin/newsletter.json', { list: 'Faux' });
  plan = planSync(sandbox, 'fr');
  ok('un fichier faussé revient dans la liste à réécrire', plan.toWrite.includes('admin/newsletter.json'));

  rmSync(join(tree, 'common', 'nav.json'));
  plan = planSync(sandbox, 'fr');
  ok('un fichier disparu revient dans la liste', plan.toWrite.includes('common/nav.json'));

  write('admin/fields/extra.json', { a: 1 });
  plan = planSync(sandbox, 'fr');
  ok('un fichier hors règle est signalé', plan.extra.includes('admin/fields/extra.json'), plan.extra.join(','));
  ok(
    'et rangé sous _legacy/, jamais supprimé',
    plan.toMove.some((m) => m.from === 'admin/fields/extra.json' && m.to === '_legacy/admin/fields/extra.json'),
    JSON.stringify(plan.toMove),
  );

  write('admin.json', { ancien: { monde: 1 } });
  plan = planSync(sandbox, 'fr');
  ok(
    'le doublon fichier/dossier est nommé',
    plan.duplicates.includes('admin'),
    `doublons : ${plan.duplicates.join(',') || 'aucun'}`,
  );

  const listed = listJsonFiles(tree).filter((rel) => !rel.startsWith('_legacy/'));
  ok('le listing des fichiers donne des chemins `/`', listed.every((rel) => !rel.includes('\\')), listed.slice(0, 3).join(','));

  eq('la règle ignore l’ordre des clés', sameContent({ a: 1, b: { c: 2 } }, { b: { c: 2 }, a: 1 }), true);
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}

console.log(`\n${failed ? '❌' : '✅'} ${done} assertion(s) ✅, ${failed} ❌`);
process.exit(failed ? 1 : 0);
