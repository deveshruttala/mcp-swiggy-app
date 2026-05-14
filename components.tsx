"use client";

/**
 * All reusable UI for Swiggy LifeOps Agent.
 *
 * The app has a single agent surface (`app/page.tsx`) plus a Memory editor.
 * Components are organized as:
 *
 *   1. Nav                  — sticky top navigation (brand + Memory link)
 *   2. MCPBadge             — colored badge per MCP surface
 *   3. AgentTrace           — timeline visualization of an A2A run
 *   4. Cart tables          — FoodCartTable / InstamartTable
 *   5. PlanCard             — unified plan renderer (hackathon + house)
 *   6. Chat primitives      — Composer, MessageBubble, QuickActions,
 *                              ThinkingBubble
 */

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  ChevronDown,
  Clock,
  Send,
  ShieldCheck,
  Sparkles,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { cn, fmtTime, inr } from "@/lib/utils";
import type {
  AgentTraceStep,
  FoodCartItem,
  InstamartCartItem,
  LifeOpsPlan,
  MCPSurface,
  MCPToolCall,
  Message,
} from "@/lib/types";

// ===========================================================================
// 1. Nav
// ===========================================================================

export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-bg-line bg-bg/80 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="group flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-soft text-accent shadow-glow">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            Swiggy <span className="text-accent">LifeOps</span> Agent
          </span>
          <span className="chip ml-2 hidden sm:inline-flex">Prototype</span>
        </Link>
        <Link
          href="/memory"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-ink-dim hover:bg-bg-soft hover:text-ink"
        >
          <Brain className="h-4 w-4" />
          Memory
        </Link>
      </div>
    </header>
  );
}

// ===========================================================================
// 2. MCPBadge
// ===========================================================================

const MCP_BADGE_COLORS: Record<MCPSurface, string> = {
  "swiggy.food": "text-accent border-accent/40 bg-accent-soft",
  "swiggy.instamart": "text-[#7cd9b0] border-[#3ddc97]/30 bg-[#3ddc97]/10",
  "swiggy.dineout": "text-[#ffb547] border-[#ffb547]/30 bg-[#ffb547]/10",
  "local.services": "text-[#a4b0ff] border-[#7c8bff]/30 bg-[#7c8bff]/10",
  calendar: "text-[#ff9bc6] border-[#ff7aa8]/30 bg-[#ff7aa8]/10",
};

export function MCPBadge({
  surface,
  tool,
  status,
}: {
  surface: MCPSurface;
  tool: string;
  status?: MCPToolCall["status"];
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        MCP_BADGE_COLORS[surface]
      )}
    >
      <span className="font-mono opacity-70">{surface}</span>
      <span>·</span>
      <span className="font-mono">{tool}</span>
      {status && status !== "executed" && (
        <span className="ml-1 rounded-full bg-bg/50 px-1.5 py-px text-[10px] uppercase tracking-wider opacity-80">
          {status}
        </span>
      )}
    </span>
  );
}

// ===========================================================================
// 3. AgentTrace
// ===========================================================================

export function AgentTrace({
  steps,
  toolCalls,
}: {
  steps: AgentTraceStep[];
  toolCalls: MCPToolCall[];
}) {
  const toolMap = Object.fromEntries(toolCalls.map((t) => [t.id, t]));
  return (
    <ol className="relative ml-3 space-y-3 border-l border-bg-line pl-6">
      {steps.map((s, i) => {
        const tc = s.toolCallId ? toolMap[s.toolCallId] : undefined;
        return (
          <li key={s.id} className="relative">
            <span className="absolute -left-[33px] top-1 flex h-5 w-5 items-center justify-center rounded-full border border-accent/40 bg-bg text-[10px] font-semibold text-accent">
              {i + 1}
            </span>
            <div className="card p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-dim">
                <span className="rounded-md bg-bg-soft px-2 py-0.5 font-mono text-ink">
                  {s.from}
                </span>
                {s.to && (
                  <>
                    <ArrowRight className="h-3.5 w-3.5" />
                    <span className="rounded-md bg-bg-soft px-2 py-0.5 font-mono text-ink">
                      {s.to}
                    </span>
                  </>
                )}
                <span className="ml-auto text-[11px] text-ink-fade">{fmtTime(s.at)}</span>
              </div>
              <div className="mt-2 text-sm text-ink">{s.action}</div>
              {s.detail && <div className="mt-0.5 text-xs muted">{s.detail}</div>}
              {tc && (
                <div className="mt-2">
                  <MCPBadge surface={tc.surface} tool={tc.tool} status={tc.status} />
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ===========================================================================
// 4. Cart tables
// ===========================================================================

export function FoodCartTable({ items }: { items: FoodCartItem[] }) {
  if (!items.length) return <div className="muted text-sm">No food items.</div>;
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  return (
    <div className="overflow-hidden rounded-xl border border-bg-line">
      <table className="w-full text-sm">
        <thead className="bg-bg-soft text-left text-xs uppercase tracking-wider text-ink-dim">
          <tr>
            <th className="px-3 py-2">Item</th>
            <th className="px-3 py-2">From</th>
            <th className="px-3 py-2 text-right">Qty</th>
            <th className="px-3 py-2 text-right">Price</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className="border-t border-bg-line">
              <td className="px-3 py-2 text-ink">
                {i.name} <span className="ml-1 text-[10px] uppercase text-ink-fade">{i.diet}</span>
              </td>
              <td className="px-3 py-2 text-ink-dim">{i.restaurant}</td>
              <td className="px-3 py-2 text-right">{i.qty}</td>
              <td className="px-3 py-2 text-right">{inr(i.price * i.qty)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-bg-line bg-bg-soft/60">
            <td colSpan={3} className="px-3 py-2 text-right text-xs uppercase tracking-wider text-ink-dim">
              Subtotal
            </td>
            <td className="px-3 py-2 text-right font-semibold text-ink">{inr(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function InstamartTable({ items }: { items: InstamartCartItem[] }) {
  if (!items.length) return <div className="muted text-sm">Instamart cart empty.</div>;
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  return (
    <div className="overflow-hidden rounded-xl border border-bg-line">
      <table className="w-full text-sm">
        <thead className="bg-bg-soft text-left text-xs uppercase tracking-wider text-ink-dim">
          <tr>
            <th className="px-3 py-2">Item</th>
            <th className="px-3 py-2">Substitute</th>
            <th className="px-3 py-2 text-right">Qty</th>
            <th className="px-3 py-2 text-right">Price</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className="border-t border-bg-line">
              <td className="px-3 py-2 text-ink">{i.name}</td>
              <td className="px-3 py-2 text-xs text-ink-dim">{i.substitute ?? "—"}</td>
              <td className="px-3 py-2 text-right">{i.qty}</td>
              <td className="px-3 py-2 text-right">{inr(i.price * i.qty)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-bg-line bg-bg-soft/60">
            <td colSpan={3} className="px-3 py-2 text-right text-xs uppercase tracking-wider text-ink-dim">
              Subtotal
            </td>
            <td className="px-3 py-2 text-right font-semibold text-ink">{inr(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ===========================================================================
// 5. PlanCard — unified plan renderer
// ===========================================================================

/**
 * Renders any LifeOpsPlan (hackathon or house) as a single agent-reply card.
 *
 * Sections shown adapt to what the plan contains:
 *   - meals timeline (hackathon only)
 *   - run-out predictions (house only)
 *   - food cart (hackathon only)
 *   - instamart cart (always)
 *   - cost split
 *   - coupons (when present)
 *   - approval checklist
 *   - A2A trace + MCP calls (collapsed by default)
 */
export function PlanCard({ plan }: { plan: LifeOpsPlan }) {
  const [traceOpen, setTraceOpen] = useState(false);
  const [checks, setChecks] = useState(plan.approvalChecklist);

  const requiredOk = checks.filter((c) => c.required).every((c) => c.checked);
  const allTools = plan.toolCalls;

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="border-b border-bg-line bg-bg-soft/40 px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip chip-accent uppercase">{plan.module}</span>
          <span className="font-medium text-ink">{plan.goal}</span>
          <span className="ml-auto text-[11px] text-ink-fade">{fmtTime(plan.createdAt)}</span>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {plan.warnings.length > 0 && (
          <div className="rounded-lg border border-warn/40 bg-warn/5 p-3 text-sm text-warn">
            {plan.warnings.map((w, i) => (
              <div key={i}>⚠ {w}</div>
            ))}
          </div>
        )}

        {/* Meal timeline */}
        {plan.meals && plan.meals.length > 0 && (
          <Section title="Meal timeline">
            <div className="grid gap-2 sm:grid-cols-2">
              {plan.meals.map((m) => (
                <div key={m.id} className="rounded-lg border border-bg-line bg-bg-soft/40 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-ink">{m.label}</span>
                    <span className="chip">
                      <Clock className="h-3 w-3" /> {fmtTime(m.time)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-ink-fade">
                    Budget {inr(m.budget)} · {m.items.length} items
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Run-out predictions */}
        {plan.runOutPredictions && plan.runOutPredictions.length > 0 && (
          <Section title="Predicted run-out">
            <div className="grid gap-1.5 sm:grid-cols-2">
              {plan.runOutPredictions.map((p) => (
                <div
                  key={p.itemName}
                  className="flex items-center justify-between rounded-lg border border-bg-line bg-bg-soft/40 px-3 py-2 text-sm"
                >
                  <span className="text-ink">{p.itemName}</span>
                  <span className={cn("chip", p.daysAway <= 2 && "chip-accent")}>
                    {p.daysAway <= 0 ? "today" : `in ${p.daysAway}d`}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Food cart */}
        {plan.foodCart.length > 0 && (
          <Section title="Food cart">
            <FoodCartTable items={plan.foodCart} />
          </Section>
        )}

        {/* Instamart cart */}
        {plan.instamartCart.length > 0 && (
          <Section title="Instamart essentials">
            <InstamartTable items={plan.instamartCart} />
          </Section>
        )}

        {/* Cost split */}
        <Section title="Cost split">
          <div className="text-xs muted">
            Total <span className="text-ink font-medium">{inr(plan.costSplit.total)}</span> · per
            person {inr(plan.costSplit.perPerson)}
          </div>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
            {plan.costSplit.byRoommate.map((r) => (
              <div
                key={r.roommateId}
                className="rounded-lg border border-bg-line bg-bg-soft/40 px-3 py-2 text-sm"
              >
                <div className="text-ink">{r.name}</div>
                <div className="text-xs text-ink-dim">{inr(r.amount)}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Coupons */}
        {plan.coupons.length > 0 && (
          <Section title="Coupons">
            <div className="flex flex-wrap gap-1.5">
              {plan.coupons.map((c) => (
                <span key={c.code} className="chip chip-accent">
                  <span className="font-mono">{c.code}</span>
                  <span className="opacity-80">save {inr(c.estimatedSavings)}</span>
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Approval */}
        <Section
          title={
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-accent" /> Approval needed
            </span>
          }
        >
          <div className="space-y-1.5">
            {checks.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-bg-line bg-bg-soft/40 px-3 py-2 text-sm hover:border-accent/40"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-orange-500"
                  checked={c.checked}
                  onChange={(e) =>
                    setChecks((prev) =>
                      prev.map((x) => (x.id === c.id ? { ...x, checked: e.target.checked } : x))
                    )
                  }
                />
                <span className="text-ink">{c.label}</span>
                {c.required && <span className="ml-auto chip">required</span>}
              </label>
            ))}
          </div>
          <button
            disabled={!requiredOk}
            className="btn btn-primary mt-2 disabled:opacity-50"
            title={requiredOk ? undefined : "Check the required boxes to enable approval"}
          >
            <CheckCircle2 className="h-4 w-4" /> Approve & prepare MCP execution
          </button>
        </Section>

        {/* Trace (collapsed) */}
        <div>
          <button
            onClick={() => setTraceOpen((x) => !x)}
            className="btn btn-ghost w-full justify-between"
          >
            <span className="flex items-center gap-2">
              <Workflow className="h-4 w-4 text-accent" />
              A2A trace · {plan.trace.length} steps · {allTools.length} MCP calls
            </span>
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", traceOpen && "rotate-180")}
            />
          </button>
          {traceOpen && (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {allTools.map((tc) => (
                  <MCPBadge
                    key={tc.id}
                    surface={tc.surface}
                    tool={tc.tool}
                    status={tc.status}
                  />
                ))}
              </div>
              <AgentTrace steps={plan.trace} toolCalls={plan.toolCalls} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="label mb-2">{title}</div>
      {children}
    </div>
  );
}

// ===========================================================================
// 6. Chat primitives
// ===========================================================================

export interface QuickAction {
  label: string;
  prompt: string;
  icon?: LucideIcon;
}

export function QuickActions({
  actions,
  onPick,
}: {
  actions: QuickAction[];
  onPick: (prompt: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <button
            key={a.label}
            onClick={() => onPick(a.prompt)}
            className="inline-flex items-center gap-1.5 rounded-full border border-bg-line bg-bg-soft/60 px-3 py-1.5 text-sm text-ink hover:border-accent/40 hover:text-accent"
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {a.label}
          </button>
        );
      })}
    </div>
  );
}

export function MessageBubble({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md border border-accent/30 bg-accent-soft px-4 py-2 text-sm text-ink">
          {message.text}
        </div>
      </div>
    );
  }

  // Agent
  return (
    <div className="flex items-start gap-2">
      <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent shadow-glow">
        <Sparkles className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        {message.kind === "text" && (
          <div className="card whitespace-pre-wrap p-4 text-sm text-ink">{message.text}</div>
        )}

        {message.kind === "plan" && (
          <>
            <div className="card p-4 text-sm text-ink">{message.preamble}</div>
            <PlanCard plan={message.plan} />
          </>
        )}

        {message.kind === "mock" && (
          <div className="card p-5">
            <div className="flex items-center gap-2">
              <span className="chip">Preview · MCP extension needed</span>
              <span className="text-[11px] text-ink-fade ml-auto">{fmtTime(message.at)}</span>
            </div>
            <h3 className="h3 text-base mt-2">{message.title}</h3>
            <p className="mt-1 text-sm text-ink-dim">{message.preamble}</p>
            <ol className="mt-3 space-y-1.5 list-decimal pl-5 text-sm text-ink-dim">
              {message.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ol>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {message.mcpHints.map((h, i) => (
                <MCPBadge key={i} surface={h.surface} tool={h.tool} status="planned" />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ThinkingBubble({ note }: { note?: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent shadow-glow">
        <Sparkles className="h-3.5 w-3.5 animate-pulse" />
      </span>
      <div className="card flex items-center gap-3 px-4 py-3 text-sm text-ink-dim">
        <span className="inline-flex gap-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:200ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:400ms]" />
        </span>
        {note ?? "Routing through Memory → Calendar → Food → Instamart → Budget…"}
      </div>
    </div>
  );
}

export function Composer({
  value,
  onChange,
  onSend,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled) onSend();
      }}
      className="sticky bottom-4 z-20 mx-auto w-full"
    >
      <div className="card flex items-center gap-2 p-2 shadow-glow">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            placeholder ??
            `Tell me what you need… (try 'plan hackathon tonight' or 'we are low on milk')`
          }
          className="flex-1 bg-transparent px-3 py-2 text-sm text-ink placeholder:text-ink-fade focus:outline-none"
          disabled={disabled}
        />
        <button type="submit" className="btn btn-primary px-3" disabled={disabled || !value.trim()}>
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </div>
    </form>
  );
}
