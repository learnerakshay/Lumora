import React from 'react';
import { LumoraBrand } from './landing/LumoraBrand';

// Shown for two brief, distinct windows on the authenticated path: while
// Clerk's client-side session check resolves (ProtectedRoute), and while a
// lazy-loaded route chunk downloads (App's Suspense boundary). Kept as a
// tiny, dependency-free component (no Three.js/GSAP/Lenis) so it never adds
// weight to the very bundle it is standing in for.
export function AppShellLoader({ label = 'Loading Lumora…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b0f17]">
      <div className="flex flex-col items-center gap-4">
        <LumoraBrand markOnly />
        <div className="flex items-center space-x-3 text-slate-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
          <span className="text-sm tracking-wide">{label}</span>
        </div>
      </div>
    </div>
  );
}
