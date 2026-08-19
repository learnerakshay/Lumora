import React, { createContext, useContext, useEffect, useState } from 'react';

export interface LearningPreferences {
  strictGrounding: boolean;
  inlineCitations: boolean;
  webDiscovery: boolean;
}

const DEFAULT_PREFERENCES: LearningPreferences = {
  strictGrounding: true,
  inlineCitations: true,
  webDiscovery: false,
};

const STORAGE_KEY = 'lumora-learning-preferences';

function readStoredPreferences(): LearningPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw);
    return {
      strictGrounding: typeof parsed.strictGrounding === 'boolean' ? parsed.strictGrounding : DEFAULT_PREFERENCES.strictGrounding,
      inlineCitations: typeof parsed.inlineCitations === 'boolean' ? parsed.inlineCitations : DEFAULT_PREFERENCES.inlineCitations,
      webDiscovery: typeof parsed.webDiscovery === 'boolean' ? parsed.webDiscovery : DEFAULT_PREFERENCES.webDiscovery,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

interface LearningPreferencesContextValue extends LearningPreferences {
  setStrictGrounding: (value: boolean) => void;
  setInlineCitations: (value: boolean) => void;
  setWebDiscovery: (value: boolean) => void;
}

const LearningPreferencesContext = createContext<LearningPreferencesContextValue | null>(null);

export function LearningPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<LearningPreferences>(readStoredPreferences);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Preferences stay active for this session even if persistence fails (e.g. private browsing).
    }
  }, [preferences]);

  const value: LearningPreferencesContextValue = {
    ...preferences,
    setStrictGrounding: (nextValue) => setPreferences((prev) => ({ ...prev, strictGrounding: nextValue })),
    setInlineCitations: (nextValue) => setPreferences((prev) => ({ ...prev, inlineCitations: nextValue })),
    setWebDiscovery: (nextValue) => setPreferences((prev) => ({ ...prev, webDiscovery: nextValue })),
  };

  return (
    <LearningPreferencesContext.Provider value={value}>
      {children}
    </LearningPreferencesContext.Provider>
  );
}

export function useLearningPreferences(): LearningPreferencesContextValue {
  const context = useContext(LearningPreferencesContext);
  if (!context) {
    throw new Error('useLearningPreferences must be used within a LearningPreferencesProvider');
  }
  return context;
}
