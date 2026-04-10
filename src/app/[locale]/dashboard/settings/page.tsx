'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Download, Trash2, LogOut, Shield, Monitor, User, CheckCircle, XCircle, ShieldCheck } from 'lucide-react';
import { signOut } from 'next-auth/react';

const ORANGE = '#FF6B2C';

const SECTION_STYLE = {
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '16px',
  overflow: 'hidden' as const,
};

const INPUT_CLASS =
  'w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-2.5 text-sm font-mono text-white placeholder:text-white/20 focus:outline-none focus:border-[#FF6B2C]/40 transition-colors disabled:opacity-40';

export default function SettingsPage() {
  const params = useParams();
  const locale = params.locale as string;
  const { toast } = useToast();

  const [user, setUser] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toggling2FA, setToggling2FA] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/user/me').then(r => r.json()),
      fetch('/api/user/sessions').then(r => r.json()),
    ]).then(([u, s]) => {
      setUser(u);
      setName(u.name || '');
      setSessions(Array.isArray(s) ? s : []);
    });
  }, []);

  const handleSaveName = async () => {
    setSavingName(true);
    try {
      const res = await fetch('/api/user/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) toast({ title: '✅ Nom mis à jour !' });
    } finally { setSavingName(false); }
  };

  const handleToggle2FA = async () => {
    setToggling2FA(true);
    try {
      const newState = !user?.twoFactorEnabled;
      const res = await fetch('/api/user/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ twoFactorEnabled: newState }),
      });
      if (res.ok) {
        setUser((u: any) => ({ ...u, twoFactorEnabled: newState }));
        toast({ title: newState ? '✅ 2FA activée' : '2FA désactivée' });
      }
    } finally { setToggling2FA(false); }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/user/export');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'yelha-data-export.json';
      a.click();
      URL.revokeObjectURL(url);
    } finally { setExporting(false); }
  };

  const handleRevokeSession = async (sessionId: string) => {
    await fetch('/api/user/sessions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    setSessions(s => s.filter(sess => sess.id !== sessionId));
    toast({ title: 'Session révoquée' });
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Êtes-vous sûr ? Cette action supprimera définitivement toutes vos données.')) return;
    setDeleting(true);
    await fetch('/api/user/delete', { method: 'DELETE' });
    await signOut({ callbackUrl: `/${locale}` });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold font-mono text-white">Paramètres</h1>
        <p className="text-white/40 text-sm mt-1">Gérez votre compte et vos préférences</p>
      </div>

      {/* Profile */}
      <div style={SECTION_STYLE}>
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/[0.06]">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${ORANGE}20` }}>
            <User className="w-4 h-4" style={{ color: ORANGE }} />
          </div>
          <h2 className="font-mono font-semibold text-white text-sm">Profil</h2>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-white/40 font-mono mb-1.5 block">Nom complet</label>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className={INPUT_CLASS}
                placeholder="Votre nom"
              />
              <button
                onClick={handleSaveName}
                disabled={savingName}
                className="flex items-center gap-1.5 font-mono text-sm text-white px-4 py-2.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-40 whitespace-nowrap"
                style={{ background: ORANGE }}
              >
                {savingName ? <Loader2 className="animate-spin w-4 h-4" /> : 'Enregistrer'}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-white/40 font-mono mb-1.5 block">Email</label>
            <input value={user?.email || ''} disabled className={INPUT_CLASS} />
          </div>
        </div>
      </div>

      {/* Security / 2FA */}
      <div style={SECTION_STYLE}>
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/[0.06]">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(96,165,250,0.15)' }}>
            <Shield className="w-4 h-4 text-blue-400" />
          </div>
          <h2 className="font-mono font-semibold text-white text-sm">Sécurité</h2>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck
                className="w-5 h-5"
                style={{ color: user?.twoFactorEnabled ? '#34d399' : 'rgba(255,255,255,0.2)' }}
              />
              <div>
                <p className="text-sm font-mono text-white/80">Authentification à deux facteurs</p>
                <p className="text-xs text-white/30 font-mono mt-0.5">
                  {user?.twoFactorEnabled
                    ? 'Activée — un code email est demandé à chaque connexion'
                    : 'Désactivée — activez-la pour sécuriser votre compte'}
                </p>
              </div>
            </div>
            <button
              onClick={handleToggle2FA}
              disabled={toggling2FA}
              className="flex items-center gap-1.5 font-mono text-xs px-3 py-2 rounded-xl border transition-all disabled:opacity-40"
              style={user?.twoFactorEnabled
                ? { borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.04)' }
                : { borderColor: `${ORANGE}40`, color: ORANGE, background: `${ORANGE}10` }}
            >
              {toggling2FA ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : user?.twoFactorEnabled ? (
                <><XCircle className="w-3.5 h-3.5" />Désactiver</>
              ) : (
                <><CheckCircle className="w-3.5 h-3.5" />Activer</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Active Sessions */}
      <div style={SECTION_STYLE}>
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/[0.06]">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(167,139,250,0.15)' }}>
            <Monitor className="w-4 h-4 text-purple-400" />
          </div>
          <h2 className="font-mono font-semibold text-white text-sm">Sessions actives</h2>
        </div>
        <div className="p-5 space-y-2">
          {sessions.length === 0 && (
            <p className="text-white/25 font-mono text-sm">Aucune session active</p>
          )}
          {sessions.map((sess: any) => (
            <div
              key={sess.id}
              className="flex items-center justify-between rounded-xl px-4 py-3 border border-white/[0.05] bg-white/[0.02]"
            >
              <div>
                <p className="text-sm font-mono text-white/70 truncate max-w-xs">
                  {sess.userAgent || 'Navigateur inconnu'}
                </p>
                <p className="text-xs text-white/25 font-mono mt-0.5">
                  {sess.ipAddress || 'IP inconnue'} · {new Date(sess.lastActivity).toLocaleDateString('fr-DZ')}
                </p>
              </div>
              <button
                onClick={() => handleRevokeSession(sess.id)}
                className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-colors"
                title="Révoquer la session"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Data & Privacy */}
      <div style={SECTION_STYLE}>
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/[0.06]">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.15)' }}>
            <Download className="w-4 h-4 text-yellow-400" />
          </div>
          <h2 className="font-mono font-semibold text-white text-sm">Données & confidentialité</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-mono text-white/70">Exporter mes données</p>
              <p className="text-xs text-white/25 font-mono mt-0.5">Télécharger toutes vos données en JSON</p>
            </div>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1.5 font-mono text-xs text-white/60 hover:text-white px-3 py-2 rounded-xl border border-white/[0.08] hover:bg-white/[0.04] transition-all disabled:opacity-40"
            >
              {exporting ? <Loader2 className="animate-spin w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
              Exporter
            </button>
          </div>
          <div className="flex items-center justify-between border-t border-white/[0.05] pt-4">
            <div>
              <p className="text-sm font-mono text-red-400">Supprimer le compte</p>
              <p className="text-xs text-white/25 font-mono mt-0.5">Suppression permanente et irréversible</p>
            </div>
            <button
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="flex items-center gap-1.5 font-mono text-xs text-red-400 px-3 py-2 rounded-xl border border-red-500/20 hover:bg-red-500/10 transition-all disabled:opacity-40"
            >
              {deleting ? <Loader2 className="animate-spin w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
              Supprimer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
