import { create } from "zustand";

/** Display timezone. Backend stores everything in IST; the UI converts to
 *  whichever zone the user picks here. Persisted across sessions. */

export interface TzOption {
  id: string; label: string; city: string; lat: number; lon: number;
}

export const TZ_OPTIONS: TzOption[] = [
  { id: "Asia/Kolkata",        label: "India (IST)",     city: "New Delhi",   lat: 28.6,  lon: 77.2 },
  { id: "UTC",                 label: "UTC",             city: "UTC",         lat: 0,     lon: 0 },
  { id: "America/New_York",    label: "Eastern (ET)",    city: "New York",    lat: 40.7,  lon: -74.0 },
  { id: "America/Chicago",     label: "Central (CT)",    city: "Chicago",     lat: 41.9,  lon: -87.6 },
  { id: "America/Los_Angeles", label: "Pacific (PT)",    city: "Los Angeles", lat: 34.0,  lon: -118.2 },
  { id: "Europe/London",       label: "UK (GMT/BST)",    city: "London",      lat: 51.5,  lon: -0.1 },
  { id: "Europe/Paris",        label: "Central Europe",  city: "Paris",       lat: 48.9,  lon: 2.35 },
  { id: "Asia/Dubai",          label: "Gulf (GST)",      city: "Dubai",       lat: 25.2,  lon: 55.3 },
  { id: "Asia/Singapore",      label: "Singapore (SGT)", city: "Singapore",   lat: 1.35,  lon: 103.8 },
  { id: "Asia/Tokyo",          label: "Japan (JST)",     city: "Tokyo",       lat: 35.7,  lon: 139.7 },
  { id: "Australia/Sydney",    label: "Australia (AET)", city: "Sydney",      lat: -33.9, lon: 151.2 },
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

export const optionFor = (id: string) =>
  TZ_OPTIONS.find((o) => o.id === id) ?? TZ_OPTIONS[0];
export const labelFor = (id: string) => optionFor(id).label;
