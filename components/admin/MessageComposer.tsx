'use client';

import { useState } from 'react';
import { Send, X } from 'lucide-react';
import { ensureThread, sendMessage, type PersonType, type ThreadContext } from '@/lib/messages';
import { useToast } from '@/components/admin/Toast';

/**
 * Composeur de message rapide (modal), réutilisé depuis le backoffice
 * (CommerceDesk, PeopleDesk, Messagerie). Crée ou alimente un fil lié,
 * éventuellement, à un devis ou une commande.
 */
export default function MessageComposer({
  email,
  name,
  type = 'other',
  context,
  subject,
  onClose,
}: {
  email: string;
  name?: string;
  type?: PersonType;
  context?: ThreadContext;
  subject?: string;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [subjectValue, setSubjectValue] = useState(subject || '');
  const [body, setBody] = useState('');

  const submit = () => {
    if (!body.trim()) return;
    const thread = ensureThread({
      email,
      name,
      type,
      subject: subjectValue.trim() || subject || 'Conversation',
      context,
    });
    sendMessage(thread.id, 'admin', body.trim());
    showToast('Message envoyé au client', 'success');
    onClose();
  };

  return (
    <div className="ad-modal" onClick={onClose}>
      <div className="ad-modal-card space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black flex items-center gap-2"><Send className="w-4 h-4" /> Message au client</h2>
            <p className="text-sm" style={{ color: 'var(--ad-muted)' }}>
              {name || email} · {email}
              {context && context.kind !== 'general' && (
                <span className="ad-chip ad-chip-acc ml-2">
                  {context.kind === 'quote' ? `Devis ${context.ref || `#${context.id ?? ''}`}` : `Commande #${context.id ?? ''}`}
                </span>
              )}
            </p>
          </div>
          <button className="ad-btn ad-btn-icon ad-btn-ghost" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        <label className="space-y-1.5">
          <span className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--ad-muted)' }}>Sujet</span>
          <input className="ad-input" value={subjectValue} placeholder="Objet du message…" onChange={(e) => setSubjectValue(e.target.value)} />
        </label>

        <label className="space-y-1.5">
          <span className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--ad-muted)' }}>Message</span>
          <textarea
            className="ad-textarea min-h-[160px]"
            value={body}
            placeholder="Écrivez votre message au client…"
            onChange={(e) => setBody(e.target.value)}
            autoFocus
          />
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button className="ad-btn ad-btn-ghost" onClick={onClose}>Annuler</button>
          <button className="ad-btn ad-btn-primary" disabled={!body.trim()} onClick={submit}>
            <Send className="w-4 h-4" /> Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}
