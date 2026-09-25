'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAdminBrand } from '@/components/admin/BrandContext';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  Activity, AlertTriangle, Banknote, FileCheck, FileText, HardDrive, Layers,
  Newspaper, Package, Receipt, ScrollText, Users, Wallet, Wrench,
} from 'lucide-react';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
import { cmsAdminFetch, cmsHealth, cmsStatus } from '@/lib/cms-admin';
import { unwrapList } from '@/lib/cms';
import type { PaymentRecord } from '@/lib/payments';
import DateText from '@/components/shared/DateText';
import { money } from '@/lib/commerce-math';

/**
 * Accueil de l'administration.
 *
 * Ce qui a changé, et pourquoi : la page affichait ses commandes et son chiffre
 * d'affaires depuis `loadOrders()`, c'est-à-dire le `localStorage` du poste — un
 * cache qui, vide, se fabrique un jeu de démonstration. Un administrateur ouvrait
 * l'accueil d'une base neuve et voyait 4 500 000 DA « livrés ». Les chiffres
 * viennent maintenant de la base (`/settings/status` pour les volumes, un comptage
 * filtré pour « à traiter »), et le bouton qui posait le jeu de démonstration a
 * quitté cette page pour Paramètres : son appel à `saveOrders()` réplique en base,
 * donc un clic ajoutait onze commandes fictives aux vraies.
 *
 * Deux absences assumées, pour la même raison : un chiffre indisponible s'affiche
 * `—` et non `0`. Sur un accueil, un zéro se lit « rien à faire » ; or c'est très
 * souvent un 403, une API muette ou un pilote JSON sans table.
 */

/**
 * Statuts de devis qui disent « on doit une réponse ». Ce sont les états ouverts de
 * `QuoteStatus` (`lib/crm-store.ts`) — pas `open`, qui n'existe pas dans cette union.
 */
const QUOTES_TO_PROCESS = ['submitted', 'processing', 'pending', 'sent', 'revision'];

/** Compte ce que la base contient pour un filtre, sans en télécharger les lignes. */
async function countWhere(resource: string, filter: Record<string, unknown>): Promise<number | null> {
  try {
    // Une valeur en tableau devient l'opérateur `in` du backend — seul moyen de
    // compter « plusieurs statuts » sans une requête par statut.
    // (`normalizeFilters` de `backend/src/common/crud/query.util.ts`)
    const shaped = Object.fromEntries(
      Object.entries(filter).map(([field, value]) => [field, Array.isArray(value) ? { in: value } : value]),
    );
    const page = await cmsAdminFetch<{ meta?: { total?: number } }>(
      `/${resource}?limit=1&filter=${encodeURIComponent(JSON.stringify(shaped))}`,
      { timeoutMs: 8000 },
    );
    // Pas de `?? 0` : une réponse sans `meta.total` n'est pas « rien à traiter »,
    // c'est une réponse qu'on ne sait pas lire.
    const total = Number(page?.meta?.total);
    return Number.isFinite(total) ? total : null;
  } catch {
    return null;
  }
}

type SourceRow = { label: string; detail: string; base: boolean; href: string; count?: number | null };

export default function AdminDashboardPage() {
  const { brand } = useAdminBrand();
  const locale = useLocale();
  const t = useTranslations('admin.dashboard');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [connected, setConnected] = useState(false);
  const [driver, setDriver] = useState('');
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<Array<{ id?: string; action?: string; resource?: string; createdAt?: string }>>([]);
  const [pending, setPending] = useState<{ orders: number | null; quotes: number | null }>({ orders: null, quotes: null });
  const [ledger, setLedger] = useState<{ total: number; waiting: number; waitingAmount: number; source: 'base' | 'cache' | 'na' }>({
    total: 0, waiting: 0, waitingAmount: 0, source: 'na',
  });
  const [methods, setMethods] = useState<{ count: number; fromBase: boolean } | null>(null);
  const [unavailable, setUnavailable] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    const [health, status] = await Promise.all([cmsHealth(), cmsStatus()]);
    setConnected(Boolean(health || status?.connected));
    setDriver(status?.driver || (health as { driver?: string } | null)?.driver || '');
    if (status?.counts) setCounts(status.counts);
    // Le backend nomme ce qu'il n'a pas pu compter ; l'écran le rapporte tel quel.
    setUnavailable(status?.unavailable ?? []);
    try {
      setLogs(unwrapList(await cmsAdminFetch<unknown>('/audit-logs/recent?limit=6')));
    } catch {
      setLogs([]);
    }
    const [orders, quotes] = await Promise.all([
      countWhere('orders', { status: 'pending' }),
      countWhere('quotes', { status: QUOTES_TO_PROCESS }),
    ]);
    setPending({ orders, quotes });

    // Le relevé d'encaissements : la base d'abord. `/payment-records/all` est la
    // route que l'écran Journal des paiements consomme déjà ; un 403 (rôle sans
    // `payments:read`) ou une API muette laissent `source: 'na'` — un chiffre
    // inventé ici se répandrait dans toute la page.
    try {
      const rows = unwrapList(await cmsAdminFetch<unknown>('/payment-records/all', { timeoutMs: 8000 }));
      const list = rows as PaymentRecord[];
      setLedger({
        total: list.length,
        waiting: list.filter((r) => r.status === 'pending').length,
        waitingAmount: list.filter((r) => r.status === 'pending').reduce((a, r) => a + (Number(r.amount) || 0), 0),
        source: 'base',
      });
    } catch {
      setLedger((prev) => ({ ...prev, source: 'na' }));
    }

    // Les modes de paiement, et surtout d'où ils viennent : `source: 'db'` veut
    // dire « enregistré en base », `'default'` veut dire « jamais enregistré —
    // l'écran affiche ses valeurs par défaut ». La distinction est la question que
    // l'exploitant pose quand une liste lui semble vide.
    try {
      const doc = await cmsAdminFetch<{ source?: string; payload?: unknown }>('/settings/doc/payments', { timeoutMs: 8000 });
      const items = Array.isArray(doc?.payload) ? doc.payload : [];
      setMethods({ count: items.length, fromBase: doc?.source === 'db' });
    } catch {
      setMethods(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, locale]);

  if (loading) {
    return (
      <div className="ad-card">
        <PixelGridLoader label="Boot CMS" />
      </div>
    );
  }

  const n = (value: number | null | undefined) => (value === null || value === undefined ? '—' : value);

  const tiles = [
    { label: t('tileProducts', { defaultMessage: 'Produits' }), value: counts.products, icon: Package, href: `/${locale}/admin/products` },
    { label: t('tileServices', { defaultMessage: 'Services' }), value: counts.services, icon: Wrench, href: `/${locale}/admin/services` },
    { label: t('tileSolutions', { defaultMessage: 'Solutions' }), value: counts.solutions, icon: Layers, href: `/${locale}/admin/solutions` },
    { label: t('tilePages', { defaultMessage: 'Pages' }), value: counts.pages, icon: FileText, href: `/${locale}/admin/pages` },
    { label: t('tileOrders', { defaultMessage: 'Commandes' }), value: counts.orders, icon: Receipt, href: `/${locale}/admin/orders` },
    { label: t('tileQuotes', { defaultMessage: 'Devis' }), value: counts.quotes, icon: FileCheck, href: `/${locale}/admin/quotes` },
    { label: t('tilePayments', { defaultMessage: 'Encaissements' }), value: counts.paymentRecords, icon: Banknote, href: `/${locale}/admin/payment-records` },
    { label: t('tileUsers', { defaultMessage: 'Comptes & contacts' }), value: counts.users, icon: Users, href: `/${locale}/admin/users` },
  ];

  const toHandle = [
    { label: t('todoPayments', { defaultMessage: 'Encaissements à valider' }), value: ledger.source === 'na' ? null : ledger.waiting, href: `/${locale}/admin/payment-records`, amount: ledger.waitingAmount },
    { label: t('todoOrders', { defaultMessage: 'Commandes en attente' }), value: pending.orders, href: `/${locale}/admin/orders` },
    { label: t('todoQuotes', { defaultMessage: 'Devis à relancer' }), value: pending.quotes, href: `/${locale}/admin/quotes` },
  ];

  const sources: SourceRow[] = [
    { label: t('srcPayments', { defaultMessage: 'Relevé d’encaissements' }), detail: 'payment_records', base: true, href: `/${locale}/admin/payment-records`, count: counts.paymentRecords },
    { label: t('srcPaymentMethods', { defaultMessage: 'Modes de paiement' }), detail: methods ? (methods.fromBase ? `doc_payments · ${methods.count}` : 'doc_payments · jamais enregistré') : 'settings', base: Boolean(methods?.fromBase), href: `/${locale}/admin/payments`, count: methods?.count },
    { label: t('srcCoupons', { defaultMessage: 'Coupons' }), detail: 'coupons', base: true, href: `/${locale}/admin/coupons`, count: counts.coupons },
    { label: t('srcTaxes', { defaultMessage: 'Règles de taxes' }), detail: 'tax_rules', base: true, href: `/${locale}/admin/taxes`, count: counts.taxRules },
    { label: t('srcSettings', { defaultMessage: 'Réglages d’écran' }), detail: 'settings · doc_*', base: true, href: `/${locale}/admin/settings` },
    {
      label: t('srcJournals', { defaultMessage: 'Journaux non transférés' }),
      detail: t('srcJournalsDetail', { defaultMessage: 'usages de coupons, imports, annuaire — cache du poste uniquement' }),
      base: false,
      href: `/${locale}/admin/settings`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 ad-rise">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] font-bold" style={{ color: 'var(--ad-muted)' }}>{brand.title}</div>
          <h1 className="text-3xl font-black tracking-tight">{t('title')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--ad-muted)' }}>
            {t('subtitle', { defaultMessage: 'Les chiffres ci-dessous viennent de la base, pas du cache de ce navigateur.' })}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Link href={`/${locale}/admin/stats`} className="ad-btn ad-btn-ghost">{t('statistics')}</Link>
          <Link href={`/${locale}/admin/logs`} className="ad-btn ad-btn-ghost">
            <ScrollText className="w-4 h-4" /> {t('logs')}
          </Link>
          <div className={`ad-chip ${connected ? 'ad-chip-ok' : 'ad-chip-warn'}`}>
            <Activity className="w-3 h-3" /> {connected ? `API ${driver || 'ok'}` : t('offline', { defaultMessage: 'Hors ligne' })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {tiles.map((tile, i) => {
          const Icon = tile.icon;
          return (
            <Link
              key={tile.href}
              href={tile.href}
              className="ad-card p-4 ad-rise hover:-translate-y-0.5 transition-transform"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-center justify-between mb-6">
                <div
                  className="w-10 h-10 flex items-center justify-center"
                  style={{ background: 'color-mix(in srgb, var(--ad-accent) 16%, transparent)', color: 'var(--ad-accent)' }}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-3xl font-black tabular-nums">{n(tile.value)}</span>
              </div>
              <div className="text-sm font-semibold" style={{ color: 'var(--ad-muted)' }}>{tile.label}</div>
            </Link>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <section className="ad-card p-5 ad-rise">
          <h3 className="ad-section-title">{t('toHandle', { defaultMessage: 'À traiter' })}</h3>
          <ul className="space-y-1">
            {toHandle.map((item) => (
              <li key={item.href + item.label}>
                <Link href={item.href} className="flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-[var(--ad-surface-2)]">
                  <span>{item.label}</span>
                  <span className="flex items-center gap-2">
                    {typeof item.amount === 'number' && item.amount > 0 && (
                      <span className="text-xs tabular-nums" style={{ color: 'var(--ad-muted)' }}>{money(item.amount)}</span>
                    )}
                    <b className="tabular-nums">{n(item.value)}</b>
                    {item.value ? <AlertTriangle className="w-4 h-4" style={{ color: 'var(--ad-warn, #b45309)' }} /> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-xs mt-3" style={{ color: 'var(--ad-muted)' }}>
            {t('naIsNotZero', { defaultMessage: 'Un tiret veut dire « non mesurable ici » : droits insuffisants, API muette ou pilote sans table. Jamais « rien à faire ».' })}
          </p>
        </section>

        <section className="ad-card p-5 ad-rise lg:col-span-2">
          <h3 className="ad-section-title">
            <HardDrive className="w-4 h-4" /> {t('dataSource', { defaultMessage: 'Données & source' })}
          </h3>
          <p className="text-sm mb-3" style={{ color: 'var(--ad-muted)' }}>
            {t('dataSourceHelp', {
              defaultMessage: 'Une liste qui semble vide vient rarement d’un bug d’affichage : soit la base ne contient encore rien (l’écran garde alors ses valeurs par défaut, non partagées), soit elle contient quelque chose que ce poste n’a pas le droit de lire.',
            })}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: 'var(--ad-muted)' }} className="text-left">
                  <th className="font-semibold py-1">{t('thScreen', { defaultMessage: 'Écran' })}</th>
                  <th className="font-semibold py-1">{t('thTable', { defaultMessage: 'Table ou document' })}</th>
                  <th className="font-semibold py-1 text-right">{t('thRows', { defaultMessage: 'Lignes' })}</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((row) => (
                  <tr key={row.label} className="border-t border-[var(--ad-border)]">
                    <td className="py-2">
                      <Link href={row.href} className="hover:underline">{row.label}</Link>
                    </td>
                    <td className="py-2" style={{ color: 'var(--ad-muted)' }}>
                      <code className="text-xs">{row.detail}</code>
                    </td>
                    <td className="py-2 text-right">
                      <span className={`ad-chip ${row.base ? 'ad-chip-ok' : 'ad-chip-warn'}`}>
                        {row.base ? t('inBase', { defaultMessage: 'en base' }) : t('inBrowser', { defaultMessage: 'cache du poste' })}
                      </span>
                      {row.count !== undefined ? <span className="ml-2 tabular-nums font-semibold">{n(row.count)}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {unavailable.length > 0 && (
            <p
              className="text-sm mt-3 flex items-start gap-2"
              style={{ color: 'var(--ad-warn, #b45309)' }}
            >
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                {t('unavailable', { defaultMessage: 'Compteurs que la base n’a pas fournis' })} :{' '}
                <code className="text-xs">{unavailable.join(' · ')}</code>.{' '}
                {t('unavailableHelp', {
                  defaultMessage:
                    'Le plus souvent, la table n’a pas encore été créée sur cette base. Le rattrapage est additif : dans backend/, « npm run db:schema-check » puis « npm run db:schema-fix » (ou le fichier backend/sql/schema-sync.mysql.sql dans votre client SQL).',
                })}
              </span>
            </p>
          )}
          {ledger.source === 'base' && (
            <p className="text-xs mt-3" style={{ color: 'var(--ad-muted)' }}>
              <Wallet className="w-3 h-3 inline mr-1" />
              {t('ledgerLine', {
                defaultMessage: '{total} ligne(s) d’encaissement lues dans la base ; {waiting} en attente de validation pour {amount}.',
                total: ledger.total,
                waiting: ledger.waiting,
                amount: money(ledger.waitingAmount),
              })}
            </p>
          )}
        </section>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="ad-card p-5">
          <h3 className="ad-section-title">{t('actions')}</h3>
          <div className="space-y-1">
            {[
              [`/${locale}/admin/products/new`, t('newProduct', { defaultMessage: 'Nouveau produit' })],
              [`/${locale}/admin/news/new`, t('newArticle', { defaultMessage: 'Nouvel article' })],
              [`/${locale}/admin/orders`, t('ordersLink', { defaultMessage: 'Commandes' })],
              [`/${locale}/admin/payment-records`, t('paymentsLink', { defaultMessage: 'Journal des paiements' })],
              [`/${locale}/admin/settings?tab=demo`, t('demoLink', { defaultMessage: 'Import & jeu de démonstration' })],
            ].map(([href, label]) => (
              <Link key={href} href={href} className="block px-3 py-2 text-sm hover:bg-[var(--ad-surface-2)]">
                {label}
              </Link>
            ))}
          </div>
        </div>

        <div className="ad-card p-5 lg:col-span-2">
          <h3 className="ad-section-title">
            <Newspaper className="w-4 h-4" /> {t('recentActivity')}
            <span className="ml-2 text-xs font-normal" style={{ color: 'var(--ad-muted)' }}>
              {n(counts.news)} {t('publishedCount', { defaultMessage: 'publications,' })} {n(counts.events)} {t('eventsCount', { defaultMessage: 'événements' })}
            </span>
          </h3>
          <ul className="space-y-2 text-sm">
            {logs.map((log) => (
              <li key={String(log.id)} className="flex justify-between gap-2">
                <span>
                  <b>{log.action}</b> · {log.resource}
                </span>
                <span style={{ color: 'var(--ad-muted)' }}>
                  <DateText value={log.createdAt} timeOnly fallback="" />
                </span>
              </li>
            ))}
            {logs.length === 0 && <li style={{ color: 'var(--ad-muted)' }}>{t('noActivity', { defaultMessage: 'Aucune activité pour l’instant.' })}</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
