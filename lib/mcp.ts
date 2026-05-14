/**
 * Mock Swiggy MCP adapters.
 *
 * Every function mirrors the shape of a real Swiggy MCP tool, so the
 * orchestrator and UI can run on mocks today and swap to a real MCP
 * client tomorrow with zero downstream changes.
 *
 * To go from mock to real: pick a namespace below, replace each function
 * body with a real MCP client call, keep the function signatures.
 *
 * Five surfaces grouped as namespaces:
 *   - Food          — swiggy.food
 *   - Instamart     — swiggy.instamart
 *   - Dineout       — swiggy.dineout      (referenced by team-lunch mock)
 *   - LocalServices — local.services      (referenced by print mock)
 *   - Calendar      — calendar            (Google / Outlook / iCal)
 */

import type {
  CalendarEvent,
  FoodCartItem,
  InstamartCartItem,
} from "./types";

/** Simulates network latency so the A2A trace feels real in the UI. */
function delay<T>(value: T, ms = 80): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

// ===========================================================================
// swiggy.food
// ===========================================================================

interface Restaurant {
  id: string;
  name: string;
  cuisines: string[];
  rating: number;
  etaMins: number;
  costForTwo: number;
}

const FOOD_RESTAURANTS: Restaurant[] = [
  { id: "r_meghana", name: "Meghana Foods", cuisines: ["Biryani", "Andhra"], rating: 4.5, etaMins: 32, costForTwo: 550 },
  { id: "r_truffles", name: "Truffles", cuisines: ["American", "Burgers"], rating: 4.4, etaMins: 28, costForTwo: 650 },
  { id: "r_empire", name: "Empire Restaurant", cuisines: ["Biryani", "North Indian"], rating: 4.2, etaMins: 24, costForTwo: 400 },
  { id: "r_thirdwave", name: "Third Wave Coffee", cuisines: ["Cafe", "Coffee"], rating: 4.6, etaMins: 18, costForTwo: 350 },
  { id: "r_dominos", name: "Domino's Pizza", cuisines: ["Pizza", "Italian"], rating: 4.1, etaMins: 30, costForTwo: 500 },
  { id: "r_cb", name: "CTR — Central Tiffin Room", cuisines: ["South Indian"], rating: 4.6, etaMins: 22, costForTwo: 280 },
];

const FOOD_MENUS: Record<string, FoodCartItem[]> = {
  r_meghana: [
    { id: "m1", name: "Chicken Biryani", restaurant: "Meghana Foods", price: 320, qty: 1, diet: "non-veg" },
    { id: "m2", name: "Paneer Biryani", restaurant: "Meghana Foods", price: 290, qty: 1, diet: "veg" },
    { id: "m3", name: "Boneless Chicken Biryani", restaurant: "Meghana Foods", price: 380, qty: 1, diet: "non-veg" },
    { id: "m4", name: "Raita", restaurant: "Meghana Foods", price: 40, qty: 1, diet: "veg" },
  ],
  r_thirdwave: [
    { id: "c1", name: "Filter Coffee", restaurant: "Third Wave Coffee", price: 140, qty: 1, diet: "veg" },
    { id: "c2", name: "Cold Brew", restaurant: "Third Wave Coffee", price: 220, qty: 1, diet: "veg" },
    { id: "c3", name: "Banana Bread", restaurant: "Third Wave Coffee", price: 160, qty: 1, diet: "egg" },
  ],
  r_dominos: [
    { id: "d1", name: "Farmhouse Medium", restaurant: "Domino's", price: 400, qty: 1, diet: "veg" },
    { id: "d2", name: "Chicken Dominator Medium", restaurant: "Domino's", price: 520, qty: 1, diet: "non-veg" },
    { id: "d3", name: "Garlic Bread", restaurant: "Domino's", price: 120, qty: 1, diet: "veg" },
  ],
  r_cb: [
    { id: "cb1", name: "Idli Vada (2+2)", restaurant: "CTR", price: 110, qty: 1, diet: "veg" },
    { id: "cb2", name: "Masala Dosa", restaurant: "CTR", price: 140, qty: 1, diet: "veg" },
    { id: "cb3", name: "Filter Coffee", restaurant: "CTR", price: 60, qty: 1, diet: "veg" },
  ],
};

/** Swiggy Food MCP — mock. */
export const Food = {
  searchRestaurants: (query: string) => {
    const q = query.toLowerCase();
    const matches = FOOD_RESTAURANTS.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.cuisines.some((c) => c.toLowerCase().includes(q))
    );
    return delay(matches.length ? matches : FOOD_RESTAURANTS.slice(0, 4));
  },

  getRestaurantMenu: (restaurantId: string) => delay(FOOD_MENUS[restaurantId] ?? []),

  fetchFoodCoupons: (subtotal: number) => {
    const coupons = [
      { code: "FIRSTORDER", description: "₹100 off on first order", estimatedSavings: subtotal > 200 ? 100 : 0, source: "food" as const },
      { code: "BIGORDER", description: "10% off above ₹999 (max ₹150)", estimatedSavings: subtotal > 999 ? Math.min(150, subtotal * 0.1) : 0, source: "food" as const },
      { code: "MIDNIGHT", description: "₹75 off on late-night orders", estimatedSavings: subtotal > 300 ? 75 : 0, source: "food" as const },
    ].filter((c) => c.estimatedSavings > 0);
    return delay(coupons);
  },

  placeFoodOrderPreview: (items: FoodCartItem[]) => {
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const fees = Math.max(20, Math.round(subtotal * 0.04));
    return delay({ subtotal, fees, total: subtotal + fees, needsApproval: true });
  },
};

// ===========================================================================
// swiggy.instamart
// ===========================================================================

interface InstamartProduct {
  id: string;
  name: string;
  category: InstamartCartItem["category"];
  price: number;
  unit: string;
  substitute?: string;
}

const INSTAMART_CATALOG: InstamartProduct[] = [
  { id: "ig_milk", name: "Milk 1L", category: "grocery", price: 68, unit: "pack" },
  { id: "ig_eggs", name: "Eggs (12)", category: "grocery", price: 95, unit: "tray", substitute: "Eggs (6)" },
  { id: "ig_bread", name: "Brown Bread", category: "grocery", price: 55, unit: "loaf", substitute: "White Bread (₹40)" },
  { id: "ig_atta", name: "Aashirvaad Atta 5kg", category: "grocery", price: 285, unit: "pack", substitute: "Pillsbury Atta 5kg (₹260)" },
  { id: "ig_coffee", name: "Davidoff Coffee 200g", category: "beverage", price: 540, unit: "pack", substitute: "Nescafé 200g (₹420)" },
  { id: "ig_detergent", name: "Surf Excel Matic 1L", category: "cleaning", price: 240, unit: "bottle" },
  { id: "ig_maggi", name: "Maggi (8 pack)", category: "snack", price: 112, unit: "pack" },
  { id: "ig_tp", name: "Origami Toilet Paper", category: "toiletry", price: 165, unit: "pack" },
  { id: "ig_rb", name: "Red Bull (4 pack)", category: "beverage", price: 460, unit: "pack" },
  { id: "ig_chips", name: "Lay's Chips (6 pack)", category: "snack", price: 120, unit: "pack" },
  { id: "ig_choc", name: "Dairy Milk Silk (3)", category: "snack", price: 165, unit: "pack" },
  { id: "ig_water", name: "Bisleri 1L (6)", category: "essentials", price: 120, unit: "pack" },
  { id: "ig_paper", name: "Paper plates (50)", category: "essentials", price: 180, unit: "pack" },
];

/** Swiggy Instamart MCP — mock. */
export const Instamart = {
  CATALOG: INSTAMART_CATALOG,

  searchProducts: (query: string) => {
    const q = query.toLowerCase();
    return delay(INSTAMART_CATALOG.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 12));
  },

  checkoutPreview: (items: InstamartCartItem[]) => {
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const fees = subtotal > 199 ? 0 : 25;
    return delay({ subtotal, fees, total: subtotal + fees, needsApproval: true });
  },

  /**
   * Proposed Swiggy MCP tool. Predicts run-out date for each recurring item
   * from `cadenceDays` + `lastOrderedAt`. Drives the dashboard low-stock
   * suggestion and the house refill basket.
   */
  predictRestockNeeds: (
    recurring: { name: string; cadenceDays: number; lastOrderedAt?: string }[]
  ) => {
    const now = Date.now();
    const items = recurring.map((r) => {
      const last = r.lastOrderedAt ? new Date(r.lastOrderedAt).getTime() : now;
      const next = last + r.cadenceDays * 24 * 60 * 60 * 1000;
      const daysAway = Math.round((next - now) / (24 * 60 * 60 * 1000));
      return {
        itemName: r.name,
        predictedDate: new Date(next).toISOString(),
        daysAway,
        confidence: "medium" as const,
      };
    });
    return delay(items);
  },

  /**
   * Proposed Swiggy MCP tool. Drops non-essential items first until the
   * cart fits the target budget.
   */
  optimizeBasketByBudget: (items: InstamartCartItem[], budget: number) => {
    const sorted = [...items].sort((a, b) => b.price - a.price);
    let total = items.reduce((s, i) => s + i.price * i.qty, 0);
    const dropped: InstamartCartItem[] = [];
    while (total > budget && sorted.length > 0) {
      const item = sorted.shift()!;
      if (item.category === "essentials" || item.category === "grocery") continue;
      dropped.push(item);
      total -= item.price * item.qty;
    }
    const kept = items.filter((i) => !dropped.includes(i));
    return delay({ kept, dropped, total });
  },
};

// ===========================================================================
// swiggy.dineout — stub (referenced by the team-lunch mock message)
// ===========================================================================

/** Swiggy Dineout MCP — mock stub. Powers the (soon) team-lunch flow. */
export const Dineout = {
  /** Proposed: pick venues that fit a group budget. */
  planGroupDinner: (input: { city: string; party: number; budgetPerPerson: number }) =>
    delay({ candidates: [], needsApproval: true, ...input }),
};

// ===========================================================================
// local.services — stub (referenced by the printout mock message)
// ===========================================================================

/** Swiggy-style local-services MCP — mock stub. Powers the printout flow. */
export const LocalServices = {
  findPrintVendor: (near: string) =>
    delay([
      { id: "pv1", name: "QuickPrint Indiranagar", etaMins: 28, near },
    ]),

  createPrintJob: (input: {
    vendorId: string;
    pages: number;
    color: "bw" | "color";
    binding: "none" | "staple" | "spiral" | "hardbound";
    deliverTo: string;
    deliverBy: string;
  }) => {
    const perPage = input.color === "bw" ? 2 : 6;
    const bindingCost = { none: 0, staple: 10, spiral: 40, hardbound: 150 }[input.binding];
    const total = input.pages * perPage + bindingCost + 35; // delivery fee
    return delay({ ...input, total, status: "preview", needsApproval: true });
  },
};

// ===========================================================================
// calendar (Google / Outlook / iCal MCP)
// ===========================================================================

/** Calendar MCP — mock. Grounds the agent in real-life events. */
export const Calendar = {
  listUpcomingEvents: (events: CalendarEvent[], limit = 5) => {
    const now = Date.now();
    const upcoming = events
      .filter((e) => new Date(e.start).getTime() >= now - 60 * 60 * 1000)
      .sort((a, b) => +new Date(a.start) - +new Date(b.start))
      .slice(0, limit);
    return delay(upcoming);
  },
};
