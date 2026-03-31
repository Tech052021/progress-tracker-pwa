import { useEffect, useState } from 'react';
import { DEFAULT_THEME, THEME_KEY, themes } from './themes';

function applyTheme(key) {
  const def = themes[key] || themes[DEFAULT_THEME];
  const root = document.documentElement;
  Object.entries(def).forEach(([prop, val]) => {
    if (prop.startsWith('--')) root.style.setProperty(prop, val);
  });
}

export function useTheme() {
  const [activeTheme, setActiveTheme] = useState(
    () => localStorage.getItem(THEME_KEY) || DEFAULT_THEME,
  );

  // Apply on first render (handles page reload)
  useEffect(() => { applyTheme(activeTheme); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-apply + persist whenever theme changes
  useEffect(() => {
    applyTheme(activeTheme);
    localStorage.setItem(THEME_KEY, activeTheme);
  }, [activeTheme]);

  return { activeTheme, setActiveTheme, themes };
}
