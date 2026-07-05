"use client";

import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Circle,
  Database,
  HelpCircle,
  Loader2,
  RotateCcw,
  Save,
  Shield,
  ShieldAlert
} from "lucide-react";
import { EmptyState, ImpactBadge, Panel, SourceBadge } from "@/components/Panel";
import type { UIText } from "@/i18n";
import type {
  AgentTrace,
  Assumption,
  AssumptionCritique,
  ConstraintWarning,
  Itinerary,
  MemoryStatus,
  UserMemory
} from "@/types/travel";

type RightRailProps = {
  prompt: string;
  assumptions: Assumption[];
  critiques: AssumptionCritique[];
  itinerary: Itinerary | null;
  warnings: ConstraintWarning[];
  trace: AgentTrace[];
  memory: UserMemory;
  memoryStatus: MemoryStatus | null;
  analyzing: boolean;
  planning: boolean;
  onSaveMemory: () => void;
  onClearMemory: () => void;
  labels: UIText;
};

type StepState = "Done" | "Running" | "Needs User Input" | "Pending" | "Error";

const expectedAgents: AgentTrace["agent"][] = [
  "Conflict Detector Agent",
  "Preference Probe Agent",
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

function agentLabel(labels: UIText, agent: AgentTrace["agent"]) {
  return (labels.agentLabels as Partial<Record<AgentTrace["agent"], string>>)[agent] || agent;
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
    return "Pending";
  }

  if (entry?.status === "Complete") {
    return "Done";
  }

  return "Pending";
}

function fallbackSummary(agent: AgentTrace["agent"], prompt: string, labels: UIText) {
  if (agent === "Conflict Detector Agent") {
    return prompt.trim() ? labels.readyInferPreferences : labels.waitingPrompt;
  }

  if (agent === "Preference Probe Agent") {
    return labels.waitingConfirmedPreferences;
  }

  if (agent === "Preference Agent") {
    return prompt.trim() ? labels.readyInferPreferences : labels.waitingPrompt;
  }

  if (agent === "Assumption Critic Agent") {
    return labels.waitingAssumptionData;
  }

  if (agent === "Planner Agent") {
    return labels.waitingConfirmedPreferences;
  }

  if (agent === "Constraint Checker Agent") {
    return labels.waitingItineraryOutput;
  }

  return labels.readySaveMemory;
}

export function RightRail({
  prompt,
  assumptions,
  critiques,
  itinerary,
  warnings,
  trace,
  memory,
  memoryStatus,
  analyzing,
  planning,
  onSaveMemory,
  onClearMemory,
  labels
}: RightRailProps) {
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
    const summary = entry?.summary || fallbackSummary(agent, prompt, labels);

    return {
      agent,
      index: index + 1,
      state: agent === "Planner Agent" && needsInput ? ("Needs User Input" as StepState) : state,
      summary
    };
  });

  return (
    <aside className="space-y-3">
      <Panel title={labels.processTitle} eyebrow={labels.backendAgentStates} icon={<Bot className="size-4" />}>
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
                  <p className="text-sm font-black text-slate-950">{agentLabel(labels, step.agent)}</p>
                  <p className={`mt-1 text-xs font-bold ${stateClass(step.state)}`}>
                    {labels.stepStateLabels[step.state]}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">{step.summary}</p>
                </div>
                <div className="pt-1">{stepIcon(step.state)}</div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title={labels.statusTitle} eyebrow={labels.liveLegend} icon={<ShieldAlert className="size-4" />}>
        <div className="space-y-2">
          {[
            { label: labels.confirmed, count: acceptedCount, color: "bg-emerald-500", text: "text-emerald-700" },
            { label: labels.inferred, count: inferredCount, color: "bg-amber-500", text: "text-amber-700" },
            { label: labels.needsCheck, count: pendingHighImpact, color: "bg-orange-500", text: "text-orange-700" },
            { label: labels.missing, count: missingCount, color: "bg-rose-500", text: "text-rose-700" }
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
        eyebrow={`${memory.preferences.length} ${labels.memoryCountLabel} · ${memoryCount} ${labels.memoryAppliedLabel}`}
        icon={<Database className="size-4" />}
        actions={
          <div className="flex gap-1">
            <button
              onClick={onSaveMemory}
              className="flex size-8 items-center justify-center rounded-[8px] border border-emerald-200 bg-emerald-50 text-emerald-700"
              title={labels.savePreferences}
            >
              <Save className="size-4" />
            </button>
            <button
              onClick={onClearMemory}
              className="flex h-8 items-center justify-center gap-1 rounded-[8px] border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600"
              title={labels.resetMemory}
            >
              <RotateCcw className="size-3.5" />
              {labels.resetMemory}
            </button>
          </div>
        }
      >
        <div className="mb-3 rounded-[8px] border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-black uppercase text-slate-400">{labels.memoryStatusTitle}</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
                {memoryStatus?.message || (memory.preferences.length > 0 ? labels.memoryNotUsed : labels.memoryEmpty)}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-bold ${
                memoryStatus?.used
                  ? "border-sky-200 bg-sky-50 text-sky-700"
                  : "border-slate-200 bg-white text-slate-500"
              }`}
            >
              {memoryStatus?.used ? labels.basedOnMemory : labels.freshRequest}
            </span>
          </div>
        </div>

        {memory.preferences.length === 0 ? (
          <EmptyState title={labels.noSavedPreferences} body={labels.noSavedPreferencesBody} />
        ) : (
          <div className="space-y-2">
            {memory.preferences.map((preference) => (
              <div key={preference.id} className="rounded-[8px] border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-950">
                      {labels.categoryLabels[preference.category] || preference.label}
                    </p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{preference.value}</p>
                  </div>
                  <SourceBadge source="Memory" labels={labels.sourceLabels} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title={labels.whyTitle} eyebrow={labels.explanationCards} icon={<HelpCircle className="size-4" />}>
        <div className="space-y-3">
          <div className="rounded-[8px] border border-violet-100 bg-violet-50 p-3">
            <div className="flex gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-violet-600 text-white">
                <Shield className="size-5" />
              </div>
              <div>
                <p className="text-sm font-black text-violet-900">{labels.whyAssumptionsMatterTitle}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-violet-800">
                  {labels.whyAssumptionsMatterBody}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[8px] border border-orange-100 bg-orange-50 p-3">
            <p className="text-sm font-black text-orange-900">{labels.whatNextTitle}</p>
            <div className="mt-2 space-y-2">
              {labels.whatNextItems.map((item) => (
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
                    <ImpactBadge impact={critique.impact} labels={labels.impactLabels} />
                  </div>
                  <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{critique.suggestedResolution}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </Panel>

      <Panel title={labels.constraintSummary} eyebrow={`${warnings.length} ${labels.warnings}`} icon={<AlertCircle className="size-4" />}>
        {warnings.length === 0 ? (
          <EmptyState title={labels.noFeasibilityTitle} body={labels.noFeasibilityBody} />
        ) : (
          <div className="space-y-2">
            {warnings.slice(0, 4).map((warning) => (
              <div key={warning.id} className="rounded-[8px] border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-black text-slate-950">{warning.message}</p>
                  <ImpactBadge impact={warning.impact} labels={labels.impactLabels} />
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
