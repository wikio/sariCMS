/**
 * Outils de mot de passe partagés par le back-office.
 *
 * Les règles reproduisent exactement celles du serveur
 * (`backend/src/modules/users/dto/user.dto.ts`) : 10 caractères minimum,
 * au moins une majuscule, une minuscule et un chiffre. Les vérifier côté
 * navigateur évite un aller-retour pour se voir refuser l'enregistrement
 * avec un message d'erreur technique en anglais.
 */

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

export interface PasswordRule {
  /** Identifiant stable, sert de clé de traduction. */
  key: 'length' | 'upper' | 'lower' | 'digit';
  ok: boolean;
}

export interface PasswordCheck {
  rules: PasswordRule[];
  /** Toutes les règles obligatoires sont satisfaites. */
  valid: boolean;
  /** 0 à 4 : longueur, casses, chiffre, puis bonus caractère spécial/longueur. */
  score: number;
  /** Étiquette de robustesse déduite du score. */
  level: 'empty' | 'weak' | 'medium' | 'strong';
}

/** Analyse un mot de passe : règles obligatoires + estimation de robustesse. */
export function checkPassword(value: string): PasswordCheck {
  const v = String(value || '');
  const rules: PasswordRule[] = [
    { key: 'length', ok: v.length >= PASSWORD_MIN && v.length <= PASSWORD_MAX },
    { key: 'upper', ok: /[A-Z]/.test(v) },
    { key: 'lower', ok: /[a-z]/.test(v) },
    { key: 'digit', ok: /[0-9]/.test(v) },
  ];
  const valid = rules.every((r) => r.ok);

  if (!v) return { rules, valid: false, score: 0, level: 'empty' };

  let score = rules.filter((r) => r.ok).length;
  // Bonus : caractère spécial et longueur confortable relèvent la robustesse
  // sans être exigés par le serveur.
  if (/[^A-Za-z0-9]/.test(v)) score += 1;
  if (v.length >= 16) score += 1;
  score = Math.min(score, 6);

  const level: PasswordCheck['level'] = !valid ? 'weak' : score >= 6 ? 'strong' : 'medium';
  return { rules, valid, score, level };
}

// Alphabets sans caractères ambigus (0/O, 1/l/I) : un mot de passe temporaire
// est souvent recopié à la main ou dicté au téléphone.
const MAJ = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MIN = 'abcdefghijkmnopqrstuvwxyz';
const CHIFFRES = '23456789';
const SPECIAUX = '!@#$%*-_=+?';

/** Entier aléatoire cryptographique dans [0, max). */
function alea(max: number): number {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    // Rejet des valeurs qui fausseraient la répartition (modulo bias).
    const limite = Math.floor(0xffffffff / max) * max;
    let v = 0;
    do {
      globalThis.crypto.getRandomValues(buf);
      v = buf[0];
    } while (v >= limite);
    return v % max;
  }
  return Math.floor(Math.random() * max);
}

/**
 * Génère un mot de passe conforme aux règles du serveur.
 *
 * La composition est imposée (au moins une majuscule, une minuscule, un
 * chiffre et un spécial) puis mélangée : tirer au hasard dans l'alphabet
 * complet produit parfois une chaîne sans chiffre, refusée à l'envoi.
 */
export function generatePassword(length = 14): string {
  const taille = Math.max(PASSWORD_MIN, Math.min(length, 32));
  const base = [
    MAJ[alea(MAJ.length)],
    MIN[alea(MIN.length)],
    CHIFFRES[alea(CHIFFRES.length)],
    SPECIAUX[alea(SPECIAUX.length)],
  ];
  const tout = MAJ + MIN + CHIFFRES + SPECIAUX;
  while (base.length < taille) base.push(tout[alea(tout.length)]);

  // Mélange de Fisher-Yates : sans lui, les quatre premiers caractères
  // suivraient toujours le même ordre majuscule/minuscule/chiffre/spécial.
  for (let i = base.length - 1; i > 0; i--) {
    const j = alea(i + 1);
    [base[i], base[j]] = [base[j], base[i]];
  }
  return base.join('');
}
