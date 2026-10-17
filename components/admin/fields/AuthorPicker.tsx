'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Check, UserPlus, Star } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { cmsAdminList, cmsAdminCreate } from '@/lib/cms-admin';
import Drawer from '@/components/admin/Drawer';

interface AuthorRow {
  id: string | number;
  name: string;
  role?: string;
  bio?: string;
  isFallback?: boolean;
}

interface AuthorPickerProps {
  /** Identifiant de la fiche auteur sélectionnée. */
  value: string | number | null | undefined;
  onChange: (value: string | number | null) => void;
  /**
   * Renseigné en parallèle de l'identifiant : la vitrine et les exports
   * continuent d'afficher un nom même si la fiche est supprimée plus tard.
   */
  onNameChange?: (name: string) => void;
}

/**
 * Choix de l'auteur d'un article par autocomplétion, avec création d'une
 * fiche sans quitter le formulaire.
 *
 * Remplace l'ancien champ texte libre : celui-ci laissait diverger les
 * orthographes d'un même auteur d'un article à l'autre et ne pouvait porter
 * ni qualification ni description.
 */
export default function AuthorPicker({ value, onChange, onNameChange }: AuthorPickerProps) {
  const locale = useLocale();
  const t = useTranslations('admin.authorPicker');
  const [authors, setAuthors] = useState<AuthorRow[]>([]);
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({ name: '', role: '', bio: '' });
  const boxRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      setLoading(true);
      // L'API plafonne `limit` à 100 et attend la langue dans `filter`
      // (comme CmsList), pas en paramètre à plat. On pagine jusqu'à
      // épuisement pour ne pas tronquer silencieusement la liste.
      const rows: AuthorRow[] = [];
      for (let page = 1; page <= 20; page += 1) {
        const chunk = await cmsAdminList<AuthorRow>('authors', {
          limit: '100',
          page: String(page),
          filter: JSON.stringify({ locale }),
        });
        rows.push(...chunk);
        if (chunk.length < 100) break;
      }
      setAuthors(rows);
    } catch (err) {
      console.error('[AuthorPicker] chargement impossible :', err);
      setAuthors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const selected = useMemo(
    () => authors.find((a) => String(a.id) === String(value ?? '')) || null,
    [authors, value],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return authors;
    return authors.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        String(a.role || '').toLowerCase().includes(q),
    );
  }, [authors, search]);

  const choose = (author: AuthorRow | null) => {
    onChange(author ? author.id : null);
    onNameChange?.(author ? author.name : '');
    setIsOpen(false);
    setSearch('');
  };

  const submitDraft = async () => {
    const name = draft.name.trim();
    if (!name) {
      setError(t('nameRequired'));
      return;
    }
    try {
      setSaving(true);
      setError('');
      const created = await cmsAdminCreate<AuthorRow>('authors', {
        name,
        role: draft.role.trim(),
        bio: draft.bio.trim(),
        locale,
        status: 'published',
      });
      // Ajout local : évite un aller-retour et sélectionne immédiatement la fiche.
      const row: AuthorRow = {
        id: created.id,
        name: created.name || name,
        role: created.role ?? draft.role.trim(),
        bio: created.bio ?? draft.bio.trim(),
      };
      setAuthors((prev) => [row, ...prev.filter((a) => String(a.id) !== String(row.id))]);
      choose(row);
      setDrawerOpen(false);
      setDraft({ name: '', role: '', bio: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('createFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <div ref={boxRef} className="relative flex-1">
          {selected ? (
            <div
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border"
              style={{ background: 'var(--ad-bg)', borderColor: 'var(--ad-line)' }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold truncate">{selected.name}</span>
                  {selected.isFallback && (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-1.5 py-0.5 rounded"
                      style={{ background: 'var(--ad-warn)', color: '#000' }}
                    >
                      <Star className="w-3 h-3" /> {t('fallbackBadge')}
                    </span>
                  )}
                </div>
                {selected.role && (
                  <div className="text-[11px] truncate" style={{ color: 'var(--ad-muted)' }}>
                    {selected.role}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  className="ad-btn ad-btn-ghost px-2 py-1 text-xs"
                  onClick={() => setIsOpen((v) => !v)}
                >
                  {t('change')}
                </button>
                <button
                  type="button"
                  aria-label={t('clear')}
                  className="p-1 rounded hover:opacity-70"
                  onClick={() => choose(null)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /*
              `ad-search` place l'icône et réserve le retrait correspondant sur
              l'input, en tenant compte du sens d'écriture : en arabe l'icône
              passe à droite. Un positionnement figé (left-3 / pl-9) collait
              l'icône au texte saisi en RTL.
            */
            <div className="ad-search">
              <Search className="ad-search-ico w-4 h-4" />
              <input
                className="ad-input w-full"
                placeholder={loading ? t('loading') : t('placeholder')}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setIsOpen(true);
                }}
                onFocus={() => setIsOpen(true)}
              />
            </div>
          )}

          {isOpen && (
            <div
              className="absolute z-30 mt-1 w-full max-h-64 overflow-auto rounded-lg border shadow-xl"
              style={{ background: 'var(--ad-surface)', borderColor: 'var(--ad-line)' }}
            >
              {filtered.length === 0 ? (
                <div className="px-3 py-3 text-sm" style={{ color: 'var(--ad-muted)' }}>
                  {loading ? t('loading') : t('noResult')}
                </div>
              ) : (
                filtered.map((a) => {
                  const isSel = String(a.id) === String(value ?? '');
                  return (
                    <button
                      key={String(a.id)}
                      type="button"
                      onClick={() => choose(a)}
                      className="w-full text-start px-3 py-2 flex items-center justify-between gap-2 hover:opacity-80"
                      style={{ background: isSel ? 'var(--ad-bg)' : 'transparent' }}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold truncate">{a.name}</span>
                        {a.role && (
                          <span className="block text-[11px] truncate" style={{ color: 'var(--ad-muted)' }}>
                            {a.role}
                          </span>
                        )}
                      </span>
                      {isSel && <Check className="w-4 h-4 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Création d'une fiche auteur sans quitter le formulaire de l'article. */}
        <button
          type="button"
          className="ad-btn ad-btn-ghost shrink-0"
          title={t('createTitle')}
          onClick={() => {
            setDraft({ name: search.trim(), role: '', bio: '' });
            setError('');
            setDrawerOpen(true);
            setIsOpen(false);
          }}
        >
          <UserPlus className="w-4 h-4" />
        </button>
      </div>

      <Drawer
        open={drawerOpen}
        title={t('createTitle')}
        subtitle={t('createSubtitle')}
        onClose={() => setDrawerOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="ad-btn ad-btn-ghost" onClick={() => setDrawerOpen(false)}>
              {t('cancel')}
            </button>
            <button type="button" className="ad-btn ad-btn-primary" disabled={saving} onClick={submitDraft}>
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
              {t('name')} *
            </label>
            <input
              className="ad-input w-full"
              value={draft.name}
              autoFocus
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder={t('namePlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
              {t('role')}
            </label>
            <input
              className="ad-input w-full"
              value={draft.role}
              onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
              placeholder={t('rolePlaceholder')}
            />
            <p className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>{t('roleHint')}</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>
              {t('bio')}
            </label>
            <textarea
              className="ad-input w-full min-h-[120px]"
              value={draft.bio}
              onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
              placeholder={t('bioPlaceholder')}
            />
            <p className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>{t('bioHint')}</p>
          </div>
          {error && (
            <p className="text-sm" style={{ color: 'var(--ad-danger)' }}>
              {error}
            </p>
          )}
        </div>
      </Drawer>
    </div>
  );
}
