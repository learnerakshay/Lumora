import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { AuthWelcomeBoard } from '../components/auth/AuthWelcomeBoard';

export function SignUpPage() {
  const { signUpWithProvider, authError, clearError } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleProviderSignUp = async (provider: 'google' | 'github' | 'email') => {
    setIsLoading(true);
    clearError();
    try {
      await signUpWithProvider(provider);
      navigate('/workspaces');
    } catch (err) {
      // Error handled by AuthProvider
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthWelcomeBoard
      mode="sign-up"
      authError={authError}
      isLoading={isLoading}
      onAuthenticate={handleProviderSignUp}
    />
  );
}
