import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';

export function SignInPage() {
  const { signInWithProvider, authError, clearError } = useAuth();
  const [emailInput, setEmailInput] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleProviderSignIn = async (provider: 'google' | 'github' | 'email') => {
    setIsLoading(true);
    clearError();
    try {
      await signInWithProvider(provider, emailInput);
      navigate('/workspaces');
    } catch (err) {
      // Error handled by AuthProvider
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    handleProviderSignIn('email');
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0b0f17] flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md space-y-8 bg-[#121824] border border-slate-800/90 p-8 rounded-xl shadow-2xl shadow-sky-950/20">
        <div className="text-center space-y-2">
          <p className="text-xs font-semibold tracking-widest text-sky-400 uppercase">
            Welcome to Lumora
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            ACCESS PORTAL
          </h1>
          <p className="text-xs text-slate-400">
            Sign in to access your Lumora knowledge workspaces.
          </p>
        </div>

        {authError && (
          <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-xs text-red-300">
            {authError}
          </div>
        )}

        <div className="space-y-3 pt-2">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => handleProviderSignIn('google')}
            className="w-full flex items-center justify-center space-x-3 px-4 py-2.5 bg-[#182030] hover:bg-[#1e293b] border border-slate-700/80 hover:border-sky-500/50 rounded-lg text-sm font-medium text-slate-200 transition-all duration-200 cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
              />
              <path
                fill="#FBBC05"
                d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 10.8 0 12.5s.7 2.8 1.9 5.2l3.7-2.9z"
              />
              <path
                fill="#34A853"
                d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={() => handleProviderSignIn('github')}
            className="w-full flex items-center justify-center space-x-3 px-4 py-2.5 bg-[#182030] hover:bg-[#1e293b] border border-slate-700/80 hover:border-sky-500/50 rounded-lg text-sm font-medium text-slate-200 transition-all duration-200 cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4 fill-current text-white" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <span>Continue with GitHub</span>
          </button>

          {!showEmailForm ? (
            <button
              type="button"
              disabled={isLoading}
              onClick={() => setShowEmailForm(true)}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-sky-950/60 hover:bg-sky-900/60 border border-sky-800/60 hover:border-sky-500/80 rounded-lg text-sm font-medium text-sky-300 transition-all duration-200 cursor-pointer"
            >
              <span>Email Sign In</span>
            </button>
          ) : (
            <form onSubmit={handleEmailSubmit} className="space-y-3 pt-2">
              <input
                type="email"
                required
                placeholder="developer@company.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full px-3.5 py-2 bg-[#0b0f17] border border-slate-700 focus:border-sky-400 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none transition-colors"
              />
              <div className="flex space-x-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-2 bg-sky-500 hover:bg-sky-400 font-semibold text-slate-950 text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Confirm Email Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setShowEmailForm(false)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="pt-4 border-t border-slate-800/80 text-center">
          <p className="text-xs text-slate-400">
            Need an account?{' '}
            <Link to="/sign-up" className="text-sky-400 hover:underline font-medium">
              Create Developer Identity
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
