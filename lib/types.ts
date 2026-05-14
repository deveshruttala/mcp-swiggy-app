/**
 * Domain types for Swiggy LifeOps Agent.
 *
 * Every page, component, and agent imports from this file. Keeping the
 * surface area in one place makes the contract between the orchestrator,
 * the UI, and the MCP adapter layer obvious.
 */

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------

export type Diet = "veg" | "non-veg" | "vegan" | "egg";

export interface UserMemory {
  id: string;
  name: string;
  homeAddress: string;
  workAddress?: string;
  diet: Diet;
  allergies: string[];
  favoriteCuisines: string[];
  dislikedItems: string[];
  /** Hard upper cap, used by Budget Agent for monthly slicing. */
  monthlyBudget: number;
  /** Soft cap per order — the agent warns above this. */
  perOrderBudgetSoftCap: number;
  roommates: Roommate[];
  recurringItems: RecurringItem[];
  printSettings: PrintSettings;
  travelHabits: TravelHabit[];
  /** Hours during which the agent should never auto-suggest orders. */
  noOrderWindows: TimeWindow[];
  caffeineHabit: "low" | "medium" | "high";
  recentPlaces: VisitedPlace[];
  searchHistory: SearchEntry[];
  pastOrders: PastOrder[];
  calendarConnected: boolean;
  lastUpdated: string;
}

export interface Roommate {
  id: string;
  name: string;
  /** Percentage 0–100 — should sum to 100 across all roommates. */
  share: number;
  diet: Diet;
}

export interface RecurringItem {
  id: string;
  name: string;
  category: "grocery" | "snack" | "toiletry" | "cleaning" | "beverage";
  averageQty: number;
  unit: string;
  /** How often this item is replenished, in days. */
  cadenceDays: number;
  lastOrderedAt?: string;
}

export interface PrintSettings {
  color: "bw" | "color";
  binding: "none" | "staple" | "spiral" | "hardbound";
  paperSize: "A4" | "A3" | "Letter";
  doubleSided: boolean;
}

export interface TravelHabit {
  city: string;
  preferredMealOnArrival: string;
  hotelBrand?: string;
}

export interface TimeWindow {
  label: string;
  startHour: number;
  endHour: number;
}

export interface VisitedPlace {
  id: string;
  name: string;
  city: string;
  type: "restaurant" | "store" | "hotel" | "venue";
  visitedAt: string;
}

export interface SearchEntry {
  id: string;
  query: string;
  surface: "food" | "instamart" | "dineout";
  at: string;
}

export interface PastOrder {
  id: string;
  surface: "food" | "instamart" | "dineout";
  total: number;
  items: string[];
  at: string;
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

export interface CalendarEvent {
  id: string;
  title: string;
  /** ISO timestamp. */
  start: string;
  end: string;
  location?: string;
  attendees?: number;
  source: "google" | "outlook" | "ics" | "manual";
  /** Semantic tags consumed by the orchestrator (exam, hackathon, travel, …). */
  tags?: string[];
}

// ---------------------------------------------------------------------------
// Suggestions (dashboard)
// ---------------------------------------------------------------------------

export type SuggestionKind =
  | "rain-mode"
  | "low-stock"
  | "hackathon-snack"
  | "travel-arrival"
  | "printout-reminder"
  | "exam-mode"
  | "team-lunch"
  | "party-mode"
  | "recurring-refill";

export interface AgentSuggestion {
  id: string;
  kind: SuggestionKind;
  title: string;
  body: string;
  /** Why the agent surfaced this — shown when user clicks "Explain". */
  reasoning: string[];
  estimatedCost?: number;
  ctaLabel: string;
  module: "hackathon" | "house" | "printout" | "travel" | "team" | "dashboard";
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Carts
// ---------------------------------------------------------------------------

export interface FoodCartItem {
  id: string;
  name: string;
  restaurant: string;
  price: number;
  qty: number;
  diet: Diet;
  tags?: string[];
}

export interface InstamartCartItem {
  id: string;
  name: string;
  category: RecurringItem["category"] | "essentials" | "snack";
  price: number;
  qty: number;
  unit: string;
  substitute?: string;
}

export interface CostSplit {
  perPerson: number;
  byRoommate: { roommateId: string; name: string; amount: number }[];
  total: number;
}

// ---------------------------------------------------------------------------
// Planning inputs
// ---------------------------------------------------------------------------

export interface HackathonPlanInput {
  eventName: string;
  location: string;
  people: number;
  startTime: string;
  endTime: string;
  budgetPerPerson: number;
  vegCount: number;
  nonVegCount: number;
  caffeine: "low" | "medium" | "high";
  snackLevel: "light" | "medium" | "heavy";
  includeInstamart: boolean;
  mealsPerNight: number;
}

export interface HouseInventoryInput {
  houseName: string;
  roommates: Roommate[];
  monthlyBudget: number;
  currentInventory: { name: string; qty: number; unit: string }[];
  lowStockItems: string[];
  dietaryPreferences: Diet[];
  refillFrequency: "weekly" | "biweekly" | "monthly";
}

// ---------------------------------------------------------------------------
// Plan output
// ---------------------------------------------------------------------------

export interface MealSlot {
  id: string;
  /** Human label — "Dinner", "Late-night snacks", etc. */
  label: string;
  time: string;
  budget: number;
  items: FoodCartItem[];
  fallbackItems?: FoodCartItem[];
  reasoning: string;
}

export interface CouponSuggestion {
  code: string;
  description: string;
  estimatedSavings: number;
  source: "food" | "instamart";
}

export interface RunOutPrediction {
  itemName: string;
  predictedDate: string;
  daysAway: number;
  confidence: "low" | "medium" | "high";
}

export interface LifeOpsPlan {
  id: string;
  module: "hackathon" | "house";
  goal: string;
  meals?: MealSlot[];
  foodCart: FoodCartItem[];
  instamartCart: InstamartCartItem[];
  costSplit: CostSplit;
  coupons: CouponSuggestion[];
  runOutPredictions?: RunOutPrediction[];
  recurringSchedule?: { itemName: string; nextDate: string; cadenceDays: number }[];
  approvalChecklist: { id: string; label: string; required: boolean; checked: boolean }[];
  warnings: string[];
  toolCalls: MCPToolCall[];
  trace: AgentTraceStep[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// MCP + A2A
// ---------------------------------------------------------------------------

export type MCPSurface =
  | "swiggy.food"
  | "swiggy.instamart"
  | "swiggy.dineout"
  | "local.services"
  | "calendar";

export interface MCPToolCall {
  id: string;
  surface: MCPSurface;
  tool: string;
  args: Record<string, unknown>;
  result?: Record<string, unknown>;
  /** Lifecycle: planned → ready (approved) → executed; skipped if user dismissed. */
  status: "planned" | "ready" | "executed" | "skipped";
  needsApproval: boolean;
  at: string;
}

export type AgentName =
  | "Orchestrator"
  | "Memory"
  | "Food"
  | "Instamart"
  | "Budget"
  | "Calendar"
  | "Travel"
  | "Print"
  | "House"
  | "Community";

export interface AgentTraceStep {
  id: string;
  from: AgentName;
  to?: AgentName;
  action: string;
  detail?: string;
  toolCallId?: string;
  at: string;
}

// ---------------------------------------------------------------------------
// Conversation (the agent surface)
// ---------------------------------------------------------------------------

/** What the user asked for, extracted from their natural-language input. */
export type IntentKind =
  | "hackathon"
  | "house"
  | "print"
  | "travel"
  | "team"
  | "exam"
  | "help"
  | "unknown";

export interface Intent {
  kind: IntentKind;
  /** Free-form numbers extracted from the prompt (people, budget, etc.). */
  people?: number;
  budget?: number;
  vegRatio?: number;
  /** Item names the user mentioned (for house intent). */
  itemHints?: string[];
}

export type Message =
  | { id: string; role: "user"; text: string; at: string }
  | { id: string; role: "agent"; kind: "text"; text: string; at: string }
  | {
      id: string;
      role: "agent";
      kind: "plan";
      preamble: string;
      plan: LifeOpsPlan;
      at: string;
    }
  | {
      id: string;
      role: "agent";
      kind: "mock";
      title: string;
      preamble: string;
      bullets: string[];
      mcpHints: { surface: MCPSurface; tool: string }[];
      at: string;
    };
