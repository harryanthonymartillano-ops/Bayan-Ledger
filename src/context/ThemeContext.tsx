import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { apiClient } from '../lib/apiClient';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isDark: boolean;
  isOfficialRoute: boolean;
  isSyncing: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_PREFIX = 'bayanledger-theme';
const OFFICIAL_THEME_STORAGE_KEY = 'bayanledger-official-theme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token, updateLocalThemePreference } = useAuth();
  const location = useLocation();
  const isOfficialRoute = location.pathname.startsWith('/official');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const isUpdatingDbRef = useRef<boolean>(false);

  // Track the official user's preferred theme (persists across sessions)
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      if (user?.themePreference === 'dark' || user?.themePreference === 'light') {
        return user.themePreference;
      }
      const activeKey = user?.id ? `${THEME_STORAGE_PREFIX}:${user.id}` : null;
      const stored = (activeKey && localStorage.getItem(activeKey)) ||
                     localStorage.getItem(OFFICIAL_THEME_STORAGE_KEY) ||
                     localStorage.getItem(THEME_STORAGE_PREFIX);
      if (stored === 'dark' || stored === 'light') {
        return stored;
      }
    } catch {
      // Storage access may fail
    }
    return 'light';
  });

  // When active user changes or session refreshes, sync preference from user profile (database)
  useEffect(() => {
    // If we are currently updating the database ourselves, avoid overriding local state
    if (isUpdatingDbRef.current) return;

    try {
      if (user?.themePreference === 'dark' || user?.themePreference === 'light') {
        setThemeState(user.themePreference);
        localStorage.setItem(OFFICIAL_THEME_STORAGE_KEY, user.themePreference);
        if (user.id) {
          localStorage.setItem(`${THEME_STORAGE_PREFIX}:${user.id}`, user.themePreference);
        }
        return;
      }

      const activeKey = user?.id ? `${THEME_STORAGE_PREFIX}:${user.id}` : null;
      const userTheme = activeKey ? localStorage.getItem(activeKey) : null;
      const fallbackTheme = localStorage.getItem(OFFICIAL_THEME_STORAGE_KEY) || localStorage.getItem(THEME_STORAGE_PREFIX);
      const effectiveTheme = (userTheme === 'dark' || userTheme === 'light') ? userTheme : fallbackTheme;

      if (effectiveTheme === 'dark' || effectiveTheme === 'light') {
        setThemeState(effectiveTheme);
      }
    } catch {
      // Storage access may fail
    }
  }, [user?.id, user?.themePreference]);

  // Route-aware DOM application:
  // ONLY apply dark mode if currently inside /official AND the official user's theme is 'dark'.
  // Public pages (/, /projects, /transactions, /login, etc.) ALWAYS stay in clean light mode.
  useEffect(() => {
    const root = document.documentElement;

    if (isOfficialRoute && theme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
  }, [isOfficialRoute, theme]);

  const setTheme = useCallback(async (newTheme: Theme) => {
    setThemeState(newTheme);

    // 1. Immediately cache in localStorage for instant retrieval
    try {
      localStorage.setItem(OFFICIAL_THEME_STORAGE_KEY, newTheme);
      localStorage.setItem(THEME_STORAGE_PREFIX, newTheme);
      if (user?.id) {
        localStorage.setItem(`${THEME_STORAGE_PREFIX}:${user.id}`, newTheme);
      }
    } catch {
      // Ignore storage errors
    }

    // 2. Update user state in AuthContext so memory and storage stay aligned
    if (updateLocalThemePreference) {
      updateLocalThemePreference(newTheme);
    }

    // 3. Persist to database if authenticated with active token
    if (token) {
      isUpdatingDbRef.current = true;
      setIsSyncing(true);
      try {
        const result = await apiClient.updateThemePreference(token, newTheme);
        if (result?.warning) {
          console.warn('[Theme Sync Notice]:', result.warning);
        }
      } catch (err) {
        console.warn('Could not persist theme preference to backend database:', err);
      } finally {
        setIsSyncing(false);
        // Short delay to avoid race with incoming profile refreshes
        setTimeout(() => {
          isUpdatingDbRef.current = false;
        }, 500);
      }
    }
  }, [user?.id, token, updateLocalThemePreference]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }, [setTheme, theme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        isDark: isOfficialRoute && theme === 'dark',
        isOfficialRoute,
        isSyncing,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
