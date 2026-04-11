'use client';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter, useParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Loader2, Shield, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';

const ORANGE = '#FF6B2C';

export default function VerifyTwoFactorPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const email = searchParams.get('email') || '';
  const callbackUrl = searchParams.get('callbackUrl') || `/${locale}/dashboard`;

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleVerify = async () => {
    if (code.length !== 6 || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (res.ok) {
        // Mark as 2FA verified then sign in
        const result = await signIn('credentials', {
          email,
          twoFactorVerified: 'true',
          redirect: false,
          callbackUrl,
        });
        if (result?.ok) {
          router.push(callbackUrl);
        } else {
          router.push(`/${locale}/dashboard`);
        }
      } else {
        setError(data.error || 'Code invalide');
        setCode('');
        inputRef.current?.focus();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resending || countdown > 0) return;
    setResending(true);
    setError('');
    try {
      await fetch('/api/auth/2fa/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setResent(true);
      setCountdown(60);
      setCode('');
    } finally {
      setResending(false);
    }
  };

  const handleCodeChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 6);
    setCode(clean);
    setError('');
  };

  if (!email) {
    return null;
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0A0A0A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '420px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: ORANGE,
              marginBottom: '16px',
            }}
          >
            <Shield style={{ width: '28px', height: '28px', color: '#fff' }} />
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '24px', fontWeight: '800', color: '#fff' }}>
            YelhaDms<span style={{ color: ORANGE }}>.</span>
          </div>
        </div>

        {/* Card */}
        <div
          style={{
            background: '#111',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '20px',
            padding: '32px',
          }}
        >
          <h1
            style={{
              fontFamily: 'monospace',
              fontSize: '20px',
              fontWeight: '700',
              color: '#fff',
              margin: '0 0 8px',
            }}
          >
            Vérification en deux étapes
          </h1>
          <p
            style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: '14px',
              margin: '0 0 28px',
              fontFamily: 'monospace',
              lineHeight: 1.6,
            }}
          >
            Code envoyé à{' '}
            <span style={{ color: ORANGE }}>{email}</span>
          </p>

          {resent && (
            <div
              style={{
                background: 'rgba(52,211,153,0.1)',
                border: '1px solid rgba(52,211,153,0.2)',
                borderRadius: '10px',
                padding: '10px 14px',
                color: '#34d399',
                fontSize: '13px',
                fontFamily: 'monospace',
                marginBottom: '16px',
                textAlign: 'center',
              }}
            >
              ✓ Nouveau code envoyé !
            </div>
          )}

          {/* Code input */}
          <div style={{ marginBottom: '20px' }}>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={e => handleCodeChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
              placeholder="000000"
              maxLength={6}
              style={{
                width: '100%',
                textAlign: 'center',
                letterSpacing: '14px',
                fontSize: '36px',
                fontFamily: 'monospace',
                fontWeight: '800',
                background: 'rgba(255,255,255,0.04)',
                border: `2px solid ${code.length === 6 ? ORANGE : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '14px',
                padding: '18px 16px',
                color: '#fff',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
            />
          </div>

          {error && (
            <div
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '10px',
                padding: '12px',
                color: '#f87171',
                fontSize: '13px',
                fontFamily: 'monospace',
                marginBottom: '16px',
                textAlign: 'center',
              }}
            >
              {error}
            </div>
          )}

          {/* Verify button */}
          <button
            onClick={handleVerify}
            disabled={loading || code.length !== 6}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              border: 'none',
              cursor: loading || code.length !== 6 ? 'not-allowed' : 'pointer',
              background: ORANGE,
              color: '#fff',
              fontFamily: 'monospace',
              fontSize: '15px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              opacity: loading || code.length !== 6 ? 0.5 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {loading && (
              <Loader2
                style={{
                  width: '16px',
                  height: '16px',
                  animation: 'spin 1s linear infinite',
                }}
              />
            )}
            Vérifier le code
          </button>

          {/* Resend */}
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            {countdown > 0 ? (
              <span
                style={{
                  color: 'rgba(255,255,255,0.25)',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                }}
              >
                Renvoyer dans {countdown}s
              </span>
            ) : (
              <button
                onClick={handleResend}
                disabled={resending}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: ORANGE,
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  textDecoration: 'underline',
                  opacity: resending ? 0.5 : 1,
                }}
              >
                <RefreshCw style={{ width: '12px', height: '12px' }} />
                {resending ? 'Envoi...' : 'Renvoyer le code'}
              </button>
            )}
          </div>

          {/* Back */}
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <Link
              href={`/${locale}/auth/signin`}
              style={{
                color: 'rgba(255,255,255,0.25)',
                fontSize: '12px',
                fontFamily: 'monospace',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <ArrowLeft style={{ width: '12px', height: '12px' }} />
              Retour à la connexion
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
