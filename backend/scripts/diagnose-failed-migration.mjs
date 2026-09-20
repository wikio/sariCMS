/**
 * backend/scripts/diagnose-failed-migration.mjs — diagnostic de l'erreur P3009.
 *
 * `prisma migrate deploy` refuse d'avancer dès qu'une ligne de
 * `_prisma_migrations` est marquée échouée :
 *
 *   Error: P3009
 *   migrate found failed migrations in the target database, new migrations
 *   will not be applied.
 *
 * La sortie de Prisma ne dit pas *pourquoi* la migration a échoué, ni si ses
 * objets existent déjà. Or c'est exactement ce qui détermine la commande de
 * réparation : `--applied` si le schéma est déjà à jour, `--rolled-back` si
 * rien n'a été écrit, réparation manuelle si l'état est partiel. MySQL ne
 * rend pas le DDL transactionnel, donc l'état partiel est un cas réel.
 *
 * Ce script est **en lecture seule** : il ne modifie ni la base ni
 * `_prisma_migrations`. Il imprime la commande à lancer, vous gardez la main.
 *
 * Usage :
 *   cd backend
 *   node scripts/diagnose-failed-migration.mjs                 # toutes les migrations échouées
 *   node scripts/diagnose-failed-migration.mjs 20260907_add_newsletter_unsubscribe_reason
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE_BACKEND = join(ICI, '..');

/* -------------------------------------------------------------------------- */
/*  Lecture du SQL d'une migration                                            */
/* -------------------------------------------------------------------------- */

/**
 * Extrait d'un fichier `migration.sql` les objets qu'il est censé créer.
 *
 * On ne cherche pas un analyseur SQL complet : les migrations de ce dépôt sont
 * écrites à la main et suivent trois formes, toujours avec des identifiants
 * entre backticks. C'est volontairement tolérant — un objet non reconnu est
 * simplement ignoré, jamais deviné.
 */
export function extraireObjets(sql) {
  const colonnes = [];
  const index = [];
  const tables = [];

  // CREATE TABLE `x`
  for (const m of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`([^`]+)`/gi)) {
    tables.push(m[1]);
  }

  // ALTER TABLE `x` ... ADD COLUMN `y`  (plusieurs ADD COLUMN par ALTER)
  for (const m of sql.matchAll(/ALTER\s+TABLE\s+`([^`]+)`([\s\S]*?);/gi)) {
    const table = m[1];
    const corps = m[2];
    for (const c of corps.matchAll(/ADD\s+COLUMN\s+`([^`]+)`/gi)) {
      colonnes.push({ table, colonne: c[1] });
    }
  }

  // CREATE INDEX `i` ON `t`  /  CREATE UNIQUE INDEX
  for (const m of sql.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+`([^`]+)`\s+ON\s+`([^`]+)`/gi)) {
    index.push({ table: m[2], index: m[1] });
  }

  return { tables, colonnes, index };
}

/* -------------------------------------------------------------------------- */
/*  Décision                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Décide de la réparation à partir de ce qui manque réellement en base.
 *
 * Fonction pure : c'est la partie qui peut se tromper, elle est donc testée
 * séparément (scripts/test-diagnose-migration.mjs).
 *
 * @param {{tables:string[], colonnes:Array, index:Array}} attendus  objets déclarés par le SQL
 * @param {{tables:Set<string>, colonnes:Set<string>, index:Set<string>}} presents  objets vus en base
 * @returns {{action:'applied'|'rolled-back'|'manuel', raison:string, manquants:string[]}}
 */
export function decider(attendus, presents) {
  const manquants = [];

  for (const t of attendus.tables) {
    if (!presents.tables.has(t)) manquants.push(`TABLE ${t}`);
  }
  for (const { table, colonne } of attendus.colonnes) {
    if (!presents.colonnes.has(`${table}.${colonne}`)) manquants.push(`COLONNE ${table}.${colonne}`);
  }
  for (const { table, index } of attendus.index) {
    if (!presents.index.has(`${table}.${index}`)) manquants.push(`INDEX ${table}.${index}`);
  }

  const totalAttendu = attendus.tables.length + attendus.colonnes.length + attendus.index.length;

  if (totalAttendu === 0) {
    return {
      action: 'manuel',
      raison:
        "Le SQL de cette migration ne crée aucun objet reconnu (table, colonne ou index). " +
        "Le script ne peut donc rien constater : lisez la colonne `logs` de _prisma_migrations.",
      manquants: [],
    };
  }

  if (manquants.length === 0) {
    return {
      action: 'applied',
      raison:
        `Les ${totalAttendu} objet(s) attendus existent tous en base. La migration a en fait ` +
        "produit son effet ; seule la ligne de suivi est restée marquée échouée.",
      manquants: [],
    };
  }

  if (manquants.length === totalAttendu) {
    return {
      action: 'rolled-back',
      raison:
        `Aucun des ${totalAttendu} objet(s) attendus n'existe. Rien n'a été écrit : la migration ` +
        "peut être rejouée proprement.",
      manquants,
    };
  }

  return {
    action: 'manuel',
    raison:
      `État partiel : ${totalAttendu - manquants.length} objet(s) sur ${totalAttendu} existent. ` +
      "MySQL n'a pas de DDL transactionnel, l'ALTER a donc pu passer pendant que la suite échouait. " +
      "Complétez ce qui manque à la main, puis déclarez la migration appliquée. Ne relancez pas " +
      "l'ALTER complet : il échouerait sur les objets déjà présents.",
    manquants,
  };
}

/* -------------------------------------------------------------------------- */
/*  Accès base                                                                */
/* -------------------------------------------------------------------------- */

async function main() {
  const filtre = process.argv[2];

  let PrismaClient;
  try {
    ({ PrismaClient } = await import('@prisma/client'));
  } catch (err) {
    throw new Error(
      `@prisma/client n'est pas utilisable (${err.message}). ` +
      "Lancez d'abord `npx prisma generate` depuis backend/.",
    );
  }

  // Le constructeur lève « did not initialize yet » quand le client n'a pas été
  // généré : l'import réussit, l'instanciation non.
  let prisma;
  try {
    prisma = new PrismaClient();
  } catch (err) {
    if (/did not initialize yet/i.test(err.message)) {
      throw new Error("Le client Prisma n'est pas généré. Lancez `npx prisma generate` depuis backend/.");
    }
    throw err;
  }

  try {
    let db;
    try {
      db = await prisma.$queryRawUnsafe('SELECT DATABASE() AS d');
    } catch (err) {
      // Message brut de Prisma peu parlant dans les deux cas les plus courants :
      // client non généré, ou base injoignable.
      if (/did not initialize yet/i.test(err.message)) {
        throw new Error("Le client Prisma n'est pas généré. Lancez `npx prisma generate` depuis backend/.");
      }
      throw new Error(`Base injoignable — vérifiez DATABASE_URL dans backend/.env. (${err.message})`);
    }
    const schema = db[0]?.d;
    if (!schema) throw new Error("DATABASE() n'a pas renvoyé de schéma — vérifiez DATABASE_URL.");

    let echouees = await prisma.$queryRawUnsafe(
      `SELECT migration_name, started_at, finished_at, rolled_back_at, logs
         FROM _prisma_migrations
        WHERE finished_at IS NULL AND rolled_back_at IS NULL
        ORDER BY started_at`,
    );
    if (filtre) echouees = echouees.filter((r) => r.migration_name === filtre);

    if (echouees.length === 0) {
      console.log(filtre
        ? `Aucune ligne échouée pour « ${filtre} ».`
        : 'Aucune migration échouée : `prisma migrate deploy` devrait passer.');
      return;
    }

    console.log(`Base : ${schema}`);
    console.log(`${echouees.length} migration(s) marquée(s) échouée(s).\n`);

    for (const ligne of echouees) {
      const nom = ligne.migration_name;
      console.log('='.repeat(72));
      console.log(nom);
      console.log('='.repeat(72));
      if (ligne.logs) {
        console.log('\nErreur enregistrée par Prisma :');
        console.log(String(ligne.logs).trim());
      }

      const fichier = join(RACINE_BACKEND, 'prisma', 'migrations', nom, 'migration.sql');
      let sql;
      try {
        sql = readFileSync(fichier, 'utf8');
      } catch {
        console.log(`\n! ${fichier} introuvable — diagnostic SQL impossible.`);
        continue;
      }

      const attendus = extraireObjets(sql);
      const presents = { tables: new Set(), colonnes: new Set(), index: new Set() };

      for (const t of attendus.tables) {
        const r = await prisma.$queryRawUnsafe(
          `SELECT COUNT(*) AS n FROM information_schema.tables
            WHERE table_schema = ? AND table_name = ?`, schema, t);
        if (Number(r[0].n) > 0) presents.tables.add(t);
      }
      for (const { table, colonne } of attendus.colonnes) {
        const r = await prisma.$queryRawUnsafe(
          `SELECT COUNT(*) AS n FROM information_schema.columns
            WHERE table_schema = ? AND table_name = ? AND column_name = ?`, schema, table, colonne);
        if (Number(r[0].n) > 0) presents.colonnes.add(`${table}.${colonne}`);
      }
      for (const { table, index } of attendus.index) {
        const r = await prisma.$queryRawUnsafe(
          `SELECT COUNT(*) AS n FROM information_schema.statistics
            WHERE table_schema = ? AND table_name = ? AND index_name = ?`, schema, table, index);
        if (Number(r[0].n) > 0) presents.index.add(`${table}.${index}`);
      }

      const decision = decider(attendus, presents);

      console.log('\nConstat :');
      const fmt = (ok) => (ok ? 'présent' : 'MANQUANT');
      for (const t of attendus.tables) console.log(`  table  ${t} : ${fmt(presents.tables.has(t))}`);
      for (const { table, colonne } of attendus.colonnes) {
        console.log(`  colonne ${table}.${colonne} : ${fmt(presents.colonnes.has(`${table}.${colonne}`))}`);
      }
      for (const { table, index } of attendus.index) {
        console.log(`  index  ${table}.${index} : ${fmt(presents.index.has(`${table}.${index}`))}`);
      }

      console.log(`\nDiagnostic : ${decision.raison}`);

      console.log('\nCommande à lancer :');
      if (decision.action === 'applied') {
        console.log(`  npx prisma migrate resolve --applied ${nom}`);
        console.log('  npx prisma migrate deploy');
      } else if (decision.action === 'rolled-back') {
        console.log(`  npx prisma migrate resolve --rolled-back ${nom}`);
        console.log('  npx prisma migrate deploy');
      } else {
        if (decision.manquants.length) {
          console.log('  1) créer ce qui manque :');
          for (const m of decision.manquants) console.log(`       - ${m}`);
        } else {
          console.log('  1) lire l’erreur ci-dessus, le script n’a pas d’objet à comparer');
        }
        console.log(`  2) npx prisma migrate resolve --applied ${nom}`);
        console.log('  3) npx prisma migrate deploy');
      }
      console.log('');
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuté seulement en lancement direct, pas à l'import (les tests importent
// `extraireObjets` et `decider` sans vouloir ouvrir de connexion).
const lanceDirectement = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (lanceDirectement) {
  main().catch((err) => {
    console.error('\nÉchec du diagnostic :', err.message);
    process.exit(1);
  });
}
