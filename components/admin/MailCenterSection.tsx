'use client';

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

const PANELS: { id: PanelId; label: string }[] = [
  { id: 'modules', label: 'Modules & messages' },
  { id: 'layouts', label: 'Gabarits' },
  { id: 'policy', label: 'Politique d’envoi' },
  { id: 'log', label: 'Journal' },
];

const STATUS_CHIP: Record<MailSentEntry['status'], { className: string; label: string }> = {
  sent: { className: 'ad-chip ad-chip-ok', label: 'Envoyé' },
  failed: { className: 'ad-chip ad-chip-warn', label: 'Échec' },
  skipped: { className: 'ad-chip ad-chip-mute', label: 'Refusé' },
};

const REASON_LABELS: Record<string, string> = {
  master_off: 'Interrupteur général coupé',
  disabled: 'Événement désactivé',
  no_recipient: 'Destinataire invalide',
  unknown_event: 'Événement inconnu',
  duplicate: 'Doublon évité',
  daily_cap: 'Plafond quotidien atteint',
  recipient_cap: 'Plafond par destinataire atteint',
  quiet_hours: 'Heures silencieuses',
  transport_error: 'Échec du transport SMTP',
  test: 'Envoi de test',
};

export default function MailCenterSection() {
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

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/mail-center', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error((json as { error?: string }).error || 'Lecture impossible.');
      apply(json as Snapshot);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Centre de courrier illisible.', 'error');
    } finally {
      setLoading(false);
    }
  }, [apply, showToast]);

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
      if (!res.ok) throw new Error((json as { error?: string } | null)?.error || 'Enregistrement refusé.');
      apply(json as Snapshot);
      showToast(`Enregistré dans ${snap?.directory || 'data/mail'}/`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Enregistrement impossible.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const setEvent = (eventId: string, patch: Partial<MailEventConfig>) => {
    setModules((prev) => ({ ...prev, [eventId]: { ...prev[eventId], ...patch } }));
    setDirty('modules');
  };

  const varsFor = (eventId: string): MailVarDef[] => {
    const event = snap?.catalog.flatMap((m) => m.events).find((e) => e.id === eventId);
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
    const event = snap?.catalog.flatMap((m) => m.events).find((e) => e.id === eventId);
    setPreview({ title: `Aperçu — ${event?.label || eventId}`, html });
  };

  const sendTest = async (eventId: string) => {
    const to = window.prompt('Adresse de destination du test :');
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
      showToast(`Test envoyé à ${to.trim()}.`, 'success');
      await reload();
    } else {
      showToast(`Test non envoyé : ${result.detail || REASON_LABELS[result.reason || ''] || 'raison inconnue'}`, 'error');
    }
    if (result.missingVars?.length) {
      showToast(`Variables non fournies dans ce test : ${result.missingVars.join(', ')}`, 'error');
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
      if (!res.ok) throw new Error((json as { error?: string } | null)?.error || 'Enregistrement refusé.');
      apply(json as Snapshot);
      showToast(`Gabarit « ${layout.name} » enregistré dans ${snap?.directory || 'data/mail'}/layouts.json`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Enregistrement impossible.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeLayout = (id: string) => {
    if (id === DEFAULT_LAYOUT.id) {
      showToast('Le gabarit par défaut ne peut pas être supprimé.', 'error');
      return;
    }
    const usedBy = Object.entries(modules).filter(([, c]) => c.layoutId === id).map(([k]) => k);
    if (usedBy.length) {
      showToast(`Gabarit utilisé par ${usedBy.length} événement(s) : réaffectez-les d’abord.`, 'error');
      return;
    }
    setLayouts((prev) => prev.filter((l) => l.id !== id));
    setDirty('layouts');
  };

  const enabledCount = useMemo(() => Object.values(modules).filter((c) => c.enabled).length, [modules]);
  const totalEvents = useMemo(() => snap?.catalog.reduce((n, m) => n + m.events.length, 0) || 0, [snap]);

  if (loading && !snap) {
    return <div className="ad-card p-8 text-center text-sm">Chargement du centre de courrier…</div>;
  }
  if (!snap || !policy) {
    return <div className="ad-card p-8 text-center text-sm">Centre de courrier indisponible.</div>;
  }

  return (
    <div className="space-y-4">
      {/* ————— Bandeau d'état ————— */}
      <div className="ad-card space-y-2 p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          {policy.masterEnabled
            ? <span className="ad-chip ad-chip-ok"><ShieldCheck className="mr-1 inline h-3 w-3" />Envois autorisés</span>
            : <span className="ad-chip ad-chip-warn"><MailX className="mr-1 inline h-3 w-3" />Interrupteur général coupé — aucun email ne part</span>}
          <span className="ad-chip ad-chip-acc">{enabledCount}/{totalEvents} événements activés</span>
          <span className="ad-chip ad-chip-mute">{layouts.length} gabarit(s)</span>
          <span className="ad-chip ad-chip-mute">{snap.sent.today} envoi(s) aujourd’hui · {snap.sent.last7Days} sur 7 jours</span>
          <span className="font-mono text-[11px]" style={{ color: 'var(--ad-muted)' }}>
            réglages : {snap.directory}/*.json (hors base de données)
          </span>
        </div>
        <p className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>
          Un événement désactivé ne part jamais, même si le code du module appelle l'envoi. Les plafonds de la
          politique d'envoi sont appliqués côté serveur : ils ne peuvent pas être contournés depuis le navigateur.
        </p>
      </div>

      {/* ————— Navigation ————— */}
      <div className="flex flex-wrap gap-1.5">
        {PANELS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`ad-btn ${panel === p.id ? 'ad-btn-primary' : 'ad-btn-ghost'}`}
            onClick={() => setPanel(p.id)}
          >
            {p.id === 'modules' && <Mail className="h-4 w-4" />}
            {p.id === 'layouts' && <LayoutTemplate className="h-4 w-4" />}
            {p.id === 'policy' && <ShieldCheck className="h-4 w-4" />}
            {p.id === 'log' && <History className="h-4 w-4" />}
            {p.label}
          </button>
        ))}
      </div>

      {/* ————— Modules & messages ————— */}
      {panel === 'modules' && (
        <div className="space-y-3">
          {snap.catalog.map((mod) => {
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
                                  {event.internal && ' · destinataire : l’entreprise'}
                                </span>
                              </span>
                            </button>
                            <span className={`ad-chip ${config.enabled ? 'ad-chip-ok' : 'ad-chip-mute'}`}>
                              {config.enabled ? 'Activé' : 'Désactivé'}
                            </span>
                            <button
                              type="button"
                              className="ad-btn ad-btn-ghost"
                              onClick={() => setEvent(event.id, { enabled: !config.enabled })}
                            >
                              {config.enabled ? 'Désactiver' : 'Activer'}
                            </button>
                          </div>

                          {isOpen && (
                            <div className="space-y-3 border-t p-3" style={{ borderColor: 'var(--ad-line)' }}>
                              <div className="grid gap-3 md:grid-cols-2">
                                <label className="block space-y-1">
                                  <span className="field-label">Objet du message</span>
                                  <input
                                    className="ad-input"
                                    value={config.subject}
                                    onChange={(e) => setEvent(event.id, { subject: e.target.value })}
                                  />
                                </label>
                                <label className="block space-y-1">
                                  <span className="field-label">Gabarit appliqué</span>
                                  <select
                                    className="ad-select"
                                    value={config.layoutId}
                                    onChange={(e) => setEvent(event.id, { layoutId: e.target.value })}
                                  >
                                    <option value="">Aucun — envoyer le corps seul</option>
                                    {layouts.map((l) => (
                                      <option key={l.id} value={l.id}>{l.name}</option>
                                    ))}
                                  </select>
                                </label>
                                <label className="block space-y-1">
                                  <span className="field-label">Copie cachée (optionnelle)</span>
                                  <input
                                    className="ad-input"
                                    placeholder="compta@sarisysteme.com"
                                    value={config.bcc}
                                    onChange={(e) => setEvent(event.id, { bcc: e.target.value })}
                                  />
                                </label>
                                <label className="block space-y-1">
                                  <span className="field-label">Intervalle anti-doublon (heures)</span>
                                  <input
                                    type="number"
                                    min={0}
                                    max={8760}
                                    className="ad-input"
                                    value={config.minIntervalHours}
                                    onChange={(e) => setEvent(event.id, { minIntervalHours: Number(e.target.value) || 0 })}
                                  />
                                  <span className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>
                                    Deux envois de cet événement vers la même adresse seront espacés d’au moins ce
                                    délai. 0 = désactivé.
                                  </span>
                                </label>
                              </div>

                              <div className="space-y-1">
                                <span className="field-label">Corps du message</span>
                                <HtmlEditor
                                  value={config.body}
                                  onChange={(html) => setEvent(event.id, { body: html })}
                                  mergeVars
                                  mergeVarsList={vars.map((v) => ({ key: `{{${v.key}}}`, label: `${v.label} · {{${v.key}}}` }))}
                                  placeholder="Rédigez le message…"
                                />
                              </div>

                              <div className="space-y-1">
                                <span className="field-label">
                                  Arguments disponibles pour cet événement ({vars.length})
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {vars.map((v) => (
                                    <span
                                      key={v.key}
                                      className="ad-chip ad-chip-mute font-mono text-[10px]"
                                      title={`${v.label} — exemple : ${v.sample}`}
                                    >
                                      {`{{${v.key}}}`}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {unknown.length > 0 && (
                                <p className="ad-chip ad-chip-warn">
                                  <AlertTriangle className="mr-1 inline h-3 w-3" />
                                  Variables inconnues pour cet événement : {unknown.map((k) => `{{${k}}}`).join(', ')}.
                                  Elles partiront vides.
                                </p>
                              )}

                              <div className="flex flex-wrap gap-2">
                                <button type="button" className="ad-btn ad-btn-ghost" onClick={() => previewOf(event.id)}>
                                  <Eye className="h-4 w-4" /> Aperçu
                                </button>
                                <button type="button" className="ad-btn ad-btn-ghost" onClick={() => sendTest(event.id)}>
                                  <Send className="h-4 w-4" /> Envoyer un test
                                </button>
                                <button
                                  type="button"
                                  className="ad-btn ad-btn-ghost"
                                  onClick={() => setEvent(event.id, defaultEventConfig(event.id, config.enabled))}
                                >
                                  <RotateCcw className="h-4 w-4" /> Modèle d’origine
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
              Un gabarit est l’habillage commun (logo, couleurs, pied de page légal, désinscription). Le texte de
              chaque événement vient se loger dans son bloc « Corps du message ». Enregistré dans{' '}
              <span className="font-mono">{snap.directory}/layouts.json</span>.
            </p>
            <button
              type="button"
              className="ad-btn ad-btn-primary"
              onClick={() => setStudio({
                ...DEFAULT_LAYOUT,
                id: `layout-${Date.now().toString(36)}`,
                name: 'Nouveau gabarit',
                updatedAt: new Date().toISOString(),
              })}
            >
              <Plus className="h-4 w-4" /> Nouveau gabarit
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
                        {layout.blocks.length} bloc(s) · utilisé par {usedBy} événement(s)
                        {layout.theme.showUnsubscribe ? ' · désinscription affichée' : ''}
                      </div>
                    </div>
                    {layout.id === DEFAULT_LAYOUT.id && <span className="ad-chip ad-chip-acc">par défaut</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" className="ad-btn ad-btn-ghost" onClick={() => setStudio(layout)}>
                      <Pencil className="h-4 w-4" /> Ouvrir le constructeur
                    </button>
                    <button
                      type="button"
                      className="ad-btn ad-btn-ghost"
                      onClick={() => setStudio({
                        ...layout,
                        id: `layout-${Date.now().toString(36)}`,
                        name: `${layout.name} (copie)`,
                        blocks: layout.blocks.map((b, i) => ({ ...b, id: `${b.id}-c${i}` })),
                      })}
                    >
                      <Copy className="h-4 w-4" /> Dupliquer
                    </button>
                    <button
                      type="button"
                      className="ad-btn ad-btn-icon ad-btn-danger"
                      onClick={() => removeLayout(layout.id)}
                      aria-label="Supprimer"
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
            <h2 className="ad-section-title">Interrupteur général</h2>
            <Toggle
              on={policy.masterEnabled}
              label=""
              hint="Coupé, plus aucun module n'envoie d'email — y compris les accusés de réception. À utiliser pour une maintenance ou un incident de délivrabilité."
              onChange={(v) => { setPolicy({ ...policy, masterEnabled: v }); setDirty('policy'); }}
            />
          </section>

          <section className="ad-card space-y-3 p-4">
            <h2 className="ad-section-title">Plafonds — ne pas trop envoyer</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block space-y-1">
                <span className="field-label">Envois par jour (tous modules)</span>
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
                <span className="field-label">Envois par destinataire et par jour</span>
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
                <span className="field-label">Fenêtre de dédoublonnage (minutes)</span>
                <input
                  type="number"
                  min={0}
                  max={10080}
                  className="ad-input"
                  value={policy.dedupeWindowMinutes}
                  onChange={(e) => { setPolicy({ ...policy, dedupeWindowMinutes: Number(e.target.value) || 0 }); setDirty('policy'); }}
                />
                <span className="text-[11px]" style={{ color: 'var(--ad-muted)' }}>
                  Une même clé d'envoi (fiche + événement) ne repart pas deux fois dans cette fenêtre.
                </span>
              </label>
              <label className="block space-y-1">
                <span className="field-label">Historique conservé (jours)</span>
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
            <h2 className="ad-section-title">Heures silencieuses</h2>
            <Toggle
              on={policy.quietHours.enabled}
              label=""
              hint="Entre ces heures, aucun envoi ne part. Les messages refusés sont journalisés, pas perdus : ils restent visibles dans l'onglet Journal."
              onChange={(v) => { setPolicy({ ...policy, quietHours: { ...policy.quietHours, enabled: v } }); setDirty('policy'); }}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="field-label">À partir de</span>
                <input
                  type="time"
                  className="ad-input"
                  value={policy.quietHours.from}
                  onChange={(e) => { setPolicy({ ...policy, quietHours: { ...policy.quietHours, from: e.target.value } }); setDirty('policy'); }}
                />
              </label>
              <label className="block space-y-1">
                <span className="field-label">Jusqu’à</span>
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
            <h2 className="ad-section-title">Ce que ces réglages ne remplacent pas</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Un email transactionnel attendu (commande, devis, candidature) se limite à un message par étape.</li>
              <li>Les alertes internes gagnent à être regroupées dans un résumé quotidien plutôt qu’un email par événement.</li>
              <li>Toute diffusion (newsletter, campagne) exige un consentement explicite et un lien de désinscription.</li>
              <li>Relances de panier, « vous nous manquez », demandes d’avis : à éviter — c’est ce qui fait classer le domaine en indésirable.</li>
            </ul>
          </section>
        </div>
      )}

      {/* ————— Journal ————— */}
      {panel === 'log' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="ad-chip ad-chip-acc">{snap.sent.today} envoi(s) aujourd’hui</span>
            <span className="ad-chip ad-chip-mute">{snap.sent.last7Days} sur 7 jours</span>
            <span className="font-mono text-[11px]" style={{ color: 'var(--ad-muted)' }}>
              {snap.files.log ? `${snap.directory}/sent-log.json` : 'aucun envoi enregistré pour l’instant'}
            </span>
            <button type="button" className="ad-btn ad-btn-ghost ml-auto" onClick={reload}>
              <History className="h-4 w-4" /> Actualiser
            </button>
          </div>

          <div className="ad-card overflow-x-auto">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Date</th><th>Module</th><th>Événement</th><th>Destinataire</th><th>Objet</th><th>État</th>
                </tr>
              </thead>
              <tbody>
                {snap.sent.last.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center" style={{ color: 'var(--ad-muted)' }}>Aucun envoi.</td></tr>
                )}
                {snap.sent.last.map((row) => {
                  const chip = STATUS_CHIP[row.status] || STATUS_CHIP.failed;
                  const event = snap.catalog.flatMap((m) => m.events).find((e) => e.id === row.event);
                  const detail = row.error || (row.reason ? REASON_LABELS[row.reason] || row.reason : '');
                  return (
                    <tr key={row.id}>
                      <td className="whitespace-nowrap text-sm"><DateText value={row.at} /></td>
                      <td className="text-sm">{snap.catalog.find((m) => m.id === row.module)?.label || row.module}</td>
                      <td className="text-sm">{event?.label || row.event}</td>
                      <td className="font-mono text-xs">{row.to}</td>
                      <td className="max-w-[240px] truncate text-sm" title={row.subject}>{row.subject}</td>
                      <td>
                        <span className={chip.className} title={detail}>
                          {row.status === 'sent' && <CheckCircle2 className="mr-1 inline h-3 w-3" />}
                          {row.status === 'failed' && <XCircle className="mr-1 inline h-3 w-3" />}
                          {chip.label}
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
            Modifications non enregistrées ({dirty === 'modules' ? 'modules & messages' : dirty === 'layouts' ? 'gabarits' : 'politique d’envoi'}).
          </span>
          <button type="button" className="ad-btn ad-btn-ghost" onClick={reload}>Annuler</button>
          <button type="button" className="ad-btn ad-btn-primary" disabled={saving} onClick={() => save(dirty)}>
            <Save className="h-4 w-4" /> {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      )}

      {/* ————— Aperçu ————— */}
      <Drawer open={!!preview} title={preview?.title || 'Aperçu'} onClose={() => setPreview(null)} width={720}
        footer={<button type="button" className="ad-btn ad-btn-ghost" onClick={() => setPreview(null)}>Fermer</button>}>
        {preview && <iframe title="Aperçu du message" className="w-full bg-white" style={{ height: 560, border: 0 }} srcDoc={preview.html} />}
      </Drawer>

      {/* ————— Constructeur de gabarit ————— */}
      <Drawer
        open={!!studio}
        title={studio ? `Constructeur — ${studio.name}` : 'Constructeur'}
        subtitle="Blocs, charte et aperçu. Enregistré dans data/mail/layouts.json."
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
