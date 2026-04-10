'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, ArrowRight, Bot } from 'lucide-react';
import { LazyMotion, domAnimation, m } from 'framer-motion';

const ORANGE = '#FF6B2C';

// ── DotMap animated canvas background ──────────────────────────────────────
const DotMap = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const generateDots = (width: number, height: number) => {
    const dots: { x: number; y: number; opacity: number }[] = [];
    const gap = 14;
    for (let x = gap; x < width - gap; x += gap) {
      for (let y = gap; y < height - gap; y += gap) {
        // Simple pattern — dense in the middle
        const cx = width / 2;
        const cy = height / 2;
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        const maxDist = Math.sqrt(cx ** 2 + cy ** 2);
        if (Math.random() > dist / maxDist - 0.2) {
          dots.push({ x, y, opacity: Math.random() * 0.4 + 0.05 });
        }
      }
    }
    return dots;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      canvas.width = width;
      canvas.height = height;
      setDimensions({ width, height });
    });
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!dimensions.width || !dimensions.height) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dots = generateDots(dimensions.width, dimensions.height);
    let startTime = Date.now();
    let raf: number;

    const animate = () => {
      const t = (Date.now() - startTime) / 1000;
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      dots.forEach(dot => {
        const pulse = 0.5 + 0.5 * Math.sin(t * 0.8 + dot.x * 0.05);
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 107, 44, ${dot.opacity * pulse})`;
        ctx.fill();
      });

      // Draw animated arcs
      const arcs = [
        { cx: dimensions.width * 0.3, cy: dimensions.height * 0.4, r: 40 },
        { cx: dimensions.width * 0.6, cy: dimensions.height * 0.6, r: 60 },
        { cx: dimensions.width * 0.5, cy: dimensions.height * 0.3, r: 30 },
      ];
      arcs.forEach((arc, i) => {
        const progress = ((t * 0.5 + i * 0.7) % 3) / 3;
        ctx.beginPath();
        ctx.arc(arc.cx, arc.cy, arc.r, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 107, 44, ${0.15 + progress * 0.1})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Moving dot on arc
        const angle = -Math.PI / 2 + progress * Math.PI * 2;
        const px = arc.cx + Math.cos(angle) * arc.r;
        const py = arc.cy + Math.sin(angle) * arc.r;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fillStyle = ORANGE;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(px, py, 7, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 107, 44, 0.2)`;
        ctx.fill();
      });

      raf = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(raf);
  }, [dimensions]);

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
};

// ── Props for the signin/signup card ───────────────────────────────────────
interface YelhaAuthCardProps {
  mode: 'signin' | 'signup';
  // injected form
  children: React.ReactNode;
  // left panel text
  tagline?: string;
  switchHref: string;
  switchText: string;
  switchLabel: string;
}

export function YelhaAuthCard({
  mode,
  children,
  tagline = 'Automatisez vos réponses Telegram avec une IA qui parle Darija, arabe, français.',
  switchHref,
  switchText,
  switchLabel,
}: YelhaAuthCardProps) {
  return (
    <LazyMotion features={domAnimation}>
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#060818] to-[#0d1023] p-4">
        <m.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-4xl overflow-hidden rounded-2xl flex bg-[#090b13] text-white shadow-2xl"
        >
          {/* Left — animated map */}
          <div className="hidden md:block w-5/12 relative overflow-hidden border-r border-white/10">
            <div className="absolute inset-0 bg-gradient-to-br from-[#0f1120] to-[#151929]">
              <DotMap />
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 z-10">
                <m.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                  className="mb-5"
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
                    style={{ background: ORANGE, boxShadow: `0 0 32px ${ORANGE}60` }}
                  >
                    <Bot className="w-8 h-8 text-white" />
                  </div>
                </m.div>
                <m.h2
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.65, duration: 0.5 }}
                  className="text-3xl font-bold mb-3 font-mono"
                  style={{ color: ORANGE }}
                >
                  Yelha
                </m.h2>
                <m.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8, duration: 0.5 }}
                  className="text-sm text-center text-white/40 max-w-xs font-mono leading-relaxed"
                >
                  {tagline}
                </m.p>

                {/* feature chips */}
                <m.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1, duration: 0.5 }}
                  className="flex flex-col gap-2 mt-8 w-full"
                >
                  {['🤖 IA DeepSeek', '🌍 Darija · Arabe · Français', '🔒 Sécurisé AES-256'].map(chip => (
                    <div
                      key={chip}
                      className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-2"
                    >
                      <span className="font-mono text-xs text-white/60">{chip}</span>
                    </div>
                  ))}
                </m.div>
              </div>
            </div>
          </div>

          {/* Right — form */}
          <div className="w-full md:w-7/12 p-8 md:p-10 flex flex-col justify-center">
            <m.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="md:hidden flex items-center gap-2 mb-6">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: ORANGE }}
                >
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <span className="font-mono font-bold text-white">Yelha</span>
              </div>

              <h1 className="text-2xl md:text-3xl font-bold mb-1 text-white">
                {mode === 'signin' ? 'Bienvenue 👋' : 'Créer un compte'}
              </h1>
              <p className="text-white/40 mb-7 font-mono text-sm">
                {mode === 'signin' ? 'Connectez-vous à votre espace' : 'Rejoignez Yelha gratuitement'}
              </p>

              {/* injected form content */}
              {children}

              <p className="text-center text-sm text-white/40 mt-6 font-mono">
                {switchText}{' '}
                <a href={switchHref} style={{ color: ORANGE }} className="hover:underline">
                  {switchLabel}
                </a>
              </p>
            </m.div>
          </div>
        </m.div>
      </div>
    </LazyMotion>
  );
}

// ── Reusable styled input/button for auth forms ────────────────────────────
export const AuthInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }
>(({ className = '', error, ...props }, ref) => (
  <input
    ref={ref}
    className={`flex h-11 w-full rounded-xl border bg-white/[0.05] px-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 transition-all ${
      error
        ? 'border-red-500/60 focus:ring-red-500/30'
        : 'border-white/10 focus:ring-orange-500/30'
    } ${className}`}
    {...props}
  />
));
AuthInput.displayName = 'AuthInput';

export function AuthGoogleButton({
  onClick,
  loading,
  label = 'Continuer avec Google',
}: {
  onClick: () => void;
  loading?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-center gap-2.5 bg-white/[0.05] border border-white/10 rounded-xl p-3 hover:bg-white/[0.09] transition-all duration-200 text-sm font-mono text-white/80"
    >
      {loading ? (
        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
        </svg>
      ) : (
        <svg className="h-4 w-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
      )}
      {label}
    </button>
  );
}

export function AuthDivider() {
  return (
    <div className="relative my-5">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-white/10" />
      </div>
      <div className="relative flex justify-center text-xs">
        <span className="px-3 bg-[#090b13] text-white/30 font-mono">ou</span>
      </div>
    </div>
  );
}

export function AuthSubmitButton({
  loading,
  label,
}: {
  loading: boolean;
  label: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <LazyMotion features={domAnimation}>
      <m.button
        type="submit"
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        className="relative w-full overflow-hidden rounded-xl py-3 text-sm font-mono font-semibold text-white transition-all disabled:opacity-60"
        style={{ background: ORANGE, boxShadow: hovered ? `0 0 20px ${ORANGE}50` : 'none' }}
        disabled={loading}
      >
        <span className="flex items-center justify-center gap-2">
          {loading ? (
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
              <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
            </svg>
          ) : (
            <>
              {label}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </span>
        {hovered && !loading && (
          <m.span
            initial={{ left: '-100%' }}
            animate={{ left: '100%' }}
            transition={{ duration: 0.9, ease: 'easeInOut' }}
            className="absolute top-0 bottom-0 left-0 w-16 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            style={{ filter: 'blur(6px)' }}
          />
        )}
      </m.button>
    </LazyMotion>
  );
}
