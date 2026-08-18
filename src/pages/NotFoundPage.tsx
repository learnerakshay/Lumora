import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';
import { ErrorPage } from '../components/shared/ErrorPage';
import { useAuth } from '../components/AuthProvider';

export function NotFoundPage() {
  const { isSignedIn } = useAuth();

  return (
    <ErrorPage
      code="404"
      icon={Compass}
      eyebrow="Error 404"
      title="This page doesn't exist"
      description="The page you're looking for may have moved, or the link might be out of date."
      actions={
        <>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg bg-sky-400 px-4 py-2.5 text-xs font-semibold text-slate-950 shadow-md shadow-sky-500/20 transition-all hover:bg-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            <Home className="h-3.5 w-3.5" />
            Return Home
          </Link>
          {isSignedIn && (
            <Link
              to="/workspaces"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:border-sky-700/70 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              Open Workspaces
            </Link>
          )}
        </>
      }
    />
  );
}
