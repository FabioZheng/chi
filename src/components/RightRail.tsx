"use client";

import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Circle,
  Database,
  HelpCircle,
  Loader2,
  Save,
  Shield,
  ShieldAlert,
  Trash2
} from "lucide-react";
import { EmptyState, ImpactBadge, Panel, SourceBadge } from "@/components/Panel";
import type { AgentTrace, Assumption, AssumptionCritique, ConstraintWarning, Itinerary, UserMemory } from "@/types/travel";

type RightRailProps = {
  prompt: string;
  assumptions: Assumption[];
  critiques: AssumptionCritique[];
  itinerary: Itinerary | null;
  warnings: ConstraintWarning[];
  trace: AgentTrace[];
  memory: UserMemory;
  analyzing: boolean;
  planning: boolean;
  onSaveMemory: () => void;
  onClearMemory: () => void;
  labels: {
    processTitle: string;
    statusTitle: string;
    memoryPanel: string;
    whyTitle: string;
    constraintSummary: string;
  };
};

type StepState = "Done" | "Running" | "Needs User Input" | "Pending" | "Error";

const expectedAgents: AgentTrace["agent"][] = [
  "Preference Agent",
  "Assumption Critic Agent",
  "Planner Agent",
  "Constraint Checker Agent",
  "Memory Agent"
];

function stepIcon(state: StepState) {
  if (state === "Done") {
    return <CheckCircle2 className="size-4 text-emerald-600" />;
  }

  if (state === "Running") {
    return <Loader2 className="size-4 animate-spin text-indigo-600" />;
  }

  if (state === "Needs User Input") {
    return <AlertCircle className="size-4 text-orange-600" />;
  }

  if (state === "Error") {
    return <AlertCircle className="size-4 text-rose-600" />;
  }

  return <Circle className="size-4 text-slate-300" />;
}

function stateClass(state: StepState) {
  if (state === "Done") {
    return "text-emerald-600";
  }

  if (state === "Running") {
    return "text-indigo-600";
  }

  if (state === "Needs User Input") {
    return "text-orange-600";
  }

  if (state === "Error") {
    return "text-rose-600";
  }

  return "text-slate-400";
}

function lastTrace(trace: AgentTrace[], agent: AgentTrace["agent"]) {
  return [...trace].reverse().find((entry) => entry.agent === agent);
}

function statusForAgent(agent: AgentTrace["agent"], trace: AgentTrace[], needsInput: boolean): StepState {
  const entry = lastTrace(trace, agent);

  if (entry?.status === "Error") {
    return "Error";
  }

  if (entry?.status === "Running") {
    return "Running";
  }

  if (needsInput && (agent === "Planner Agent" || agent === "Constraint Checker Agent")) {
    return agent === "Planner Agent" ? "Pending" : "Pending";
  }

  if (entry?.status === "Complete") {
    return "Done";
  }

  return "Pending";
}

export function RightRail({
  prompt,
  assumptions,
  critiques,
  itinerary,
  warnings,
  trace,
  memory,
  analyzing,
  planning,
  onSaveMemory,
  onClearMemory,
  labels
}: RightRailProps) {
  const highImpactCount = critiques.filter((critique) => critique.impact === "High").length;
  const pendingHighImpact = critiques.filter((critique) => {
    if (critique.impact !== "High") {
      return false;
    }

    const linked = assumptions.find((assumption) => assumption.id === critique.assumptionId);
    return !linked || linked.status === "Pending";
  }).length;
  const acceptedCount = assumptions.filter((assumption) => assumption.status === "Accepted" || assumption.status === "Edited").length;
  const inferredCount = assumptions.filter((assumption) => assumption.status === "Pending").length;
  const missingCount = assumptions.filter((assumption) => assumption.status === "Rejected").length;
  const memoryCount = assumptions.filter((assumption) => assumption.source === "Memory").length;
  const needsInput = assumptions.length > 0 && !itinerary && pendingHighImpact > 0;

  const steps = expectedAgents.map((agent, index) => {
    const entry = lastTrace(trace, agent);
    const state = statusForAgent(agent, trace, needsInput);
    const summary =
      entry?.summary ||
      (agent === "Preference Agent"
        ? prompt.trim()
          ? "Ready to infer likely preferences."
          : "Waiting for a short prompt."
        : agent === "Assumption Critic Agent"
          ? "Waiting for assumption data."
          : agent === "Planner Agent"
            ? "Waiting for confirmed preferences."
            : agent === "Constraint Checker Agent"
              ? "Waiting for itinerary output."
              : "Ready to save confirmed preferences.");

    return {
      agent,
      index: index + 1,
      state: agent === "Planner Agent" && needsInput ? "Needs User Input" as StepState : state,
      summary
    };
  });

  return (
    <aside className="space-y-3">
      <Panel title={labels.processTitle} eyebrow="Backend agent states" icon={<Bot className="size-4" />}>
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div
              key={step.agent}
              className={`relative rounded-[8px] border p-3 ${
                step.state === "Needs User Input"
                  ? "border-orange-300 bg-orange-50"
                  : step.state === "Running"
                    ? "border-indigo-200 bg-indigo-50"
                    : "border-transparent bg-transparent"
              }`}
            >
              <div className="grid grid-cols-[32px_minmax(0,1fr)_24px] gap-3">
                <div className="relative flex justify-center">
                  <div
                    className={`flex size-8 items-center justify-center rounded-full text-sm font-black text-white ${
                      step.state === "Done"
                        ? "bg-emerald-500"
                        : step.state === "Needs User Input"
                          ? "bg-orange-500"
                          : step.state === "Running"
                            ? "bg-indigo-500"
                            : step.state === "Error"
                              ? "bg-rose-500"
                              : "bg-slate-400"
                    }`}
                  >
                    {step.index}
                  </div>
                  {index < steps.length - 1 ? <div className="absolute top-9 h-8 border-l border-slate-200" /> : null}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-950">{step.agent}</p>
                  <p className={`mt-1 text-xs font-bold ${stateClass(step.state)}`}>{step.state}</p>
                  <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">{step.summary}</p>
                </div>
                <div className="pt-1">{stepIcon(step.state)}</div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title={labels.statusTitle} eyebrow="Live legend" icon={<ShieldAlert className="size-4" />}>
        <div className="space-y-2">
          {[
            { label: "Confirmed", count: acceptedCount, color: "bg-emerald-500", text: "text-emerald-700" },
            { label: "Inferred", count: inferredCount, color: "bg-amber-500", text: "text-amber-700" },
            { label: "Needs Check", count: pendingHighImpact, color: "bg-orange-500", text: "text-orange-700" },
            { label: "Missing", count: missingCount, color: "bg-rose-500", text: "text-rose-700" }
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-[8px] bg-slate-50 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={`size-2.5 rounded-full ${item.color}`} />
                <span className={`text-xs font-black ${item.text}`}>{item.label}</span>
              </div>
              <span className="text-xs font-black text-slate-600">{item.count}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title={labels.memoryPanel}
        eyebrow={`${memory.preferences.length} saved · ${memoryCount} applied`}
        icon={<Database className="size-4" />}
        actions={
          <div className="flex gap-1">
            <button
              onClick={onSaveMemory}
              className="flex size-8 items-center justify-center rounded-[8px] border border-emerald-200 bg-emerald-50 text-emerald-700"
              title="Save preferences"
            >
              <Save className="size-4" />
            </button>
            <button
              onClick={onClearMemory}
              className="flex size-8 items-center justify-center rounded-[8px] border border-slate-200 bg-white text-slate-500"
              title="Clear memory"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        }
      >
        {memory.preferences.length === 0 ? (
          <EmptyState title="No saved preferences" body="Confirmed values can be stored locally for future prompts." />
        ) : (
          <div className="space-y-2">
            {memory.preferences.map((preference) => (
              <div key={preference.id} className="rounded-[8px] border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-950">{preference.label}</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{preference.value}</p>
                  </div>
                  <SourceBadge source="Memory" />
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title={labels.whyTitle} eyebrow="Explanation cards" icon={<HelpCircle className="size-4" />}>
        <div className="space-y-3">
          <div className="rounded-[8px] border border-violet-100 bg-violet-50 p-3">
            <div className="flex gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-violet-600 text-white">
                <Shield className="size-5" />
              </div>
              <div>
                <p className="text-sm font-black text-violet-900">Why assumptions matter</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-violet-800">
                  Visible assumptions improve plan quality and allow agents to coordinate on what matters most.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[8px] border border-orange-100 bg-orange-50 p-3">
            <p className="text-sm font-black text-orange-900">What happens next?</p>
            <div className="mt-2 space-y-2">
              {[
                "Confirmed preferences are passed to the Planner Agent.",
                "Alternatives may change when assumptions change.",
                "The Constraint Checker reviews feasibility after planning."
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 text-xs font-semibold leading-5 text-orange-900/80">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {critiques.length > 0 ? (
            <div className="space-y-2">
              {critiques.slice(0, 3).map((critique) => (
                <div key={critique.id} className="rounded-[8px] border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-black text-slate-950">{critique.issue}</p>
                    <ImpactBadge impact={critique.impact} />
                  </div>
                  <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{critique.suggestedResolution}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </Panel>

      <Panel title={labels.constraintSummary} eyebrow={`${warnings.length} warnings`} icon={<AlertCircle className="size-4" />}>
        {warnings.length === 0 ? (
          <EmptyState title="No feasibility output yet" body="Warnings appear after the Constraint Checker runs." />
        ) : (
          <div className="space-y-2">
            {warnings.slice(0, 4).map((warning) => (
              <div key={warning.id} className="rounded-[8px] border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-black text-slate-950">{warning.message}</p>
                  <ImpactBadge impact={warning.impact} />
                </div>
                <p className="mt-1 text-xs font-semibold text-slate-500">{warning.recommendation}</p>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </aside>
  );
}
