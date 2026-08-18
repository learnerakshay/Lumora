import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { AuthWelcomeBoard } from '../components/auth/AuthWelcomeBoard';

// Only a same-origin relative path is a safe post-sign-in destination — a
// bare "/…" that isn't protocol-relative ("//evil.com") guards against an
// open redirect via a crafted ?redirect= query value.
function safeRedirectTarget(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return '/workspaces';
}

export function SignInPage() {
  const { signInWithProvider, authError, clearError } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTarget = safeRedirectTarget(searchParams.get('redirect'));

  const handleProviderSignIn = async (provider: 'google' | 'github' | 'email') => {
    setIsLoading(true);
    clearError();
    try {
      await signInWithProvider(provider, undefined, redirectTarget);
      navigate(redirectTarget);
    } catch (err) {
      // Error handled by AuthProvider
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthWelcomeBoard
      mode="sign-in"
      authError={authError}
      isLoading={isLoading}
      onAuthenticate={handleProviderSignIn}
    />
  );
}
