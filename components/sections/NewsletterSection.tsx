// components/sections/NewsletterSection.tsx
'use client';

/**
 * Bandeau d'abonnement de la page d'accueil.
 *
 * Les textes, les arguments affichés sous le champ, le consentement explicite
 * et le double opt-in se règlent dans le studio ; l'inscription est envoyée à
 * `/api/newsletter` et enregistrée côté serveur (voir `lib/newsletter-store.ts`
 * et le module `newsletter` de l'API), jamais dans le navigateur.
 */
import { useLocale, useTranslations } from 'next-intl';
import NewsletterSignup from '@/components/shared/NewsletterSignup';
import { getLucideIcon } from '@/lib/lucide-icons';
import { boolSetting, setting, txt, visibleItems, type HomeSectionConfig } from '@/lib/home/config';
import { BuilderBlock, ScopedStyle, isSectionVisible } from '@/components/sections/SectionFrame';
import { BACKGROUND_CLASS, styleVars } from '@/lib/home/config';

interface NewsletterSectionProps {
  config?: HomeSectionConfig;
  /** Point d'entrée enregistré avec l'adresse ; le bandeau de pied de page met `footer`. */
  source?: string;
  /** Version compacte (pied de page, barre latérale) sans bandeau ni arguments. */
  compact?: boolean;
}

export default function NewsletterSection({ config, source = 'home.newsletter', compact = false }: NewsletterSectionProps) {
  const locale = useLocale();
  const t = useTranslations('components.sections.NewsletterSection');
  if (!isSectionVisible(config)) return null;

  const style = config?.style || {};
  const showFeatures = compact ? false : setting(config, 'showFeatures', true);
  const requireConsent = boolSetting(config, 'requireConsent', false);
  const doubleOptIn = boolSetting(config, 'doubleOptIn', false);
  const topics = visibleItems(config)
    .filter((item) => String(item.kind ?? 'topic') === 'topic')
    .map((item) => ({ id: String(item.id), label: String(item.label ?? item.title ?? '') }))
    .filter((topic) => topic.label);
  const features = visibleItems(config)
    .filter((item) => String(item.kind ?? '') === 'argument')
    .map((item) => ({ icon: String(item.icon ?? 'mail-check'), title: String(item.title ?? ''), desc: String(item.description ?? '') }));

  const form = (
    <NewsletterSignup
      source={source}
      variant={compact ? 'card' : 'band'}
      requireConsent={requireConsent}
      doubleOptIn={doubleOptIn}
      topics={topics.length ? topics : []}
      labels={{
        title: txt(config, 'title', compact ? '' : t('title')),
        description: txt(config, 'description', compact ? '' : t('description')),
        placeholder: txt(config, 'placeholder', t('placeholder')),
        submit: txt(config, 'submit', t('subscribe')),
        legal: txt(config, 'legal', t('legalText')),
        successTitle: txt(config, 'successTitle', t('successTitle')),
        successDesc: txt(config, 'successDesc', t('successDesc')),
      }}
    />
  );

  if (compact) return <div id="home-newsletter-compact">{form}</div>;

  return (
    <BuilderBlock config={config} sectionKey="newsletter">
      <section
        id="home-newsletter"
        className={`relative overflow-hidden ${BACKGROUND_CLASS[style.background || 'blue'] || 'bg-sari-blue'}`}
        style={{
          ...styleVars(config),
          paddingTop: `${style.paddingY ?? 96}px`,
          paddingBottom: `${style.paddingY ?? 96}px`,
          ...(style.backgroundImage
            ? { backgroundImage: `url("${style.backgroundImage}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : {}),
        }}
      >
        <ScopedStyle sectionKey="newsletter" config={config} />
        <div className="absolute inset-0 grid-pattern-bg opacity-10" />
        <div className="absolute top-0 left-0 w-96 h-96 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full translate-x-1/2 translate-y-1/2" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <span className="text-sari-lime font-bold uppercase tracking-wider text-sm">
              {txt(config, 'subtitle', t('subtitle'))}
            </span>
            {form}
            {showFeatures && features.length ? (
              <div className="grid md:grid-cols-3 gap-6 mt-16">
                {features.map((feature, i) => {
                  const Icon = getLucideIcon(feature.icon);
                  return (
                    <div key={i} className="text-center">
                      <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Icon className="w-8 h-8 text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                      <p className="text-blue-100 text-sm">{feature.desc}</p>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </BuilderBlock>
  );
}
