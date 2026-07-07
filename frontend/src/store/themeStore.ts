import { create } from 'zustand';

type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

// Applies the theme class to <html> itself — every color in
// tailwind.config.js resolves through a CSS variable that flips based on
// this class (see index.css), so this one line is what makes every existing
// page respond to the toggle without any of them needing to know a theme
// system exists at all.
const applyThemeClass = (theme: Theme) => {
  document.documentElement.classList.toggle('light', theme === 'light');
};

const getInitialTheme = (): Theme => {
  const stored = localStorage.getItem('theme');
  return stored === 'light' ? 'light' : 'dark'; // dark stays the default — no behavior change for anyone who's never touched this
};

const initial = getInitialTheme();
applyThemeClass(initial);

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initial,
  toggleTheme: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    applyThemeClass(next);
    set({ theme: next });
  },
  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    applyThemeClass(theme);
    set({ theme });
  },
}));