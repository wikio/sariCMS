import { CircleHelp, icons as lucideIcons, type LucideIcon } from 'lucide-react';

/** Convertit un nom PascalCase Lucide en kebab-case (ex. ArrowUpRight → arrow-up-right). */
export function toKebabCase(name: string): string {
  return String(name || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

export function toPascalCase(name: string): string {
  return String(name || '')
    .split(/[-_\s./]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/* Catalogue complet des icônes Lucide (indexées kebab-case + PascalCase). */
const ICON_MAP = new Map<string, LucideIcon>();
const ICON_NAMES: string[] = [];

for (const pascal of Object.keys(lucideIcons)) {
  const kebab = toKebabCase(pascal);
  const component = lucideIcons[pascal as keyof typeof lucideIcons] as unknown as LucideIcon;
  if (!ICON_MAP.has(kebab)) ICON_MAP.set(kebab, component);
  ICON_MAP.set(pascal, component);
  ICON_NAMES.push(kebab);
}

ICON_NAMES.sort();

export const LUCIDE_CATALOG = ICON_NAMES;

export function getLucideIcon(name?: string | null): LucideIcon {
  const raw = String(name || '').trim();
  if (!raw) return CircleHelp;
  return (
    ICON_MAP.get(raw) ||
    ICON_MAP.get(raw.toLowerCase()) ||
    ICON_MAP.get(toPascalCase(raw)) ||
    ICON_MAP.get(toKebabCase(raw)) ||
    CircleHelp
  );
}

export function searchLucideIcons(q: string, limit = 60): string[] {
  const needle = q.trim().toLowerCase();
  const list = needle ? ICON_NAMES.filter((name) => name.includes(needle)) : ICON_NAMES;
  return list.slice(0, limit);
}
