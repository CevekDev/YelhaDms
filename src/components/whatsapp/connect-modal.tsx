'use client';

import { useState, useEffect, useRef } from 'react';

const WA_COLOR = '#25d366';

interface Props {
  connectionId: string;
  onConnected: (phoneNumber: string) => void;
  onClose: () => void;
}

export function ConnectWhatsAppModal({ connectionId, onConnected, onClose }: Props) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'qr' | 'connected' | 'error'>('loading');
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const poll = async () => {
    try {
      const r = await fetch(`/api/whatsapp/status?connectionId=${connectionId}`);
      if (!r.ok) return;
      const data = await r.json();

      if (data.isActive) {
        stopPolling();
        setPhoneNumber(data.phoneNumber);
        setStatus('connected');
        onConnected(data.phoneNumber);
        return;
      }

      if (data.waStatus === 'qr' && data.qrDataUrl) {
        setQrCode(data.qrDataUrl);
        setStatus('qr');
        return;
      }

      if (data.waStatus === 'disconnected' || data.waStatus === 'error') {
        stopPolling();
        setStatus('error');
        setErrorMsg(data.waStatus === 'error' ? 'Puppeteer a planté sur Railway — vérifiez les logs.' : 'Session déconnectée.');
      }
    } catch {
      // ignore transient errors, keep polling
    }
  };

  const start = async () => {
    stopPolling();
    startedRef.current = true;
    setStatus('loading');
    setQrCode(null);
    setErrorMsg('');

    const res = await fetch('/api/whatsapp/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId }),
    });

    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Erreur de démarrage' }));
      setStatus('error');
      setErrorMsg(error || 'Service WhatsApp indisponible');
      return;
    }

    // Poll every 2s for up to 3 minutes
    pollRef.current = setInterval(poll, 2000);
    setTimeout(() => {
      if (status !== 'connected') {
        stopPolling();
        setStatus('error');
        setErrorMsg('Délai dépassé — réessayez.');
      }
    }, 180_000);
  };

  useEffect(() => {
    start();
    return () => stopPolling();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl p-6 space-y-4"
        style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.08)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${WA_COLOR}20` }}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill={WA_COLOR}>
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
            <h2 className="font-mono font-semibold text-white text-sm">Connecter WhatsApp</h2>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors text-xl leading-none">×</button>
        </div>

        {/* Content */}
        <div className="flex flex-col items-center text-center gap-4 py-2">
          {status === 'loading' && (
            <>
              <div className="w-12 h-12 rounded-full border-2 border-white/10 animate-spin" style={{ borderTopColor: WA_COLOR }} />
              <p className="text-sm font-mono text-white/40">Démarrage de WhatsApp...</p>
            </>
          )}

          {status === 'qr' && qrCode && (
            <>
              <div className="rounded-xl overflow-hidden p-2" style={{ background: 'white', border: `3px solid ${WA_COLOR}` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrCode} alt="WhatsApp QR Code" className="w-52 h-52" />
              </div>
              <div className="space-y-1">
                <p className="font-mono text-white text-sm font-semibold">Scannez avec WhatsApp</p>
                <p className="font-mono text-white/40 text-xs">1. Ouvrez WhatsApp sur votre téléphone</p>
                <p className="font-mono text-white/40 text-xs">2. Paramètres → Appareils connectés</p>
                <p className="font-mono text-white/40 text-xs">3. Scannez ce QR code</p>
              </div>
              <span className="text-[10px] font-mono px-2 py-1 rounded-full" style={{ background: 'rgba(255,165,0,0.1)', color: '#ffa500', border: '1px solid rgba(255,165,0,0.3)' }}>
                ⏱ QR code expire dans 60 secondes
              </span>
            </>
          )}

          {status === 'connected' && (
            <>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl" style={{ background: `${WA_COLOR}20` }}>✅</div>
              <div>
                <p className="font-mono font-semibold text-green-400 text-sm">WhatsApp connecté !</p>
                {phoneNumber && <p className="font-mono text-white/40 text-xs mt-1">+{phoneNumber}</p>}
                <p className="font-mono text-white/30 text-xs mt-1">Le bot IA répond maintenant automatiquement.</p>
              </div>
              <button
                onClick={onClose}
                className="w-full font-mono text-sm text-white py-2.5 rounded-xl transition-all hover:opacity-90"
                style={{ background: WA_COLOR }}
              >
                Fermer
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl" style={{ background: 'rgba(239,68,68,0.1)' }}>❌</div>
              <div>
                <p className="font-mono text-red-400 text-sm font-semibold">Erreur de connexion</p>
                {errorMsg && <p className="font-mono text-white/30 text-xs mt-1">{errorMsg}</p>}
              </div>
              <button onClick={start} className="w-full font-mono text-sm text-white/70 py-2.5 rounded-xl border border-white/10 hover:border-white/20 transition-all">
                Réessayer
              </button>
            </>
          )}
        </div>

        {/* Warning */}
        <div className="rounded-xl p-3" style={{ background: 'rgba(255,165,0,0.05)', border: '1px solid rgba(255,165,0,0.15)' }}>
          <p className="text-xs font-mono text-yellow-600/80">
            ⚠️ Utilisez un numéro WhatsApp Business dédié. Le bot répond uniquement aux messages entrants — jamais en premier.
          </p>
        </div>
      </div>
    </div>
  );
}
