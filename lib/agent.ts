/**
 * Agent layer for Swiggy LifeOps Agent.
 *
 * Public surface (everything else is internal):
 *   - generateHackathonPlan        builds a hackathon LifeOpsPlan
 *   - generateHouseInventoryPlan   builds a house-refill LifeOpsPlan
 *   - generateSmartSuggestions     proactive cards for the agent greeting
 *   - respondToMessage             top-level NL → Message dispatcher
 *
 * The orchestrators depend only on the MCP adapter namespaces in
 * `lib/mcp.ts`. Swapping any namespace to a real Swiggy MCP client
 * requires no change here.
 */

import type {
  AgentName,
  AgentSuggestion,
  AgentTraceStep,
  CalendarEvent,
  CostSplit,
  CouponSuggestion,
  FoodCartItem,
  HackathonPlanInput,
  HouseInventoryInput,
  InstamartCartItem,
  Intent,
  LifeOpsPlan,
  MCPToolCall,
  Message,
  MealSlot,
  RunOutPrediction,
  UserMemory,
} from "./types";
import { addDays, hoursBetween, nowIso, uid } from "./utils";
import { Calendar, Food, Instamart } from "./mcp";

// ---------------------------------------------------------------------------
// A2A trace builder
// ---------------------------------------------------------------------------

/**
 * Fluent builder that the orchestrator uses to record:
 *   - `step()`  — an agent action (optionally addressed to another agent)
 *   - `tool()`  — an MCP tool call (with status: planned / executed / …)
 *
 * The build artifact feeds both `LifeOpsPlan.trace` and `LifeOpsPlan.toolCalls`.
 */
class TraceBuilder {
  private steps: AgentTraceStep[] = [];
  private toolCalls: MCPToolCall[] = [];

  step(
    from: AgentName,
    action: string,
    detail?: string,
    to?: AgentName,
    toolCallId?: string
  ) {
    this.steps.push({
      id: uid("step"),
      from,
      to,
      action,
      detail,
      toolCallId,
      at: nowIso(),
    });
    return this;
  }

  tool(call: Omit<MCPToolCall, "id" | "at">): MCPToolCall {
    const c: MCPToolCall = { ...call, id: uid("tc"), at: nowIso() };
    this.toolCalls.push(c);
    return c;
  }

  build() {
    return { trace: this.steps, toolCalls: this.toolCalls };
  }
}

// ===========================================================================
// Orchestrator — Hackathon / CampusOps
// ===========================================================================

export async function generateHackathonPlan(
  input: HackathonPlanInput,
  memory: UserMemory,
  calendar: CalendarEvent[]
): Promise<LifeOpsPlan> {
  const t = new TraceBuilder();
  t.step("Orchestrator", "Received hackathon plan goal", `${input.eventName} for ${input.people} people`);
  t.step(
    "Memory",
    "Loaded preferences",
    `Allergies: ${memory.allergies.join(", ") || "none"}; caffeine: ${memory.caffeineHabit}`
  );

  // 1. Calendar grounding — check for conflicts.
  const upcoming = await Calendar.listUpcomingEvents(calendar, 3);
  t.step("Calendar", "Read upcoming events", `${upcoming.length} events; checking conflicts`);
  t.tool({
    surface: "calendar",
    tool: "listUpcomingEvents",
    args: { limit: 3 },
    result: { count: upcoming.length },
    status: "executed",
    needsApproval: false,
  });

  // 2. Budget allocation across meal slots.
  const totalBudget = input.budgetPerPerson * input.people;
  const durationH = Math.max(2, hoursBetween(input.startTime, input.endTime));
  t.step("Budget", "Computed total + duration", `₹${totalBudget} across ${Math.round(durationH)}h`);

  const dinnerShare = 0.45;
  const snackShare = 0.25;
  const caffShare =
    input.caffeine === "high" ? 0.18 : input.caffeine === "medium" ? 0.12 : 0.07;
  const breakfastShare = 1 - (dinnerShare + snackShare + caffShare);
  const allocation = {
    Dinner: totalBudget * dinnerShare,
    "Late-night snacks": totalBudget * snackShare,
    Caffeine: totalBudget * caffShare,
    Breakfast: totalBudget * breakfastShare,
  };

  // 3. Food Agent — search + menus.
  t.step("Food", "Searching restaurants", `near ${input.location}`);
  const [restaurants, cafes, pizza, south] = await Promise.all([
    Food.searchRestaurants("biryani"),
    Food.searchRestaurants("coffee"),
    Food.searchRestaurants("pizza"),
    Food.searchRestaurants("dosa"),
  ]);
  t.tool({
    surface: "swiggy.food",
    tool: "searchRestaurants",
    args: { queries: ["biryani", "coffee", "pizza", "dosa"], location: input.location },
    result: { restaurantsFound: restaurants.length + cafes.length + pizza.length + south.length },
    status: "executed",
    needsApproval: false,
  });

  const [dinnerMenu, pizzaMenu, cafeMenu, breakfastMenu] = await Promise.all([
    Food.getRestaurantMenu(restaurants[0]?.id ?? "r_meghana"),
    Food.getRestaurantMenu(pizza[0]?.id ?? "r_dominos"),
    Food.getRestaurantMenu(cafes[0]?.id ?? "r_thirdwave"),
    Food.getRestaurantMenu(south[0]?.id ?? "r_cb"),
  ]);
  t.tool({
    surface: "swiggy.food",
    tool: "getRestaurantMenu",
    args: { ids: [restaurants[0]?.id, pizza[0]?.id, cafes[0]?.id, south[0]?.id] },
    result: { items: dinnerMenu.length + pizzaMenu.length + cafeMenu.length + breakfastMenu.length },
    status: "executed",
    needsApproval: false,
  });

  // 4. Build meal slots.
  const meals = Math.max(1, input.mealsPerNight);
  const start = new Date(input.startTime);
  const end = new Date(input.endTime);

  const buildSlot = (label: string, hour: number, budget: number, base: FoodCartItem[]): MealSlot => {
    const at = new Date(start);
    at.setHours(hour, 0, 0, 0);
    return {
      id: uid("slot"),
      label,
      time: at.toISOString(),
      budget,
      items: pickItemsForGroup(base, input, budget),
      fallbackItems: base.slice(0, 2).map((b) => ({ ...b, id: uid("fb") })),
      reasoning: `Allocated ₹${Math.round(budget)} based on ${label.toLowerCase()} share.`,
    };
  };

  const slots: MealSlot[] = [];
  if (meals >= 1) slots.push(buildSlot("Dinner", Math.max(start.getHours(), 20), allocation.Dinner, dinnerMenu));
  if (meals >= 1) slots.push(buildSlot("Late-night snacks", 23, allocation["Late-night snacks"], pizzaMenu));
  if (durationH > 6) slots.push(buildSlot("Caffeine", 2, allocation.Caffeine, cafeMenu));
  if (end.getHours() >= 7) slots.push(buildSlot("Breakfast", 8, allocation.Breakfast, breakfastMenu));
  t.step("Food", "Built meal timeline", `${slots.length} slots`);

  const foodCart: FoodCartItem[] = slots.flatMap((s) => s.items);
  const subtotal = foodCart.reduce((s, i) => s + i.price * i.qty, 0);

  // 5. Coupons.
  const coupons = await Food.fetchFoodCoupons(subtotal);
  t.tool({
    surface: "swiggy.food",
    tool: "fetchFoodCoupons",
    args: { subtotal },
    result: { coupons: coupons.length },
    status: "executed",
    needsApproval: false,
  });

  // 6. Optional Instamart essentials.
  let instamartCart: InstamartCartItem[] = [];
  if (input.includeInstamart) {
    t.step("Instamart", "Building essentials cart", "energy drinks, chips, water, plates");
    const wanted = ["ig_rb", "ig_chips", "ig_water", "ig_paper", "ig_choc"];
    instamartCart = Instamart.CATALOG.filter((c) => wanted.includes(c.id)).map((p) => ({
      id: uid("im"),
      name: p.name,
      category: p.category,
      price: p.price,
      qty: 1,
      unit: p.unit,
    }));
    t.tool({
      surface: "swiggy.instamart",
      tool: "searchProducts",
      args: { queries: ["redbull", "chips", "water", "paper plates"] },
      result: { items: instamartCart.length },
      status: "executed",
      needsApproval: false,
    });
  }

  // 7. Budget Agent — re-optimize if over.
  const allInTotal = subtotal + instamartCart.reduce((s, i) => s + i.price * i.qty, 0);
  const warnings: string[] = [];
  if (allInTotal > totalBudget * 1.1) {
    warnings.push(
      `Cart is ${Math.round(((allInTotal - totalBudget) / totalBudget) * 100)}% over budget — Budget Agent will down-quantize snacks.`
    );
    t.step("Budget", "Over budget — optimizing", `${allInTotal} > ${totalBudget}`);
    if (instamartCart.length > 0) {
      const optimized = await Instamart.optimizeBasketByBudget(instamartCart, totalBudget * 0.25);
      instamartCart = optimized.kept;
      t.tool({
        surface: "swiggy.instamart",
        tool: "optimizeBasketByBudget",
        args: { budget: totalBudget * 0.25 },
        result: { kept: optimized.kept.length, dropped: optimized.dropped.length },
        status: "executed",
        needsApproval: false,
      });
    }
  }

  // 8. Cost split — fall back to synthetic members if memory has none.
  const splitTargets =
    memory.roommates.length > 0
      ? memory.roommates
      : Array.from({ length: input.people }).map((_, i) => ({
          id: `p${i + 1}`,
          name: `Member ${i + 1}`,
          share: Math.floor(100 / input.people),
          diet: "veg" as const,
        }));
  const finalTotal = subtotal + instamartCart.reduce((s, i) => s + i.price * i.qty, 0);
  const costSplit = splitEqually(finalTotal, input.people, splitTargets);

  t.step("Community", "Will collect veg/non-veg preferences", `${input.vegCount} veg / ${input.nonVegCount} non-veg`);

  // 9. Preview previews (needs human approval).
  const foodPreview = await Food.placeFoodOrderPreview(foodCart);
  const foodPreviewTC = t.tool({
    surface: "swiggy.food",
    tool: "placeFoodOrderPreview",
    args: { itemCount: foodCart.length },
    result: { total: foodPreview.total },
    status: "planned",
    needsApproval: true,
  });
  t.step(
    "Orchestrator",
    "Prepared food order preview",
    `₹${foodPreview.total} — awaiting approval`,
    "Food",
    foodPreviewTC.id
  );

  const martPreview = await Instamart.checkoutPreview(instamartCart);
  const martPreviewTC = t.tool({
    surface: "swiggy.instamart",
    tool: "checkoutPreview",
    args: { itemCount: instamartCart.length },
    result: { total: martPreview.total },
    status: "planned",
    needsApproval: true,
  });
  t.step(
    "Orchestrator",
    "Prepared essentials preview",
    `₹${martPreview.total} — awaiting approval`,
    "Instamart",
    martPreviewTC.id
  );

  const { trace, toolCalls } = t.build();

  return {
    id: uid("plan"),
    module: "hackathon",
    goal: `${input.eventName} — ${input.people} people, ₹${input.budgetPerPerson}/head`,
    meals: slots,
    foodCart,
    instamartCart,
    costSplit,
    coupons,
    approvalChecklist: [
      { id: uid("c"), label: "Confirm address (home / hostel)", required: true, checked: false },
      { id: uid("c"), label: "Confirm payment method", required: true, checked: false },
      { id: uid("c"), label: "Review veg/non-veg split", required: true, checked: false },
      { id: uid("c"), label: "Notify roommates / teammates", required: false, checked: false },
    ],
    warnings,
    toolCalls,
    trace,
    createdAt: nowIso(),
  };
}

/**
 * Choose items for a group cart by allocating each meal slot's budget
 * proportionally between veg and non-veg pools.
 */
function pickItemsForGroup(
  base: FoodCartItem[],
  input: HackathonPlanInput,
  slotBudget: number
): FoodCartItem[] {
  const out: FoodCartItem[] = [];
  const totalPeople = Math.max(1, input.vegCount + input.nonVegCount);
  const vegRatio = input.vegCount / totalPeople;

  const sortedVeg = base
    .filter((b) => b.diet === "veg" || b.diet === "vegan")
    .sort((a, b) => a.price - b.price);
  const sortedNon = base.filter((b) => b.diet === "non-veg").sort((a, b) => a.price - b.price);

  const targetVegSpend = slotBudget * vegRatio;
  const targetNonSpend = slotBudget * (1 - vegRatio);

  const pickFrom = (pool: FoodCartItem[], target: number) => {
    let s = 0;
    for (const item of pool) {
      if (s + item.price > target * 1.05 && out.length > 0) break;
      out.push({ ...item, id: uid("fc"), qty: 1 });
      s += item.price;
      if (s >= target) break;
    }
  };

  if (input.vegCount > 0 && sortedVeg.length) pickFrom(sortedVeg, targetVegSpend);
  if (input.nonVegCount > 0 && sortedNon.length) pickFrom(sortedNon, targetNonSpend);

  // Always return at least one item so the user sees something.
  if (out.length === 0 && base.length) out.push({ ...base[0], id: uid("fc"), qty: 1 });
  return out;
}

function splitEqually(
  total: number,
  people: number,
  members: { id: string; name: string }[]
): CostSplit {
  const list = members.slice(0, people);
  const per = Math.round(total / Math.max(1, list.length));
  return {
    perPerson: per,
    byRoommate: list.map((r) => ({ roommateId: r.id, name: r.name, amount: per })),
    total: Math.round(total),
  };
}

// ===========================================================================
// Orchestrator — Bachelor House Inventory
// ===========================================================================

export async function generateHouseInventoryPlan(
  input: HouseInventoryInput,
  memory: UserMemory
): Promise<LifeOpsPlan> {
  const t = new TraceBuilder();
  t.step("Orchestrator", "Received house refill goal", `${input.houseName} — ${input.roommates.length} roommates`);
  t.step("Memory", "Loaded recurring items", `${memory.recurringItems.length} tracked items`);

  // 1. House Agent predicts run-out dates from cadence + last-ordered-at.
  t.step("House", "Predicting run-out dates", "Using cadence + last-ordered-at");
  const predictions: RunOutPrediction[] = await Instamart.predictRestockNeeds(
    memory.recurringItems.map((r) => ({
      name: r.name,
      cadenceDays: r.cadenceDays,
      lastOrderedAt: r.lastOrderedAt,
    }))
  );
  t.tool({
    surface: "swiggy.instamart",
    tool: "predictRestockNeeds",
    args: { items: memory.recurringItems.length },
    result: { soonItems: predictions.filter((p) => p.daysAway <= 3).length },
    status: "executed",
    needsApproval: false,
  });

  // 2. Build refill basket: items predicted to run out in ≤7 days + manually flagged low-stock.
  const refillNames = new Set<string>([
    ...predictions.filter((p) => p.daysAway <= 7).map((p) => p.itemName),
    ...input.lowStockItems,
  ]);
  t.step("Instamart", "Searching products for refill", `${refillNames.size} items`);

  const cart: InstamartCartItem[] = [];
  for (const name of refillNames) {
    const matches = await Instamart.searchProducts(name.split(" ")[0]);
    const best = matches[0];
    if (best) {
      cart.push({
        id: uid("im"),
        name: best.name,
        category: best.category,
        price: best.price,
        qty: 1,
        unit: best.unit,
        substitute: best.substitute,
      });
    }
  }
  t.tool({
    surface: "swiggy.instamart",
    tool: "searchProducts",
    args: { count: refillNames.size },
    result: { itemsAdded: cart.length },
    status: "executed",
    needsApproval: false,
  });

  // 3. Budget Agent — fit basket into the weekly slice of the monthly budget.
  const weeklyBudget =
    input.refillFrequency === "weekly"
      ? input.monthlyBudget / 4
      : input.refillFrequency === "biweekly"
        ? input.monthlyBudget / 2
        : input.monthlyBudget;
  const currentTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

  let optimizedCart = cart;
  const warnings: string[] = [];
  if (currentTotal > weeklyBudget) {
    t.step("Budget", "Refill exceeds slice — substituting", `₹${currentTotal} > ₹${Math.round(weeklyBudget)}`);
    const opt = await Instamart.optimizeBasketByBudget(cart, weeklyBudget);
    optimizedCart = opt.kept;
    t.tool({
      surface: "swiggy.instamart",
      tool: "optimizeBasketByBudget",
      args: { budget: Math.round(weeklyBudget) },
      result: { kept: opt.kept.length, dropped: opt.dropped.length },
      status: "executed",
      needsApproval: false,
    });
    if (opt.dropped.length) warnings.push(`Dropped ${opt.dropped.length} non-essential items to fit budget.`);
  }

  // 4. Recurring schedule projection.
  const recurringSchedule = memory.recurringItems.map((r) => {
    const last = r.lastOrderedAt ? new Date(r.lastOrderedAt) : new Date();
    return {
      itemName: r.name,
      nextDate: addDays(last, r.cadenceDays).toISOString(),
      cadenceDays: r.cadenceDays,
    };
  });

  // 5. Cost split by roommate share %.
  const finalTotal = optimizedCart.reduce((s, i) => s + i.price * i.qty, 0);
  const costSplit: CostSplit = {
    perPerson: Math.round(finalTotal / Math.max(1, input.roommates.length)),
    byRoommate: input.roommates.map((r) => ({
      roommateId: r.id,
      name: r.name,
      amount: Math.round((finalTotal * r.share) / 100),
    })),
    total: Math.round(finalTotal),
  };

  // 6. Final preview — needs approval.
  const preview = await Instamart.checkoutPreview(optimizedCart);
  const tc = t.tool({
    surface: "swiggy.instamart",
    tool: "bulkCheckoutPreview",
    args: { itemCount: optimizedCart.length },
    result: { total: preview.total },
    status: "planned",
    needsApproval: true,
  });
  t.step("Orchestrator", "Prepared Instamart preview", `₹${preview.total} — needs human approval`, "Instamart", tc.id);

  const { trace, toolCalls } = t.build();
  return {
    id: uid("plan"),
    module: "house",
    goal: `${input.houseName} — refill for ${input.refillFrequency}`,
    foodCart: [],
    instamartCart: optimizedCart,
    costSplit,
    coupons: [] as CouponSuggestion[],
    runOutPredictions: predictions,
    recurringSchedule,
    approvalChecklist: [
      { id: uid("c"), label: "Confirm delivery address", required: true, checked: false },
      { id: uid("c"), label: "Approve substitutes", required: true, checked: false },
      { id: uid("c"), label: "Confirm roommate split share", required: true, checked: false },
      { id: uid("c"), label: "Enable recurring schedule", required: false, checked: false },
    ],
    warnings,
    toolCalls,
    trace,
    createdAt: nowIso(),
  };
}

// ===========================================================================
// Smart suggestions (dashboard)
// ===========================================================================

/**
 * Builds the proactive suggestions surfaced on `/dashboard`.
 * Sources of signal:
 *   - Memory:   recurring items + cadence (drives low-stock).
 *   - Calendar: tagged events (hackathon, exam, travel, team-lunch).
 *   - Time of day: mock rain-mode after 6 PM (proxy for weather MCP).
 */
export async function generateSmartSuggestions(
  memory: UserMemory,
  calendar: CalendarEvent[]
): Promise<AgentSuggestion[]> {
  const out: AgentSuggestion[] = [];
  const hour = new Date().getHours();

  // 1. Low-stock from cadence predictions.
  const preds = await Instamart.predictRestockNeeds(
    memory.recurringItems.map((r) => ({
      name: r.name,
      cadenceDays: r.cadenceDays,
      lastOrderedAt: r.lastOrderedAt,
    }))
  );
  const soon = preds.filter((p) => p.daysAway <= 2);
  if (soon.length) {
    out.push({
      id: uid("sug"),
      kind: "low-stock",
      title: "Low on essentials",
      body: `${soon.map((s) => s.itemName).slice(0, 3).join(", ")} likely running out in ${soon[0].daysAway} day(s).`,
      reasoning: [
        "Memory: tracks recurring grocery cadence.",
        `Instamart Agent predicts run-out in ${soon[0].daysAway}d.`,
        "House Agent built a refill basket.",
      ],
      estimatedCost: 480,
      ctaLabel: "Build refill cart",
      module: "house",
      createdAt: nowIso(),
    });
  }

  // 2. Calendar-driven suggestions, scoped to events in the next 72h.
  for (const e of calendar) {
    const hoursAway = (new Date(e.start).getTime() - Date.now()) / 36e5;
    if (hoursAway < -2 || hoursAway > 72) continue;

    if (e.tags?.includes("hackathon")) {
      out.push({
        id: uid("sug"),
        kind: "hackathon-snack",
        title: "Hackathon mode tonight",
        body: `${e.title} starts in ${Math.round(hoursAway)}h. Want me to plan snacks + caffeine?`,
        reasoning: [
          "Calendar Agent detected hackathon event.",
          `Memory: caffeine habit = ${memory.caffeineHabit}.`,
          "Budget Agent ready to optimize.",
        ],
        estimatedCost: 1800,
        ctaLabel: "Plan hackathon",
        module: "hackathon",
        createdAt: nowIso(),
      });
    }
    if (e.tags?.includes("travel")) {
      out.push({
        id: uid("sug"),
        kind: "travel-arrival",
        title: "Schedule dinner around your flight",
        body: `${e.title} — order food to land ~45 mins after arrival.`,
        reasoning: [
          "Calendar Agent saw flight event.",
          `Memory: travel meal preference exists for ${memory.travelHabits.length} cities.`,
        ],
        ctaLabel: "Plan travel meal",
        module: "travel",
        createdAt: nowIso(),
      });
    }
    if (e.tags?.includes("exam")) {
      out.push({
        id: uid("sug"),
        kind: "exam-mode",
        title: "Exam tomorrow — light dinner?",
        body: `${e.title} — set light dinner, coffee, and printout reminder.`,
        reasoning: ["Calendar Agent saw exam tag.", "Print Agent ready for assignment printout flow."],
        ctaLabel: "Exam mode",
        module: "printout",
        createdAt: nowIso(),
      });
    }
    if (e.tags?.includes("team-lunch")) {
      out.push({
        id: uid("sug"),
        kind: "team-lunch",
        title: "Plan team lunch for all-hands",
        body: `${e.attendees ?? "Multiple"} attendees — Dineout / group order under budget.`,
        reasoning: ["Calendar Agent flagged team event.", "Dineout Agent has venues for groups."],
        ctaLabel: "Plan team lunch",
        module: "team",
        createdAt: nowIso(),
      });
    }
  }

  // 3. Rain-mode (mock — would come from a weather MCP).
  if (hour >= 18) {
    out.push({
      id: uid("sug"),
      kind: "rain-mode",
      title: "Rain detected near you",
      body: "Delivery ETAs will rise in 30 mins — order dinner now to avoid surge.",
      reasoning: [
        "Signal: rain probability > 70% near home address.",
        "Food Agent has reliable restaurants within 25 min ETA.",
      ],
      estimatedCost: 380,
      ctaLabel: "Quick dinner",
      module: "dashboard",
      createdAt: nowIso(),
    });
  }

  // 4. Printout reminder — proxy for the (soon) Printout Delivery Agent.
  out.push({
    id: uid("sug"),
    kind: "printout-reminder",
    title: "Printout delivery (preview)",
    body: "Upload PDF → spiral-bound A4 delivered before 9 AM. Local services MCP.",
    reasoning: [
      "Memory: print settings = spiral / A4 / double-sided.",
      "Print Agent will use local.services MCP.",
    ],
    ctaLabel: "Preview flow",
    module: "printout",
    createdAt: nowIso(),
  });

  return out;
}

// ===========================================================================
// Conversational layer — what the agent page calls
// ===========================================================================

/**
 * Lightweight NL → Intent classifier. Keyword-based on purpose: it keeps the
 * surface auditable for students and is trivial to swap with an LLM call
 * later (return shape stays the same).
 */
function detectIntent(text: string): Intent {
  const t = text.toLowerCase();

  const num = (re: RegExp) => {
    const m = t.match(re);
    return m ? Number(m[1]) : undefined;
  };
  const people = num(/(\d+)\s*(?:people|folks|of us|guys|members|friends|attendees)/);
  const budget = num(/(?:[₹$]|under\s+|budget\s+(?:of\s+)?|max\s+)(\d+)/);
  const vegPct = num(/(\d+)\s*%?\s*veg/);
  const vegRatio = vegPct !== undefined ? Math.min(1, vegPct / 100) : undefined;

  // Hackathon / event / coding-night intents.
  if (
    /hackathon|hack ?night|all[- ]?nighter|coding night|submission night|jam session|study group/.test(
      t
    )
  ) {
    return { kind: "hackathon", people, budget, vegRatio };
  }

  // House refill / low-stock / grocery intents.
  if (
    /refill|low ?on|out ?of|running ?out|need (?:more|some)|grocery|groceries|household|essentials|restock/.test(
      t
    )
  ) {
    const items = ["milk", "eggs", "bread", "atta", "coffee", "maggi", "detergent", "toilet"].filter(
      (i) => t.includes(i)
    );
    return { kind: "house", itemHints: items.length ? items : undefined };
  }

  if (/print|printout|spiral|bind|pdf|assignment paper|submission paper/.test(t)) {
    return { kind: "print" };
  }
  if (/flight|land(?:ing)?|airport|train|cab home|travel|hotel/.test(t)) {
    return { kind: "travel" };
  }
  if (/team lunch|all[- ]?hands|office lunch|colleagues|meeting lunch/.test(t)) {
    return { kind: "team", people, budget };
  }
  if (/exam|midterm|finals|tomorrow.?s test|study session/.test(t)) {
    return { kind: "exam" };
  }
  if (/help|what can you do|how (?:does|do) (?:this|you) work|hi$|hello|hey$/.test(t)) {
    return { kind: "help" };
  }
  return { kind: "unknown" };
}

/** Build a HackathonPlanInput from an intent + memory + calendar defaults. */
function deriveHackathonInput(
  intent: Intent,
  memory: UserMemory,
  calendar: CalendarEvent[]
): HackathonPlanInput {
  // If the calendar has a hackathon event in the next 72h, use its details.
  const event =
    calendar
      .filter((e) => e.tags?.includes("hackathon"))
      .sort((a, b) => +new Date(a.start) - +new Date(b.start))[0] ?? null;

  const people = intent.people ?? event?.attendees ?? 12;
  const budget = intent.budget ?? memory.perOrderBudgetSoftCap;
  const vegRatio = intent.vegRatio ?? 0.4;

  const start = event ? new Date(event.start) : nextEvening();
  const end = event ? new Date(event.end) : new Date(start.getTime() + 14 * 36e5);

  return {
    eventName: event?.title ?? "Tonight's hackathon",
    location: event?.location ?? memory.homeAddress,
    people,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    budgetPerPerson: budget,
    vegCount: Math.round(people * vegRatio),
    nonVegCount: people - Math.round(people * vegRatio),
    caffeine: memory.caffeineHabit,
    snackLevel: "heavy",
    includeInstamart: true,
    mealsPerNight: 2,
  };
}

function deriveHouseInput(intent: Intent, memory: UserMemory): HouseInventoryInput {
  return {
    houseName: "Our flat",
    roommates: memory.roommates,
    monthlyBudget: memory.monthlyBudget,
    currentInventory: memory.recurringItems.map((r) => ({
      name: r.name,
      qty: r.averageQty,
      unit: r.unit,
    })),
    lowStockItems:
      intent.itemHints?.map((h) =>
        memory.recurringItems.find((r) => r.name.toLowerCase().includes(h))?.name ?? h
      ) ?? [],
    dietaryPreferences: [memory.diet],
    refillFrequency: "weekly",
  };
}

function nextEvening() {
  const d = new Date();
  d.setHours(20, 0, 0, 0);
  if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
  return d;
}

/**
 * Top-level conversational entry point.
 *
 * Given the user's text, the current memory, and calendar, the agent returns
 * one of three things:
 *
 *   1. A `text` message — clarification, greeting, or "didn't understand".
 *   2. A `plan` message — a real LifeOpsPlan rendered inline.
 *   3. A `mock` message — a polished mock for modules whose MCP tools
 *      don't exist yet (printout / travel / team / exam).
 */
export async function respondToMessage(
  text: string,
  memory: UserMemory,
  calendar: CalendarEvent[]
): Promise<Message> {
  const intent = detectIntent(text);
  const at = nowIso();

  switch (intent.kind) {
    case "hackathon": {
      const input = deriveHackathonInput(intent, memory, calendar);
      const plan = await generateHackathonPlan(input, memory, calendar);
      const preamble = buildHackathonPreamble(input, calendar);
      return { id: uid("m"), role: "agent", kind: "plan", preamble, plan, at };
    }

    case "house": {
      const input = deriveHouseInput(intent, memory);
      const plan = await generateHouseInventoryPlan(input, memory);
      const preamble = buildHousePreamble(intent, plan);
      return { id: uid("m"), role: "agent", kind: "plan", preamble, plan, at };
    }

    case "print":
      return mockMessage(
        "Printout delivery (preview)",
        `Looked at your print settings (${memory.printSettings.paperSize} · ${memory.printSettings.color} · ${memory.printSettings.binding}). I'd route this to a nearby vendor via Local Services MCP.`,
        [
          "Find print vendor within 10 km of your address",
          `Create job: ${memory.printSettings.paperSize}, ${memory.printSettings.color}, ${memory.printSettings.binding}, ${memory.printSettings.doubleSided ? "double-sided" : "single-sided"}`,
          "Schedule rider pickup → drop to hostel before 09:00",
        ],
        [
          { surface: "local.services", tool: "findPrintVendor" },
          { surface: "local.services", tool: "createPrintJob" },
          { surface: "local.services", tool: "schedulePickupDrop" },
        ]
      );

    case "travel":
      return mockMessage(
        "Travel meal scheduling (preview)",
        `For your next trip I'd schedule food to land ~45 min after arrival. Memory says you usually go for ${
          memory.travelHabits[0]?.preferredMealOnArrival ?? "a light meal"
        } in ${memory.travelHabits[0]?.city ?? "your destination"}.`,
        [
          "Read flight/cab event from Calendar MCP",
          "Search Food MCP for hotel-deliverable restaurants",
          "Schedule order with arrival-aligned ETA",
        ],
        [
          { surface: "calendar", tool: "findEventsByTag" },
          { surface: "swiggy.food", tool: "recommendMealForContext" },
          { surface: "swiggy.food", tool: "placeFoodOrderPreview" },
        ]
      );

    case "team":
      return mockMessage(
        "Team lunch planning (preview)",
        `For team events I'd combine a Dineout venue search with a group food order — whichever fits the headcount and budget better.`,
        [
          `Search Dineout for venues fitting ${intent.people ?? 20} people`,
          `Optimize cart to ${intent.budget ?? 300} per head`,
          "Send team a vote link → finalize cart",
        ],
        [
          { surface: "swiggy.dineout", tool: "planGroupDinner" },
          { surface: "swiggy.food", tool: "fetchFoodCoupons" },
          { surface: "swiggy.food", tool: "placeFoodOrderPreview" },
        ]
      );

    case "exam":
      return mockMessage(
        "Exam-week kit (preview)",
        "For exam week I'd plan a light dinner, late-night coffee, and a printout reminder for any submissions on your calendar.",
        [
          "Read exam events from Calendar MCP",
          "Order light dinner around 8 PM",
          "Schedule a midnight coffee delivery",
          "Set printout reminder for the morning",
        ],
        [
          { surface: "calendar", tool: "findEventsByTag" },
          { surface: "swiggy.food", tool: "placeFoodOrderPreview" },
          { surface: "local.services", tool: "createPrintJob" },
        ]
      );

    case "help":
      return {
        id: uid("m"),
        role: "agent",
        kind: "text",
        at,
        text:
          "I'm your LifeOps Agent. Tell me what you need in plain English. A few things I'm good at:\n\n" +
          "• Hackathon / coding-night meals for a group (try \"plan hackathon tonight for 12 people under ₹400\")\n" +
          "• Flat refills (\"we're low on milk and eggs\")\n" +
          "• Print delivery (\"print my submission for tomorrow\")\n" +
          "• Travel meals (\"order dinner for my flight tonight\")\n" +
          "• Team lunch (\"lunch for 20, budget ₹300 each\")\n\n" +
          "I'll always show you the plan + the agents I used. No real orders go through — you approve everything.",
      };

    case "unknown":
    default:
      return {
        id: uid("m"),
        role: "agent",
        kind: "text",
        at,
        text:
          "Hmm, I didn't catch that. Try something like:\n" +
          "• \"plan our hackathon tonight\"\n" +
          "• \"we're out of milk and bread\"\n" +
          "• \"print my assignment\"\n" +
          "• \"team lunch for 20, budget ₹300\"",
      };
  }
}

function buildHackathonPreamble(input: HackathonPlanInput, calendar: CalendarEvent[]): string {
  const matched = calendar.find((e) => e.tags?.includes("hackathon"));
  const parts: string[] = [];
  if (matched) {
    parts.push(`Saw "${matched.title}" on your calendar.`);
  }
  parts.push(
    `Planning for ${input.people} people (${input.vegCount} veg / ${input.nonVegCount} non-veg) at ₹${input.budgetPerPerson}/head. Caffeine: ${input.caffeine}.`
  );
  parts.push("Here's the meal timeline, food + Instamart carts, and the cost split.");
  return parts.join(" ");
}

function buildHousePreamble(intent: Intent, plan: LifeOpsPlan): string {
  const soon = plan.runOutPredictions?.filter((p) => p.daysAway <= 2) ?? [];
  const items = intent.itemHints?.length
    ? intent.itemHints.join(", ")
    : soon.map((s) => s.itemName).slice(0, 3).join(", ");
  const head = items
    ? `Got it — checked the recurring items, looks like ${items} need refilling.`
    : "Checked your recurring items and built a weekly refill basket.";
  return `${head} Split across roommates by share, optimized to fit your weekly budget slice.`;
}

function mockMessage(
  title: string,
  preamble: string,
  bullets: string[],
  mcpHints: { surface: import("./types").MCPSurface; tool: string }[]
): Message {
  return {
    id: uid("m"),
    role: "agent",
    kind: "mock",
    title,
    preamble,
    bullets,
    mcpHints,
    at: nowIso(),
  };
}
