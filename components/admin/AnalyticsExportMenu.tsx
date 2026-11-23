'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, Download, FileCode, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import type { AnalyticsSnapshot } from '@/lib/analytics-types';
import {
  downloadAnalyticsCsv,
  downloadAnalyticsHtml,
  downloadAnalyticsJson,
  printAnalyticsReport,
  type ExportScope,
} from '@/lib/analytics-export';
import { useToast } from '@/components/admin/Toast';

export default function AnalyticsExportMenu({
  snapshot,
  scope = 'all',
  title,
  compact = false,
}: {
  snapshot: AnalyticsSnapshot | null;
  scope?: ExportScope;
  title?: string;
  compact?: boolean;
}) {
  const t = useTranslations('admin.analytics');
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  if (!snapshot) return null;

  const run = (fn: () => void, msg: string) => {
    setOpen(false);
    fn();
    showToast(msg, 'success');
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`ad-btn ad-btn-primary ${compact ? '!py-1.5 !px-3 text-xs' : ''}`}
      >
        <Download className="w-4 h-4" />
        <span>{t('exportReport')}</span>
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-1.5 w-60 rounded-xl border shadow-xl p-1.5 z-40 space-y-0.5"
          style={{ background: 'var(--ad-surface)', borderColor: 'var(--ad-line)' }}
        >
          <button
            type="button"
            onClick={() => run(() => downloadAnalyticsCsv(snapshot, scope), t('exportedCsv'))}
            className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2.5 hover:bg-[var(--ad-surface-2)]"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />
            <div>
              <div>{t('exportCsvTitle')}</div>
              <div className="text-[10px] font-normal" style={{ color: 'var(--ad-muted)' }}>
                {t('exportCsvHint')}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => run(() => downloadAnalyticsJson(snapshot), t('exportedJson'))}
            className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2.5 hover:bg-[var(--ad-surface-2)]"
          >
            <FileCode className="w-4 h-4 text-sky-500 shrink-0" />
            <div>
              <div>{t('exportJsonTitle')}</div>
              <div className="text-[10px] font-normal" style={{ color: 'var(--ad-muted)' }}>
                {t('exportJsonHint')}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => run(() => downloadAnalyticsHtml(snapshot, title), t('exportedHtml'))}
            className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2.5 hover:bg-[var(--ad-surface-2)]"
          >
            <FileText className="w-4 h-4 text-violet-500 shrink-0" />
            <div>
              <div>{t('exportHtmlTitle')}</div>
              <div className="text-[10px] font-normal" style={{ color: 'var(--ad-muted)' }}>
                {t('exportHtmlHint')}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => run(() => printAnalyticsReport(snapshot, title), t('printOpened'))}
            className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2.5 hover:bg-[var(--ad-surface-2)]"
          >
            <Printer className="w-4 h-4 text-amber-500 shrink-0" />
            <div>
              <div>{t('exportPdfTitle')}</div>
              <div className="text-[10px] font-normal" style={{ color: 'var(--ad-muted)' }}>
                {t('exportPdfHint')}
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
