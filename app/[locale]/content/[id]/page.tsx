// app/[locale]/content/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, FileText, Download, Play, Image as ImageIcon } from 'lucide-react';
import { getGenericContent } from '@/lib/data';
import { matchesEntity } from '@/lib/ids';
import type { GenericContent } from '@/types';
import Breadcrumb from '@/components/ui/Breadcrumb';
import CTAButton from '@/components/ui/CTAButton';

export default function GenericContentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const locale = useLocale();
  const t = useTranslations('pages.genericContent');
  const isRtl = locale === 'ar';

  const [content, setContent] = useState<GenericContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentScrollIndex, setCurrentScrollIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      const data = await getGenericContent(locale);
      const found = data.find((c) => matchesEntity(c, id));
      setContent(found || null);
      setLoading(false);
    };
    loadContent();
  }, [id, locale]);

  useEffect(() => {
    setCurrentSlideIndex(0);
    setCurrentImageIndex(0);
    setCurrentScrollIndex(0);
  }, [id]);

  // ✅ Tous les hooks sont appelés AVANT tout return conditionnel
  
  if (loading) {
    return (
      <div className="pt-32 pb-24 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-sari-blue border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">{t('loading', { defaultMessage: 'Chargement...' })}</p>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="pt-32 pb-24 container mx-auto px-6 text-center min-h-screen flex flex-col items-center justify-center">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center mb-6 rounded-full">
          <FileText className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-sari-dark dark:text-white mb-2">{t('notFound')}</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">{t('notFoundDesc')}</p>
        <Link href={`/${locale}`} className="btn-primary text-white px-6 py-3 font-semibold inline-block rounded-lg">
          {t('backHome')}
        </Link>
      </div>
    );
  }

  const slides = content.slides || [];
  const mediaArray = content.media ? (typeof content.media === 'string' ? [content.media] : content.media) : [];
  const sections = content.sections || [];

  const nextSlide = () => {
    if (slides.length === 0 || isTransitioning) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
      setIsTransitioning(false);
    }, 500);
  };

  const prevSlide = () => {
    if (slides.length === 0 || isTransitioning) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentSlideIndex((prev) => (prev - 1 + slides.length) % slides.length);
      setIsTransitioning(false);
    }, 500);
  };

  const nextImage = () => {
    if (mediaArray.length === 0) return;
    setCurrentImageIndex((prev) => (prev + 1) % mediaArray.length);
  };

  const prevImage = () => {
    if (mediaArray.length === 0) return;
    setCurrentImageIndex((prev) => (prev - 1 + mediaArray.length) % mediaArray.length);
  };

  const nextScrollSection = () => {
    if (sections.length === 0) return;
    setCurrentScrollIndex((prev) => Math.min(prev + 1, sections.length - 1));
  };

  const prevScrollSection = () => {
    if (sections.length === 0) return;
    setCurrentScrollIndex((prev) => Math.max(prev - 1, 0));
  };

  const mainMedia = typeof content.media === 'string' ? content.media : (content.media && content.media[0]);

  // TYPE: FULL
  if (content.type === 'full') {
    return (
      <div className="pt-32 pb-24 min-h-screen page-enter">
        {mainMedia && (
          <div className="relative h-[400px] md:h-[500px] overflow-hidden" style={{ backgroundImage: `url(${mainMedia})` }}>
            <div className="absolute inset-0 bg-gradient-to-t from-sari-dark via-sari-dark/60 to-transparent"></div>
            <div className="absolute inset-0 grid-pattern-bg opacity-10"></div>
            <div className="absolute bottom-0 left-0 right-0 container mx-auto px-6 pb-12">
              <div className="max-w-4xl">
                {content.category && <span className="inline-block px-4 py-2 bg-sari-lime/20 border border-sari-lime/30 text-sari-lime font-semibold text-sm uppercase tracking-wider mb-4">{content.category}</span>}
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">{content.title}</h1>
                {content.subtitle && <p className="text-xl text-gray-300 max-w-2xl">{content.subtitle}</p>}
              </div>
            </div>
          </div>
        )}
        <div className="py-8">
          <div className="container mx-auto px-6">
            <Breadcrumb items={[{ label: t('home', { defaultMessage: 'Accueil' }), href: '/' }, { label: content.category || content.title }]} />
          </div>
        </div>
        <div className="py-16">
          <div className="prose dark:prose-invert max-w-4xl mx-auto text-gray-600 dark:text-gray-400 text-lg leading-relaxed px-6" dangerouslySetInnerHTML={{ __html: content.content || '' }} />
        </div>
      </div>
    );
  }

  // TYPE: SIMPLE / ABOUT
  if (!content.type || content.type === 'simple' || content.type === 'about') {
    return (
      <div className="pt-32 pb-24 min-h-screen page-enter">
        {mainMedia && (
          <div className="relative h-[400px] md:h-[500px] overflow-hidden" style={{ backgroundImage: `url(${mainMedia})` }}>
            <div className="absolute inset-0 bg-gradient-to-t from-sari-dark via-sari-dark/60 to-transparent"></div>
            <div className="absolute inset-0 grid-pattern-bg opacity-10"></div>
            <div className="absolute bottom-0 left-0 right-0 container mx-auto px-6 pb-12">
              <div className="max-w-4xl">
                {content.category && <span className="inline-block px-4 py-2 bg-sari-lime/20 border border-sari-lime/30 text-sari-lime font-semibold text-sm uppercase tracking-wider mb-4">{content.category}</span>}
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">{content.title}</h1>
                {content.subtitle && <p className="text-xl text-gray-300 max-w-2xl">{content.subtitle}</p>}
              </div>
            </div>
          </div>
        )}
        <div className="py-8">
          <div className="container mx-auto px-6">
            <Breadcrumb items={[{ label: t('home', { defaultMessage: 'Accueil' }), href: '/' }, { label: content.title }]} />
          </div>
        </div>
        <div className="container mx-auto px-6 py-16">
          <div className="max-w-4xl mx-auto bg-white dark:bg-[#1a1a1a] p-8 md:p-12 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
            {!mainMedia && (
              <>
                {content.category && <span className="text-sari-blue font-bold uppercase tracking-wider text-sm mb-4 block">{content.category}</span>}
                <h1 className="text-4xl md:text-5xl font-bold text-sari-dark dark:text-white mb-6">{content.title}</h1>
                {content.subtitle && <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">{content.subtitle}</p>}
              </>
            )}
            <div className="prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-400 text-lg leading-relaxed" dangerouslySetInnerHTML={{ __html: content.content || '' }} />
          </div>
        </div>
      </div>
    );
  }

  // TYPE: GALLERY
  if (content.type === 'gallery') {
    const currentMedia = mediaArray[currentImageIndex] || mediaArray[0];
    const currentSrc = typeof currentMedia === 'string' ? currentMedia : currentMedia;
    return (
      <div className="pt-32 pb-24 min-h-screen page-enter">
        {mainMedia && (
          <div className="relative h-[400px] md:h-[500px] overflow-hidden" style={{ backgroundImage: `url(${mainMedia})` }}>
            <div className="absolute inset-0 bg-gradient-to-t from-sari-dark via-sari-dark/60 to-transparent"></div>
            <div className="absolute bottom-0 left-0 right-0 container mx-auto px-6 pb-12">
              <div className="max-w-4xl">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">{content.title}</h1>
              </div>
            </div>
          </div>
        )}
        <div className="py-8">
          <div className="container mx-auto px-6">
            <Breadcrumb items={[{ label: t('home', { defaultMessage: 'Accueil' }), href: '/' }, { label: content.title }]} />
          </div>
        </div>
        <div className="container mx-auto px-6 py-16">
          <div className="max-w-6xl mx-auto">
            <div className="relative bg-gray-100 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden rounded-xl">
              <img src={currentSrc} alt={content.title} className="w-full h-[500px] object-contain" onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/1200x500?text=Image'; }} />
              {mediaArray.length > 1 && (
                <>
                  <button onClick={prevImage} className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 dark:bg-sari-dark/90 p-3 shadow-lg hover:scale-110 transition-all rounded-full">
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button onClick={nextImage} className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 dark:bg-sari-dark/90 p-3 shadow-lg hover:scale-110 transition-all rounded-full">
                    <ChevronRight className="w-6 h-6" />
                  </button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-sari-dark/80 text-white px-4 py-2 rounded-full text-sm font-semibold">
                    {currentImageIndex + 1} / {mediaArray.length}
                  </div>
                </>
              )}
            </div>
            {mediaArray.length > 1 && (
              <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 mt-6">
                {mediaArray.map((media, idx) => {
                  const src = typeof media === 'string' ? media : media;
                  return (
                    <button key={idx} onClick={() => setCurrentImageIndex(idx)} className={`aspect-square overflow-hidden border-2 transition-all rounded-lg ${currentImageIndex === idx ? 'border-sari-blue shadow-lg scale-105' : 'border-gray-200 dark:border-gray-800 opacity-60 hover:opacity-100'}`}>
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    </button>
                  );
                })}
              </div>
            )}
            {content.content && (
              <div className="mt-12 bg-white dark:bg-[#1a1a1a] p-8 md:p-12 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
                <div className="prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-400" dangerouslySetInnerHTML={{ __html: content.content }} />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // TYPE: SLIDE
  if (content.type === 'slide') {
    const currentSlide = slides[currentSlideIndex] || {};
    return (
      <div className="pt-32 pb-24 min-h-screen page-enter">
        {mainMedia && (
          <div className="relative h-[300px] md:h-[400px] overflow-hidden" style={{ backgroundImage: `url(${mainMedia})` }}>
            <div className="absolute inset-0 bg-gradient-to-t from-sari-dark via-sari-dark/60 to-transparent"></div>
            <div className="absolute bottom-0 left-0 right-0 container mx-auto px-6 pb-12">
              <div className="max-w-4xl">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">{content.title}</h1>
              </div>
            </div>
          </div>
        )}
        <div className="py-8">
          <div className="container mx-auto px-6">
            <Breadcrumb items={[{ label: t('home', { defaultMessage: 'Accueil' }), href: '/' }, { label: content.title }]} />
          </div>
        </div>
        {slides.length > 0 ? (
          <div className="container mx-auto px-6 py-16">
            <div className="max-w-6xl mx-auto">
              <div className="relative bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden rounded-xl">
                <div className={`transition-all duration-500 ${isTransitioning ? 'opacity-0 translate-x-10' : 'opacity-100 translate-x-0'}`}>
                  {currentSlide.mediaType === 'youtube' && currentSlide.media ? (
                    <div className="w-full h-[500px]">
                      <iframe src={currentSlide.media.replace('watch?v=', 'embed/')} className="w-full h-full" frameBorder="0" allowFullScreen></iframe>
                    </div>
                  ) : currentSlide.mediaType === 'video' && currentSlide.media ? (
                    <video src={currentSlide.media} className="w-full h-[500px] object-cover" controls></video>
                  ) : currentSlide.media ? (
                    <img src={currentSlide.media} alt={currentSlide.title} className="w-full h-[500px] object-cover" />
                  ) : null}
                  <div className="p-8 md:p-12">
                    <h2 className="text-3xl md:text-4xl font-bold text-sari-dark dark:text-white mb-4">{currentSlide.title}</h2>
                    {currentSlide.subtitle && <p className="text-xl text-sari-blue mb-4">{currentSlide.subtitle}</p>}
                    {currentSlide.description && <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">{currentSlide.description}</p>}
                    {currentSlide.cta && (
                      <div className="mt-6">
                        <Link href={`/${locale}${currentSlide.ctaLink || '/'}`} className="btn-primary text-white px-6 py-3 font-semibold inline-flex items-center gap-2 rounded-lg">
                          {currentSlide.cta} {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
                {slides.length > 1 && (
                  <>
                    <button onClick={prevSlide} className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 dark:bg-sari-dark/90 p-3 shadow-lg hover:scale-110 transition-all z-10 rounded-full">
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button onClick={nextSlide} className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 dark:bg-sari-dark/90 p-3 shadow-lg hover:scale-110 transition-all z-10 rounded-full">
                      <ChevronRight className="w-6 h-6" />
                    </button>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-sari-dark/80 text-white px-4 py-2 rounded-full text-sm font-semibold z-10">
                      {currentSlideIndex + 1} / {slides.length}
                    </div>
                  </>
                )}
              </div>
              {slides.length > 1 && (
                <div className="flex justify-center gap-2 mt-8">
                  {slides.map((_, idx) => (
                    <button key={idx} onClick={() => setCurrentSlideIndex(idx)} className={`w-3 h-3 rounded-full transition-all ${idx === currentSlideIndex ? 'bg-sari-blue w-8' : 'bg-gray-300 dark:bg-gray-700'}`}></button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="container mx-auto px-6 py-16 text-center">
            <h2 className="text-2xl font-bold text-sari-dark dark:text-white mb-2">{t('noSlides', { defaultMessage: 'Aucun slide disponible' })}</h2>
          </div>
        )}
      </div>
    );
  }

  // TYPE: SCROLL
  if (content.type === 'scroll') {
    const currentSection = sections[currentScrollIndex] || {};
    return (
      <div className="pt-32 pb-24 min-h-screen page-enter">
        {mainMedia && (
          <div className="relative h-[300px] md:h-[400px] overflow-hidden" style={{ backgroundImage: `url(${mainMedia})` }}>
            <div className="absolute inset-0 bg-gradient-to-t from-sari-dark via-sari-dark/60 to-transparent"></div>
            <div className="absolute bottom-0 left-0 right-0 container mx-auto px-6 pb-12">
              <div className="max-w-4xl">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">{content.title}</h1>
              </div>
            </div>
          </div>
        )}
        <div className="py-8">
          <div className="container mx-auto px-6">
            <Breadcrumb items={[{ label: t('home', { defaultMessage: 'Accueil' }), href: '/' }, { label: content.title }]} />
          </div>
        </div>
        {sections.length > 0 ? (
          <div className="container mx-auto px-6 py-16">
            <div className="max-w-6xl mx-auto">
              <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden rounded-xl">
                <div className="grid md:grid-cols-2">
                  {currentSection.mediaType === 'youtube' && currentSection.media ? (
                    <div className="h-96 md:h-auto">
                      <iframe src={currentSection.media.replace('watch?v=', 'embed/')} className="w-full h-full" frameBorder="0" allowFullScreen></iframe>
                    </div>
                  ) : currentSection.mediaType === 'video' && currentSection.media ? (
                    <video src={currentSection.media} className="w-full h-full object-cover" controls></video>
                  ) : currentSection.media ? (
                    <div className="relative h-96 md:h-auto overflow-hidden">
                      <img src={currentSection.media} alt={currentSection.title} className="w-full h-full object-cover" />
                    </div>
                  ) : null}
                  <div className={`p-8 md:p-12 flex flex-col justify-center ${!currentSection.media ? 'md:col-span-2' : ''}`}>
                    <h2 className="text-3xl md:text-4xl font-bold text-sari-dark dark:text-white mb-4">{currentSection.title}</h2>
                    {currentSection.subtitle && <p className="text-xl text-sari-blue mb-4">{currentSection.subtitle}</p>}
                    {currentSection.description && <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed mb-6">{currentSection.description}</p>}
                    {currentSection.cta && (
                      <Link href={`/${locale}${currentSection.ctaLink || '/'}`} className="btn-primary text-white px-6 py-3 font-semibold inline-flex items-center gap-2 w-fit rounded-lg">
                        {currentSection.cta} {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
              {sections.length > 1 && (
                <div className="flex items-center justify-between mt-8">
                  <button onClick={prevScrollSection} disabled={currentScrollIndex === 0} className="btn-primary text-white px-6 py-3 font-semibold inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg">
                    <ChevronLeft className="w-5 h-5" /> {t('previous', { defaultMessage: 'Précédent' })}
                  </button>
                  <div className="flex gap-2">
                    {sections.map((_, idx) => (
                      <button key={idx} onClick={() => setCurrentScrollIndex(idx)} className={`w-3 h-3 rounded-full transition-all ${idx === currentScrollIndex ? 'bg-sari-blue w-8' : 'bg-gray-300 dark:bg-gray-700'}`}></button>
                    ))}
                  </div>
                  <button onClick={nextScrollSection} disabled={currentScrollIndex === sections.length - 1} className="btn-primary text-white px-6 py-3 font-semibold inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg">
                    {t('next', { defaultMessage: 'Suivant' })} <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="container mx-auto px-6 py-16 text-center">
            <h2 className="text-2xl font-bold text-sari-dark dark:text-white mb-2">{t('noSections', { defaultMessage: 'Aucune section disponible' })}</h2>
          </div>
        )}
      </div>
    );
  }

  // FALLBACK
  return (
    <div className="pt-32 pb-24 min-h-screen page-enter">
      <div className="py-8">
        <div className="container mx-auto px-6">
          <Breadcrumb items={[{ label: t('home', { defaultMessage: 'Accueil' }), href: '/' }, { label: content.title }]} />
        </div>
      </div>
      <div className="container mx-auto px-6 py-16">
        <div className="max-w-4xl mx-auto bg-white dark:bg-[#1a1a1a] p-8 md:p-12 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
          <h1 className="text-4xl font-bold text-sari-dark dark:text-white mb-6">{content.title}</h1>
          <div className="prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-400" dangerouslySetInnerHTML={{ __html: content.content || '' }} />
        </div>
      </div>
    </div>
  );
}