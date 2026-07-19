import { create } from "zustand";

/** Display timezone. Backend stores everything in IST; the UI converts to
 *  whichever zone the user picks here. Persisted across sessions. */

export interface TzOption { id: string; label: string }

export const TZ_OPTIONS: TzOption[] = [
  { id: "Asia/Kolkata", label: "India (IST)" },
  { id: "UTC", label: "UTC" },
  { id: "America/New_York", label: "New York (ET)" },
  { id: "America/Chicago", label: "Chicago (CT)" },
  { id: "America/Los_Angeles", label: "Los Angeles (PT)" },
  { id: "Europe/London", label: "London (GMT/BST)" },
  { id: "Europe/Paris", label: "Paris (CET)" },
  { id: "Asia/Dubai", label: "Dubai (GST)" },
  { id: "Asia/Singapore", label: "Singapore (SGT)" },
  { id: "Asia/Tokyo", label: "Tokyo (JST)" },
  { id: "Australia/Sydney", label: "Sydney (AET)" },
];

const stored = typeof localStorage !== "undefined"
  ? localStorage.getItem("cleardesk-tz") : null;
const initial = stored && TZ_OPTIONS.some((o) => o.id === stored) ? stored : "Asia/Kolkata";

interface TzState { tz: string; setTz: (id: string) => void }

export const useTimezone = create<TzState>((set) => ({
  tz: initial,
  setTz: (id) => {
    localStorage.setItem("cleardesk-tz", id);
    set({ tz: id });
  },
}));

export const labelFor = (id: string) =>
  TZ_OPTIONS.find((o) => o.id === id)?.label ?? id;
