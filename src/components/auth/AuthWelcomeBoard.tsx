import React, { useRef } from 'react';
import { ArrowRight, GraduationCap, Quote, ShieldCheck, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LandingAtmosphere } from '../landing/LandingAtmosphere';
import { LumoraBrand } from '../landing/LumoraBrand';
import { AuthStarField } from './AuthStarField';
import { useReducedMotion } from '../landing/motion/useReducedMotion';
import '../landing/landing-motion.css';

type AuthMode = 'sign-in' | 'sign-up';
type AuthProvider = 'google' | 'github' | 'email';

interface AuthWelcomeBoardProps {
  mode: AuthMode;
  authError: string | null;
  isLoading: boolean;
  onAuthenticate: (provider: AuthProvider) => void;
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z" />
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
      <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 10.8 0 12.5s.7 2.8 1.9 5.2l3.7-2.9z" />
      <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 fill-current" viewBox="0 0 24 24">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function TelemetryPanel({
  variant,
  icon: Icon,
  label,
  body,
  chip,
}: {
  variant: 'cyan' | 'violet';
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  body: string;
  chip: React.ReactNode;
}) {
  const accent = variant === 'cyan' ? 'text-cyan-300' : 'text-violet-300';
  const floatClass = variant === 'cyan' ? 'auth-telemetry-float' : 'auth-telemetry-float auth-telemetry-float--right';
  return (
    <div className={`${floatClass} hidden w-64 flex-col gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 shadow-xl backdrop-blur-xl lg:flex`}>
      <p className={`flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider ${accent}`}>
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className="text-xs leading-relaxed text-slate-400">{body}</p>
      {chip}
    </div>
  );
}

export function AuthWelcomeBoard({
  mode,
  authError,
  isLoading,
  onAuthenticate,
}: AuthWelcomeBoardProps) {
  const isSignIn = mode === 'sign-in';
  const reducedMotion = useReducedMotion();
  const cursorGlowRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (event: React.MouseEvent<HTMLElement>) => {
    if (reducedMotion || !cursorGlowRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    cursorGlowRef.current.style.background = `radial-gradient(600px circle at ${x}% ${y}%, rgba(34,211,238,0.07), transparent 70%)`;
  };

  return (
    <main
      onMouseMove={handleMouseMove}
      className="auth-entry relative isolate flex min-h-[calc(100svh-4.5rem)] items-center justify-center overflow-hidden px-4 py-4 sm:px-6 sm:py-5"
    >
      <LandingAtmosphere particles={false} />
      <AuthStarField />
      <div aria-hidden="true" className="auth-entry-horizon absolute inset-x-0 bottom-0 h-72" />
      <div aria-hidden="true" ref={cursorGlowRef} className="pointer-events-none absolute inset-0 z-0" />
      <div aria-hidden="true" className="pointer-events-none absolute left-10 top-1/3 z-0 h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-[150px]" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-1/3 right-10 z-0 h-[500px] w-[500px] rounded-full bg-violet-500/10 blur-[150px]" />

      <div className="relative z-10 flex w-full max-w-6xl items-center justify-center gap-8">
        <TelemetryPanel
          variant="cyan"
          icon={ShieldCheck}
          label="Grounded Knowledge"
          body="Answers cite the exact page, section, or timestamp they came from — never a confident-sounding guess."
          chip={
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-medium text-cyan-300">
              <Quote className="h-3 w-3" /> Citation #3 · page 12
            </span>
          }
        />

        <div className="auth-board-entrance w-full max-w-xl">
          <section
            aria-labelledby="auth-entry-title"
            className="auth-board relative z-10 w-full overflow-hidden rounded-[2rem] border border-cyan-500/30 bg-[#101621]/90 px-5 py-8 text-center backdrop-blur-2xl sm:px-10 sm:py-10"
          >
          <div aria-hidden="true" className="auth-board-glow absolute inset-x-[18%] top-0 h-px bg-gradient-to-r from-transparent via-cyan-200 to-transparent" />

          <div className="mx-auto flex justify-center">
            <LumoraBrand markOnly className="auth-hero-mark" />
          </div>

          <div className="mt-5 space-y-3">
            <h1 id="auth-entry-title" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Welcome to{' '}
              <span className="bg-gradient-to-r from-cyan-300 via-sky-300 to-blue-400 bg-clip-text text-transparent">
                Lumora
              </span>
            </h1>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.28em] text-slate-400 sm:text-xs">
              AI Knowledge Workspace
            </p>
            <p className="mx-auto max-w-md text-sm leading-6 text-slate-400 sm:text-base">
              Bring your learning materials together, organize them into Workspaces, and learn with grounded AI.
            </p>
          </div>

          {authError && (
            <div role="alert" className="mt-5 rounded-xl border border-red-800/70 bg-red-950/45 p-3 text-sm text-red-200">
              {authError}
            </div>
          )}

          <div className="mt-7 space-y-3">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => onAuthenticate('email')}
              className="auth-primary-button group flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-white shadow-md transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] active:scale-[0.99] disabled:cursor-wait disabled:opacity-60 sm:text-base"
            >
              <span>{isSignIn ? 'Sign In' : 'Create Account'}</span>
              <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
            </button>

            <Link
              to={isSignIn ? '/sign-up' : '/sign-in'}
              className="auth-secondary-button flex w-full items-center justify-center rounded-xl border border-sky-700/75 bg-slate-950/35 px-5 py-3.5 text-sm font-semibold uppercase tracking-[0.08em] text-slate-100 transition sm:text-base"
            >
              {isSignIn ? 'Create Account' : 'Sign In'}
            </Link>
          </div>

          <div className="my-6 flex items-center gap-4 text-xs text-slate-500">
            <span className="h-px flex-1 bg-slate-800" />
            <span>or continue with</span>
            <span className="h-px flex-1 bg-slate-800" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => onAuthenticate('github')}
              className="auth-provider-button flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 py-2.5 text-sm font-medium text-slate-200 transition-all duration-200 disabled:cursor-wait disabled:opacity-60"
            >
              <GitHubIcon />
              <span>GitHub</span>
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => onAuthenticate('google')}
              className="auth-provider-button flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 py-2.5 text-sm font-medium text-slate-200 transition-all duration-200 disabled:cursor-wait disabled:opacity-60"
            >
              <GoogleIcon />
              <span>Google</span>
            </button>
          </div>

          </section>
        </div>

        <TelemetryPanel
          variant="violet"
          icon={Target}
          label="Career Intelligence"
          body="Upload a resume and get an explainable role-fit score with evidence-backed gaps to close."
          chip={
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[10px] font-medium text-violet-300">
              <GraduationCap className="h-3 w-3" /> 66% Role Match
            </span>
          }
        />
      </div>
    </main>
  );
}
