'use client';

/**
 * Masques de saisie par type de champ (formatage au fil de la frappe).
 * Utilisés dans les formulaires de paiement et partout où un champ
 * nécessite un format structuré.
 */

/** Numéro de carte : chiffres uniquement, groupes de 4 (max 16). */
export function maskCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

/** Derniers 4 chiffres d'un numéro de carte (stockés, le reste est masqué). */
export function cardLast4(value: string): string {
  return value.replace(/\D/g, '').slice(-4);
}

/** Affichage masqué d'une carte : « **** **** **** 1234 ». */
export function maskCardDisplay(last4?: string): string {
  const l4 = (last4 || '').replace(/\D/g, '').slice(-4);
  return `**** **** **** ${l4}`.trim();
}

/** Date d'expiration : MM/AA. */
export function maskExpiry(value: string): string {
  let d = value.replace(/\D/g, '').slice(0, 4);
  if (d.length > 2) d = `${d.slice(0, 2)}/${d.slice(2)}`;
  return d;
}

/** CVV : chiffres uniquement, max 4. */
export function maskCvv(value: string): string {
  return value.replace(/\D/g, '').slice(0, 4);
}

/** Téléphone : chiffres, +, espaces et tirets ; longueur raisonnable. */
export function maskPhone(value: string): string {
  return value.replace(/[^\d+\s().-]/g, '').slice(0, 24);
}

/** Montant / nombre : chiffres avec séparateur décimal (point ou virgule). */
export function maskAmount(value: string): string {
  return value.replace(/[^\d.,]/g, '').slice(0, 14);
}

/** Entier strict (quantités, codes postaux…). */
export function maskInteger(value: string): string {
  return value.replace(/\D/g, '');
}

/** IBAN : groupes de 4 (réutilise le formatage existant). */
export function maskIban(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim();
}

/** RIB algérien : 003 99999 00000000000 12. */
export function maskRib(value: string): string {
  return value.replace(/\D/g, '').replace(/(\d{3})(\d{5})(\d{11})(\d{2})/, '$1 $2 $3 $4');
}
