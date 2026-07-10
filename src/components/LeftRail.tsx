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
import type { UIText } from "@/i18n";
import type {
  AccommodationAssumption,
  Assumption,
  AssumptionCritique,
  ConfirmedPreference,
  CostAssumption,
  MissingPreference,
  TransportAssumption
} from "@/types/travel";

type LeftRailProps = {
  assumptions: Assumption[];
  transportAssumptions: TransportAssumption[];
  accommodationAssumptions: AccommodationAssumption[];
  costAssumptions: CostAssumption[];
  missingPreferences: MissingPreference[];
  critiques: AssumptionCritique[];
  missingAnswers: Record<string, string>;
  customPreferences: ConfirmedPreference[];
  customCategory: ConfirmedPreference["category"];
  customValue: string;
  labels: UIText;
  onAssumptionStatusChange: (id: string, status: Assumption["status"]) => void;
  onAssumptionValueChange: (id: string, value: string) => void;
  onMissingAnswerChange: (id: string, value: string) => void;
  onCustomCategoryChange: (category: ConfirmedPreference["category"]) => void;
  onCustomValueChange: (value: string) => void;
  onAddCustomPreference: () => void;
  onRemoveCustomPreference: (id: string) => void;
};

const categoryValues: ConfirmedPreference["category"][] = [
  "budget",
  "pace",
  "food",
  "transport",
  "walkingTolerance",
  "accommodationArea",
  "interests",
  "nightlife",
  "touristyLocalStyle",
  "dates",
  "travelParty",
  "accessibility",
  "other"
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

function categoryLabel(category: ConfirmedPreference["category"], labels: UIText) {
  return labels.categoryLabels[category] || category;
}

function impactRank(impact: "Low" | "Medium" | "High") {
  return impact === "High" ? 3 : impact === "Medium" ? 2 : 1;
}

function statusForAssumption(assumption: Assumption, critique: AssumptionCritique | undefined, labels: UIText) {
  if (assumption.status === "Accepted" || assumption.status === "Edited") {
    return { label: labels.confirmed, className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  }

  if (assumption.status === "Rejected") {
    return { label: labels.missing, className: "border-rose-200 bg-rose-50 text-rose-700" };
  }

  if (critique?.impact === "High") {
    return { label: labels.needsCheck, className: "border-orange-200 bg-orange-50 text-orange-700" };
  }

  return { label: labels.inferred, className: "border-amber-200 bg-amber-50 text-amber-700" };
}

function sourceText(source: Assumption["source"], labels: UIText) {
  return labels.sourceDescriptions[source] || source;
}

function costText(value: number) {
  return `EUR ${Math.round(value)}`;
}

function StructuredAssumptions({
  transportAssumptions,
  accommodationAssumptions,
  costAssumptions,
  labels
}: {
  transportAssumptions: TransportAssumption[];
  accommodationAssumptions: AccommodationAssumption[];
  costAssumptions: CostAssumption[];
  labels: UIText;
}) {
  const hasAny =
    transportAssumptions.length > 0 || accommodationAssumptions.length > 0 || costAssumptions.length > 0;

  return (
    <Panel
      title={labels.structuredAssumptionsTitle}
      eyebrow={labels.structuredAssumptionsEyebrow}
      icon={<Bus className="size-4" />}
    >
      {!hasAny ? (
        <EmptyState title={labels.noStructuredAssumptionsTitle} body={labels.noStructuredAssumptionsBody} />
      ) : (
        <div className="space-y-4">
          {transportAssumptions.length > 0 ? (
            <section>
              <h3 className="text-xs font-black uppercase text-slate-400">{labels.transportAssumptions}</h3>
              <div className="mt-2 space-y-2">
                {transportAssumptions.map((assumption) => (
                  <div key={assumption.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-950">
                          {assumption.from} - {assumption.to}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {labels.mode}: {assumption.mode} · {labels.travelTime}:{" "}
                          {assumption.estimatedTravelTimeMinutes} min
                        </p>
                      </div>
                      <ImpactBadge impact={assumption.travelBurden} labels={labels.impactLabels} />
                    </div>
                    <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">{assumption.rationale}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {accommodationAssumptions.length > 0 ? (
            <section>
              <h3 className="text-xs font-black uppercase text-slate-400">{labels.accommodationAssumptions}</h3>
              <div className="mt-2 space-y-2">
                {accommodationAssumptions.map((assumption) => (
                  <div key={assumption.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-950">
                          {labels.night} {assumption.night}: {assumption.area}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {labels.style}: {assumption.accommodationStyle}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-sky-100 bg-sky-50 px-2 py-1 text-[11px] font-bold text-sky-700">
                        {assumption.changeFromPreviousNight ? labels.changeStay : labels.sameStay}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">{assumption.rationale}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {costAssumptions.length > 0 ? (
            <section>
              <h3 className="text-xs font-black uppercase text-slate-400">{labels.costAssumptions}</h3>
              <div className="mt-2 space-y-2">
                {costAssumptions.map((assumption) => (
                  <div key={assumption.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-950">
                          {labels.costCategoryLabels[assumption.category] || assumption.label}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {labels.perDay}: {costText(assumption.perDayEstimateEur)} · {labels.total}:{" "}
                          {costText(assumption.totalEstimateEur)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-amber-100 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">
                        {labels.roughEstimate}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">{assumption.basis}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </Panel>
  );
}

export function LeftRail({
  assumptions,
  transportAssumptions,
  accommodationAssumptions,
  costAssumptions,
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
  const categories = categoryValues.map((value) => ({ value, label: categoryLabel(value, labels) }));
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
        eyebrow={`${assumptions.length} ${labels.assumptionsNoun} · ${missingPreferences.length} ${labels.missingNoun}`}
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
              const status = statusForAssumption(assumption, critique, labels);
              const Icon = iconByCategory[assumption.category] || Sparkles;

              return (
                <div key={assumption.id} className="grid grid-cols-[32px_minmax(0,1fr)_auto] gap-3 py-3">
                  <div className="flex size-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-indigo-700">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-sm font-bold text-slate-950">
                        {categoryLabel(assumption.category, labels)}
                      </p>
                      <SourceBadge source={assumption.source} labels={labels.sourceLabels} />
                    </div>
                    <input
                      value={assumption.value}
                      onChange={(event) => onAssumptionValueChange(assumption.id, event.target.value)}
                      className="mt-1 h-7 w-full rounded-xl border border-transparent bg-transparent px-0 text-xs font-semibold text-blue-900 outline-none focus:border-indigo-200 focus:bg-white focus:px-2"
                    />
                    <p className="text-[11px] font-medium text-slate-500">
                      {sourceText(assumption.source, labels)} · {Math.round(assumption.confidence * 100)}%{" "}
                      {labels.confidence}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${status.className}`}>
                      {status.label}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-semibold text-slate-400">{labels.impact}</span>
                      <ImpactBadge impact={critique?.impact || "Medium"} labels={labels.impactLabels} />
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => onAssumptionStatusChange(assumption.id, "Accepted")}
                        className="flex size-6 items-center justify-center rounded-[7px] border border-emerald-200 bg-emerald-50 text-emerald-700"
                        title={labels.confirmAssumption}
                      >
                        <Check className="size-3.5" />
                      </button>
                      <button
                        onClick={() => onAssumptionStatusChange(assumption.id, "Rejected")}
                        className="flex size-6 items-center justify-center rounded-[7px] border border-rose-200 bg-rose-50 text-rose-700"
                        title={labels.rejectAssumption}
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
                  <div className="flex size-8 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-950">{categoryLabel(preference.category, labels)}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs font-semibold text-blue-900">{preference.question}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{preference.reason}</p>
                    {preference.options.length > 0 ? (
                      <select
                        value={missingAnswers[preference.id] || ""}
                        onChange={(event) => onMissingAnswerChange(preference.id, event.target.value)}
                        className="mt-2 h-8 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                      >
                        <option value="">{labels.selectPreference}</option>
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
                        placeholder={labels.typePreference}
                        className="mt-2 h-8 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
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
                      {answered ? labels.confirmed : labels.missing}
                    </span>
                    <ImpactBadge impact={preference.impact} labels={labels.impactLabels} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <StructuredAssumptions
        transportAssumptions={transportAssumptions}
        accommodationAssumptions={accommodationAssumptions}
        costAssumptions={costAssumptions}
        labels={labels}
      />

      <Panel
        title={labels.checkpointTitle}
        eyebrow={`${highImpactCritiques.length + unresolvedMissing.filter((item) => item.impact === "High").length} ${labels.highImpact}`}
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
                    className={`rounded-xl border px-3 py-3 text-left text-xs font-bold shadow-sm ${
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
                  placeholder={labels.typeAnswer}
                  className="col-span-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                />
              )}
            </div>
            <p className="mt-3 text-xs font-semibold text-blue-900/65">
              {labels.whyThisMatters}: {labels.impactLabels[checkpointMissing.impact]} {labels.itineraryFitFeasibility}
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
              className="mt-4 h-10 w-full rounded-xl border border-orange-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => onAssumptionStatusChange(checkpointAssumption.id, "Accepted")}
                className="flex h-9 flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 text-sm font-bold text-white"
              >
                <Check className="size-4" />
                {labels.confirmed}
              </button>
              <button
                onClick={() => onAssumptionStatusChange(checkpointAssumption.id, "Rejected")}
                className="flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600"
                title={labels.rejectAssumption}
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        ) : (
          <EmptyState title={labels.noCheckpointTitle} body={labels.noCheckpointBody} />
        )}
      </Panel>

      <Panel title={labels.addPreferenceTitle} eyebrow={labels.userConfirmed} icon={<Settings2 className="size-4" />}>
        <div className="grid gap-2">
          <select
            value={customCategory}
            onChange={(event) => onCustomCategoryChange(event.target.value as ConfirmedPreference["category"])}
            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
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
              placeholder={labels.customPreferencePlaceholder}
              className="h-9 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
            />
            <button
              onClick={onAddCustomPreference}
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white"
              title={labels.addPreference}
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
                <button onClick={() => onRemoveCustomPreference(preference.id)} title={labels.removePreference}>
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
