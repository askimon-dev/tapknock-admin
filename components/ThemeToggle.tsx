'use client';

import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className={`p-2 rounded-xl border border-surface-border bg-surface-card hover:bg-surface-cardHover text-slate-400 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-1.5 ${className}`}
      title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 text-amber-400 animate-in fade-in zoom-in duration-200" />
      ) : (
        <Moon className="w-4 h-4 text-blue-500 animate-in fade-in zoom-in duration-200" />
      )}
      <span className="text-xs font-medium hidden sm:inline text-slate-300">
        {theme === 'dark' ? 'Light' : 'Dark'}
      </span>
    </button>
  );
}
