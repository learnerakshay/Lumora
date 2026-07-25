import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#0b0f17] flex items-center justify-center">
        <div className="flex items-center space-x-3 text-slate-400">
          <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm tracking-wide font-mono text-xs">Lumora Auth</span>
        </div>
      </div>
    );
  }

  if (isSignedIn) {
    return <Navigate to="/workspaces" replace />;
  }

  return <>{children}</>;
}
