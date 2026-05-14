# Swiggy LifeOps Agent

> An AI agent that plans hackathon nights, flat refills, printouts, travel meals, and team lunches — for students, on top of Swiggy MCP.

You open one page, tell the agent what you need in plain English (*"plan our hackathon tonight"*, *"we're low on milk"*, *"print my submission"*), and it generates an inline plan — meal timeline, food + Instamart carts, cost split, coupons, MCP tool trace, and an approval gate. No real orders go through; you approve everything.

---

## Setup

Requires Node 18.18+ and npm.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

There are two routes:

| Route | Purpose |
| --- | --- |
| `/` | The agent. Type or pick a chip; plans render inline. |
| `/memory` | What the agent knows about you. Edit and the next plan reflects it. |

Memory and recent plans persist to `localStorage` — no backend.

---

## What it solves

| Mode | The pain | The agent does |
| --- | --- | --- |
| **Hackathon / campus** | 12 people ordering separately at midnight, no caffeine plan, no submission breakfast, roommate split fights | Meal timeline (Dinner → Snacks → Caffeine → Breakfast), food + Instamart carts by veg/non-veg ratio, coupons, cost split |
| **House refill** | "Bro, we're out of milk" again. Detergent runs out before laundry. Three half-finished Instamart carts | Run-out prediction from cadence + last-ordered-at, refill basket with substitutes, weekly-budget fit, split by roommate share % |
| **Printout** | Submission at 9 AM, print shop opens at 10 | Picks up print settings from memory; routes `findPrintVendor → createPrintJob → schedulePickupDrop` |
| **Travel meal** | Flight lands at 11 PM, hotel kitchen closed | Reads `travel`-tagged calendar event; schedules order ~45 min after arrival |
| **Team lunch** | "Lunch for 40, 60% veg, ₹300 each" | Dineout venue search + group food order with budget optimization |

Modes 1–2 are fully wired. Modes 3–5 render polished mock cards that drop in once their MCP tools land.

---

## How it works

- **Agentic memory** — diet, allergies, budget, roommates, recurring items, print settings, travel habits, places visited, past orders. All editable on `/memory`, persisted locally.
- **Calendar grounding** — the agent reads upcoming events (hackathon, exam, flight, team-lunch) and surfaces them as a proactive *"What I'm already seeing"* panel on the greeting.
- **A2A orchestration** — every plan runs through specialized agents (Orchestrator → Memory → Calendar → Budget → Food → Instamart → Community), each step traceable. The trace is collapsible on every plan card.
- **Human-in-the-loop** — every plan ends with an approval checklist. Required boxes must be checked. Tool calls are tagged `planned` until approved.

---

## Project layout

```
app/
  layout.tsx
  globals.css
  page.tsx              THE AGENT — chat surface + inline plans
  memory/page.tsx       Memory editor + connectors + reset
components.tsx          Nav, MessageBubble, Composer, PlanCard,
                        AgentTrace, MCPBadge, cart tables
lib/
  types.ts              Domain types
  utils.ts              cn, inr, uid, fmtTime, …
  store.ts              Zustand store + seed data
  mcp.ts                Food / Instamart / Dineout / LocalServices / Calendar
                        (five mock MCP namespaces in one file)
  agent.ts              Orchestrators + A2A trace builder + NL dispatcher
```

**Tech**: Next.js 14, TypeScript, Tailwind, Zustand-persist, `lucide-react`. No backend.

---

## Replacing mocks with real Swiggy MCP

Open `lib/mcp.ts`, pick a namespace (`Food`, `Instamart`, `Dineout`, `LocalServices`, `Calendar`), replace each function body with a real MCP client call. Keep the signatures — `lib/agent.ts` and the UI stay untouched.

---

## Future MCP tools we want from Swiggy

- **Food**: `create_group_order`, `optimize_cart_by_budget`, `schedule_food_order`, `get_delivery_eta`, `recommend_meal_for_context`
- **Instamart**: `create_shared_cart`, `predict_restock_needs`, `subscribe_recurring_items`, `optimize_basket_by_budget`, `find_substitutes`
- **Dineout**: `plan_group_dinner`, `split_table_booking`, `corporate_booking_request`
- **Local services**: `find_print_vendor`, `create_print_job`, `schedule_pickup_drop`, `track_local_task`

---

**Prototype only — review every cart before any real checkout.**
