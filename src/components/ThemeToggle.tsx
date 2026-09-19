import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  variant?: 'segmented' | 'switch' | 'icon' | 'cards';
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ variant = 'segmented', className = '' }) => {
  const { theme, setTheme, toggleTheme, isDark } = useTheme();

  // Paios-classroom Header Icon Button
  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`relative h-9 w-9 rounded-xl border border-slate-200 dark:border-[#212638] bg-white dark:bg-[#141722] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1b1f2e] flex items-center justify-center transition-all duration-200 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${className}`}
        title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
        aria-label={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
      >
        {isDark ? (
          <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300 hover:rotate-45" />
        ) : (
          <Moon className="w-4 h-4 text-slate-700 transition-transform duration-300 hover:-rotate-12" />
        )}
      </button>
    );
  }

  // Paios-classroom Appearance Settings Cards (Image 2)
  if (variant === 'cards') {
    return (
      <div className={`grid grid-cols-2 gap-3 w-full ${className}`} role="radiogroup" aria-label="Theme Selection">
        {/* Light Mode Card */}
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border-2 transition-all duration-150 text-center ${
            theme === 'light'
              ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 font-semibold shadow-xs'
              : 'border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#121520] text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
          role="radio"
          aria-checked={theme === 'light'}
        >
          <div className={`p-2 rounded-lg ${theme === 'light' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
            <Sun className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold">Light</span>
        </button>

        {/* Dark Mode Card */}
        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border-2 transition-all duration-150 text-center ${
            theme === 'dark'
              ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 font-semibold shadow-xs'
              : 'border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#121520] text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
          role="radio"
          aria-checked={theme === 'dark'}
        >
          <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
            <Moon className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold">Dark</span>
        </button>
      </div>
    );
  }

  if (variant === 'switch') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
          isDark ? 'bg-blue-600' : 'bg-slate-300'
        } ${className}`}
        role="switch"
        aria-checked={isDark}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform flex items-center justify-center ${
            isDark ? 'translate-x-6' : 'translate-x-1'
          }`}
        >
          {isDark ? (
            <Moon className="w-2.5 h-2.5 text-blue-600" />
          ) : (
            <Sun className="w-2.5 h-2.5 text-amber-500" />
          )}
        </span>
      </button>
    );
  }

  // Segmented pill
  return (
    <div
      className={`inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-[#141722] border border-slate-200 dark:border-[#212638] ${className}`}
      role="radiogroup"
      aria-label="Theme selection"
    >
      <button
        type="button"
        onClick={() => setTheme('light')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
          theme === 'light'
            ? 'bg-white text-slate-900 shadow-xs font-semibold'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
        }`}
        role="radio"
        aria-checked={theme === 'light'}
      >
        <Sun className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-amber-500' : ''}`} />
        <span>Light</span>
      </button>

      <button
        type="button"
        onClick={() => setTheme('dark')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
          theme === 'dark'
            ? 'bg-slate-900 text-white shadow-xs font-semibold dark:bg-blue-600'
            : 'text-slate-500 hover:text-slate-900'
        }`}
        role="radio"
        aria-checked={theme === 'dark'}
      >
        <Moon className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-blue-200' : ''}`} />
        <span>Dark</span>
      </button>
    </div>
  );
};

