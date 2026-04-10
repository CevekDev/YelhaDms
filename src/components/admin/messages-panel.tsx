'use client';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Mail, Loader2, Users } from 'lucide-react';

const BLUE = '#60a5fa';

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

export default function AdminMessagesPanel({ users }: { users: User[] }) {
  const { toast } = useToast();
  const [targetType, setTargetType] = useState<'all' | 'user'>('user');
  const [userId, setUserId] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!subject || !message) return;
    if (targetType === 'user' && !userId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType,
          userId: targetType === 'user' ? userId : undefined,
          subject,
          message,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        toast({ title: `✅ Message envoyé à ${json.sent} utilisateur(s)` });
        setSubject('');
        setMessage('');
      } else {
        toast({ title: 'Erreur', description: json.error, variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-2.5 text-sm font-mono text-white placeholder:text-white/20 focus:outline-none focus:border-[#60a5fa]/40 transition-colors';

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/[0.06]">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${BLUE}20` }}>
          <Mail className="w-4 h-4" style={{ color: BLUE }} />
        </div>
        <h2 className="font-mono font-semibold text-white text-sm">Envoyer un message personnalisé</h2>
      </div>

      <div className="p-5 space-y-4">
        {/* Target toggle */}
        <div className="flex gap-2 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
          {(['user', 'all'] as const).map(type => (
            <button
              key={type}
              onClick={() => setTargetType(type)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-mono text-xs font-medium transition-all"
              style={
                targetType === type
                  ? { background: BLUE + '25', color: BLUE, border: `1px solid ${BLUE}40` }
                  : { color: 'rgba(255,255,255,0.35)' }
              }
            >
              {type === 'all' && <Users className="w-3.5 h-3.5" />}
              {type === 'user' ? 'Un utilisateur' : 'Tous les utilisateurs'}
            </button>
          ))}
        </div>

        {/* User selector */}
        {targetType === 'user' && (
          <select
            value={userId}
            onChange={e => setUserId(e.target.value)}
            className={inputClass + ' appearance-none cursor-pointer'}
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            <option value="">Sélectionner un utilisateur</option>
            {users.filter(u => u.role === 'USER').map(u => (
              <option key={u.id} value={u.id} style={{ background: '#1a1a2e' }}>
                {u.name || 'Sans nom'} — {u.email}
              </option>
            ))}
          </select>
        )}

        {/* Subject */}
        <input
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="Sujet — Ex: Vos tokens sont prêts !"
          className={inputClass}
        />

        {/* Message */}
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Rédigez votre message..."
          rows={5}
          className={inputClass + ' resize-none'}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={loading || !subject || !message || (targetType === 'user' && !userId)}
          className="flex items-center gap-2 font-mono text-sm text-white px-4 py-2.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-40"
          style={{ background: BLUE }}
        >
          {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Mail className="w-4 h-4" />}
          {targetType === 'all' ? 'Envoyer à tous' : 'Envoyer le message'}
        </button>
      </div>
    </div>
  );
}
