'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Lock, Plus, Shield, Trash2, X } from 'lucide-react';
import PixelGridLoader from '@/components/admin/PixelGridLoader';
import { useToast } from '@/components/admin/Toast';
import { cmsAdminCreate, cmsAdminDelete, cmsAdminList, cmsAdminUpdate } from '@/lib/cms-admin';
import { CmsError } from '@/lib/cms';
import { useTranslations } from 'next-intl';

const ACTIONS = ['create', 'read', 'update', 'delete', 'admin'] as const;

/**
 * Les ids sont des entiers en MySQL/Postgres et des UUID avec le driver JSON.
 * Tout comparer sous forme de chaîne évite le piège d'origine : la page
 * construisait un `Set` d'ids numériques puis testait `has('1')`, qui est
 * toujours faux — aucune case ne pouvait donc apparaître cochée.
 */
const key = (v: unknown) => String(v ?? '');

interface RoleRow extends Record<string, unknown> {
  id?: unknown;
  name?: unknown;
  slug?: unknown;
  isSystem?: unknown;
  permissionIds?: unknown;
}

export default function AdminPermissionsPage() {
  const { showToast } = useToast();
  const t = useTranslations('admin.permissions');
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [perms, setPerms] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: '', slug: '', description: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([
        cmsAdminList<RoleRow>('roles', { limit: '100' }),
        loadAllPermissions(),
      ]);
      setRoles(r);
      setPerms(p);
      setActive((prev) => (prev && r.some((x) => key(x.id) === prev) ? prev : key(r[0]?.id)));
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : t('loadError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Ressources réellement présentes en base, plutôt qu'une liste figée dans le code. */
  const resources = useMemo(() => {
    const set = new Set(perms.map((p) => String(p.resource)));
    return Array.from(set).sort();
  }, [perms]);

  const role = roles.find((r) => key(r.id) === active);
  const isSystem = Boolean(role?.isSystem);
  const granted = useMemo(
    () => new Set((Array.isArray(role?.permissionIds) ? role?.permissionIds : []).map(key)),
    [role],
  );

  const idFor = (resource: string, action: string) =>
    key(perms.find((p) => p.resource === resource && p.action === action)?.id);

  const persist = async (ids: Set<string>) => {
    if (!role) return;
    setSaving(true);
    try {
      const updated = await cmsAdminUpdate<RoleRow>('roles', key(role.id), {
        permissionIds: Array.from(ids),
      });
      setRoles((prev) => prev.map((r) => (key(r.id) === key(role.id) ? { ...r, ...updated } : r)));
      showToast(t('saved'), 'success');
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : t('saveError'), 'error');
      load(); // resynchronise l'affichage sur l'état réel du serveur
    } finally {
      setSaving(false);
    }
  };

  const toggle = (resource: string, action: string) => {
    if (!role || isSystem) return;
    const pid = idFor(resource, action);
    if (!pid) return;
    const next = new Set(granted);
    if (next.has(pid)) next.delete(pid);
    else next.add(pid);
    persist(next);
  };

  const toggleRow = (resource: string) => {
    if (!role || isSystem) return;
    const ids = ACTIONS.map((a) => idFor(resource, a)).filter(Boolean);
    const all = ids.every((id) => granted.has(id));
    const next = new Set(granted);
    ids.forEach((id) => (all ? next.delete(id) : next.add(id)));
    persist(next);
  };

  const setAll = (on: boolean) => {
    if (!role || isSystem) return;
    persist(on ? new Set(perms.map((p) => key(p.id))) : new Set());
  };

  const createRole = async () => {
    const name = draft.name.trim();
    const slug = draft.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
    if (!name || !slug) {
      showToast(t('nameRequired'), 'error');
      return;
    }
    setSaving(true);
    try {
      const created = await cmsAdminCreate<RoleRow>('roles', {
        name,
        slug,
        description: draft.description.trim() || undefined,
        permissionIds: [],
      });
      setRoles((prev) => [...prev, created]);
      setActive(key(created.id));
      setCreating(false);
      setDraft({ name: '', slug: '', description: '' });
      showToast(t('created'), 'success');
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : t('saveError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeRole = async (r: RoleRow) => {
    if (r.isSystem) return;
    if (!window.confirm(t('deleteConfirm'))) return;
    try {
      await cmsAdminDelete('roles', key(r.id));
      setRoles((prev) => prev.filter((x) => key(x.id) !== key(r.id)));
      if (key(r.id) === active) setActive(key(roles.find((x) => key(x.id) !== key(r.id))?.id));
      showToast(t('deleted'), 'success');
    } catch (err) {
      showToast(err instanceof CmsError ? err.message : t('saveError'), 'error');
    }
  };

  if (loading) return <div className="ad-card"><PixelGridLoader label="ACL" /></div>;

  return (
    <div className="space-y-4">
      <div className="ad-rise">
        <div className="text-[11px] uppercase tracking-[0.2em] font-bold" style={{ color: 'var(--ad-muted)' }}>
          {t('rbac')}
        </div>
        <h1 className="text-2xl font-black">{t('title')}</h1>
        <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>{t('subtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {roles.map((r) => (
          <span key={key(r.id)} className="inline-flex items-center">
            <button
              onClick={() => setActive(key(r.id))}
              className={`ad-btn ${active === key(r.id) ? 'ad-btn-primary' : 'ad-btn-ghost'}`}
            >
              {r.isSystem ? <Lock className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
              {String(r.name)}
            </button>
            {!r.isSystem && (
              <button
                onClick={() => removeRole(r)}
                title={t('delete')}
                className="ad-btn ad-btn-ghost px-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </span>
        ))}
        <button onClick={() => setCreating((v) => !v)} className="ad-btn ad-btn-ghost">
          {creating ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {t('newRole')}
        </button>
      </div>

      {creating && (
        <div className="ad-card ad-rise space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <input
              className="ad-input"
              placeholder={t('roleName')}
              value={draft.name}
              onChange={(e) => {
                const name = e.target.value;
                setDraft((d) => ({
                  ...d,
                  name,
                  // slug pré-rempli tant que l'utilisateur ne l'a pas édité
                  slug: d.slug && d.slug !== slugify(d.name) ? d.slug : slugify(name),
                }));
              }}
            />
            <input
              className="ad-input"
              placeholder={t('roleSlug')}
              value={draft.slug}
              onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))}
            />
            <input
              className="ad-input"
              placeholder={t('roleDescription')}
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <button className="ad-btn ad-btn-primary" onClick={createRole} disabled={saving}>
              {t('create')}
            </button>
            <button className="ad-btn ad-btn-ghost" onClick={() => setCreating(false)}>
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      {!roles.length ? (
        <div className="ad-card text-sm" style={{ color: 'var(--ad-muted)' }}>{t('noRole')}</div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span style={{ color: 'var(--ad-muted)' }}>
              {t('permissionCount', { count: granted.size })}
            </span>
            {isSystem ? (
              <span className="inline-flex items-center gap-1" style={{ color: 'var(--ad-muted)' }}>
                <Lock className="w-3.5 h-3.5" /> {t('systemRole')}
              </span>
            ) : (
              <>
                <button className="ad-btn ad-btn-ghost" onClick={() => setAll(true)} disabled={saving}>
                  {t('selectAll')}
                </button>
                <button className="ad-btn ad-btn-ghost" onClick={() => setAll(false)} disabled={saving}>
                  {t('clearAll')}
                </button>
              </>
            )}
          </div>

          <div className="ad-card overflow-x-auto ad-rise ad-rise-2">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>{t('resource')}</th>
                  {ACTIONS.map((a) => <th key={a} className="text-center">{a}</th>)}
                </tr>
              </thead>
              <tbody>
                {resources.map((res) => (
                  <tr key={res}>
                    <td>
                      <button
                        className="font-semibold capitalize hover:underline disabled:no-underline"
                        onClick={() => toggleRow(res)}
                        disabled={isSystem || saving}
                      >
                        {res}
                      </button>
                    </td>
                    {ACTIONS.map((act) => {
                      const pid = idFor(res, act);
                      const on = Boolean(pid) && granted.has(pid);
                      return (
                        <td key={act} className="text-center">
                          <button
                            disabled={!pid || isSystem || saving}
                            onClick={() => toggle(res, act)}
                            aria-pressed={on}
                            aria-label={`${res}:${act}`}
                            title={pid ? `${res}:${act}` : '—'}
                            className={`w-8 h-8 rounded-lg inline-flex items-center justify-center ${
                              on ? 'ad-btn-primary' : 'ad-btn-ghost'
                            } ${!pid || isSystem ? 'opacity-40 cursor-not-allowed' : ''}`}
                          >
                            {on && <Check className="w-4 h-4" />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function slugify(v: string) {
  return v.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * L'API plafonne `limit` à 100, or le catalogue compte plus de 100 permissions
 * (23 ressources × 5 actions). Une requête unique tronquerait la matrice sans
 * le signaler : on parcourt donc les pages jusqu'à épuisement.
 */
async function loadAllPermissions(): Promise<Array<Record<string, unknown>>> {
  const out: Array<Record<string, unknown>> = [];
  for (let page = 1; page <= 20; page += 1) {
    const chunk = await cmsAdminList('permissions', { limit: '100', page: String(page) });
    out.push(...chunk);
    if (chunk.length < 100) break;
  }
  return out;
}
