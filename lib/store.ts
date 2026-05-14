"use client";

/**
 * Client-side state for Swiggy LifeOps Agent.
 *
 * - Persists to `localStorage` under the key `lifeops-store` so the demo
 *   survives reloads without a backend.
 * - Seeds with realistic demo data on first load.
 * - Exposed via the `useApp` hook to every page/component.
 *
 * In production, the same shape can back a Supabase / Postgres store;
 * persist() simply needs to be replaced with a remote sync.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CalendarEvent, LifeOpsPlan, UserMemory } from "./types";

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

const inDays = (n: number, hour: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

const DEFAULT_MEMORY: UserMemory = {
  id: "user_demo",
  name: "Devesh",
  homeAddress: "Flat 12B, Indiranagar, Bengaluru",
  workAddress: "Koramangala 4th Block, Bengaluru",
  diet: "egg",
  allergies: ["peanut"],
  favoriteCuisines: ["South Indian", "Biryani", "Pasta", "Chinese"],
  dislikedItems: ["mushroom", "olives"],
  monthlyBudget: 12000,
  perOrderBudgetSoftCap: 600,
  roommates: [
    { id: "rm_1", name: "Devesh", share: 34, diet: "egg" },
    { id: "rm_2", name: "Aakash", share: 33, diet: "veg" },
    { id: "rm_3", name: "Rohit", share: 33, diet: "non-veg" },
  ],
  recurringItems: [
    { id: "ri_1", name: "Milk 1L", category: "grocery", averageQty: 6, unit: "pack", cadenceDays: 7, lastOrderedAt: daysAgo(6) },
    { id: "ri_2", name: "Eggs (12)", category: "grocery", averageQty: 1, unit: "tray", cadenceDays: 5, lastOrderedAt: daysAgo(5) },
    { id: "ri_3", name: "Bread", category: "grocery", averageQty: 2, unit: "loaf", cadenceDays: 4, lastOrderedAt: daysAgo(3) },
    { id: "ri_4", name: "Atta 5kg", category: "grocery", averageQty: 1, unit: "pack", cadenceDays: 30, lastOrderedAt: daysAgo(22) },
    { id: "ri_5", name: "Coffee 200g", category: "beverage", averageQty: 1, unit: "pack", cadenceDays: 21, lastOrderedAt: daysAgo(20) },
    { id: "ri_6", name: "Detergent 1L", category: "cleaning", averageQty: 1, unit: "bottle", cadenceDays: 30, lastOrderedAt: daysAgo(25) },
    { id: "ri_7", name: "Maggi (8 pack)", category: "snack", averageQty: 1, unit: "pack", cadenceDays: 10, lastOrderedAt: daysAgo(9) },
    { id: "ri_8", name: "Toilet paper", category: "toiletry", averageQty: 1, unit: "pack", cadenceDays: 21, lastOrderedAt: daysAgo(18) },
  ],
  printSettings: { color: "bw", binding: "spiral", paperSize: "A4", doubleSided: true },
  travelHabits: [
    { city: "Bengaluru", preferredMealOnArrival: "Curd rice + filter coffee" },
    { city: "Mumbai", preferredMealOnArrival: "Vada pav + cutting chai" },
    { city: "Delhi", preferredMealOnArrival: "Paratha + lassi" },
  ],
  noOrderWindows: [
    { label: "Deep work", startHour: 10, endHour: 13 },
    { label: "Sleep", startHour: 1, endHour: 7 },
  ],
  caffeineHabit: "high",
  recentPlaces: [
    { id: "p1", name: "Meghana Foods", city: "Bengaluru", type: "restaurant", visitedAt: daysAgo(2) },
    { id: "p2", name: "Third Wave Coffee", city: "Bengaluru", type: "restaurant", visitedAt: daysAgo(4) },
    { id: "p3", name: "Phoenix Marketcity", city: "Bengaluru", type: "venue", visitedAt: daysAgo(9) },
    { id: "p4", name: "Taj MG Road", city: "Bengaluru", type: "hotel", visitedAt: daysAgo(14) },
  ],
  searchHistory: [
    { id: "s1", query: "biryani near me", surface: "food", at: daysAgo(1) },
    { id: "s2", query: "milk 1l", surface: "instamart", at: daysAgo(1) },
    { id: "s3", query: "best dosa", surface: "food", at: daysAgo(3) },
    { id: "s4", query: "team dinner spots", surface: "dineout", at: daysAgo(6) },
  ],
  pastOrders: [
    { id: "o1", surface: "food", total: 540, items: ["Chicken Biryani", "Raita"], at: daysAgo(2) },
    { id: "o2", surface: "instamart", total: 870, items: ["Milk", "Eggs", "Bread", "Coffee"], at: daysAgo(7) },
    { id: "o3", surface: "food", total: 220, items: ["Filter coffee", "Idli x2"], at: daysAgo(4) },
  ],
  calendarConnected: true,
  lastUpdated: new Date().toISOString(),
};

const DEFAULT_CALENDAR: CalendarEvent[] = [
  { id: "ev1", title: "Internal Hackathon — Submission", start: inDays(1, 23), end: inDays(2, 9), location: "BMSCE Hostel Block C", attendees: 12, source: "google", tags: ["hackathon"] },
  { id: "ev2", title: "All-hands → Team Lunch", start: inDays(3, 13), end: inDays(3, 14), location: "Koramangala office", attendees: 40, source: "google", tags: ["meeting", "team-lunch"] },
  { id: "ev3", title: "Flight BLR → BOM", start: inDays(5, 21), end: inDays(5, 23), location: "BLR airport", source: "google", tags: ["travel"] },
  { id: "ev4", title: "DBMS End-Sem Exam", start: inDays(7, 9), end: inDays(7, 12), source: "google", tags: ["exam"] },
];

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface AppState {
  memory: UserMemory;
  calendar: CalendarEvent[];
  /** Most recent generated plans (capped at 12 to keep storage small). */
  plans: LifeOpsPlan[];
  dismissedSuggestionIds: string[];
  setMemory: (patch: Partial<UserMemory>) => void;
  resetMemory: () => void;
  addRoommate: (name: string, diet: UserMemory["roommates"][number]["diet"]) => void;
  removeRoommate: (id: string) => void;
  addPlan: (plan: LifeOpsPlan) => void;
  dismissSuggestion: (id: string) => void;
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      memory: DEFAULT_MEMORY,
      calendar: DEFAULT_CALENDAR,
      plans: [],
      dismissedSuggestionIds: [],

      setMemory: (patch) =>
        set((s) => ({
          memory: { ...s.memory, ...patch, lastUpdated: new Date().toISOString() },
        })),

      resetMemory: () => set({ memory: DEFAULT_MEMORY, calendar: DEFAULT_CALENDAR }),

      addRoommate: (name, diet) =>
        set((s) => {
          const next = [...s.memory.roommates, { id: `rm_${Date.now()}`, name, share: 0, diet }];
          // Re-balance shares evenly so they always sum close to 100%.
          const evenShare = Math.floor(100 / next.length);
          return {
            memory: {
              ...s.memory,
              roommates: next.map((r) => ({ ...r, share: evenShare })),
              lastUpdated: new Date().toISOString(),
            },
          };
        }),

      removeRoommate: (id) =>
        set((s) => {
          const next = s.memory.roommates.filter((r) => r.id !== id);
          const evenShare = next.length > 0 ? Math.floor(100 / next.length) : 0;
          return {
            memory: {
              ...s.memory,
              roommates: next.map((r) => ({ ...r, share: evenShare })),
              lastUpdated: new Date().toISOString(),
            },
          };
        }),

      addPlan: (plan) => set((s) => ({ plans: [plan, ...s.plans].slice(0, 12) })),

      dismissSuggestion: (id) =>
        set((s) => ({ dismissedSuggestionIds: [...s.dismissedSuggestionIds, id] })),
    }),
    { name: "lifeops-store" }
  )
);
