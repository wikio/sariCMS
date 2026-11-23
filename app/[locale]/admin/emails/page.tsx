'use client';

import { useTranslations } from 'next-intl';

import { useEffect, useState } from 'react';
import { History, Mail, Send } from 'lucide-react';
import { useToast } from '@/components/admin/Toast';
import HtmlEditor from '@/components/admin/fields/HtmlEditor';
import { escapeMailText } from '@/lib/mail-center';
import { sendMail, loadOutbox, type OutboxEntry } from '@/lib/mail';
import DateText from '@/components/shared/DateText';

const TEMPLATES = [
  { id: 'welcome', name: 'welcome', subject: 'welcomeSubject' },
  { id: 'quote', name: 'quoteSubject', subject: 'quoteAcknowledgement' },
  { id: 'job', name: 'applicationSubject', subject: 'cvAcknowledgement' },
  { id: 'newsletter', name: 'newsletter', subject: 'newsSubject' },
] as const;

export default function EmailsPage() {
  const t = useTranslations('admin.emails');
  const tc = useTranslations('admin.common');
  const { showToast } = useToast();
  const [active, setActive] = useState<string>(TEMPLATES[0].id);
  const [to, setTo] = useState('');
  const [toName, setToName] = useState('');
  const [subject, setSubject] = useState(() => t(TEMPLATES[0].subject));
  const [body, setBody] = useState(() => `<p>${escapeMailText(t('hello'))}</p><p>${escapeMailText(t('thankYou'))}</p>`);
  const [sending, setSending] = useState(false);
  const [outbox, setOutbox] = useState<OutboxEntry[]>([]);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [showOutbox, setShowOutbox] = useState(false);

  const refreshOutbox = async () => {
    const res = await loadOutbox();
    setOutbox(res.items);
    setSmtpConfigured(res.smtpConfigured);
  };

  useEffect(() => { refreshOutbox(); }, []);

  const send = async () => {
    if (!to.trim() || !subject.trim()) {
      showToast(t('required'), 'error');
      return;
    }
    setSending(true);
    try {
      await sendMail({ to: to.trim(), toName: toName.trim() || undefined, subject, html: body });
      showToast(t('sent'), 'success');
      await refreshOutbox();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('sendError'), 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <header className="ad-rise flex items-end justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] font-black" style={{ color: 'var(--ad-muted)' }}>{t('breadcrumb')}</div>
          <h1 className="text-3xl font-black">{t('title')}</h1>
        </div>
        <button className="ad-btn ad-btn-ghost" onClick={() => { setShowOutbox((v) => !v); refreshOutbox(); }}>
          <History className="w-4 h-4" /> {t('history', { count: outbox.length })}
        </button>
      </header>

      <div className="ad-card p-3 text-sm" style={{ borderColor: smtpConfigured ? 'var(--ad-line)' : 'color-mix(in srgb, var(--ad-accent) 45%, var(--ad-line))' }}>
        {smtpConfigured
          ? <span className="ad-chip ad-chip-ok">{t('smtpConnected')}</span>
          : <span className="ad-chip ad-chip-warn">{t('smtpOff')}</span>}
        <span className="ml-2" style={{ color: 'var(--ad-muted)' }}>{t('smtpHint')}</span>
      </div>

      {showOutbox && (
        <div className="ad-card overflow-x-auto">
          <table className="ad-table">
            <thead><tr><th>{t('to')}</th><th>{t('subject')}</th><th>{tc('date')}</th><th>{t('mode')}</th></tr></thead>
            <tbody>
              {outbox.length === 0 && <tr><td colSpan={4} className="text-center py-8" style={{ color: 'var(--ad-muted)' }}>{t('empty')}</td></tr>}
              {outbox.map((m) => (
                <tr key={m.id}>
                  <td className="font-bold">{m.to}</td>
                  <td>{m.subject}</td>
                  <td className="text-sm"><DateText value={m.sentAt} /></td>
                  <td><span className={`ad-chip ${m.provider === 'smtp' ? 'ad-chip-ok' : 'ad-chip-mute'}`}>{m.provider === 'smtp' ? 'SMTP' : t('fileMode')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-4">
        <aside className="lg:col-span-3 ad-card p-3 space-y-1">
          {TEMPLATES.map((tpl) => (
            <button key={tpl.id} onClick={() => { setActive(tpl.id); setSubject(t(tpl.subject)); }} className={`w-full text-left px-3 py-2 text-sm ${active === tpl.id ? 'font-bold' : ''}`} style={{ background: active === tpl.id ? 'color-mix(in srgb, var(--ad-accent) 14%, transparent)' : undefined }}>
              <Mail className="w-4 h-4 inline mr-2" />{t(tpl.name)}
            </button>
          ))}
        </aside>
        <section className="lg:col-span-9 ad-card p-5 space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <label className="space-y-1.5">
              <span className="field-label">{t('recipient')}</span>
              <input className="ad-input" placeholder="client@exemple.dz" type="email" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            <label className="space-y-1.5">
              <span className="field-label">{t('recipientName')}</span>
              <input className="ad-input" placeholder={t('fullName')} value={toName} onChange={(e) => setToName(e.target.value)} />
            </label>
          </div>
          <label className="space-y-1.5 block">
            <span className="field-label">{t('subject')}</span>
            <input className="ad-input font-bold" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label className="space-y-1.5 block">
            <span className="field-label">{t('body')}</span>
            <HtmlEditor value={body} onChange={setBody} placeholder={t('write')} />
          </label>
          <div className="flex justify-end">
            <button className="ad-btn ad-btn-primary" disabled={sending} onClick={send}>
              <Send className="w-4 h-4" /> {sending ? t('sending') : tc('send')}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
