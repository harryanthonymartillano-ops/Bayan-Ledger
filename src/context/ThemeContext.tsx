import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isDark: boolean;
  isOfficialRoute: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_PREFIX = 'bayanledger-theme';
const OFFICIAL_THEME_STORAGE_KEY = 'bayanledger-official-theme';

const getStorageKey = (userId?: string) => {
  return userId ? `${THEME_STORAGE_PREFIX}:${userId}` : OFFICIAL_THEME_STORAGE_KEY;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const isOfficialRoute = location.pathname.startsWith('/official');

  // Track the official user's preferred theme (persists across sessions)
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
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

  // When active user changes or session refreshes, ensure preference is maintained
  useEffect(() => {
    try {
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
  }, [user?.id]);

  // Route-aware DOM application:
  // ONLY apply dark mode if currently inside /official AND the official user's theme is 'dark'.
  // Public pages (/, /projects, /transactions, /login, etc.) ALWAYS stay in light mode.
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

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(OFFICIAL_THEME_STORAGE_KEY, newTheme);
      localStorage.setItem(THEME_STORAGE_PREFIX, newTheme);
      if (user?.id) {
        localStorage.setItem(`${THEME_STORAGE_PREFIX}:${user.id}`, newTheme);
      }
    } catch {
      // Ignore storage errors
    }
  }, [user?.id]);

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

