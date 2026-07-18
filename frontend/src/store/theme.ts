import { create } from "zustand";

interface ThemeState {
  dark: boolean;
  toggle: () => void;
}

/** Class-based dark mode, persisted; initial value applied in main.tsx. */
export const useTheme = create<ThemeState>((set) => ({
  dark: typeof document !== "undefined" &&
        document.documentElement.classList.contains("dark"),
  toggle: () =>
    set((s) => {
      const dark = !s.dark;
      document.documentElement.classList.toggle("dark", dark);
      localStorage.setItem("cleardesk-theme", dark ? "dark" : "light");
      return { dark };
    }),
}));
