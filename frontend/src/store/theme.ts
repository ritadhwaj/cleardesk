import { create } from "zustand";

interface ThemeState {
  dark: boolean;
  toggle: () => void;
}

/** Single source of truth for the theme.
 *  The initial value is read from localStorage (falling back to the OS
 *  preference) and the `dark` class is applied here, at module load, so the
 *  store state and the <html> class can never diverge — which is what caused
 *  the intermittent "half light / half dark" split (scenes use this store,
 *  the rest of the UI uses the CSS `.dark` class). */
function computeInitial(): boolean {
  if (typeof window === "undefined") return false;
  const saved = localStorage.getItem("cleardesk-theme");
  if (saved) return saved === "dark";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

const initialDark = computeInitial();
if (typeof document !== "undefined") {
  document.documentElement.classList.toggle("dark", initialDark);
}

export const useTheme = create<ThemeState>((set) => ({
  dark: initialDark,
  toggle: () =>
    set((s) => {
      const dark = !s.dark;
      document.documentElement.classList.toggle("dark", dark);
      localStorage.setItem("cleardesk-theme", dark ? "dark" : "light");
      return { dark };
    }),
}));
