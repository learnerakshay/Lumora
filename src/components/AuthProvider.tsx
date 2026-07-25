import React, { createContext, useContext, useState } from 'react';
import { ClerkProvider, useAuth as useClerkAuth, useUser as useClerkUser, useClerk } from '@clerk/clerk-react';

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
  signInWithProvider: (provider: 'google' | 'github' | 'email', emailInput?: string) => Promise<void>;
  signUpWithProvider: (provider: 'google' | 'github' | 'email', emailInput?: string) => Promise<void>;
  signOut: () => Promise<void>;
  authError: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'lumora_user_session';

const envSource = typeof window !== 'undefined' ? (import.meta as any).env || {} : process.env;
const clerkPubKey = envSource.VITE_CLERK_PUBLISHABLE_KEY || envSource.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const isValidClerkKey = Boolean(clerkPubKey && typeof clerkPubKey === 'string' && clerkPubKey.length > 20 && !clerkPubKey.includes('mock'));

function resolveDisplayName(fullName?: string | null, firstName?: string | null, email?: string | null): string {
  if (fullName && fullName.trim()) return fullName.trim();
  if (firstName && firstName.trim()) return firstName.trim();
  if (email && email.includes('@')) {
    const username = email.split('@')[0].trim();
    if (username) return username;
  }
  return 'User';
}

function ClerkInnerAuthProvider({ children }: { children: React.ReactNode }) {
  const clerk = useClerk();
  const { isLoaded: clerkLoaded, isSignedIn: clerkSignedIn } = useClerkAuth();
  const { user: clerkUser } = useClerkUser();

  const [localUser, setLocalUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [authError, setAuthError] = useState<string | null>(null);

  const isSignedIn = Boolean(clerkSignedIn || localUser);
  const userEmail = clerkUser?.primaryEmailAddress?.emailAddress || localUser?.email || 'user@lumora.ai';
  const userFullName = clerkUser
    ? resolveDisplayName(clerkUser.fullName, clerkUser.firstName, userEmail)
    : (localUser?.fullName || resolveDisplayName(null, null, userEmail));

  const user: AuthUser | null = clerkUser ? {
    id: clerkUser.id,
    email: userEmail,
    fullName: userFullName,
    imageUrl: clerkUser.imageUrl,
  } : localUser;

  const signInWithProvider = async (provider: 'google' | 'github' | 'email', emailInput?: string) => {
    setAuthError(null);
    try {
      if (provider === 'google' || provider === 'github') {
        await clerk.redirectToSignIn({
          redirectUrl: '/workspaces',
        });
        return;
      }

      const mockEmail = emailInput && emailInput.includes('@') ? emailInput : `user_${provider}@lumora.ai`;
      const newUser: AuthUser = {
        id: `usr_${Date.now().toString(36)}`,
        email: mockEmail,
        fullName: resolveDisplayName(null, null, mockEmail),
        provider,
      };

      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newUser));
      setLocalUser(newUser);
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed. Please try again.');
    }
  };

  const signUpWithProvider = async (provider: 'google' | 'github' | 'email', emailInput?: string) => {
    return signInWithProvider(provider, emailInput);
  };

  const signOut = async () => {
    setAuthError(null);
    try {
      await clerk.signOut();
    } catch (err) {
      // Ignore
    } finally {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      setLocalUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isLoaded: clerkLoaded,
        isSignedIn,
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

function LocalAuthProvider({ children }: { children: React.ReactNode }) {
  const [localUser, setLocalUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [authError, setAuthError] = useState<string | null>(null);

  const isSignedIn = Boolean(localUser);

  const signInWithProvider = async (provider: 'google' | 'github' | 'email', emailInput?: string) => {
    setAuthError(null);
    try {
      const mockEmail = emailInput && emailInput.includes('@') ? emailInput : `user_${provider}@lumora.ai`;
      const newUser: AuthUser = {
        id: `usr_${Date.now().toString(36)}`,
        email: mockEmail,
        fullName: resolveDisplayName(null, null, mockEmail),
        provider,
      };

      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newUser));
      setLocalUser(newUser);
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed. Please try again.');
    }
  };

  const signUpWithProvider = async (provider: 'google' | 'github' | 'email', emailInput?: string) => {
    return signInWithProvider(provider, emailInput);
  };

  const signOut = async () => {
    setAuthError(null);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setLocalUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isLoaded: true,
        isSignedIn,
        user: localUser,
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
  if (isValidClerkKey && clerkPubKey) {
    return (
      <ClerkProvider publishableKey={clerkPubKey}>
        <ClerkInnerAuthProvider>{children}</ClerkInnerAuthProvider>
      </ClerkProvider>
    );
  }

  return <LocalAuthProvider>{children}</LocalAuthProvider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
