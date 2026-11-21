/** Montant des prix historiques du catalogue (sans conversion de devise).
 * « 2 450 € HT », « €2,450 excl. VAT » et « ٢٬٤٥٠ » désignent le même prix.
 * Les groupes de trois chiffres sont des milliers ; les nombres SQL restent numériques.
 */
export function catalogPrice(value: number | string): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = String(value)
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x660))
    .replace(/٫/g, '.').replace(/٬/g, ',')
    .match(/-?\d+(?:[.,\s]+\d+)*/)?.[0].replace(/\s/g, '') ?? '';
  if (/^-?\d{1,3}([.,])\d{3}(?:\1\d{3})*$/.test(text)) return Number(text.replace(/[.,]/g, ''));
  const last = Math.max(text.lastIndexOf(','), text.lastIndexOf('.'));
  const normalized = last < 0 ? text : `${text.slice(0, last).replace(/[.,]/g, '')}.${text.slice(last + 1)}`;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}
