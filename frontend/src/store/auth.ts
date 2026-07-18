import { create } from "zustand";

interface AuthState {
  token: string | null;
  role: string | null;
  fullName: string | null;
  login: (token: string, role: string, fullName: string) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  token: null,
  role: null,
  fullName: null,
  login: (token, role, fullName) => set({ token, role, fullName }),
  logout: () => set({ token: null, role: null, fullName: null }),
}));
