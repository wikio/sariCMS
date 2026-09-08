#!/usr/bin/env node
// scripts/intl-sync.mjs
/**
 * Met l'atelier de traduction (`translate/<locale>/`) et le fichier que lit le site
 * (`translate/<locale>.json`) d'aplomb avec `messages/<locale>.json`.
 *
 * Trois endroits prétendaient détenir les chaînes de l'interface, et ils n'étaient
 * pas d'accord : voir `lib/intl-tree.mjs` pour la règle de découpage et le détail
 * du désordre. En résumé, depuis ce lot : `messages/` reste la source committée,
 * l'atelier en est la copie rangée par écran, `translate/<locale>.json` la copie que
 * le site charge — et l'écran « Traductions » écrit dans les trois à chaque
 * enregistrement. Ce script sert donc quand `messages/` a bougé à la main (un ajout
 * de clés, un `git pull`), et en vérification avant une mise en ligne.
 *
 *   node scripts/intl-sync.mjs            # écrit
 *   node scripts/intl-sync.mjs --check    # ne touche à rien, sortie 1 si ça diverge
 *   node scripts/intl-sync.mjs --locale en
 *
 * Les fichiers que la règle ne produit pas restent en place : le dépôt traîne un
 * corpus hérité de l'ancien site (1 644 clés dans `translate/fr/admin.json` —
 * `admin.menu`, `admin.login`, `admin.dataManager`… que `messages/` ignore), et le
 * supprimer serait effacer du texte sans que personne ne l'ait décidé.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEGACY_DIR, ROOT_FILE, planSync } from '../lib/intl-tree.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES = ['fr', 'en', 'ar'];
const CHECK = process.argv.includes('--check');
const argOf = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : null;
};
const ONLY = argOf('locale');
/** Un objet écrit comme le reste de l'atelier : deux espaces, pas de saut de ligne final. */
const dump = (value) => JSON.stringify(value, null, 2);

let diverge = 0;

for (const locale of ONLY ? [ONLY] : LOCALES) {
  const plan = planSync(ROOT, locale);

  if (plan.missing) {
    console.log(`\n${locale} — ⚠️  messages/${locale}.json introuvable, rien à reprendre.`);
    diverge += 1;
    continue;
  }

  for (const rel of plan.toWrite) {
    const full = join(plan.treeDir, rel);
    if (!CHECK) {
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, dump(plan.wanted.get(rel)), 'utf8');
    }
  }
  for (const move of plan.toMove) {
    if (CHECK) continue;
    const dst = join(plan.treeDir, move.to);
    mkdirSync(dirname(dst), { recursive: true });
    renameSync(join(plan.treeDir, move.from), dst);
  }
  if (!CHECK && plan.runtimeStale) {
    // Le fichier du site est une copie conforme des messages, au bit près : c'est ce
    // que `i18n/request.ts` charge, et ce que l'écran « Traductions » rafraîchit après
    // chaque enregistrement. Aucune concaténation à lancer ensuite.
    writeFileSync(plan.runtimeFile, readFileSync(plan.messagesFile, 'utf8'), 'utf8');
  }

  const bits = [];
  if (plan.toWrite.length) bits.push(`${plan.toWrite.length} fichier${plan.toWrite.length === 1 ? '' : 's'} ${CHECK ? 'à réécrire' : 'réécrit' + (plan.toWrite.length === 1 ? '' : 's')}`);
  if (plan.runtimeStale) bits.push(`translate/${locale}.json ${CHECK ? 'obsolète' : 'rafraîchi'}`);
  if (!bits.length) bits.push(`déjà d'aplomb — ${plan.clean} fichiers`);
  console.log(`\n${locale} — ${bits.join(', ')}`);
  for (const f of plan.toWrite.slice(0, 14)) console.log(`   ~ ${f}`);
  if (plan.toWrite.length > 14) console.log(`   … ${plan.toWrite.length - 14} autres`);
  if (plan.toMove.length) {
    console.log(
      `   → ${plan.toMove.length} vestige(s) hors règle rangé(s) sous ${LEGACY_DIR}/ (${plan.toMove
        .slice(0, 3)
        .map((m) => m.from)
        .join(', ')}${plan.toMove.length > 3 ? '…' : ''}) — rien n'est supprimé, ils ne font plus de l'ombre aux dossiers`,
    );
  }
  if (plan.duplicates.length) {
    console.log(
      `   ! namespace en double exemplaire : ${plan.duplicates.join(', ')} — le fichier plat côtoie le dossier.`,
    );
    console.log(
      `     Enregistrer le plat écraserait le namespace entier : l'API le refuse. Éditez les` +
        ` fichiers du dossier « ${plan.duplicates[0]}/ »` +
        ` (les feuilles du nœud sont dans « ${plan.duplicates[0]}/${ROOT_FILE} »).`,
    );
  }
  if (plan.toWrite.length || plan.runtimeStale || plan.toMove.length) diverge += 1;
}

console.log(
  CHECK
    ? diverge
      ? "\n⚠️  L'atelier est en retard sur les messages : « npm run intl:sync » le remet d'aplomb."
      : "\n✅ translate/ est d'aplomb avec messages/, les trois langues."
    : diverge
      ? "\n✅ Atelier remis d'aplomb, fichier du site avec."
      : '\n✅ Rien à faire.',
);
process.exit(CHECK && diverge ? 1 : 0);
