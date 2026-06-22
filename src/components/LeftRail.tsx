"use client";

import {
  AlertTriangle,
  BadgeHelp,
  Bed,
  Bus,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  Footprints,
  Gauge,
  Moon,
  Pencil,
  Plus,
  Settings2,
  Sparkles,
  Utensils,
  X
} from "lucide-react";
import { EmptyState, ImpactBadge, Panel, SourceBadge } from "@/components/Panel";
import type { Assumption, AssumptionCritique, ConfirmedPreference, MissingPreference } from "@/types/travel";

type LeftRailProps = {
  assumptions: Assumption[];
  missingPreferences: MissingPreference[];
  critiques: AssumptionCritique[];
  missingAnswers: Record<string, string>;
  customPreferences: ConfirmedPreference[];
  customCategory: ConfirmedPreference["category"];
  customValue: string;
  labels: {
    inferredPanel: string;
    noAssumptionsTitle: string;
    noAssumptionsBody: string;
    editAll: string;
    checkpointTitle: string;
    addPreferenceTitle: string;
  };
  onAssumptionStatusChange: (id: string, status: Assumption["status"]) => void;
  onAssumptionValueChange: (id: string, value: string) => void;
  onMissingAnswerChange: (id: string, value: string) => void;
  onCustomCategoryChange: (category: ConfirmedPreference["category"]) => void;
  onCustomValueChange: (value: string) => void;
  onAddCustomPreference: () => void;
  onRemoveCustomPreference: (id: string) => void;
};

const categories: Array<{ value: ConfirmedPreference["category"]; label: string }> = [
  { value: "budget", label: "Budget" },
  { value: "pace", label: "Pace" },
  { value: "food", label: "Food" },
  { value: "transport", label: "Transport" },
  { value: "walkingTolerance", label: "Walking tolerance" },
  { value: "accommodationArea", label: "Accommodation area" },
  { value: "interests", label: "Interests" },
  { value: "nightlife", label: "Nightlife" },
  { value: "touristyLocalStyle", label: "Touristy/local style" },
  { value: "dates", label: "Dates" },
  { value: "travelParty", label: "Travel party" },
  { value: "accessibility", label: "Accessibility" },
  { value: "other", label: "Other" }
];

const iconByCategory: Partial<Record<ConfirmedPreference["category"], typeof Sparkles>> = {
  budget: CircleDollarSign,
  pace: Gauge,
  food: Utensils,
  transport: Bus,
  walkingTolerance: Footprints,
  accommodationArea: Bed,
  nightlife: Moon,
  interests: Sparkles,
  touristyLocalStyle: BadgeHelp
};

function categoryLabel(category: ConfirmedPreference["category"]) {
  return categories.find((item) => item.value === category)?.label || category;
}

function impactRank(impact: "Low" | "Medium" | "High") {
  return impact === "High" ? 3 : impact === "Medium" ? 2 : 1;
}

function statusForAssumption(assumption: Assumption, critique?: AssumptionCritique) {
  if (assumption.status === "Accepted" || assumption.status === "Edited") {
    return { label: "Confirmed", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  }

  if (assumption.status === "Rejected") {
    return { label: "Missing", className: "border-rose-200 bg-rose-50 text-rose-700" };
  }

  if (critique?.impact === "High") {
    return { label: "Needs Check", className: "border-orange-200 bg-orange-50 text-orange-700" };
  }

  return { label: "Inferred", className: "border-amber-200 bg-amber-50 text-amber-700" };
}

function sourceText(source: Assumption["source"]) {
  if (source === "User") {
    return "user prompt or edit";
  }

  if (source === "Memory") {
    return "saved memory";
  }

  return "backend inference";
}

export function LeftRail({
  assumptions,
  missingPreferences,
  critiques,
  missingAnswers,
  customPreferences,
  customCategory,
  customValue,
  labels,
  onAssumptionStatusChange,
  onAssumptionValueChange,
  onMissingAnswerChange,
  onCustomCategoryChange,
  onCustomValueChange,
  onAddCustomPreference,
  onRemoveCustomPreference
}: LeftRailProps) {
  const critiqueByAssumption = new Map(critiques.map((critique) => [critique.assumptionId, critique]));
  const unresolvedMissing = missingPreferences.filter((preference) => !missingAnswers[preference.id]?.trim());
  const pendingAssumptions = assumptions.filter((assumption) => assumption.status === "Pending");
  const highImpactCritiques = critiques.filter((critique) => critique.impact === "High");

  const checkpointMissing = [...unresolvedMissing].sort((a, b) => impactRank(b.impact) - impactRank(a.impact))[0];
  const checkpointCritique = [...highImpactCritiques].find((critique) => {
    const linked = assumptions.find((assumption) => assumption.id === critique.assumptionId);
    return linked ? linked.status === "Pending" : true;
  });
  const checkpointAssumption = checkpointCritique
    ? assumptions.find((assumption) => assumption.id === checkpointCritique.assumptionId)
    : pendingAssumptions[0];

  return (
    <aside className="space-y-3">
      <Panel
        title={labels.inferredPanel}
        eyebrow={`${assumptions.length} assumptions · ${missingPreferences.length} missing`}
        icon={<ClipboardCheck className="size-4" />}
        actions={
          <button className="flex items-center gap-1 text-xs font-bold text-indigo-600">
            <Pencil className="size-3.5" />
            {labels.editAll}
          </button>
        }
      >
        {assumptions.length === 0 && missingPreferences.length === 0 ? (
          <EmptyState title={labels.noAssumptionsTitle} body={labels.noAssumptionsBody} />
        ) : (
          <div className="divide-y divide-slate-100">
            {assumptions.map((assumption) => {
              const critique = critiqueByAssumption.get(assumption.id) || critiques.find((item) => item.category === assumption.category);
              const status = statusForAssumption(assumption, critique);
              const Icon = iconByCategory[assumption.category] || Sparkles;

              return (
                <div key={assumption.id} className="grid grid-cols-[32px_minmax(0,1fr)_auto] gap-3 py-3">
                  <div className="flex size-8 items-center justify-center rounded-[8px] border border-slate-200 bg-slate-50 text-indigo-700">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-sm font-bold text-slate-950">{assumption.label}</p>
                      <SourceBadge source={assumption.source} />
                    </div>
                    <input
                      value={assumption.value}
                      onChange={(event) => onAssumptionValueChange(assumption.id, event.target.value)}
                      className="mt-1 h-7 w-full rounded-[8px] border border-transparent bg-transparent px-0 text-xs font-semibold text-blue-900 outline-none focus:border-indigo-200 focus:bg-white focus:px-2"
                    />
                    <p className="text-[11px] font-medium text-slate-500">
                      {sourceText(assumption.source)} · {Math.round(assumption.confidence * 100)}% confidence
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${status.className}`}>
                      {status.label}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-semibold text-slate-400">Impact</span>
                      <ImpactBadge impact={critique?.impact || "Medium"} />
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => onAssumptionStatusChange(assumption.id, "Accepted")}
                        className="flex size-6 items-center justify-center rounded-[7px] border border-emerald-200 bg-emerald-50 text-emerald-700"
                        title="Confirm assumption"
                      >
                        <Check className="size-3.5" />
                      </button>
                      <button
                        onClick={() => onAssumptionStatusChange(assumption.id, "Rejected")}
                        className="flex size-6 items-center justify-center rounded-[7px] border border-rose-200 bg-rose-50 text-rose-700"
                        title="Reject assumption"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {missingPreferences.map((preference) => {
              const Icon = iconByCategory[preference.category] || AlertTriangle;
              const answered = Boolean(missingAnswers[preference.id]?.trim());

              return (
                <div key={preference.id} className="grid grid-cols-[32px_minmax(0,1fr)_auto] gap-3 py-3">
                  <div className="flex size-8 items-center justify-center rounded-[8px] border border-rose-100 bg-rose-50 text-rose-600">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-950">{categoryLabel(preference.category)}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs font-semibold text-blue-900">{preference.question}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{preference.reason}</p>
                    {preference.options.length > 0 ? (
                      <select
                        value={missingAnswers[preference.id] || ""}
                        onChange={(event) => onMissingAnswerChange(preference.id, event.target.value)}
                        className="mt-2 h-8 w-full rounded-[8px] border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                      >
                        <option value="">Select preference</option>
                        {preference.options.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={missingAnswers[preference.id] || ""}
                        onChange={(event) => onMissingAnswerChange(preference.id, event.target.value)}
                        placeholder="Type your preference"
                        className="mt-2 h-8 w-full rounded-[8px] border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                      />
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`rounded-full border px-2 py-1 text-[11px] font-bold ${
                        answered
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-rose-200 bg-rose-50 text-rose-700"
                      }`}
                    >
                      {answered ? "Confirmed" : "Missing"}
                    </span>
                    <ImpactBadge impact={preference.impact} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel
        title={labels.checkpointTitle}
        eyebrow={`${highImpactCritiques.length + unresolvedMissing.filter((item) => item.impact === "High").length} high impact`}
        icon={<AlertTriangle className="size-4" />}
        className="bg-gradient-to-br from-white via-white to-rose-50/70"
      >
        {checkpointMissing ? (
          <div>
            <p className="text-base font-bold text-rose-600">{checkpointMissing.question}</p>
            <p className="mt-2 text-sm leading-6 text-blue-900/75">{checkpointMissing.reason}</p>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
              {checkpointMissing.options.length > 0 ? (
                checkpointMissing.options.slice(0, 3).map((option) => (
                  <button
                    key={option}
                    onClick={() => onMissingAnswerChange(checkpointMissing.id, option)}
                    className={`rounded-[8px] border px-3 py-3 text-left text-xs font-bold shadow-sm ${
                      missingAnswers[checkpointMissing.id] === option
                        ? "border-violet-300 bg-violet-50 text-violet-700"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {option}
                  </button>
                ))
              ) : (
                <input
                  value={missingAnswers[checkpointMissing.id] || ""}
                  onChange={(event) => onMissingAnswerChange(checkpointMissing.id, event.target.value)}
                  placeholder="Type your answer"
                  className="col-span-full h-10 rounded-[8px] border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                />
              )}
            </div>
            <p className="mt-3 text-xs font-semibold text-blue-900/65">
              Why this matters: {checkpointMissing.impact} impact on itinerary fit and feasibility.
            </p>
          </div>
        ) : checkpointAssumption ? (
          <div>
            <p className="text-base font-bold text-orange-600">{checkpointCritique?.issue || checkpointAssumption.label}</p>
            <p className="mt-2 text-sm leading-6 text-blue-900/75">
              {checkpointCritique?.whyItMatters || checkpointAssumption.rationale}
            </p>
            <input
              value={checkpointAssumption.value}
              onChange={(event) => onAssumptionValueChange(checkpointAssumption.id, event.target.value)}
              className="mt-4 h-10 w-full rounded-[8px] border border-orange-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => onAssumptionStatusChange(checkpointAssumption.id, "Accepted")}
                className="flex h-9 flex-1 items-center justify-center gap-2 rounded-[8px] bg-violet-600 text-sm font-bold text-white"
              >
                <Check className="size-4" />
                Confirm
              </button>
              <button
                onClick={() => onAssumptionStatusChange(checkpointAssumption.id, "Rejected")}
                className="flex h-9 items-center justify-center rounded-[8px] border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        ) : (
          <EmptyState title="No unresolved high-impact checkpoint" body="Risky assumptions will appear here after analysis." />
        )}
      </Panel>

      <Panel title={labels.addPreferenceTitle} eyebrow="User-confirmed" icon={<Settings2 className="size-4" />}>
        <div className="grid gap-2">
          <select
            value={customCategory}
            onChange={(event) => onCustomCategoryChange(event.target.value as ConfirmedPreference["category"])}
            className="h-9 rounded-[8px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
          >
            {categories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              value={customValue}
              onChange={(event) => onCustomValueChange(event.target.value)}
              placeholder="e.g. avoid crowded lunch spots"
              className="h-9 min-w-0 flex-1 rounded-[8px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
            />
            <button
              onClick={onAddCustomPreference}
              className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-indigo-600 text-white"
              title="Add preference"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>

        {customPreferences.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {customPreferences.map((preference) => (
              <span
                key={preference.id}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-indigo-100 bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-700"
              >
                <span className="truncate">{preference.value}</span>
                <button onClick={() => onRemoveCustomPreference(preference.id)} title="Remove preference">
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </Panel>
    </aside>
  );
}
