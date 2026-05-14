"use client";

/**
 * The Agent.
 *
 * This is the entire app surface for an end-user (a student). They type
 * what they need; the agent replies with a plan card inline, complete with
 * carts, cost split, approval checklist, and a collapsible A2A trace.
 *
 * On first load we greet the student with context derived from their
 * memory + calendar (low-stock items, upcoming hackathon, etc.) and a row
 * of quick-action chips. There are no separate pages for "hackathon" or
 * "dashboard" — the agent dispatches based on what the student says.
 */

import { useEffect, useRef, useState } from "react";
import {
  CalendarClock,
  Coffee,
  HelpCircle,
  Home,
  Plane,
  Printer,
  Trophy,
  Users,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { respondToMessage, generateSmartSuggestions } from "@/lib/agent";
import { uid } from "@/lib/utils";
import type { AgentSuggestion, Message } from "@/lib/types";
import { Composer, MessageBubble, QuickActions, ThinkingBubble } from "@/components";

export default function AgentPage() {
  const memory = useApp((s) => s.memory);
  const calendar = useApp((s) => s.calendar);
  const addPlan = useApp((s) => s.addPlan);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [suggestions, setSuggestions] = useState<AgentSuggestion[]>([]);
  const threadRef = useRef<HTMLDivElement>(null);

  // Boot: load context-aware suggestions from the orchestrator so the agent
  // can greet the student with what it already sees.
  useEffect(() => {
    let active = true;
    generateSmartSuggestions(memory, calendar).then((s) => {
      if (active) setSuggestions(s);
    });
    return () => {
      active = false;
    };
  }, [memory, calendar]);

  // Auto-scroll to bottom whenever a new message is added.
  useEffect(() => {
    threadRef.current?.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, thinking]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    const userMsg: Message = { id: uid("m"), role: "user", text: trimmed, at: new Date().toISOString() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setThinking(true);

    const reply = await respondToMessage(trimmed, memory, calendar);
    if (reply.role === "agent" && reply.kind === "plan") {
      addPlan(reply.plan);
    }
    setMessages((m) => [...m, reply]);
    setThinking(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <Greeting memoryName={memory.name} suggestions={suggestions} onPick={send} />

      <div ref={threadRef} className="flex flex-col gap-4">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {thinking && <ThinkingBubble />}
      </div>

      <Composer value={input} onChange={setInput} onSend={() => send(input)} disabled={thinking} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Greeting — only shown until the student starts the conversation
// ---------------------------------------------------------------------------

function Greeting({
  memoryName,
  suggestions,
  onPick,
}: {
  memoryName: string;
  suggestions: AgentSuggestion[];
  onPick: (prompt: string) => void;
}) {
  // Pick the two most relevant prompts based on what the orchestrator surfaced.
  const proactive = buildProactiveChips(suggestions);

  return (
    <section className="card overflow-hidden">
      <div className="relative p-6">
        <div className="absolute inset-0 grid-bg opacity-50" />
        <div className="relative space-y-4">
          <div className="flex items-center gap-2">
            <span className="chip chip-accent">Powered by Swiggy MCP</span>
            <span className="chip">Human-in-the-loop</span>
          </div>
          <h1 className="h2">
            Hey {memoryName} 👋 — what should I plan?
          </h1>
          <p className="muted">
            I&apos;m your LifeOps Agent. Tell me in plain English (try
            &ldquo;plan our hackathon tonight&rdquo; or &ldquo;we&apos;re low on milk&rdquo;) and
            I&apos;ll pull from your memory and calendar, route through Food + Instamart
            + Dineout MCP, and hand you a plan to approve.
          </p>

          {proactive.length > 0 && (
            <div className="rounded-xl border border-accent/30 bg-accent-soft/40 p-3 text-sm text-ink">
              <div className="label mb-1.5 text-accent">What I&apos;m already seeing</div>
              <ul className="space-y-1">
                {proactive.map((p) => (
                  <li key={p.id} className="flex gap-2">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-accent" />
                    <span>{p.body}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="label mb-2">Try one of these</div>
            <QuickActions
              actions={[
                {
                  label: "Plan tonight's hackathon",
                  prompt: "Plan our hackathon tonight for 12 people, ₹400 each, 40% veg",
                  icon: Trophy,
                },
                {
                  label: "Refill the flat",
                  prompt: "We're low on milk, eggs, bread, and coffee — refill for this week",
                  icon: Home,
                },
                {
                  label: "Exam-week kit",
                  prompt: "Exam tomorrow — light dinner, coffee, and printout reminder",
                  icon: Coffee,
                },
                {
                  label: "Print my submission",
                  prompt: "Print my assignment and deliver to hostel before 9 AM",
                  icon: Printer,
                },
                {
                  label: "Travel meal",
                  prompt: "Flight lands at 11 PM — order dinner to my hotel",
                  icon: Plane,
                },
                {
                  label: "Team lunch",
                  prompt: "Lunch for 20 people after all-hands, budget ₹300 each, 60% veg",
                  icon: Users,
                },
                {
                  label: "What can you do?",
                  prompt: "help",
                  icon: HelpCircle,
                },
              ]}
              onPick={onPick}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function buildProactiveChips(suggestions: AgentSuggestion[]) {
  // Surface only the high-signal ones — low-stock and any calendar-driven ones.
  const priority = new Set(["low-stock", "hackathon-snack", "exam-mode", "travel-arrival", "team-lunch"]);
  return suggestions.filter((s) => priority.has(s.kind)).slice(0, 3);
}
