import React, { createContext, useContext, useState } from 'react';
import {
  ClerkProvider,
  useAuth as useClerkAuth,
  useUser as useClerkUser,
  useClerk,
} from '@clerk/clerk-react';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  imageUrl?: string;
  provider?: string;
}

interface AuthContextType {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: AuthUser | null;
  signInWithProvider: (
    provider: 'google' | 'github' | 'email',
    emailInput?: string,
  ) => Promise<void>;
  signUpWithProvider: (
    provider: 'google' | 'github' | 'email',
    emailInput?: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  authError: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const clerkPublishableKey = (import.meta as any).env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPublishableKey) {
  throw new Error('VITE_CLERK_PUBLISHABLE_KEY is required');
}

function resolveDisplayName(
  fullName?: string | null,
  firstName?: string | null,
  email?: string | null,
): string {
  if (fullName?.trim()) return fullName.trim();
  if (firstName?.trim()) return firstName.trim();
  if (email?.includes('@')) return email.split('@')[0].trim() || 'User';
  return 'User';
}

function ClerkAuthContextProvider({ children }: { children: React.ReactNode }) {
  const clerk = useClerk();
  const { isLoaded, isSignedIn } = useClerkAuth();
  const { user: clerkUser } = useClerkUser();
  const [authError, setAuthError] = useState<string | null>(null);

  const email = clerkUser?.primaryEmailAddress?.emailAddress || '';
  const user: AuthUser | null = clerkUser
    ? {
        id: clerkUser.id,
        email,
        fullName: resolveDisplayName(clerkUser.fullName, clerkUser.firstName, email),
        imageUrl: clerkUser.imageUrl,
        provider: 'clerk',
      }
    : null;

  const signInWithProvider = async () => {
    setAuthError(null);
    try {
      await clerk.redirectToSignIn({ redirectUrl: '/workspaces' });
    } catch (error: any) {
      setAuthError(error.message || 'Authentication failed. Please try again.');
    }
  };

  const signUpWithProvider = async () => {
    setAuthError(null);
    try {
      await clerk.redirectToSignUp({ redirectUrl: '/workspaces' });
    } catch (error: any) {
      setAuthError(error.message || 'Registration failed. Please try again.');
    }
  };

  const signOut = async () => {
    setAuthError(null);
    await clerk.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        isLoaded,
        isSignedIn: Boolean(isSignedIn),
        user,
        signInWithProvider,
        signUpWithProvider,
        signOut,
        authError,
        clearError: () => setAuthError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <ClerkAuthContextProvider>{children}</ClerkAuthContextProvider>
    </ClerkProvider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
