/**
 * common/schedule/cron-expression.ts — validation d'une expression crontab.
 *
 * L'écran d'administration laisse saisir la planification des purges. Une
 * expression invalide ne se plaint pas à la saisie : `@nestjs/schedule` lève au
 * démarrage, quand plus personne ne regarde. On refuse donc en amont.
 *
 * Grammaire acceptée, cinq champs séparés par des espaces :
 *   minute heure jour mois jour-de-semaine
 * Chaque champ accepte `*`, une valeur, un intervalle `a-b`, un pas `*\/n` ou
 * `a-b/n`, et une liste de ces formes séparée par virgules. Les mois et jours de
 * semaine acceptent aussi leurs noms anglais abrégés.
 *
 * Logique pure : aucun import Nest.
 */

/** Bornes de chaque champ, dans l'ordre crontab. */
const FIELD_BOUNDS: ReadonlyArray<readonly [number, number]> = [
  [0, 59], // minute
  [0, 23], // heure
  [1, 31], // jour du mois
  [1, 12], // mois
  [0, 7], // jour de semaine — 0 et 7 valent dimanche
];

const MONTH_NAMES: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

const DOW_NAMES: Record<string, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};

/** Traduit un nom abrégé en nombre, selon le champ. */
function nameToNumber(token: string, fieldIndex: number): number | null {
  const upper = token.toUpperCase();
  const table = fieldIndex === 3 ? MONTH_NAMES : fieldIndex === 4 ? DOW_NAMES : null;
  const hit = table?.[upper];
  return hit === undefined ? null : hit;
}

/** Une valeur nue : entier, ou nom abrégé pour le mois et le jour de semaine. */
function parseValue(token: string, fieldIndex: number): number | null {
  if (!/^\d+$/.test(token)) return nameToNumber(token, fieldIndex);
  return Number(token);
}

function validField(field: string, fieldIndex: number): boolean {
  const [min, max] = FIELD_BOUNDS[fieldIndex];

  for (const part of field.split(',')) {
    if (!part) return false;
    const [rangePart, stepPart] = part.split('/');
    if (!rangePart) return false;
    // Un pas doit être un entier strictement positif.
    if (stepPart !== undefined && (!/^\d+$/.test(stepPart) || Number(stepPart) === 0)) return false;
    if (part.split('/').length > 2) return false;

    if (rangePart === '*') continue;

    const bounds = rangePart.split('-');
    if (bounds.length > 2) return false;
    for (const bound of bounds) {
      const value = parseValue(bound, fieldIndex);
      if (value === null || value < min || value > max) return false;
    }
    if (bounds.length === 2) {
      const from = parseValue(bounds[0], fieldIndex)!;
      const to = parseValue(bounds[1], fieldIndex)!;
      if (from > to) return false;
    }
    // Un pas sans intervalle ni étoile n'a pas de sens (`5/10`).
    if (stepPart !== undefined && bounds.length === 1) return false;
  }
  return true;
}

/** L'expression est-elle une crontab à cinq champs que le planificateur accepte ? */
export function isValidCron(expression: string): boolean {
  if (typeof expression !== 'string') return false;
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== FIELD_BOUNDS.length) return false;
  return fields.every((field, index) => validField(field, index));
}
