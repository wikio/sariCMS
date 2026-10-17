'use client';

import { useEffect, useMemo, useState } from 'react';
import { Eye, Inbox, Mail, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { loadMessages, saveMessages, MERGE_VARS, TRIGGERS, type NotifyMessage } from '@/lib/notify-store';
import {
  deleteThread, ensureThread, loadThreads, markThreadRead, sendMessage, unreadForAdmin, unreadForThread,
  threadLabel, type Thread,
} from '@/lib/messages';
import { useToast } from '@/components/admin/Toast';
import Drawer from '@/components/admin/Drawer';
import Toggle from '@/components/admin/Toggle';
import HtmlEditor from '@/components/admin/fields/HtmlEditor';
import SearchField from '@/components/admin/SearchField';
import MessageComposer from '@/components/admin/MessageComposer';
import { renderTemplate, sendMail } from '@/lib/mail';
import { useTranslations } from 'next-intl';
import DateText from '@/components/shared/DateText';

const empty = (): NotifyMessage => ({
  id: `m-${Date.now()}`, name: '', trigger: 'stock_backorder', subject: '', body: '<p></p>', active: true, locale: 'fr',
});

export default function MessagesPage() {
  const t = useTranslations('admin.messages');
  const [tab, setTab] = useState<'inbox' | 'templates'>('inbox');
  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <div className="ad-breadcrumb">Configuration avancée / Messagerie</div>
          <h1 className="text-3xl font-black">{t("title")}</h1>
        </div>
      </header>
      <div className="flex gap-2" style={{ borderBottom: '1px solid var(--ad-line)' }}>
        <button
          className={`ad-btn ${tab === 'inbox' ? 'ad-btn-primary' : 'ad-btn-ghost'}`}
          onClick={() => setTab('inbox')}
        >
          <Inbox className="w-4 h-4" /> Conversations
        </button>
        <button
          className={`ad-btn ${tab === 'templates' ? 'ad-btn-primary' : 'ad-btn-ghost'}`}
          onClick={() => setTab('templates')}
        >
          <Mail className="w-4 h-4" /> Modèles de notification
        </button>
      </div>
      {tab === 'inbox' ? <InboxTab /> : <TemplatesTab />}
    </div>
  );
}

/* ============================ Conversations ============================ */

function InboxTab() {
  const t = useTranslations('admin.messages');
  const { showToast } = useToast();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState('');
  const [compose, setCompose] = useState(false);

  const refresh = () => setThreads(loadThreads());
  const unreadTotal = unreadForAdmin();

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener('sari-threads-changed', handler);
    return () => window.removeEventListener('sari-threads-changed', handler);
  }, []);

  const open = threads.find((t) => t.id === openId) || null;

  const shown = useMemo(() => threads.filter((t) => {
    if (!q.trim()) return true;
    return `${t.name} ${t.email} ${t.subject}`.toLowerCase().includes(q.toLowerCase());
  }), [threads, q]);

  const openThread = (t: Thread) => {
    setOpenId(t.id);
    markThreadRead(t.id, 'admin');
    refresh();
  };

  const send = () => {
    if (!open || !draft.trim()) return;
    sendMessage(open.id, 'admin', draft.trim());
    setDraft('');
    refresh();
  };

  if (open) {
    return (
      <div className="space-y-3">
        <button className="ad-btn ad-btn-ghost" onClick={() => { setOpenId(null); refresh(); }}>← Retour aux conversations</button>
        <div className="ad-card flex flex-col h-[62vh]">
          <div className="p-4 border-b" style={{ borderColor: 'var(--ad-line)' }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-black text-lg">{open.subject}</div>
                <div className="text-sm" style={{ color: 'var(--ad-muted)' }}>
                  {open.name} · {open.email} · <span className="capitalize">{open.type}</span>
                  {threadLabel(open) && <span className="ad-chip ad-chip-acc ml-2">{threadLabel(open)}</span>}
                </div>
              </div>
              <button
                className="ad-btn ad-btn-icon ad-btn-danger"
                title="Supprimer la conversation"
                onClick={() => { if (confirm('Supprimer cette conversation ?')) { deleteThread(open.id); setOpenId(null); refresh(); showToast('Conversation supprimée', 'success'); } }}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto ad-scroll p-4 space-y-3">
            {open.messages.length === 0 && (
              <div className="text-center py-16" style={{ color: 'var(--ad-muted)' }}>
                <Inbox className="w-10 h-10 mx-auto mb-2 opacity-50" /> Aucun message pour le moment.
              </div>
            )}
            {open.messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'admin' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[72%] px-4 py-2.5 text-sm whitespace-pre-wrap"
                  style={{
                    background: m.role === 'admin' ? 'var(--ad-accent)' : 'var(--ad-surface-2)',
                    color: m.role === 'admin' ? 'var(--ad-accent-ink, #fff)' : 'var(--ad-ink)',
                    borderRadius: 10,
                  }}
                >
                  <div className="mb-1 text-[10px] uppercase tracking-wide font-black opacity-70">
                    {m.role === 'admin' ? 'Admin' : open.name} · <DateText value={m.at} />
                  </div>
                  {m.body}
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t flex gap-2" style={{ borderColor: 'var(--ad-line)' }}>
            <input
              className="ad-input flex-1"
              value={draft}
              placeholder={t("writeResponse")}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <button className="ad-btn ad-btn-primary" disabled={!draft.trim()} onClick={send}><Send className="w-4 h-4" /> Envoyer</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="ad-card p-3 flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[220px]"><SearchField value={q} onChange={setQ} placeholder="Rechercher une conversation…" /></div>
        <button className="ad-btn ad-btn-primary" onClick={() => setCompose(true)}><Plus className="w-4 h-4" /> Nouveau message</button>
        {unreadTotal > 0 && <span className="ad-chip ad-chip-warn">{unreadTotal} non lu(s)</span>}
      </div>
      <div className="ad-card overflow-hidden">
        {shown.length === 0 ? (
          <div className="text-center py-20" style={{ color: 'var(--ad-muted)' }}>
            <Inbox className="w-12 h-12 mx-auto mb-3 opacity-50" />
            Aucune conversation. Utilisez « Nouveau message » ou le bouton « Message » sur une commande / un devis.
          </div>
        ) : (
          <table className="ad-table">
            <thead>
              <tr><th>{t("contact")}</th><th>{t("subject")}</th><th>{t("linkedTo")}</th><th>{t("lastMessage")}</th><th></th></tr>
            </thead>
            <tbody>
              {shown.map((t) => {
                const unread = unreadForThread(t, 'admin');
                const last = t.messages[t.messages.length - 1];
                return (
                  <tr key={t.id} className="cursor-pointer" onClick={() => openThread(t)}>
                    <td>
                      <div className="font-bold">{t.name}</div>
                      <div className="text-xs" style={{ color: 'var(--ad-muted)' }}>{t.email} · <span className="capitalize">{t.type}</span></div>
                    </td>
                    <td className="font-semibold">{t.subject}</td>
                    <td>{threadLabel(t) ? <span className="ad-chip ad-chip-acc">{threadLabel(t)}</span> : '—'}</td>
                    <td className="text-sm" style={{ color: 'var(--ad-muted)' }}>
                      {last ? <span className="truncate inline-block max-w-[260px] align-middle">{last.body}</span> : '—'}
                      {last && <span className="block text-[11px]"><DateText value={last.at} /></span>}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      {unread > 0 && <span className="ad-chip ad-chip-warn">{unread}</span>}
                      <button className="ad-btn ad-btn-icon ad-btn-ghost ml-1" onClick={(e) => { e.stopPropagation(); openThread(t); }}><Eye className="w-4 h-4" /></button>
                      <button className="ad-btn ad-btn-icon ad-btn-danger ml-1" onClick={(e) => { e.stopPropagation(); if (confirm('Supprimer cette conversation ?')) { deleteThread(t.id); refresh(); } }}><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {compose && <NewConversation onClose={() => setCompose(false)} onDone={() => { setCompose(false); refresh(); }} />}
    </div>
  );
}

function NewConversation({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const t = useTranslations('admin.messages');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<'client' | 'candidate' | 'partner'>('client');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const { showToast } = useToast();

  const submit = () => {
    if (!email.trim() || !body.trim()) return;
    const thread = ensureThread({
      email,
      name: name.trim() || email,
      type,
      subject: subject.trim() || 'Conversation',
    });
    sendMessage(thread.id, 'admin', body.trim());
    showToast('Message envoyé', 'success');
    onDone();
  };

  return (
    <div className="ad-modal" onClick={onClose}>
      <div className="ad-modal-card space-y-3" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-black">{t("newMessage")}</h2>
        <div className="grid grid-cols-2 gap-3">
          <input className="ad-input" placeholder="Email du destinataire" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="ad-input" placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <select className="ad-select" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="client">{t("client")}</option>
          <option value="candidate">{t("candidate")}</option>
          <option value="partner">{t("partner")}</option>
        </select>
        <input className="ad-input" placeholder="Sujet" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <textarea className="ad-textarea min-h-[140px]" placeholder="Message…" value={body} onChange={(e) => setBody(e.target.value)} autoFocus />
        <div className="flex justify-end gap-2">
          <button className="ad-btn ad-btn-ghost" onClick={onClose}>Annuler</button>
          <button className="ad-btn ad-btn-primary" disabled={!email.trim() || !body.trim()} onClick={submit}><Send className="w-4 h-4" /> Envoyer</button>
        </div>
      </div>
    </div>
  );
}

/* ============================ Modèles ============================ */

function TemplatesTab() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<NotifyMessage[]>([]);
  const [draft, setDraft] = useState<NotifyMessage | null>(null);
  const [mode, setMode] = useState<'edit' | 'consult'>('edit');
  const [q, setQ] = useState('');
  const [trigger, setTrigger] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => { setRows(loadMessages()); }, []);
  const persist = (next: NotifyMessage[], toast = 'Message enregistré') => {
    setRows(next); saveMessages(next); showToast(toast, 'success'); setDraft(null); setSelected([]);
  };
  const shown = useMemo(() => rows.filter((m) => {
    if (trigger && m.trigger !== trigger) return false;
    if (q && !`${m.name} ${m.subject} ${m.trigger}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [rows, q, trigger]);

  return (
    <div className="space-y-4">
      <div className="ad-card p-3 grid md:grid-cols-2 gap-2">
        <SearchField value={q} onChange={setQ} placeholder="Nom, sujet, déclencheur…" />
        <select className="ad-select" value={trigger} onChange={(e) => setTrigger(e.target.value)}>
          <option value="">Tous les déclencheurs</option>
          {TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      {selected.length > 0 && (
        <div className="flex gap-2">
          <button className="ad-btn ad-btn-ghost" onClick={() => persist(rows.map((r) => selected.includes(r.id) ? { ...r, active: true } : r))}>Activer</button>
          <button className="ad-btn ad-btn-ghost" onClick={() => persist(rows.map((r) => selected.includes(r.id) ? { ...r, active: false } : r))}>Désactiver</button>
          <button className="ad-btn ad-btn-danger" onClick={() => persist(rows.filter((r) => !selected.includes(r.id)))}>Supprimer</button>
        </div>
      )}
      <div className="ad-card overflow-x-auto">
        <table className="ad-table">
          <thead><tr><th></th><th>Nom</th><th>Déclencheur</th><th>Langue</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {shown.map((m) => (
              <tr key={m.id}>
                <td><input type="checkbox" checked={selected.includes(m.id)} onChange={(e) => setSelected((s) => e.target.checked ? [...s, m.id] : s.filter((x) => x !== m.id))} /></td>
                <td className="font-bold">{m.name}</td>
                <td>{TRIGGERS.find((t) => t.value === m.trigger)?.label || m.trigger}</td>
                <td>{m.locale.toUpperCase()}</td>
                <td><span className={`ad-chip ${m.active ? 'ad-chip-ok' : 'ad-chip-mute'}`}>{m.active ? 'Actif' : 'Inactif'}</span></td>
                <td className="text-right whitespace-nowrap">
                  <button className="ad-btn ad-btn-ghost" onClick={() => { setMode('consult'); setDraft({ ...m }); }}><Eye className="w-4 h-4" /></button>
                  <button className="ad-btn ad-btn-ghost" onClick={() => { setMode('edit'); setDraft({ ...m }); }}><Pencil className="w-4 h-4" /></button>
                  <button className="ad-btn ad-btn-ghost" title="Tester l'envoi" onClick={async () => {
                    const email = prompt('Adresse de destination du test :');
                    if (!email) return;
                    try {
                      const { subject, html } = renderTemplate(m, {
                        nom_societe: 'SARI Système',
                        nom_client: 'Client de test',
                        email_client: email,
                        numero_commande: '1001',
                        numero_devis: 'DV-2026-00001',
                        montant_ttc: '4 500 DA',
                      });
                      await sendMail({ to: email, subject, html });
                      showToast('Email de test envoyé', 'success');
                    } catch (err) {
                      showToast(err instanceof Error ? err.message : 'Envoi impossible', 'error');
                    }
                  }}><Send className="w-4 h-4" /></button>
                  <button className="ad-btn ad-btn-icon ad-btn-danger" onClick={() => persist(rows.filter((x) => x.id !== m.id))}><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Drawer
        open={!!draft}
        title={mode === 'consult' ? `Consultation · ${draft?.name}` : 'Modèle de message'}
        onClose={() => setDraft(null)}
        width={680}
        footer={mode === 'consult' ? <button className="ad-btn ad-btn-ghost" onClick={() => setDraft(null)}>Fermer</button> : (
          <>
            <button className="ad-btn ad-btn-ghost" onClick={() => setDraft(null)}>Annuler</button>
            <button className="ad-btn ad-btn-primary" onClick={() => {
              if (!draft?.name.trim()) return;
              persist(rows.some((r) => r.id === draft.id) ? rows.map((r) => r.id === draft.id ? draft : r) : [draft, ...rows]);
            }}>Enregistrer</button>
          </>
        )}
      >
        {draft && (
          <>
            <input className="ad-input" disabled={mode === 'consult'} placeholder="Nom interne" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <select className="ad-select" disabled={mode === 'consult'} value={draft.trigger} onChange={(e) => setDraft({ ...draft, trigger: e.target.value })}>
              {TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select className="ad-select" disabled={mode === 'consult'} value={draft.locale} onChange={(e) => setDraft({ ...draft, locale: e.target.value })}>
              <option value="fr">Français</option>
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </select>
            <input className="ad-input" disabled={mode === 'consult'} placeholder="Sujet" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
            <HtmlEditor value={draft.body} onChange={(body) => setDraft({ ...draft, body })} readOnly={mode === 'consult'} mergeVars />
            <Toggle on={draft.active} onChange={(active) => setDraft({ ...draft, active })} label="Actif" disabled={mode === 'consult'} />
          </>
        )}
      </Drawer>
    </div>
  );
}
