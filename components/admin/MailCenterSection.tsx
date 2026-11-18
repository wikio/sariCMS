'use client';

import { useTranslations } from 'next-intl';

/**
 * Onglet « Emails & notifications » des paramètres — le centre de courrier.
 *
 * Trois choses, et une seule règle : **un message n'est envoyé que si son
 * événement est activé ici**. L'écran pilote `data/mail/*.json` (fichiers sur le
 * serveur, jamais la base de données) et c'est la même configuration que lit
 * `/api/admin/mail-center/send` au moment d'envoyer — il n'y a donc pas de
 * réglage décoratif.
 *
 * - **Modules** : ce que chaque module du CMS peut envoyer. Par événement :
 *   l'objet, le corps (variables de fusion), le gabarit appliqué, la copie
 *   cachée et l'intervalle anti-doublon.
 * - **Gabarits** : l'habillage commun, construit bloc par bloc (logo, titre,
 *   bouton, pied de page légal, désinscription).
 * - **Politique d'envoi** : les plafonds qui empêchent de trop envoyer —
 *   interrupteur général, quota quotidien, quota par destinataire, fenêtre de
 *   dédoublonnage, heures silencieuses.
 * - **Journal** : ce qui est parti, ce qui a été refusé, et pourquoi.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Copy, Eye, History, LayoutTemplate, Mail, MailX,
  Pencil, Plus, RotateCcw, Save, Send, ShieldCheck, Trash2, XCircle,
} from 'lucide-react';
import Drawer from '@/components/admin/Drawer';
import Toggle from '@/components/admin/Toggle';
import HtmlEditor from '@/components/admin/fields/HtmlEditor';
import MailLayoutStudio from '@/components/admin/MailLayoutStudio';
import DateText from '@/components/shared/DateText';
import { useToast } from '@/components/admin/Toast';
import { sendModuleMail } from '@/lib/mail';
import {
  DEFAULT_LAYOUT,
  defaultEventConfig,
  renderMailHtml,
  sampleVars,
  unresolvedVars,
  type MailCenterConfig,
  type MailEventConfig,
  type MailLayout,
  type MailModuleDef,
  type MailPolicy,
  type MailSentEntry,
  type MailVarDef,
} from '@/lib/mail-center';

interface Snapshot {
  policy: MailPolicy;
  modules: Record<string, MailEventConfig>;
  layouts: MailLayout[];
  files: { policy: boolean; modules: boolean; layouts: boolean; log: boolean };
  sent: { today: number; last7Days: number; last: MailSentEntry[] };
  catalog: MailModuleDef[];
  vars: MailVarDef[];
  directory: string;
}

type PanelId = 'modules' | 'layouts' | 'policy' | 'log';

const PANELS: PanelId[] = ['modules', 'layouts', 'policy', 'log'];

const STATUS_CHIP: Record<MailSentEntry['status'], string> = {
  sent: 'ad-chip ad-chip-ok', failed: 'ad-chip ad-chip-warn', skipped: 'ad-chip ad-chip-mute',
};


export default function MailCenterSection() {
  const t = useTranslations('admin.mailCenter');
  const tc = useTranslations('admin.common');
  const ts = useTranslations('admin.settings');
  const tv = useTranslations('admin.mailVariables');
  const { showToast } = useToast();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [panel, setPanel] = useState<PanelId>('modules');

  // Brouillons locaux — rien n'est écrit sur le disque avant « Enregistrer ».
  const [modules, setModules] = useState<Record<string, MailEventConfig>>({});
  const [layouts, setLayouts] = useState<MailLayout[]>([]);
  const [policy, setPolicy] = useState<MailPolicy | null>(null);
  const [dirty, setDirty] = useState<'modules' | 'layouts' | 'policy' | null>(null);

  const [openEvent, setOpenEvent] = useState<string | null>(null);
  const [openModule, setOpenModule] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ title: string; html: string } | null>(null);
  const [studio, setStudio] = useState<MailLayout | null>(null);

  const apply = useCallback((data: Snapshot) => {
    setSnap(data);
    setModules(data.modules);
    setLayouts(data.layouts);
    setPolicy(data.policy);
    setDirty(null);
  }, []);

  /**
   * Fusionne la réponse d'un PUT dans l'instantané courant au lieu de le
   * remplacer.
   *
   * Le serveur ne renvoie que la section enregistrée : `{ok, policy, modules}`
   * pour les modules, `{ok, layouts}` pour les gabarits. Passer cette réponse
   * telle quelle à `apply()` écrasait l'instantané complet et faisait
   * disparaître `catalog`, `vars`, `directory`, `files` et `sent`. Le rendu
   * suivant plantait alors sur `catalog.flatMap(...)` : l'écran tombait en
   * erreur juste après un enregistrement qui avait pourtant réussi côté serveur.
   */
  const applyPartial = (patch: Partial<Snapshot>) => {
    apply({ ...(snap as Snapshot), ...patch } as Snapshot);
  };

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/mail-center', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error((json as { error?: string }).error || t('readFailed'));
      // Rechargement complet : le GET renvoie tout l'instantané, on remplace.
      apply(json as Snapshot);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('loadError'), 'error');
    } finally {
      setLoading(false);
    }
  }, [apply, showToast, t]);

  useEffect(() => { reload(); }, [reload]);

  const save = async (section: 'modules' | 'layouts' | 'policy') => {
    setSaving(true);
    try {
      const payload = section === 'modules' ? { modules } : section === 'layouts' ? { layouts } : { policy };
      const res = await fetch('/api/admin/mail-center', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error((json as { error?: string } | null)?.error || t('saveDenied'));
      applyPartial(json as Partial<Snapshot>);
      showToast(t('savedAt', { path: `${snap?.directory || 'data/mail'}/` }), 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : tc('saveError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const setEvent = (eventId: string, patch: Partial<MailEventConfig>) => {
    setModules((prev) => ({ ...prev, [eventId]: { ...prev[eventId], ...patch } }));
    setDirty('modules');
  };

  const catalog = useMemo(() => (snap?.catalog || []).map((mod) => ({
    ...mod, label: t(`label_${mod.id}`), description: t(`hint_${mod.id}`),
    events: mod.events.map((event) => ({ ...event, label: t(`label_${event.id}`), description: t(`hint_${event.id}`) })),
  })), [snap?.catalog, t]);
  const reasonLabel = (reason: string) => t.has(`reason_${reason}`) ? t(`reason_${reason}`) : reason;

  const varsFor = (eventId: string): MailVarDef[] => {
    const event = catalog.flatMap((m) => m.events).find((e) => e.id === eventId);
    const keys = event?.vars || [];
    const list = (snap?.vars || []).filter((v) => keys.includes(v.key));
    return list.length ? list : snap?.vars || [];
  };

  const previewOf = (eventId: string) => {
    const config = modules[eventId];
    if (!config) return;
    const vars = sampleVars();
    const html = renderMailHtml({
      bodyHtml: config.body,
      layout: layouts.find((l) => l.id === config.layoutId) || null,
      vars,
    });
    const event = catalog.flatMap((m) => m.events).find((e) => e.id === eventId);
    setPreview({ title: `${tc('preview')} — ${event?.label || eventId}`, html });
  };

  const sendTest = async (eventId: string) => {
    const to = window.prompt(t('testAddress'));
    if (!to) return;
    const config = modules[eventId];
    const result = await sendModuleMail({
      event: eventId,
      to: to.trim(),
      vars: sampleVars(),
      test: true,
      override: { subject: config.subject, body: config.body, layoutId: config.layoutId },
    });
    if (result.sent) {
      showToast(t('testSent', { email: to.trim() }), 'success');
      await reload();
    } else {
      showToast(t('testSkipped', { reason: (result.reason && reasonLabel(result.reason)) || result.detail || t('unknownReason') }), 'error');
    }
    if (result.missingVars?.length) {
      showToast(t('missingVars', { list: result.missingVars.join(', ') }), 'error');
    }
  };

  const saveLayout = async (layout: MailLayout) => {
    const next = layouts.some((l) => l.id === layout.id)
      ? layouts.map((l) => (l.id === layout.id ? layout : l))
      : [...layouts, layout];
    setLayouts(next);
    setDirty('layouts');
    setStudio(null);
    // Les gabarits s'enregistrent immédiatement : le constructeur est un atelier.
    setSaving(true);
    try {
      const res = await fetch('/api/admin/mail-center', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layouts: next }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error((json as { error?: string } | null)?.error || t('saveDenied'));
      applyPartial(json as Partial<Snapshot>);
      showToast(t('layoutSaved', { name: layout.name, path: `${snap?.directory || 'data/mail'}/layouts.json` }), 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : tc('saveError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeLayout = (id: string) => {
    if (id === DEFAULT_LAYOUT.id) {
      showToast(t('protectedLayout'), 'error');
      return;
    }
    const usedBy = Object.entries(modules).filter(([, c]) => c.layoutId === id).map(([k]) => k);
    if (usedBy.length) {
      showToast(t('inUse', { count: usedBy.length }), 'error');
      return;
    }
    setLayouts((prev) => prev.filter((l) => l.id !== id));
    setDirty('layouts');
  };

  const enabledCount = useMemo(() => Object.values(modules).filter((c) => c.enabled).length, [modules]);
  const totalEvents = useMemo(() => (snap?.catalog || []).reduce((n, m) => n + m.events.length, 0) || 0, [snap]);

  if (loading && !snap) {
    return <div className="ad-card p-8 text-center text-sm">{t('loading')}</div>;
  }
  if (!snap || !policy) {
    return <div className="ad-card p-8 text-center text-sm">{t('unavailable')}</div>;
  }

  return (
    <div className="space-y-4">
      {/* ————— Bandeau d'état ————— */}
      <div className="ad-card space-y-2 p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          {policy.masterEnabled
            ? <span className="ad-chip ad-chip-ok"><ShieldCheck className="mr-1 inline h-3 w-3" />{t('allowed')}</span>
            : <span className="ad-chip ad-chip-warn"><MailX className="mr-1 inline h-3 w-3" />{t('masterOff')}</span>}
          <span className="ad-chip ad-chip-acc">{t('enabledCount', { enabled: enabledCount, total: totalEvents })}</span>
          <span className="ad-chip ad-chip-mute">{t('layoutCount', { count: layouts.length })}</span>
          <span className="ad-chip ad-chip-mute">{t('sentToday', { count: snap.sent.today })} · {t('sentWeek', { count: snap.sent.last7Days })}</span>
          <span className="font-mono text-[11px]" style={{ color: 'var(--ad-muted)' }}>
            {t('files', { path: `${snap.directory}/*.json` })}
          </span>
        </div>
        <p className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>
          {t('policyHint')}
        </p>
      </div>

      {/* ————— Navigation ————— */}
      <div className="flex flex-wrap gap-1.5">
        {PANELS.map((panelId) => (
          <button
            key={panelId}
            type="button"
            className={`ad-btn ${panel === panelId ? 'ad-btn-primary' : 'ad-btn-ghost'}`}
            onClick={() => setPanel(panelId)}
          >
            {panelId === 'modules' && <Mail className="h-4 w-4" />}
            {panelId === 'layouts' && <LayoutTemplate className="h-4 w-4" />}
            {panelId === 'policy' && <ShieldCheck className="h-4 w-4" />}
            {panelId === 'log' && <History className="h-4 w-4" />}
            {t(panelId)}
          </button>
        ))}
      </div>

      {/* ————— Modules & messages ————— */}
      {panel === 'modules' && (
        <div className="space-y-3">
          {catalog.map((mod) => {
            const modEnabled = mod.events.filter((e) => modules[e.id]?.enabled).length;
            const open = openModule === mod.id;
            return (
              <section key={mod.id} className="ad-card overflow-hidden">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 p-3 text-left"
                  onClick={() => setOpenModule(open ? null : mod.id)}
                >
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="flex-1">
                    <span className="block font-black">{mod.label}</span>
                    <span className="block text-[11px]" style={{ color: 'var(--ad-muted)' }}>{mod.description}</span>
                  </span>
                  <span className="ad-chip ad-chip-mute">{modEnabled}/{mod.events.length}</span>
                </button>

                {open && (
                  <div className="space-y-2 border-t p-3" style={{ borderColor: 'var(--ad-line)' }}>
                    {mod.events.map((event) => {
                      const config = modules[event.id];
                      if (!config) return null;
                      const isOpen = openEvent === event.id;
                      const vars = varsFor(event.id);
                      const unknown = unresolvedVars(`${config.subject} ${config.body}`)
                        .filter((key) => !vars.some((v) => v.key === key));
                      return (
                        <div
                          key={event.id}
                          className="overflow-hidden"
                          style={{ border: '1px solid var(--ad-line)', borderRadius: 8 }}
                        >
                          <div className="flex flex-wrap items-center gap-2 p-2.5">
                            <button
                              type="button"
                              className="flex flex-1 items-start gap-2 text-left"
                              onClick={() => setOpenEvent(isOpen ? null : event.id)}
                            >
                              <span
                                className="mt-1 h-2 w-2 shrink-0 rounded-full"
                                style={{ background: config.enabled ? 'var(--ad-accent)' : 'var(--ad-line)' }}
                              />
                              <span>
                                <span className="block text-sm font-bold">{event.label}</span>
                                <span className="block text-[11px]" style={{ color: 'var(--ad-muted)' }}>
                                  {event.description}
                                  {event.internal && t('internal')}
                                </span>
                              </span>
                            </button>
                            <span className={`ad-chip ${config.enabled ? 'ad-chip-ok' : 'ad-chip-mute'}`}>
                              {config.enabled ? ts('enabled') : ts('disabled')}
                            </span>
                            <button
                              type="button"
                              className="ad-btn ad-btn-ghost"
                              onClick={() => setEvent(event.id, { enabled: !config.enabled })}
                            >
                              {config.enabled ? tc('deactivate') : tc('activate')}
                            </button>
                          </div>

                          {isOpen && (
                            <div className="space-y-3 border-t p-3" style={{ borderColor: 'var(--ad-line)' }}>
                              <div className="grid gap-3 md:grid-cols-2">
                                <label className="block space-y-1">
                                  <span className="field-label">{t('subject')}</span>
                                  <input
                                    className="ad-input"
                                    value={config.subject}
                                    onChange={(e) => setEvent(event.id, { subject: e.target.value })}
                                  />
                                </label>
                                <label className="block space-y-1">
                                  <span className="field-label">{t('layout')}</span>
                                  <select
                                    className="ad-select"
                                    value={config.layoutId}
                                    onChange={(e) => setEvent(event.id, { layoutId: e.target.value })}
                                  >
                                    <option value="">{t('noLayout')}</option>
                                    {layouts.map((l) => (
                                      <option key={l.id} value={l.id}>{l.name}</option>
                                    ))}
                                  </select>
                                </label>
                                <label className="block space-y-1">
                                  <span className="field-label">{t('bcc')}</span>
                                  <input
                                    className="ad-input"
                                    placeholder="compta@sarisysteme.com"
                                    value={config.bcc}
                                    onChange={(e) => setEvent(event.id, { bcc: e.target.value })}
                                  />
                                </label>
                                <label className="block space-y-1">
                                  <span className="field-label">{t('interval')}</span>
                                  <input
                                    type="number"
                                    min={0}
                                    max={8760}
                                    className="ad-input"
                                    value={config.minIntervalHours}
                                    onChange={(e) => setEvent(event.id, { minIntervalHours: Number(e.target.value) || 0 })}
                                  />
                                  <span className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>
                                    {t('intervalHint')}
                                  </span>
                                </label>
                              </div>

                              <div className="space-y-1">
                                <span className="field-label">{t('body')}</span>
                                <HtmlEditor
                                  value={config.body}
                                  onChange={(html) => setEvent(event.id, { body: html })}
                                  mergeVars
                                  mergeVarsList={vars.map((v) => ({ key: `{{${v.key}}}`, label: tv(v.key) }))}
                                  placeholder={t('compose')}
                                />
                              </div>

                              <div className="space-y-1">
                                <span className="field-label">
                                  {t('vars', { count: vars.length })}
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {vars.map((v) => (
                                    <span
                                      key={v.key}
                                      className="ad-chip ad-chip-mute font-mono text-[10px]"
                                      title={t('example', { label: tv(v.key), sample: v.sample })}
                                    >
                                      {`{{${v.key}}}`}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {unknown.length > 0 && (
                                <p className="ad-chip ad-chip-warn">
                                  <AlertTriangle className="mr-1 inline h-3 w-3" />
                                  {t('unknownVars', { list: unknown.map((k) => `{{${k}}}`).join(', ') })}
                                </p>
                              )}

                              <div className="flex flex-wrap gap-2">
                                <button type="button" className="ad-btn ad-btn-ghost" onClick={() => previewOf(event.id)}>
                                  <Eye className="h-4 w-4" /> {tc('preview')}
                                </button>
                                <button type="button" className="ad-btn ad-btn-ghost" onClick={() => sendTest(event.id)}>
                                  <Send className="h-4 w-4" /> {t('test')}
                                </button>
                                <button
                                  type="button"
                                  className="ad-btn ad-btn-ghost"
                                  onClick={() => setEvent(event.id, defaultEventConfig(event.id, config.enabled))}
                                >
                                  <RotateCcw className="h-4 w-4" /> {t('original')}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* ————— Gabarits ————— */}
      {panel === 'layouts' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <p className="flex-1 text-[11px]" style={{ color: 'var(--ad-muted)' }}>
              {t('layoutHint')}{' '}
              <span className="font-mono">{snap.directory}/layouts.json</span>.
            </p>
            <button
              type="button"
              className="ad-btn ad-btn-primary"
              onClick={() => setStudio({
                ...DEFAULT_LAYOUT,
                id: `layout-${Date.now().toString(36)}`,
                name: t('newLayout'),
                updatedAt: new Date().toISOString(),
              })}
            >
              <Plus className="h-4 w-4" /> {t('newLayout')}
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {layouts.map((layout) => {
              const usedBy = Object.entries(modules).filter(([, c]) => c.layoutId === layout.id).length;
              return (
                <article key={layout.id} className="ad-card space-y-2 p-3">
                  <div className="flex items-start gap-2">
                    <LayoutTemplate className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="flex-1">
                      <div className="font-black">{layout.name}</div>
                      <div className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>
                        {t('usage', { blocks: layout.blocks.length, events: usedBy })}
                        {layout.theme.showUnsubscribe ? t('unsubscribeOn') : ''}
                      </div>
                    </div>
                    {layout.id === DEFAULT_LAYOUT.id && <span className="ad-chip ad-chip-acc">{t('default')}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" className="ad-btn ad-btn-ghost" onClick={() => setStudio(layout)}>
                      <Pencil className="h-4 w-4" /> {t('openStudio')}
                    </button>
                    <button
                      type="button"
                      className="ad-btn ad-btn-ghost"
                      onClick={() => setStudio({
                        ...layout,
                        id: `layout-${Date.now().toString(36)}`,
                        name: t('copy', { name: layout.name }),
                        blocks: layout.blocks.map((b, i) => ({ ...b, id: `${b.id}-c${i}` })),
                      })}
                    >
                      <Copy className="h-4 w-4" /> {tc('duplicate')}
                    </button>
                    <button
                      type="button"
                      className="ad-btn ad-btn-icon ad-btn-danger"
                      onClick={() => removeLayout(layout.id)}
                      aria-label={tc('delete')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* ————— Politique d'envoi ————— */}
      {panel === 'policy' && (
        <div className="space-y-3">
          <section className="ad-card space-y-3 p-4">
            <h2 className="ad-section-title">{t('masterSwitch')}</h2>
            <Toggle
              on={policy.masterEnabled}
              label=""
              hint={t('masterHint')}
              onChange={(v) => { setPolicy({ ...policy, masterEnabled: v }); setDirty('policy'); }}
            />
          </section>

          <section className="ad-card space-y-3 p-4">
            <h2 className="ad-section-title">{t('caps')}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block space-y-1">
                <span className="field-label">{t('daily')}</span>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  className="ad-input"
                  value={policy.dailyCap}
                  onChange={(e) => { setPolicy({ ...policy, dailyCap: Number(e.target.value) || 1 }); setDirty('policy'); }}
                />
              </label>
              <label className="block space-y-1">
                <span className="field-label">{t('perRecipient')}</span>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  className="ad-input"
                  value={policy.perRecipientDailyCap}
                  onChange={(e) => { setPolicy({ ...policy, perRecipientDailyCap: Number(e.target.value) || 1 }); setDirty('policy'); }}
                />
              </label>
              <label className="block space-y-1">
                <span className="field-label">{t('window')}</span>
                <input
                  type="number"
                  min={0}
                  max={10080}
                  className="ad-input"
                  value={policy.dedupeWindowMinutes}
                  onChange={(e) => { setPolicy({ ...policy, dedupeWindowMinutes: Number(e.target.value) || 0 }); setDirty('policy'); }}
                />
                <span className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>
                  {t('windowHint')}
                </span>
              </label>
              <label className="block space-y-1">
                <span className="field-label">{t('retention')}</span>
                <input
                  type="number"
                  min={1}
                  max={730}
                  className="ad-input"
                  value={policy.logRetentionDays}
                  onChange={(e) => { setPolicy({ ...policy, logRetentionDays: Number(e.target.value) || 1 }); setDirty('policy'); }}
                />
              </label>
            </div>
          </section>

          <section className="ad-card space-y-3 p-4">
            <h2 className="ad-section-title">{t('reason_quiet_hours')}</h2>
            <Toggle
              on={policy.quietHours.enabled}
              label=""
              hint={t('quietHint')}
              onChange={(v) => { setPolicy({ ...policy, quietHours: { ...policy.quietHours, enabled: v } }); setDirty('policy'); }}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="field-label">{t('from')}</span>
                <input
                  type="time"
                  className="ad-input"
                  value={policy.quietHours.from}
                  onChange={(e) => { setPolicy({ ...policy, quietHours: { ...policy.quietHours, from: e.target.value } }); setDirty('policy'); }}
                />
              </label>
              <label className="block space-y-1">
                <span className="field-label">{t('until')}</span>
                <input
                  type="time"
                  className="ad-input"
                  value={policy.quietHours.to}
                  onChange={(e) => { setPolicy({ ...policy, quietHours: { ...policy.quietHours, to: e.target.value } }); setDirty('policy'); }}
                />
              </label>
            </div>
          </section>

          <section className="ad-card space-y-2 p-4 text-[12px]" style={{ color: 'var(--ad-muted)' }}>
            <h2 className="ad-section-title">{t('advice')}</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>{t('transactional')}</li>
              <li>{t('digest')}</li>
              <li>{t('consent')}</li>
              <li>{t('avoidSpam')}</li>
            </ul>
          </section>
        </div>
      )}

      {/* ————— Journal ————— */}
      {panel === 'log' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="ad-chip ad-chip-acc">{t('sentToday', { count: snap.sent.today })}</span>
            <span className="ad-chip ad-chip-mute">{t('sentWeek', { count: snap.sent.last7Days })}</span>
            <span className="font-mono text-[11px]" style={{ color: 'var(--ad-muted)' }}>
              {snap.files.log ? `${snap.directory}/sent-log.json` : t('noHistory')}
            </span>
            <button type="button" className="ad-btn ad-btn-ghost ml-auto" onClick={reload}>
              <History className="h-4 w-4" /> {tc('refresh')}
            </button>
          </div>

          <div className="ad-card overflow-x-auto">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>{tc('date')}</th><th>{t('module')}</th><th>{t('event')}</th><th>{t('recipient')}</th><th>{t('subject')}</th><th>{t('status')}</th>
                </tr>
              </thead>
              <tbody>
                {snap.sent.last.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center" style={{ color: 'var(--ad-muted)' }}>{t('emptyLog')}</td></tr>
                )}
                {snap.sent.last.map((row) => {
                  const chip = STATUS_CHIP[row.status] || STATUS_CHIP.failed;
                  const event = catalog.flatMap((m) => m.events).find((e) => e.id === row.event);
                  const detail = row.error || (row.reason ? reasonLabel(row.reason) : '');
                  return (
                    <tr key={row.id}>
                      <td className="whitespace-nowrap text-sm"><DateText value={row.at} /></td>
                      <td className="text-sm">{catalog.find((m) => m.id === row.module)?.label || row.module}</td>
                      <td className="text-sm">{event?.label || row.event}</td>
                      <td className="font-mono text-xs">{row.to}</td>
                      <td className="max-w-[240px] truncate text-sm" title={row.subject}>{row.subject}</td>
                      <td>
                        <span className={chip} title={detail}>
                          {row.status === 'sent' && <CheckCircle2 className="mr-1 inline h-3 w-3" />}
                          {row.status === 'failed' && <XCircle className="mr-1 inline h-3 w-3" />}
                          {t(row.status)}
                        </span>
                        {detail && <span className="ml-1 text-[10px]" style={{ color: 'var(--ad-muted)' }}>{detail}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ————— Barre d'enregistrement ————— */}
      {dirty && (
        <div
          className="sticky bottom-3 flex items-center gap-2 rounded-xl p-3"
          style={{ background: 'var(--ad-surface)', border: '1px solid var(--ad-line)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
        >
          <span className="flex-1 text-sm">
            {t('unsaved', { section: t(dirty) })}
          </span>
          <button type="button" className="ad-btn ad-btn-ghost" onClick={reload}>{tc('cancel')}</button>
          <button type="button" className="ad-btn ad-btn-primary" disabled={saving} onClick={() => save(dirty)}>
            <Save className="h-4 w-4" /> {saving ? tc('saving') : tc('save')}
          </button>
        </div>
      )}

      {/* ————— Aperçu ————— */}
      <Drawer open={!!preview} title={preview?.title || tc('preview')} onClose={() => setPreview(null)} width={720}
        footer={<button type="button" className="ad-btn ad-btn-ghost" onClick={() => setPreview(null)}>{tc('close')}</button>}>
        {preview && <iframe title={t('previewTitle')} className="w-full bg-white" style={{ height: 560, border: 0 }} srcDoc={preview.html} />}
      </Drawer>

      {/* ————— Constructeur de gabarit ————— */}
      <Drawer
        open={!!studio}
        title={studio ? `${t('studio')} — ${studio.name}` : t('studio')}
        subtitle={t('studioHint')}
        onClose={() => setStudio(null)}
        width={1100}
      >
        {studio && (
          <MailLayoutStudio layout={studio} saving={saving} onSave={saveLayout} onCancel={() => setStudio(null)} />
        )}
      </Drawer>
    </div>
  );
}
