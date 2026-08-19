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
  authProvider: 'google' | 'github' | 'email' | 'other';
}

interface AuthContextType {
  isLoaded: boolean;
  isSignedIn: boolean;
  authenticatedUserId: string | null;
  user: AuthUser | null;
  signInWithProvider: (
    provider: 'google' | 'github' | 'email',
    emailInput?: string,
    redirectTo?: string,
  ) => Promise<void>;
  signUpWithProvider: (
    provider: 'google' | 'github' | 'email',
    emailInput?: string,
    redirectTo?: string,
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

function resolveAuthProvider(clerkUser: ReturnType<typeof useClerkUser>['user']): AuthUser['authProvider'] {
  const externalProvider = clerkUser?.externalAccounts?.[0]?.provider;
  if (!externalProvider) return 'email';
  if (externalProvider.includes('google')) return 'google';
  if (externalProvider.includes('github')) return 'github';
  return 'other';
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
  const { isLoaded, isSignedIn, userId } = useClerkAuth();
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
        authProvider: resolveAuthProvider(clerkUser),
      }
    : null;

  const signInWithProvider = async (
    _provider?: 'google' | 'github' | 'email',
    _emailInput?: string,
    redirectTo?: string,
  ) => {
    setAuthError(null);
    try {
      await clerk.redirectToSignIn({ redirectUrl: redirectTo || '/workspaces' });
    } catch (error: any) {
      setAuthError(error.message || 'Authentication failed. Please try again.');
    }
  };

  const signUpWithProvider = async (
    _provider?: 'google' | 'github' | 'email',
    _emailInput?: string,
    redirectTo?: string,
  ) => {
    setAuthError(null);
    try {
      await clerk.redirectToSignUp({ redirectUrl: redirectTo || '/workspaces' });
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
        authenticatedUserId: userId || null,
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
