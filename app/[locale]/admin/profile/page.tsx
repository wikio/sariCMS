'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Save } from 'lucide-react';
import { persistAdminSession, readAdminAccess, readAdminUser, type AdminUser } from '@/lib/admin-session';
import { cmsAdminUpdate } from '@/lib/cms-admin';
import { useToast } from '@/components/admin/Toast';

export default function ProfilePage() {
  const params = useSearchParams();
  const edit = params.get('edit') === '1';
  const { showToast } = useToast();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [draft, setDraft] = useState({ firstName: '', lastName: '', email: '', phone: '' });

  useEffect(() => {
    const u = readAdminUser();
    setUser(u);
    setDraft({
      firstName: u?.firstName || '',
      lastName: u?.lastName || '',
      email: u?.email || '',
      phone: '',
    });
  }, []);

  const save = async () => {
    if (!user) return;
    try {
      await cmsAdminUpdate('users', user.id, draft);
      persistAdminSession({
        accessToken: readAdminAccess() || '',
        user: { ...user, ...draft },
      });
      setUser({ ...user, ...draft });
      showToast('Profil mis à jour', 'success');
    } catch {
      persistAdminSession({
        accessToken: readAdminAccess() || '',
        user: { ...user, ...draft },
      });
      setUser({ ...user, ...draft });
      showToast('Profil enregistré localement', 'info');
    }
  };

  if (!user) return <div className="ad-card p-8">Aucun utilisateur connecté.</div>;

  return (
    <div className="space-y-4 max-w-xl">
      <header className="ad-rise">
        <div className="text-[11px] uppercase tracking-[0.22em] font-black" style={{ color: 'var(--ad-muted)' }}>Compte</div>
        <h1 className="text-3xl font-black">{edit ? 'Mettre à jour le profil' : 'Profil'}</h1>
      </header>
      <section className="ad-card p-5 space-y-3">
        {['firstName', 'lastName', 'email', 'phone'].map((key) => (
          <label key={key} className="block space-y-1.5">
            <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--ad-muted)' }}>{key}</span>
            <input className="ad-input" disabled={!edit && key !== 'phone'} value={draft[key as keyof typeof draft]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
          </label>
        ))}
        <div className="text-sm" style={{ color: 'var(--ad-muted)' }}>Rôle : {user.role || user.type || 'admin'}</div>
        <button className="ad-btn ad-btn-primary" onClick={save}><Save className="w-4 h-4" /> Enregistrer</button>
      </section>
    </div>
  );
}
