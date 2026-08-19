export interface AdminSettings {
  defaultLocale: 'fr' | 'en' | 'ar';
  skuFormat: string;
  cropWidth: number;
  cropHeight: number;
}

const KEY = 'sari_admin_settings';

export const DEFAULT_SETTINGS: AdminSettings = {
  defaultLocale: 'fr',
  skuFormat: 'PRO-{ID}',
  cropWidth: 800,
  cropHeight: 600,
};

export function loadAdminSettings(): AdminSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveAdminSettings(next: AdminSettings) {
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function nextSku(format = loadAdminSettings().skuFormat): string {
  const n = Number(typeof window !== 'undefined' ? localStorage.getItem('sari_sku_seq') : 0) + 1;
  if (typeof window !== 'undefined') localStorage.setItem('sari_sku_seq', String(n));
  return format.replace('{ID}', String(n).padStart(5, '0'));
}
