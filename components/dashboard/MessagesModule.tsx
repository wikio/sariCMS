'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Inbox, Mail, Send, Trash2 } from 'lucide-react';
import type { User } from '@/contexts/AuthContext';
import {
  markThreadRead, sendMessage, threadsForUser, unreadForThread, threadLabel,
  type Thread,
} from '@/lib/messages';

/**
 * Messagerie côté utilisateur (client / candidat / partenaire).
 * Affiche les conversations liées aux devis/commandes et permet de répondre.
 */
export default function MessagesModule({ user }: { user: User }) {
  const t = useTranslations('pages.dashboard');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const refresh = () => setThreads(threadsForUser(user.email));
  const unreadTotal = threads.reduce((s, th) => s + unreadForThread(th, 'user'), 0);

  useEffect(() => { refresh(); }, [user.email]);
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('sari-threads-changed', handler);
    return () => window.removeEventListener('sari-threads-changed', handler);
  }, [user.email]);

  const open = threads.find((th) => th.id === openId) || null;

  const openThread = (th: Thread) => {
    setOpenId(th.id);
    markThreadRead(th.id, 'user');
    refresh();
  };

  const send = () => {
    if (!open || !draft.trim()) return;
    sendMessage(open.id, 'user', draft.trim());
    setDraft('');
    refresh();
  };

  if (open) {
    return (
      <div className="space-y-4">
        <button onClick={() => { setOpenId(null); refresh(); }} className="flex items-center gap-1 text-sm text-gray-500 hover:text-sari-dark dark:hover:text-white">
          <ArrowLeft className="w-4 h-4" /> {t('back')}
        </button>
        <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl overflow-hidden flex flex-col h-[560px]">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40">
            <div className="font-bold text-sari-dark dark:text-white">{open.subject}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <span>{t('from')} {t('admin')}</span>
              {threadLabel(open) && <span className="px-2 py-0.5 bg-sari-blue/10 text-sari-blue rounded-full font-semibold">{threadLabel(open)}</span>}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {open.messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-sari-blue text-white rounded-br-sm'
                    : 'bg-gray-100 dark:bg-gray-800 text-sari-dark dark:text-white rounded-bl-sm'
                }`}>
                  <div className="mb-1 text-[10px] uppercase tracking-wide opacity-70 font-bold">
                    {m.role === 'user' ? t('you') : t('admin')} · {new Date(m.at).toLocaleString()}
                  </div>
                  {m.body}
                </div>
              </div>
            ))}
            {open.messages.length === 0 && (
              <div className="text-center text-gray-400 py-16">
                <Inbox className="w-10 h-10 mx-auto mb-2" />
                {t('noMessagesYet')}
              </div>
            )}
          </div>
          <div className="p-3 border-t border-gray-200 dark:border-gray-800 flex gap-2">
            <input
              className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue"
              value={draft}
              placeholder={t('typeMessage')}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <button onClick={send} disabled={!draft.trim()} className="bg-sari-blue text-white px-4 py-2.5 rounded-lg font-semibold inline-flex items-center gap-2 disabled:opacity-50">
              <Send className="w-4 h-4" /> {t('sendMessage')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-sari-dark dark:text-white flex items-center gap-3">
        <Mail className="w-6 h-6 text-sari-blue" /> {t('messagesTitle')}
        {unreadTotal > 0 && <span className="text-xs px-2.5 py-1 bg-red-500 text-white rounded-full font-bold">{unreadTotal}</span>}
      </h2>
      {threads.length === 0 ? (
        <div className="bg-white dark:bg-[#1a1a1a] p-12 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl text-center">
          <Inbox className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-sari-dark dark:text-white mb-2">{t('noMessages')}</h3>
          <p className="text-gray-600 dark:text-gray-400">{t('noMessagesDesc')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {threads.map((th) => {
            const unread = unreadForThread(th, 'user');
            const last = th.messages[th.messages.length - 1];
            return (
              <button
                key={th.id}
                onClick={() => openThread(th)}
                className="w-full text-left bg-white dark:bg-[#1a1a1a] p-4 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl hover:border-sari-blue transition-colors flex items-center gap-4"
              >
                <div className="w-11 h-11 rounded-full bg-sari-blue/10 text-sari-blue flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sari-dark dark:text-white truncate">{th.subject}</span>
                    {threadLabel(th) && <span className="text-xs px-2 py-0.5 bg-sari-blue/10 text-sari-blue rounded-full font-semibold shrink-0">{threadLabel(th)}</span>}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {last ? `${last.role === 'user' ? t('you') : t('admin')} : ${last.body}` : t('emptyThread')}
                  </div>
                  <div className="text-xs text-gray-400">{last ? new Date(last.at).toLocaleString() : new Date(th.createdAt).toLocaleString()}</div>
                </div>
                {unread > 0 && <span className="shrink-0 text-xs px-2.5 py-1 bg-red-500 text-white rounded-full font-bold">{unread}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
