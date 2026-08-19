import type { LucideIcon } from 'lucide-react';
import * as Lucide from 'lucide-react';

export const LUCIDE_CATALOG = [
  'activity', 'airplay', 'alarm-clock', 'ambulance', 'archive', 'award', 'banknote',
  'barcode', 'bell', 'book-open', 'box', 'briefcase', 'building-2', 'calendar',
  'camera', 'check', 'check-circle', 'clipboard', 'clock', 'cloud', 'compass',
  'cpu', 'credit-card', 'database', 'download', 'droplet', 'eye', 'file-text',
  'filter', 'flag', 'flask-conical', 'folder', 'globe', 'graduation-cap', 'grip-vertical',
  'hammer', 'hand-heart', 'handshake', 'hard-hat', 'headphones', 'heart', 'heart-pulse',
  'help-circle', 'home', 'hospital', 'image', 'inbox', 'info', 'key', 'layers',
  'layout-dashboard', 'life-buoy', 'link', 'list', 'lock', 'mail', 'map-pin',
  'megaphone', 'menu', 'message-circle', 'microscope', 'monitor', 'newspaper',
  'package', 'paperclip', 'pen', 'phone', 'pill', 'play', 'plus', 'printer',
  'radio', 'receipt', 'refresh-cw', 'save', 'scale', 'search', 'send', 'settings',
  'share-2', 'shield', 'shopping-bag', 'shopping-cart', 'sparkles', 'star',
  'stethoscope', 'sun', 'syringe', 'table', 'tag', 'target', 'thermometer',
  'thumbs-up', 'trash-2', 'truck', 'upload', 'user', 'users', 'video', 'wallet',
  'warehouse', 'wifi', 'wrench', 'zap',
];

export function toPascalCase(name: string) {
  return String(name || '')
    .split(/[-_\s./]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

export function getLucideIcon(name?: string | null): LucideIcon {
  const key = toPascalCase(name || '');
  const pack = Lucide as unknown as Record<string, LucideIcon>;
  return pack[key] || Lucide.HelpCircle;
}

export function searchLucideIcons(q: string, limit = 40) {
  const needle = q.trim().toLowerCase();
  const list = needle
    ? LUCIDE_CATALOG.filter((name) => name.includes(needle) || toPascalCase(name).toLowerCase().includes(needle))
    : LUCIDE_CATALOG;
  return list.slice(0, limit);
}
