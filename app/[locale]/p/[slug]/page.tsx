// app/[locale]/p/[slug]/page.tsx
/**
 * Une page construite dans l'administration, servie sans coque de site.
 *
 * `/{langue}/p/{slug}` : le contenu vient du module Pages CMS (fiche de type
 * « Constructeur »), et `SiteWrapper` reconnaît ce chemin et n'affiche ni bandeau
 * de navigation ni pied de page. Le reste du site suit son cours normal — la page
 * n'est pas une enclave à part, c'est une page du même site, sans menu autour.
 *
 * Le rendu est ISR : la page est régénérée à la demande et garde soixante
 * secondes de vie, le délai ordinaire du cache des données du site. Une page en
 * brouillon n'est pas servie (la liste publique ne la renvoie pas) : `notFound()`
 * plutôt qu'une coquille vide.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getConstructorPage } from '@/lib/data';
import { sanitizeBuilderHtml } from '@/lib/home/config';
import { isRtl, locales, type Locale } from '@/lib/i18n';
import BuiltPage from '@/components/builder/BuiltPage';

export const revalidate = 60;

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

async function load(params: Props['params']) {
  const { locale, slug } = await params;
  if (!locales.includes(locale as Locale)) notFound();
  const page = await getConstructorPage(locale, slug);
  return { locale, page };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, page } = await load(params);
  if (!page) return { title: 'Page introuvable | SARI Système', robots: 'noindex' };
  const t = await getTranslations({ locale, namespace: 'common.nav' });
  return {
    // Le gabarit du titre du site ajoute déjà « | SARI Système » : le reprendre ici
    // le doublait dans l'onglet et dans le résultat de recherche.
    title: page.title || t('home'),
    description: page.subtitle || undefined,
    // Une page de campagne n'a rien à faire dans un index de recherche : elle a
    // son URL courte et son propre canal d'entrée.
    robots: 'noindex, follow',
    openGraph: {
      title: page.title,
      description: page.subtitle || undefined,
      images: page.media ? [{ url: page.media }] : undefined,
      locale,
      type: 'website',
    },
  };
}

export default async function StandaloneBuiltPage({ params }: Props) {
  const { locale, page } = await load(params);
  if (!page) notFound();
  // Le nettoyage est fait ici, avant que la fiche ne passe au composant client :
  // le chargement React traverse la page sous forme de données en clair, et le HTML
  // d'une page construite ne doit y figurer qu'assaini. `BuiltPage` recommence — le
  // filet est idempotent, et le composant peut être employé seul (aperçu).
  const built = { ...page, html: sanitizeBuilderHtml(page.html), css: page.css };
  return (
    <main lang={locale} dir={isRtl(locale) ? 'rtl' : 'ltr'}>
      <BuiltPage page={built} />
    </main>
  );
}
