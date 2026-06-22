"use client";

import {
  AlertTriangle,
  CalendarDays,
  Clock3,
  Euro,
  Footprints,
  MapPin,
  Route,
  ShieldCheck,
  Sparkles,
  Star,
  Tickets,
  Timer
} from "lucide-react";
import { EmptyState, ImpactBadge, Panel } from "@/components/Panel";
import type { Activity, Assumption, ConstraintWarning, Itinerary, ItineraryDay, ItineraryOption } from "@/types/travel";

type ItineraryCanvasProps = {
  itinerary: Itinerary | null;
  warnings: ConstraintWarning[];
  assumptions: Assumption[];
  selectedOptionId: string | null;
  onSelectOption: (id: string) => void;
  planning: boolean;
  labels: {
    dynamicCanvas: string;
    plannerOutput: string;
    planningCanvas: string;
    constraintWarnings: string;
    noWarningsTitle: string;
    noWarningsBody: string;
  };
};

const warningLabels: Record<ConstraintWarning["type"], string> = {
  walkingLoad: "Walking load",
  travelTime: "Travel time",
  budgetMismatch: "Budget mismatch",
  bookingRisk: "Booking risk",
  openingHoursRisk: "Opening-hour risk",
  pacingIssue: "Pacing issue"
};

function activityTone(index: number) {
  const tones = [
    "from-blue-100 to-indigo-100 text-blue-800",
    "from-orange-100 to-amber-100 text-orange-800",
    "from-emerald-100 to-teal-100 text-emerald-800",
    "from-rose-100 to-pink-100 text-rose-800",
    "from-violet-100 to-fuchsia-100 text-violet-800"
  ];

  return tones[index % tones.length];
}

function influenceTone(status: Assumption["status"]) {
  if (status === "Accepted" || status === "Edited") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "Rejected") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-orange-200 bg-orange-50 text-orange-700";
}

function linkedAssumptions(activity: Activity, assumptions: Assumption[]) {
  const haystack = `${activity.title} ${activity.description} ${activity.preferenceFit}`.toLowerCase();
  return assumptions
    .filter((assumption) => {
      const label = assumption.label.toLowerCase();
      const category = assumption.category.toLowerCase();
      const value = assumption.value.toLowerCase();
      return haystack.includes(label) || haystack.includes(category) || value.split(/[,\s]+/).some((part) => part.length > 4 && haystack.includes(part));
    })
    .slice(0, 2);
}

function EmptyCanvas({
  planning,
  labels
}: {
  planning: boolean;
  labels: ItineraryCanvasProps["labels"];
}) {
  return (
    <Panel title={labels.dynamicCanvas} eyebrow={labels.plannerOutput} icon={<Route className="size-4" />} className="min-h-[650px]">
      <div className="canvas-grid relative min-h-[570px] overflow-hidden rounded-[8px] border border-slate-200 bg-white/78 p-6">
        <div className="mx-auto mt-4 max-w-2xl rounded-[8px] border border-slate-200 bg-white p-6 text-center shadow-[0_20px_60px_rgba(26,35,67,0.1)]">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-orange-100 text-indigo-600">
            <Sparkles className="size-8" />
          </div>
          <h3 className="mt-4 text-2xl font-bold text-slate-950">
            {planning ? "Planner Agent is building itinerary options" : "Analyze and confirm assumptions first"}
          </h3>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">
            The canvas will render whatever structured itinerary JSON the backend returns, including any number of days,
            activities, alternatives, and feasibility warnings.
          </p>
        </div>

        <div className="pointer-events-none absolute left-[10%] right-[10%] top-[285px] hidden border-t border-dashed border-blue-300 md:block" />
        <div className="mt-20 grid gap-4 md:grid-cols-3">
          {["Assumptions", "Checkpoint", "Itinerary"].map((label, index) => (
            <div key={label} className="rounded-[8px] border border-dashed border-slate-300 bg-white/76 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                {index === 1 ? <ShieldCheck className="size-4 text-orange-500" /> : <CalendarDays className="size-4 text-blue-500" />}
                {label}
              </div>
              <div className="mt-3 space-y-2">
                <div className="h-3 rounded-full bg-slate-100" />
                <div className="h-3 w-4/5 rounded-full bg-slate-100" />
                <div className="h-3 w-3/5 rounded-full bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function ActivityRow({ activity, index, assumptions }: { activity: Activity; index: number; assumptions: Assumption[] }) {
  const links = linkedAssumptions(activity, assumptions);

  return (
    <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 rounded-[8px] border border-slate-100 bg-white p-2 shadow-sm">
      <div
        className={`flex size-11 items-center justify-center rounded-[8px] bg-gradient-to-br text-sm font-black ${activityTone(
          index
        )}`}
        title={activity.imageHint}
      >
        {activity.title.slice(0, 1)}
      </div>
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-950">{activity.title}</p>
            <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] font-semibold text-blue-900/65">
              <MapPin className="size-3 shrink-0" />
              {activity.location}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-800">
            {activity.time}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{activity.description}</p>
        <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-4 text-indigo-700">{activity.preferenceFit}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-600">
            <Euro className="size-3" />
            {activity.estimatedCostEur}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-600">
            <Footprints className="size-3" />
            {activity.walkingKm.toFixed(1)} km
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-600">
            <Timer className="size-3" />
            {activity.travelTimeMinutes} min
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-600">
            <Tickets className="size-3" />
            {activity.bookingRisk}
          </span>
          {links.map((assumption) => (
            <span
              key={assumption.id}
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${influenceTone(
                assumption.status
              )}`}
            >
              {assumption.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function DayCard({ day, assumptions }: { day: ItineraryDay; assumptions: Assumption[] }) {
  return (
    <article className="min-w-[286px] rounded-[8px] border border-blue-200 bg-white p-3 shadow-[0_20px_48px_rgba(26,35,67,0.1)]">
      <div className="rounded-[8px] border border-blue-100 bg-gradient-to-br from-white to-blue-50 px-3 py-3 text-center">
        <div className="mx-auto flex size-8 items-center justify-center rounded-[8px] bg-white text-blue-700 shadow-sm">
          <CalendarDays className="size-4" />
        </div>
        <h3 className="mt-2 text-lg font-black text-slate-950">Day {day.dayNumber}</h3>
        <p className="truncate text-xs font-bold text-blue-800">{day.title}</p>
      </div>

      <p className="mt-3 text-xs font-semibold leading-5 text-slate-600">{day.theme}</p>

      <div className="mt-3 space-y-2">
        {day.activities.map((activity, index) => (
          <ActivityRow key={activity.id} activity={activity} index={index} assumptions={assumptions} />
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-[8px] bg-slate-50 p-2 text-center">
          <p className="text-[10px] font-bold uppercase text-slate-400">Walk</p>
          <p className="text-xs font-black text-slate-800">{day.totalWalkingKm.toFixed(1)} km</p>
        </div>
        <div className="rounded-[8px] bg-slate-50 p-2 text-center">
          <p className="text-[10px] font-bold uppercase text-slate-400">Travel</p>
          <p className="text-xs font-black text-slate-800">{day.totalTravelTimeMinutes}m</p>
        </div>
        <div className="rounded-[8px] bg-slate-50 p-2 text-center">
          <p className="text-[10px] font-bold uppercase text-slate-400">Cost</p>
          <p className="text-xs font-black text-slate-800">EUR {day.estimatedCostEur}</p>
        </div>
      </div>

      <div className="mt-3 rounded-[8px] border border-violet-100 bg-violet-50/70 p-3">
        <p className="text-xs font-bold text-violet-800">Pacing note</p>
        <p className="mt-1 text-xs leading-5 text-violet-700">{day.pacingNote}</p>
      </div>
    </article>
  );
}

function OptionHeader({
  itinerary,
  selectedOption,
  onSelectOption
}: {
  itinerary: Itinerary;
  selectedOption: ItineraryOption;
  onSelectOption: (id: string) => void;
}) {
  return (
    <div className="relative rounded-[8px] border border-slate-200 bg-white p-4 shadow-[0_18px_50px_rgba(26,35,67,0.09)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-gradient-to-br from-orange-100 via-blue-100 to-violet-100 text-4xl font-black text-indigo-700 shadow-inner">
            {itinerary.destination.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-3xl font-black text-slate-950">{itinerary.destination}</h2>
              <span className="rounded-full bg-violet-50 px-3 py-1 text-[11px] font-bold text-violet-700">
                {itinerary.durationDays} day plan
              </span>
            </div>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-blue-900/65">{itinerary.summary}</p>
          </div>
        </div>
        <div className="grid min-w-[190px] grid-cols-2 gap-2 rounded-[8px] border border-slate-100 bg-slate-50 p-2">
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400">Selected</p>
            <p className="truncate text-sm font-black text-slate-800">{selectedOption.title}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400">Estimate</p>
            <p className="text-sm font-black text-slate-800">
              {itinerary.currency} {selectedOption.estimatedTotalCostEur}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 lg:grid-cols-2">
        {itinerary.options.map((option, index) => (
          <button
            key={option.id}
            onClick={() => onSelectOption(option.id)}
            className={`rounded-[8px] border px-3 py-3 text-left transition ${
              option.id === selectedOption.id
                ? "border-orange-300 bg-orange-50 text-orange-900 shadow-sm"
                : "border-slate-200 bg-white text-slate-700 hover:border-violet-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-white text-sm font-black shadow-sm">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-black">{option.title}</p>
                <p className="line-clamp-2 text-xs font-semibold leading-5 opacity-75">{option.fitSummary}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function InfluenceLayer({ assumptions }: { assumptions: Assumption[] }) {
  if (assumptions.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
      {assumptions.map((assumption) => (
        <span
          key={assumption.id}
          className={`inline-flex items-center gap-1 rounded-[8px] border px-3 py-2 text-xs font-black ${influenceTone(
            assumption.status
          )}`}
        >
          <span>{assumption.label}</span>
          <span className="font-semibold opacity-70">{Math.round(assumption.confidence * 100)}%</span>
        </span>
      ))}
    </div>
  );
}

function ConstraintWarnings({
  warnings,
  labels
}: {
  warnings: ConstraintWarning[];
  labels: ItineraryCanvasProps["labels"];
}) {
  return (
    <Panel title={labels.constraintWarnings} eyebrow={`${warnings.length} flagged`} icon={<AlertTriangle className="size-4" />}>
      {warnings.length === 0 ? (
        <EmptyState title={labels.noWarningsTitle} body={labels.noWarningsBody} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {warnings.map((warning) => (
            <div key={warning.id} className="rounded-[8px] border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-950">{warningLabels[warning.type]}</p>
                  <p className="mt-1 text-xs font-bold text-slate-400">
                    {warning.affectedDay ? `Day ${warning.affectedDay}` : "Whole plan"}
                  </p>
                </div>
                <ImpactBadge impact={warning.impact} />
              </div>
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">{warning.message}</p>
              <div className="mt-3 rounded-[8px] bg-slate-50 p-2">
                <p className="text-[10px] font-black uppercase text-slate-400">Recommendation</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-700">{warning.recommendation}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function RecommendationPanels({ selectedOption, warnings }: { selectedOption: ItineraryOption; warnings: ConstraintWarning[] }) {
  const alternatives = selectedOption.days.flatMap((day) =>
    day.alternatives.map((alternative) => ({
      ...alternative,
      dayNumber: day.dayNumber
    }))
  );
  const panels = [
    ...alternatives.slice(0, 3).map((alternative) => ({
      id: alternative.id,
      title: alternative.title,
      eyebrow: `Day ${alternative.dayNumber} alternative`,
      body: alternative.tradeoff,
      foot: alternative.bestFor,
      tone: "border-orange-100 bg-orange-50/55"
    })),
    ...warnings.slice(0, 2).map((warning) => ({
      id: warning.id,
      title: warningLabels[warning.type],
      eyebrow: warning.affectedDay ? `Day ${warning.affectedDay} feasibility` : "Plan feasibility",
      body: warning.message,
      foot: warning.recommendation,
      tone: "border-rose-100 bg-rose-50/55"
    }))
  ];

  if (panels.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {panels.slice(0, 4).map((panel) => (
        <div key={panel.id} className={`rounded-[8px] border p-3 shadow-sm ${panel.tone}`}>
          <p className="text-[11px] font-black uppercase text-blue-900/45">{panel.eyebrow}</p>
          <h3 className="mt-1 truncate text-sm font-black text-slate-950">{panel.title}</h3>
          <p className="mt-2 line-clamp-3 text-xs font-semibold leading-5 text-slate-600">{panel.body}</p>
          <p className="mt-2 line-clamp-2 text-[11px] font-bold leading-4 text-blue-900/70">{panel.foot}</p>
        </div>
      ))}
    </div>
  );
}

export function ItineraryCanvas({
  itinerary,
  warnings,
  assumptions,
  selectedOptionId,
  onSelectOption,
  planning,
  labels
}: ItineraryCanvasProps) {
  if (!itinerary) {
    return (
      <div className="space-y-4">
        <EmptyCanvas planning={planning} labels={labels} />
        <ConstraintWarnings warnings={warnings} labels={labels} />
      </div>
    );
  }

  const selectedOption =
    itinerary.options.find((option) => option.id === selectedOptionId) ||
    itinerary.options.find((option) => option.id === itinerary.selectedOptionId) ||
    itinerary.options[0];

  return (
    <div className="space-y-4">
      <Panel title={labels.planningCanvas} eyebrow="Planner Agent JSON" icon={<Route className="size-4" />}>
        <div className="canvas-grid relative overflow-hidden rounded-[8px] border border-slate-200 bg-white/78 p-4">
          <div className="pointer-events-none absolute left-12 right-12 top-[310px] hidden border-t border-dashed border-blue-300 xl:block" />
          <OptionHeader itinerary={itinerary} selectedOption={selectedOption} onSelectOption={onSelectOption} />
          <InfluenceLayer assumptions={assumptions} />

          <div className="mt-4 flex gap-4 overflow-x-auto px-1 pb-2 planner-scrollbar">
            {selectedOption.days.map((day) => (
              <DayCard key={day.dayNumber} day={day} assumptions={assumptions} />
            ))}
          </div>

          <div className="mt-4 flex justify-center text-[11px] font-bold text-blue-900/45">
            Dashed links indicate that assumptions can influence option choice, pacing, and feasibility warnings.
          </div>
        </div>
      </Panel>

      <RecommendationPanels selectedOption={selectedOption} warnings={warnings} />
      <ConstraintWarnings warnings={warnings} labels={labels} />
    </div>
  );
}
