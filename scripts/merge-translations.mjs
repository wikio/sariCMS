// Copies de runtime ignorées par Git. Les fichiers de l’atelier versionné restent
// contrôlés par intl:check ; ne pas les « réparer » silencieusement au build.
import { copyFileSync, mkdirSync } from 'node:fs';
const root = new URL('../', import.meta.url);
mkdirSync(new URL('translate/', root), { recursive: true });
for (const locale of ['fr', 'en', 'ar']) {
  copyFileSync(new URL(`messages/${locale}.json`, root), new URL(`translate/${locale}.json`, root));
}
