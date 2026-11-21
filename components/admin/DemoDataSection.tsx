'use client';

import { useTranslations } from 'next-intl';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, DatabaseZap, DownloadCloud, FlaskConical, Play, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/admin/Toast';
import { cmsHealth, cmsImportCatalog, cmsStatus } from '@/lib/cms-admin';
import { CmsError } from '@/lib/cms';
import { seedDemoWorkspace } from '@/lib/demo-seed';

/**
 * Import du catalogue et jeu de démonstration.
 *
 * Ces trois boutons vivaient sur la page d'accueil de l'administration, au
 * milieu des compteurs. Deux d'entre eux écrivent dans la base :
 *
 * - l'import du catalogue lit `data/{fr,en,ar}` et alimente les listes — utile à
 *   l'installation, sans interest une fois le contenu en place ;
 * - le jeu de démonstration, lui, appelle `saveOrders()` et `saveQuotes()`, qui
 *   répliquent vers l'API : onze commandes et six devis fictifs, avec leurs
 *   montants, venaient s'ajouter aux vrais dans `orders` et `quotes`. Sur un poste
 *   de production, c'est une pollution comptable irréversible à l'œil — aucune
 *   colonne ne dit « ceci est un bac à sable ».
 *
 * Ils sont donc descendus ici, derrière une case à cocher qui n'est mémorisée
 * nulle part : elle doit être re-cochée à chaque séance, et elle disparaît quand
 * on ferme l'onglet. `lib/demo-seed.ts` refuse de surcroit d'écrire dans une base
 * qui contient déjà des commandes ou des devis ; le déverrouillage explicite
 * existe, parce qu'un environnement de recette doit pouvoir forcer.
 */
export default function DemoDataSection() {
  const t = useTranslations('admin.demoSettings');
  const { showToast } = useToast();
  const [driver, setDriver] = useState('');
  const [connected, setConnected] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [armed, setArmed] = useState(false);
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<
    { reason: 'base-occupée' | 'base-inconnue'; orders: number; quotes: number } | null
  >(null);

  const refresh = useCallback(async () => {
    const [health, status] = await Promise.all([cmsHealth(), cmsStatus()]);
    setConnected(Boolean(health || status?.connected));
    setDriver(status?.driver || (health as { driver?: string } | null)?.driver || '');
    if (status?.counts) setCounts(status.counts);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const importCatalog = async (replace: boolean) => {
    setBusy(true);
    try {
      const result = await cmsImportCatalog(replace);
      const total = Object.values(result.imported || {}).reduce((a, b) => a + Number(b), 0);
      showToast(total ? t('imported', { count: total }) : t('alreadyPresent'), 'success');
      await refresh();
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : t('importFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const seedDemo = async () => {
    setBusy(true);
    setRefused(null);
    try {
      const result = await seedDemoWorkspace({ force });
      if (!result.ok) {
        // Le refus est un résultat, pas une erreur : l'écran le dit avec les
        // chiffres qui l'ont provoqué, pour que la décision de forcer se prenne
        // en connaissance de cause.
        setRefused({ reason: result.reason, orders: result.orders, quotes: result.quotes });
        showToast(
          result.reason === 'base-occupée'
            ? t('occupied')
            : t('unknownCounts'),
          'warning',
        );
      } else {
        showToast(
          t('seeded', { orders: result.orders, quotes: result.quotes, applications: result.applications, people: result.people, imported: result.imported }),
          'success',
        );
        setArmed(false);
        setForce(false);
        await refresh();
      }
    } catch {
      showToast(t('partial'), 'warning');
    } finally {
      setBusy(false);
    }
  };

  const seeded = (Number(counts.orders) || 0) + (Number(counts.quotes) || 0);

  return (
    <div className="space-y-4">
      <section className="ad-card p-5">
        <h3 className="ad-section-title">
          <DownloadCloud className="w-4 h-4" /> {t('importTitle')}
        </h3>
        <p className="text-sm mb-1" style={{ color: 'var(--ad-muted)' }}>
          {t('importHint', { path: 'data/fr|en|ar' })}
        </p>
        <p className="text-xs mb-4" style={{ color: 'var(--ad-muted)' }}>
          {connected ? t('apiOnline', { driver: driver || t('unknown') }) : t('apiOffline')}
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="ad-btn ad-btn-primary" disabled={busy || !connected} onClick={() => importCatalog(false)}>
            <Play className="w-4 h-4" /> {busy ? t('importing') : t('importMissing')}
          </button>
          <button className="ad-btn ad-btn-ghost" disabled={busy || !connected} onClick={() => importCatalog(true)}>
            <RefreshCw className="w-4 h-4" /> {t('replace')}
          </button>
        </div>
      </section>

      <section className="ad-card p-5">
        <h3 className="ad-section-title">
          <FlaskConical className="w-4 h-4" /> {t('demoTitle')}
        </h3>
        <p className="text-sm mb-4" style={{ color: 'var(--ad-muted)' }}>
          {t('intro')}
        </p>

        <div className="ad-chip mb-4" style={{ marginRight: 8 }}>
          <DatabaseZap className="w-3 h-3" /> {t('driver', { driver: driver || t('unknown') })}
        </div>
        <div className={`ad-chip mb-4 ${seeded ? 'ad-chip-warn' : 'ad-chip-ok'}`}>
          {t('dbCount', { orders: Number(counts.orders) || 0, quotes: Number(counts.quotes) || 0 })}
        </div>

        {seeded > 0 && (
          <p className="text-sm mb-4 flex items-start gap-2" style={{ color: 'var(--ad-warn, #b45309)' }}>
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              {t('warning')}
            </span>
          </p>
        )}

        <label className="flex items-start gap-2 text-sm mb-3 cursor-pointer">
          <input type="checkbox" checked={armed} onChange={(e) => setArmed(e.target.checked)} />
          <span>
            {t('confirm')}
          </span>
        </label>
        {armed && seeded > 0 && (
          <label className="flex items-start gap-2 text-sm mb-3 cursor-pointer">
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
            <span>{t('force', { orders: Number(counts.orders) || 0, quotes: Number(counts.quotes) || 0 })}</span>
          </label>
        )}

        <button className="ad-btn ad-btn-lime" disabled={busy || !armed || !connected} onClick={seedDemo}>
          {busy ? t('loading') : t('loadDemo')}
        </button>
        {!connected && (
          <p className="text-xs mt-2" style={{ color: 'var(--ad-muted)' }}>
            {t('offlineHint')}
          </p>
        )}
        {refused && (
          <p className="text-sm mt-3" style={{ color: 'var(--ad-warn, #b45309)' }}>
            {refused.reason === 'base-occupée' ? (
              <>
                {t('refused', { orders: refused.orders, quotes: refused.quotes })}
              </>
            ) : (
              <>
                {t('unavailableHint')}
              </>
            )}
          </p>
        )}
      </section>
    </div>
  );
}
