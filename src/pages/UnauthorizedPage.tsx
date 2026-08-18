import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Lock, LogIn } from 'lucide-react';
import { ErrorPage } from '../components/shared/ErrorPage';
import { useAuth } from '../components/AuthProvider';

export function UnauthorizedPage() {
  const { isSignedIn } = useAuth();

  return (
    <ErrorPage
      code="403"
      icon={Lock}
      eyebrow="Error 403"
      title="You can't access this"
      description={
        isSignedIn
          ? "This resource doesn't belong to your account, or you don't have permission to view it."
          : 'Sign in to continue — this page requires an authenticated account.'
      }
      actions={
        isSignedIn ? (
          <>
            <Link
              to="/workspaces"
              className="inline-flex items-center gap-2 rounded-lg bg-sky-400 px-4 py-2.5 text-xs font-semibold text-slate-950 shadow-md shadow-sky-500/20 transition-all hover:bg-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              Go to Workspaces
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:border-sky-700/70 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <Home className="h-3.5 w-3.5" />
              Return Home
            </Link>
          </>
        ) : (
          <Link
            to="/sign-in"
            className="inline-flex items-center gap-2 rounded-lg bg-sky-400 px-4 py-2.5 text-xs font-semibold text-slate-950 shadow-md shadow-sky-500/20 transition-all hover:bg-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            <LogIn className="h-3.5 w-3.5" />
            Sign In
          </Link>
        )
      }
    />
  );
}
