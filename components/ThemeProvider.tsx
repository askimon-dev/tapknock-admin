'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
});

export const COOKIE_THEME_NAME = 'tk_admin_theme';

export function ThemeProvider({
  initialTheme = 'dark',
  children,
}: {
  initialTheme?: Theme;
  children: React.ReactNode;
}) {
  const [theme, setCurrentTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    // Read cookie on mount if available
    const match = document.cookie.match(new RegExp(`(^| )${COOKIE_THEME_NAME}=([^;]+)`));
    const savedTheme = match ? (match[2] as Theme) : initialTheme;
    if (savedTheme === 'light' || savedTheme === 'dark') {
      setCurrentTheme(savedTheme);
      applyTheme(savedTheme);
    }
  }, [initialTheme]);

  const applyTheme = (t: Theme) => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(t);
    root.style.colorScheme = t;
  };

  const setTheme = (nextTheme: Theme) => {
    setCurrentTheme(nextTheme);
    applyTheme(nextTheme);
    document.cookie = `${COOKIE_THEME_NAME}=${nextTheme}; path=/; max-age=31536000; SameSite=Lax`;
  };

  const toggleTheme = () => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
