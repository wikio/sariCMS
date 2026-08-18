// lib/slugify.ts

export function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD') // Sépare les accents des caractères (ex: é -> e + ́)
    .replace(/[\u0300-\u036f]/g, '') // Supprime les marques diacritiques (accents)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Remplace les espaces par des tirets
    // ✅ AJOUT : Remplace / et \ par des tirets
    .replace(/[\\/]/g, '-') 
    .replace(/[^\p{L}\p{N}\-]/gu, '') // Supprime les autres caractères spéciaux
    .replace(/\-\-+/g, '-') // Remplace les tirets multiples par un seul
    .replace(/^-+/, '') // Supprime les tirets au début
    .replace(/-+$/, ''); // Supprime les tirets à la fin
}

export function buildSlugUrl(basePath: string, id: number | string, title: string): string {
  return `${basePath}/${id}-${slugify(title)}`;
}

export function extractIdFromSlug(paramValue: string): string {
  // Récupère la première partie avant le premier tiret (l'ID)
  return paramValue.split('-')[0];
}

export function extractSlugFromSlug(paramValue: string): string {
  // Récupère tout ce qui suit le premier tiret (le slug)
  return paramValue.split('-').slice(1).join('-');
}