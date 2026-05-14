"use client";

/**
 * Memory editor.
 *
 * The only "settings"-style screen in the app. Edits flow directly into
 * every future plan the agent generates. A small footer panel groups the
 * connector toggle, safety summary, and the reset action that used to
 * live on a separate Settings page.
 */

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Brain, Plus, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { useApp } from "@/lib/store";
import { inr } from "@/lib/utils";

export default function MemoryPage() {
  const memory = useApp((s) => s.memory);
  const setMemory = useApp((s) => s.setMemory);
  const addRoommate = useApp((s) => s.addRoommate);
  const removeRoommate = useApp((s) => s.removeRoommate);
  const resetMemory = useApp((s) => s.resetMemory);

  const [newAllergy, setNewAllergy] = useState("");
  const [newRoommate, setNewRoommate] = useState("");
  const [newCuisine, setNewCuisine] = useState("");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-ink-dim hover:text-accent"
          >
            <ArrowLeft className="h-3 w-3" /> back to agent
          </Link>
          <h1 className="h2 mt-1 flex items-center gap-2">
            <Brain className="h-6 w-6 text-accent" /> Memory
          </h1>
          <p className="mt-1 muted">
            What the agent knows about you. Edit anything — changes flow into every
            plan and suggestion the next time you ask.
          </p>
        </div>
        <button onClick={resetMemory} className="btn">
          <RotateCcw className="h-4 w-4" /> Reset to demo
        </button>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Profile">
          <Row label="Name">
            <input
              className="input"
              value={memory.name}
              onChange={(e) => setMemory({ name: e.target.value })}
            />
          </Row>
          <Row label="Home address">
            <input
              className="input"
              value={memory.homeAddress}
              onChange={(e) => setMemory({ homeAddress: e.target.value })}
            />
          </Row>
          <Row label="Diet">
            <select
              className="input"
              value={memory.diet}
              onChange={(e) => setMemory({ diet: e.target.value as typeof memory.diet })}
            >
              <option value="veg">Veg</option>
              <option value="egg">Egg-friendly</option>
              <option value="non-veg">Non-veg</option>
              <option value="vegan">Vegan</option>
            </select>
          </Row>
          <Row label="Caffeine habit">
            <select
              className="input"
              value={memory.caffeineHabit}
              onChange={(e) =>
                setMemory({ caffeineHabit: e.target.value as typeof memory.caffeineHabit })
              }
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </Row>
        </Card>

        <Card title="Budget">
          <Row label={`Monthly budget — ${inr(memory.monthlyBudget)}`}>
            <input
              type="range"
              min={3000}
              max={50000}
              step={500}
              value={memory.monthlyBudget}
              onChange={(e) => setMemory({ monthlyBudget: +e.target.value })}
              className="w-full accent-orange-500"
            />
          </Row>
          <Row label={`Per-order soft cap — ${inr(memory.perOrderBudgetSoftCap)}`}>
            <input
              type="range"
              min={100}
              max={3000}
              step={50}
              value={memory.perOrderBudgetSoftCap}
              onChange={(e) => setMemory({ perOrderBudgetSoftCap: +e.target.value })}
              className="w-full accent-orange-500"
            />
          </Row>
        </Card>

        <Card title="Allergies">
          <div className="flex flex-wrap gap-1.5">
            {memory.allergies.map((a) => (
              <button
                key={a}
                onClick={() =>
                  setMemory({ allergies: memory.allergies.filter((x) => x !== a) })
                }
                className="chip chip-accent"
              >
                {a} <Trash2 className="h-3 w-3" />
              </button>
            ))}
            {memory.allergies.length === 0 && (
              <span className="text-xs muted">No allergies set.</span>
            )}
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (newAllergy.trim()) {
                setMemory({ allergies: [...memory.allergies, newAllergy.trim()] });
                setNewAllergy("");
              }
            }}
          >
            <input
              className="input"
              placeholder="Add allergy (e.g. peanut)"
              value={newAllergy}
              onChange={(e) => setNewAllergy(e.target.value)}
            />
            <button type="submit" className="btn">
              <Plus className="h-4 w-4" />
            </button>
          </form>
        </Card>

        <Card title="Favorite cuisines">
          <div className="flex flex-wrap gap-1.5">
            {memory.favoriteCuisines.map((c) => (
              <button
                key={c}
                onClick={() =>
                  setMemory({
                    favoriteCuisines: memory.favoriteCuisines.filter((x) => x !== c),
                  })
                }
                className="chip"
              >
                {c}
              </button>
            ))}
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (newCuisine.trim()) {
                setMemory({
                  favoriteCuisines: [...memory.favoriteCuisines, newCuisine.trim()],
                });
                setNewCuisine("");
              }
            }}
          >
            <input
              className="input"
              placeholder="Add cuisine"
              value={newCuisine}
              onChange={(e) => setNewCuisine(e.target.value)}
            />
            <button type="submit" className="btn">
              <Plus className="h-4 w-4" />
            </button>
          </form>
        </Card>

        <Card title="Roommates">
          {memory.roommates.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-lg border border-bg-line bg-bg-soft/40 p-2.5 text-sm"
            >
              <div>
                <div className="text-ink">{r.name}</div>
                <div className="text-xs muted">
                  {r.diet} · {r.share}%
                </div>
              </div>
              <button onClick={() => removeRoommate(r.id)} className="btn btn-ghost">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (newRoommate.trim()) {
                addRoommate(newRoommate.trim(), "veg");
                setNewRoommate("");
              }
            }}
          >
            <input
              className="input"
              placeholder="Add roommate name"
              value={newRoommate}
              onChange={(e) => setNewRoommate(e.target.value)}
            />
            <button type="submit" className="btn">
              <Plus className="h-4 w-4" />
            </button>
          </form>
        </Card>

        <Card title="Recurring items">
          <ul className="space-y-1.5">
            {memory.recurringItems.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-bg-line bg-bg-soft/40 p-2 text-sm"
              >
                <span className="text-ink">{r.name}</span>
                <span className="text-xs muted">every {r.cadenceDays}d</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Print settings">
          <Row label="Paper / color">
            <div className="flex gap-2">
              <select
                className="input"
                value={memory.printSettings.paperSize}
                onChange={(e) =>
                  setMemory({
                    printSettings: {
                      ...memory.printSettings,
                      paperSize: e.target.value as "A4" | "A3" | "Letter",
                    },
                  })
                }
              >
                <option>A4</option>
                <option>A3</option>
                <option>Letter</option>
              </select>
              <select
                className="input"
                value={memory.printSettings.color}
                onChange={(e) =>
                  setMemory({
                    printSettings: {
                      ...memory.printSettings,
                      color: e.target.value as "bw" | "color",
                    },
                  })
                }
              >
                <option value="bw">B/W</option>
                <option value="color">Color</option>
              </select>
            </div>
          </Row>
          <Row label="Binding">
            <select
              className="input"
              value={memory.printSettings.binding}
              onChange={(e) =>
                setMemory({
                  printSettings: {
                    ...memory.printSettings,
                    binding: e.target.value as "none" | "staple" | "spiral" | "hardbound",
                  },
                })
              }
            >
              <option value="none">None</option>
              <option value="staple">Staple</option>
              <option value="spiral">Spiral</option>
              <option value="hardbound">Hardbound</option>
            </select>
          </Row>
        </Card>

        <Card title="Recent places & searches">
          <div className="label">Places visited</div>
          <div className="flex flex-wrap gap-1.5">
            {memory.recentPlaces.map((p) => (
              <span key={p.id} className="chip">
                {p.name} <span className="opacity-60">· {p.type}</span>
              </span>
            ))}
          </div>
          <div className="label mt-3">Recent searches</div>
          <div className="flex flex-wrap gap-1.5">
            {memory.searchHistory.map((s) => (
              <span key={s.id} className="chip">
                {s.query} <span className="opacity-60">· {s.surface}</span>
              </span>
            ))}
          </div>
        </Card>
      </div>

      {/* Footer — connectors + safety, the bits that used to be on Settings */}
      <section className="grid gap-5 md:grid-cols-2">
        <Card title="Connectors">
          <Toggle
            label="Google Calendar (MCP)"
            description="Reads upcoming events for grounded suggestions."
            checked={memory.calendarConnected}
            onChange={(v) => setMemory({ calendarConnected: v })}
          />
          <div className="rounded-lg border border-bg-line bg-bg-soft/40 p-3 text-sm">
            <div className="text-ink">Swiggy MCP</div>
            <div className="text-xs muted">
              Food, Instamart, Dineout, Local Services adapters live as namespaces in{" "}
              <code className="font-mono">lib/mcp.ts</code>. Swap any function body with a
              real MCP client to go live.
            </div>
          </div>
        </Card>

        <Card
          title={
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-accent" /> Safety
            </span>
          }
        >
          <ul className="space-y-1.5 text-sm text-ink-dim">
            <li>• No real Swiggy order is placed — every MCP call is mocked.</li>
            <li>• Each plan ends with an approval checklist; required boxes must be checked.</li>
            <li>
              • Tool calls marked <span className="chip">planned</span> need human approval
              before execution.
            </li>
            <li>• Memory is stored locally in your browser.</li>
          </ul>
        </Card>
      </section>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5 space-y-3">
      <h3 className="h3 text-base">{title}</h3>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="label">{label}</div>
      {children}
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-bg-line bg-bg-soft/40 p-3 hover:border-accent/40">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 accent-orange-500"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="flex-1">
        <div className="text-sm text-ink">{label}</div>
        <div className="text-xs muted">{description}</div>
      </div>
      <span className={`chip ${checked ? "chip-accent" : ""}`}>{checked ? "On" : "Off"}</span>
    </label>
  );
}
