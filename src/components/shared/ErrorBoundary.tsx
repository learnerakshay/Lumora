import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Home, RefreshCw, WifiOff } from 'lucide-react';
import { ErrorPage } from './ErrorPage';

interface ErrorBoundaryState {
  hasError: boolean;
  isOffline: boolean;
}

// Top-level render-error catch-all. Distinguishes an offline failure from a
// generic one using navigator.onLine — a real signal, not a guess — rather
// than inventing a fake "network error" detector.
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, isOffline: false };

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Unhandled render error', error, info.componentStack);
    this.setState({ isOffline: typeof navigator !== 'undefined' && navigator.onLine === false });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.state.isOffline) {
      return (
        <ErrorPage
          code="Offline"
          icon={WifiOff}
          eyebrow="Connection problem"
          title="You're offline"
          description="Lumora couldn't reach the network. Check your connection and try again."
          actions={
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-400 px-4 py-2.5 text-xs font-semibold text-slate-950 shadow-md shadow-sky-500/20 transition-all hover:bg-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          }
        />
      );
    }

    return (
      <ErrorPage
        code="500"
        icon={AlertTriangle}
        eyebrow="Something went wrong"
        title="Unexpected error"
        description="Lumora hit an unexpected problem loading this page. Reloading usually fixes it."
        actions={
          <>
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-400 px-4 py-2.5 text-xs font-semibold text-slate-950 shadow-md shadow-sky-500/20 transition-all hover:bg-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reload
            </button>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:border-sky-700/70 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <Home className="h-3.5 w-3.5" />
              Return Home
            </Link>
            <Link
              to="/report-bug"
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-medium text-slate-400 transition-colors hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              Report this
            </Link>
          </>
        }
      />
    );
  }
}
