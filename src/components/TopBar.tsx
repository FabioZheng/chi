"use client";

import {
  Bot,
  BrainCircuit,
  Database,
  Gauge,
  GitBranch,
  LayoutTemplate,
  MapPinned,
  Plus,
  Route,
  SearchCheck,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  WalletCards
} from "lucide-react";
import { languageNames, type Language, type UIText, type ViewMode } from "@/i18n";
import type { AgentTrace } from "@/types/travel";

type TopBarProps = {
  memoryCount: number;
  agentTrace: AgentTrace[];
  activeView: ViewMode;
  language: Language;
  labels: UIText;
  onViewChange: (view: ViewMode) => void;
  onLanguageChange: (language: Language) => void;
};

const workflowAgents: AgentTrace["agent"][] = [
  "Conflict Detector Agent",
  "Preference Probe Agent",
  "Preference Agent",
  "Assumption Critic Agent",
  "Input Consistency Agent",
  "Planner Agent",
  "Constraint Checker Agent",
  "Memory Agent"
];

const iconForAgent: Record<AgentTrace["agent"], typeof Bot> = {
  "Conflict Detector Agent": SearchCheck,
  "Preference Probe Agent": Sparkles,
  "Preference Agent": Bot,
  "Assumption Critic Agent": ShieldAlert,
  "Input Consistency Agent": ShieldCheck,
  "Branch Explorer Agent": GitBranch,
  "Planner Agent": Route,
  "Constraint Checker Agent": MapPinned,
  "Budget Manager Agent": WalletCards,
  "Route Mobility Agent": MapPinned,
  "Pace Feasibility Agent": Gauge,
  "Presentation Agent": LayoutTemplate,
  "Memory Agent": Database
};

const toneForIndex = [
  "border-blue-100 bg-blue-50 text-blue-700",
  "border-orange-100 bg-orange-50 text-orange-700",
  "border-emerald-100 bg-emerald-50 text-emerald-700",
  "border-violet-100 bg-violet-50 text-violet-700",
  "border-sky-100 bg-sky-50 text-sky-700"
];

function agentLabel(labels: UIText, agent: AgentTrace["agent"]) {
  return (labels.agentLabels as Partial<Record<AgentTrace["agent"], string>>)[agent] || agent;
}

function shortAgentLabel(labels: UIText, agent: AgentTrace["agent"]) {
  return (labels.shortAgentLabels as Partial<Record<AgentTrace["agent"], string>>)[agent] || agent.replace(" Agent", "");
}

export function TopBar({
  memoryCount,
  agentTrace,
  activeView,
  language,
  labels,
  onViewChange,
  onLanguageChange
}: TopBarProps) {
  const activeAgents = agentTrace.length
    ? Array.from(new Set(agentTrace.map((entry) => entry.agent)))
    : workflowAgents;

  return (
    <header className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto_minmax(280px,1fr)] lg:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-500 text-white shadow-[0_14px_34px_rgba(92,70,229,0.3)]">
          <BrainCircuit className="size-7" />
          <span className="absolute -right-1 -top-1 size-3 rounded-full bg-violet-300" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-slate-950 md:text-2xl">{labels.appTitle}</h1>
          <p className="text-sm font-semibold text-indigo-900/70">{labels.appSubtitle}</p>
        </div>
      </div>

      <div className="mx-auto flex h-12 w-full max-w-[460px] items-center justify-center rounded-full border border-slate-200/80 bg-white/86 p-1 shadow-[0_14px_40px_rgba(24,32,56,0.08)] backdrop-blur">
        {[
          { view: "plan" as const, label: labels.planView },
          { view: "assumptions" as const, label: labels.assumptionsView },
          { view: "canvas" as const, label: labels.canvasView }
        ].map((tab) => (
          <button
            key={tab.view}
            type="button"
            onClick={() => onViewChange(tab.view)}
            aria-pressed={activeView === tab.view}
            className={`h-9 flex-1 rounded-full px-4 text-sm font-semibold transition ${
              activeView === tab.view
                ? "border border-violet-300 bg-violet-50 text-violet-700 shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-start gap-3 lg:justify-end">
        <div className="hidden text-right text-xs font-semibold text-slate-600 xl:block">
          {labels.agentsLabel}
        </div>
        <label className="flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 shadow-sm">
          <span>{labels.language}</span>
          <select
            value={language}
            onChange={(event) => onLanguageChange(event.target.value as Language)}
            className="bg-transparent text-xs font-black text-indigo-700 outline-none"
          >
            {(Object.keys(languageNames) as Language[]).map((item) => (
              <option key={item} value={item}>
                {languageNames[item]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          {activeAgents.map((agent, index) => {
            const Icon = iconForAgent[agent] || Bot;
            const traceEntry = [...agentTrace].reverse().find((entry) => entry.agent === agent);
            return (
              <div key={agent} className="flex min-w-11 flex-col items-center gap-1">
                <div
                  className={`relative flex size-10 items-center justify-center rounded-full border ${
                    toneForIndex[index % toneForIndex.length]
                  }`}
                  title={traceEntry?.summary || agentLabel(labels, agent)}
                >
                  <Icon className="size-5" />
                  {traceEntry?.status === "Running" ? (
                    <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-indigo-500" />
                  ) : null}
                </div>
                <span className="max-w-14 truncate text-[10px] font-bold text-blue-800">
                  {shortAgentLabel(labels, agent)}
                </span>
              </div>
            );
          })}
          <div className="flex min-w-11 flex-col items-center gap-1">
            <div className="flex size-10 items-center justify-center rounded-full border border-slate-200 bg-white text-indigo-600 shadow-sm">
              <Plus className="size-5" />
            </div>
            <span className="text-[10px] font-bold text-blue-800">
              {memoryCount} {labels.saved}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
