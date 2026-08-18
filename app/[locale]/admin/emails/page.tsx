'use client';

import { useState } from 'react';
import { Mail, Send } from 'lucide-react';
import { useToast } from '@/components/admin/Toast';

const TEMPLATES = [
  { id: 'welcome', name: 'Bienvenue', subject: 'Bienvenue chez SARI Système' },
  { id: 'quote', name: 'Accusé devis', subject: 'Votre demande de devis' },
  { id: 'job', name: 'Candidature reçue', subject: 'Nous avons bien reçu votre CV' },
  { id: 'newsletter', name: 'Newsletter', subject: 'Les nouveautés SARI' },
];

export default function EmailsPage() {
  const { showToast } = useToast();
  const [active, setActive] = useState(TEMPLATES[0]);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState(TEMPLATES[0].subject);
  const [body, setBody] = useState('<p>Bonjour,</p><p>Merci de votre confiance.</p>');

  return (
    <div className="space-y-4">
      <header className="ad-rise">
        <div className="text-[11px] uppercase tracking-[0.2em] font-black" style={{ color: 'var(--ad-muted)' }}>Transactional</div>
        <h1 className="text-3xl font-black">Emails</h1>
      </header>
      <div className="grid lg:grid-cols-12 gap-4">
        <aside className="lg:col-span-3 ad-card p-3 space-y-1">
          {TEMPLATES.map((tpl) => (
            <button key={tpl.id} onClick={() => { setActive(tpl); setSubject(tpl.subject); }} className={`w-full text-left px-3 py-2 rounded-xl text-sm ${active.id === tpl.id ? 'font-bold' : ''}`} style={{ background: active.id === tpl.id ? 'color-mix(in srgb, var(--ad-accent) 14%, transparent)' : undefined }}>
              <Mail className="w-4 h-4 inline mr-2" />{tpl.name}
            </button>
          ))}
        </aside>
        <section className="lg:col-span-9 ad-card p-5 space-y-3 pixel-frame">
          <input className="ad-input" placeholder="Destinataire" type="email" value={to} onChange={(e) => setTo(e.target.value)} />
          <input className="ad-input font-bold" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <textarea className="ad-textarea min-h-[240px] font-mono text-sm" value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="flex justify-end">
            <button className="ad-btn ad-btn-primary" onClick={() => showToast('File d’envoi prête (SMTP à brancher)', 'info')}>
              <Send className="w-4 h-4" /> Préparer l’envoi
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
