// app/[locale]/news/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Calendar, Clock, ChevronLeft, ChevronRight, Mail } from 'lucide-react';
import { getNews, getArticleAuthor, getDefaultAuthor } from '@/lib/data';
import { newsListHref, popularNewsTags } from '@/lib/news-groups';
import { entityUrl, findByRouteKey } from '@/lib/entity-url';
import { useDateUtils } from '@/lib/use-date-format';
import type { News, Author } from '@/types';
import Breadcrumb from '@/components/ui/Breadcrumb';
import PageVisibilityGuard from '@/components/shared/PageVisibilityGuard';
import { ArticleTags, PopularTags } from '@/components/news/NewsTags';
import NewsletterSignup from '@/components/shared/NewsletterSignup';
import ImageWithFallback from '@/components/ui/ImageWithFallback';
import LanguageIndicator from '@/components/ui/LanguageIndicator';

export default function NewsDetailPage() {
  const { id } = useParams<{ id: string }>();
  const locale = useLocale();
  return (
    <PageVisibilityGuard visibilityKey="module.news">
      <NewsDetail key={`${locale}/${id}`} routeKey={id} locale={locale} />
    </PageVisibilityGuard>
  );
}

function NewsDetail({ routeKey, locale }: { routeKey: string; locale: string }) {
  const { formatDate, hasTime } = useDateUtils();
  const t = useTranslations('pages.newsDetail');
  const tNews = useTranslations('pages.news');
  // undefined pendant la lecture, null seulement si aucune fiche ne correspond.
  const [item, setItem] = useState<News | null>();
  const [author, setAuthor] = useState<Author | null>(null);
  const [popularTags, setPopularTags] = useState<string[]>([]);
  const [relatedNews, setRelatedNews] = useState<News[]>([]);
  const [latestNews, setLatestNews] = useState<News[]>([]);
  const [prevArticle, setPrevArticle] = useState<News | null>(null);
  const [nextArticle, setNextArticle] = useState<News | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    let current = true;
    const loadArticle = async () => {
      const news = await getNews(locale);
      if (!current) return;

      const found = findByRouteKey(news, routeKey);
      setItem(found);
      if (!found) return;
      setPopularTags(popularNewsTags(news));
      const others = news.filter(n => n.id !== found.id);
      setRelatedNews(others.filter(n => n.category === found.category).slice(0, 3));
      setLatestNews(others.slice(0, 5));
      const index = news.indexOf(found);
      setPrevArticle(news[index - 1] ?? null);
      setNextArticle(news[index + 1] ?? null);

      // Sans auteur lié, essayer celui par défaut ; sinon la carte reste masquée.
      const resolved = (await getArticleAuthor(locale, found)) ?? (await getDefaultAuthor(locale));
      if (current) setAuthor(resolved);
    };
    void loadArticle();
    return () => { current = false; };
  }, [routeKey, locale]);

  useEffect(() => {
    const handleScroll = () => {
      const winScroll = document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      setScrollProgress((winScroll / height) * 100);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (item === undefined) {
    return <p role="status" className="pt-44 text-center min-h-screen">{tNews('loading')}</p>;
  }
  if (!item) {
    return (
      <div className="pt-32 pb-24 container mx-auto px-6 text-center min-h-screen flex flex-col items-center justify-center">
        <div className="w-24 h-24 bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-6 rounded-full">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="9" y1="15" x2="15" y2="9"></line>
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-sari-dark dark:text-white mb-2">
          {t('articleNotFound')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {t('articleNotFoundDesc')}
        </p>
        <Link href={`/${locale}/news`} className="btn-primary text-white px-6 py-3 inline-block rounded-lg">
          {t('backToNews')}
        </Link>
      </div>
    );
  }

  const articleType = item.classification?.trim();
  const badge = articleType || item.category?.trim();
  const subject = item.sujet?.trim();
  const lead = item.shortDesc?.trim();

  return (
    <div className="pt-[var(--site-header-h)] pb-24 min-h-screen">
      {item.locale && <LanguageIndicator contentLocale={item.locale} requestedLocale={locale} />}
      {/* Barre de progression */}
      <div className="fixed top-0 left-0 w-full h-1 bg-gray-200 dark:bg-gray-800 z-50">
        <div className="h-full bg-sari-blue transition-all duration-150" style={{ width: `${scrollProgress}%` }}></div>
      </div>

      {/* Le titre et le sujet restent dans le flux, même sur mobile. */}
      <div className="relative flex min-h-[500px] items-end overflow-hidden bg-sari-dark md:min-h-[600px]">
        <ImageWithFallback
          src={item.image}
          alt={item.title}
          className="absolute inset-0 h-full w-full object-cover parallax-slow"
          fallbackIcon="calendar"
          placeholderSize="xl"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-sari-dark via-sari-dark/75 to-sari-dark/45"></div>
        <div className="absolute inset-0 grid-pattern-bg opacity-10"></div>
        <div className="container relative mx-auto px-6 py-10 md:py-12">
          <div className="max-w-4xl">
            {badge && (
              <Link href={newsListHref(locale, { by: articleType ? 'type' : 'category', value: badge })}
                className="inline-block px-4 py-2 bg-sari-blue text-white font-semibold text-sm uppercase tracking-wider mb-4 rounded hover:underline">
                {badge}
              </Link>
            )}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight break-words">
              {item.title}
            </h1>
            {subject && (
              <p className="mb-6 max-w-prose break-words text-lg italic leading-relaxed text-gray-100 md:text-xl">{subject}</p>
            )}
            <div className="flex flex-wrap items-center gap-6 text-gray-300">
              {/* Sans auteur ni auteur par défaut, le bloc n'est pas affiché. */}
              {author && (
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-sari-blue flex items-center justify-center text-white font-bold rounded-full overflow-hidden">
                    {author.photo ? (
                      <ImageWithFallback
                        src={author.photo}
                        alt={author.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      author.name.charAt(0)
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-white">{author.name}</div>
                    {/* Qualification de l'auteur, à la place du libellé générique. */}
                    <div className="text-xs text-gray-400">{author.role || t('author')}</div>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-sari-blue" />
                <span>
                  {formatDate(item.publicationDate || item.date, locale, {
                    includeTime: hasTime(item.publicationDate || item.date) 
                  })}
                </span>
              </div>
              {item.readTime && (
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-sari-blue" />
                  <span>{item.readTime}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-16">
        <Breadcrumb items={[
          { label: t('home', { defaultMessage: 'Accueil' }), href: '/' },
          { label: t('news', { defaultMessage: 'Actualités' }), href: '/news' },
          { label: item.category }
        ]} />
        
        <div className="grid lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2">
            <article className="bg-white dark:bg-[#1a1a1a] p-5 sm:p-8 md:p-12 border border-gray-200 dark:border-gray-800 shadow-xl mb-8 rounded-xl">
              {lead && (
                <p className="mb-8 whitespace-pre-line rounded-e-xl border-s-4 border-sari-blue bg-sari-blue/5 px-4 py-4 text-lg font-semibold leading-relaxed text-sari-dark [overflow-wrap:anywhere] dark:bg-sari-blue/10 dark:text-gray-100 sm:px-6 sm:py-5 sm:text-xl sm:leading-relaxed">
                  {lead}
                </p>
              )}
              <div className="prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-400 text-lg leading-relaxed mb-12" dangerouslySetInnerHTML={{ __html: item.fullContent || '' }}></div>
              
              <ArticleTags article={item} popular={popularTags} locale={locale} />

              <div className="border-t border-gray-200 dark:border-gray-800 pt-8">
                <h3 className="text-sm font-bold text-sari-dark dark:text-white uppercase tracking-wider mb-4">{t('shareArticle')}</h3>
                <div className="flex gap-3">
                  <button className="w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-all hover:scale-110 rounded">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  </button>
                  <button className="w-10 h-10 bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center transition-all hover:scale-110 rounded">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  </button>
                  <button className="w-10 h-10 bg-blue-700 hover:bg-blue-800 text-white flex items-center justify-center transition-all hover:scale-110 rounded">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                  </button>
                </div>
              </div>
            </article>

            {(prevArticle || nextArticle) && (
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                {prevArticle ? (
                  <Link href={entityUrl(locale, 'news', prevArticle)} className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 p-6 hover:border-sari-blue transition-all group rounded-xl">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                      {locale === 'ar' ? <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /> : <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />}
                      {t('previousArticle')}
                    </div>
                    <h3 className="font-bold text-sari-dark dark:text-white group-hover:text-sari-blue transition-colors line-clamp-2">
                      {prevArticle.title}
                    </h3>
                  </Link>
                ) : <div></div>}
                {nextArticle ? (
                  <Link href={entityUrl(locale, 'news', nextArticle)} className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 p-6 hover:border-sari-blue transition-all group text-right rounded-xl">
                    <div className="flex items-center justify-end gap-2 text-sm text-gray-500 mb-2">
                      {t('nextArticle')}
                      {locale === 'ar' ? <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> : <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                    </div>
                    <h3 className="font-bold text-sari-dark dark:text-white group-hover:text-sari-blue transition-colors line-clamp-2">
                      {nextArticle.title}
                    </h3>
                  </Link>
                ) : <div></div>}
              </div>
            )}

            {relatedNews.length > 0 && (
              <div className="mt-16">
                <h2 className="text-3xl font-bold text-sari-dark dark:text-white mb-8">{t('relatedArticles')}</h2>
                <div className="grid md:grid-cols-3 gap-6">
                  {relatedNews.map(article => (
                    <Link key={article.id} href={entityUrl(locale, 'news', article)} className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 card-hover overflow-hidden group rounded-xl">
                      <div className="aspect-video overflow-hidden">
                        <ImageWithFallback
                          src={article.image}
                          alt={article.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          fallbackIcon="calendar"
                          placeholderSize="md"
                        />
                      </div>
                      <div className="p-6">
                        <div className="text-xs text-sari-blue font-bold uppercase mb-2">{article.category}</div>
                        <h3 className="text-lg font-bold text-sari-dark dark:text-white mb-2 line-clamp-2 group-hover:text-sari-blue transition-colors">{article.title}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{article.shortDesc}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-1 space-y-8">
            {/* Carte auteur : masquée si l'article n'a ni auteur ni auteur par défaut. */}
            {author && (
              <div className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
                <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-6">{t('aboutAuthor')}</h3>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-sari-blue flex items-center justify-center text-white text-2xl font-bold rounded-full overflow-hidden shrink-0">
                    {author.photo ? (
                      <ImageWithFallback
                        src={author.photo}
                        alt={author.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      author.name.charAt(0)
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-sari-dark dark:text-white text-lg">{author.name}</div>
                    {/* Qualification issue de la fiche auteur (et non la catégorie de l'article). */}
                    {author.role && <div className="text-sari-blue text-sm">{author.role}</div>}
                  </div>
                </div>
                {/* Présentation saisie dans la fiche auteur, en remplacement du texte figé. */}
                {author.bio && (
                  <p className="text-gray-600 dark:text-gray-400 text-sm">{author.bio}</p>
                )}
              </div>
            )}

            <PopularTags tags={popularTags} locale={locale} />

            <div className="bg-white dark:bg-[#1a1a1a] p-8 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl">
              <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-6 border-b border-gray-200 dark:border-gray-800 pb-4">
                {t('latestArticles')}
              </h3>
              <div className="space-y-6">
                {latestNews.map(post => (
                  <Link key={post.id} href={entityUrl(locale, 'news', post)} className="flex gap-4 group">
                    {post.image ? (
                    <ImageWithFallback
                      src={post.image}
                      alt={post.title}
                      className="w-20 h-20 object-cover flex-shrink-0 rounded-lg"
                      fallbackIcon="calendar"
                      placeholderSize="sm"
                    />
                    ) : null}
                    <div className="flex-1">
                      <h4 className="font-bold text-sari-dark dark:text-white group-hover:text-sari-blue transition-colors line-clamp-2 text-sm">{post.title}</h4>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {formatDate(post.publicationDate || post.date, locale, { format: 'short' })}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="bg-sari-blue text-white p-8 shadow-xl rounded-xl">
              <div className="w-16 h-16 bg-white/20 flex items-center justify-center mx-auto mb-4 rounded-full">
                <Mail className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold mb-4 text-center">{t('newsletter')}</h3>
              <p className="text-blue-100 mb-6 text-sm text-center">
                {t('newsletterDesc')}
              </p>
              <NewsletterSignup
                variant="card"
                source="news.detail"
                labels={{
                  placeholder: t('yourEmail'),
                  submit: t('subscribe'),
                  successDesc: t('subscriptionSuccess'),
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}