import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { AuthWelcomeBoard } from '../components/auth/AuthWelcomeBoard';

export function SignInPage() {
  const { signInWithProvider, authError, clearError } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleProviderSignIn = async (provider: 'google' | 'github' | 'email') => {
    setIsLoading(true);
    clearError();
    try {
      await signInWithProvider(provider);
      navigate('/workspaces');
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
