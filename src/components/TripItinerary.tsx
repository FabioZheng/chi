"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  Clock3,
  Euro,
  Footprints,
  MapPin,
  Route,
  SlidersHorizontal
} from "lucide-react";
import type { ConstraintWarning, Itinerary } from "@/types/travel";

export type TripItineraryLabels = {
  backToTree: string;
  finalPlan: string;
  builtFromBranch: string;
  days: string;
  estimated: string;
  walking: string;
  travel: string;
  day: string;
  flexible: string;
  warnings: string;
  noWarnings: string;
  adjustPlan: string;
  costEstimate: string;
  routeOverview: string;
};

type TripItineraryProps = {
  itinerary: Itinerary;
  warnings: ConstraintWarning[];
  selectedOptionId: string | null;
  labels: TripItineraryLabels;
  onSelectOption: (id: string) => void;
  onBack: () => void;
  onAdjust: () => void;
};

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function TripItinerary({
  itinerary,
  warnings,
  selectedOptionId,
  labels,
  onSelectOption,
  onBack,
  onAdjust
}: TripItineraryProps) {
  const selected =
    itinerary.options.find((option) => option.id === selectedOptionId) ??
    itinerary.options.find((option) => option.id === itinerary.selectedOptionId) ??
    itinerary.options[0];
  const walkingKm = selected.days.reduce((sum, day) => sum + day.totalWalkingKm, 0);
  const travelMinutes = selected.days.reduce((sum, day) => sum + day.totalTravelTimeMinutes, 0);
  const cities = Array.from(
    new Set(
      selected.days.flatMap((day) =>
        day.activities.map((activity) => activity.location.split(",").at(-1)?.trim()).filter((value): value is string => Boolean(value))
      )
    )
  ).slice(0, 6);

  return (
    <div className="itinerary-view">
      <header className="itinerary-header">
        <button type="button" className="button-secondary" onClick={onBack}>
          <ArrowLeft className="size-4" /> {labels.backToTree}
        </button>
        <div>
          <span>{labels.finalPlan}</span>
          <h2>{itinerary.destination}</h2>
          <p>{itinerary.summary}</p>
        </div>
        <button type="button" className="button-primary" onClick={onAdjust}>
          <SlidersHorizontal className="size-4" /> {labels.adjustPlan}
        </button>
      </header>

      {itinerary.options.length > 1 ? (
        <div className="itinerary-options" role="tablist" aria-label={labels.finalPlan}>
          {itinerary.options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={selected.id === option.id}
              onClick={() => onSelectOption(option.id)}
            >
              <strong>{option.title}</strong>
              <span>{option.positioning}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="itinerary-summary-band">
        <div>
          <CalendarDays className="size-4" />
          <span>{labels.days}</span>
          <strong>{itinerary.durationDays}</strong>
        </div>
        <div>
          <Euro className="size-4" />
          <span>{labels.estimated}</span>
          <strong>€{Math.round(selected.estimatedTotalCostEur).toLocaleString()}</strong>
        </div>
        <div>
          <Footprints className="size-4" />
          <span>{labels.walking}</span>
          <strong>{walkingKm.toFixed(1)} km</strong>
        </div>
        <div>
          <Clock3 className="size-4" />
          <span>{labels.travel}</span>
          <strong>{formatMinutes(travelMinutes)}</strong>
        </div>
      </div>

      <div className="itinerary-layout">
        <main>
          <div className="itinerary-route-strip">
            <div className="section-kicker">
              <Route className="size-4" /> {labels.routeOverview}
            </div>
            <div>
              {cities.map((city, index) => (
                <span key={`${city}-${index}`}>
                  <i>{index + 1}</i>
                  {city}
                </span>
              ))}
            </div>
          </div>

          <div className="itinerary-days">
            {selected.days.map((day, index) => (
              <details key={day.dayNumber} open={index === 0}>
                <summary>
                  <span>{String(day.dayNumber).padStart(2, "0")}</span>
                  <div>
                    <strong>{day.title}</strong>
                    <small>{day.theme}</small>
                  </div>
                  <p>{day.totalWalkingKm.toFixed(1)} km · {formatMinutes(day.totalTravelTimeMinutes)} · €{Math.round(day.estimatedCostEur)}</p>
                  <ChevronDown className="size-4" />
                </summary>
                <div className="day-timeline">
                  {day.activities.map((activity) => (
                    <article key={activity.id}>
                      <time>{activity.time || labels.flexible}</time>
                      <span />
                      <div>
                        <h4>{activity.title}</h4>
                        <p className="day-location"><MapPin className="size-3" /> {activity.location}</p>
                        <p>{activity.description}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </main>

        <aside className="itinerary-side">
          <section>
            <div className="section-kicker"><Euro className="size-4" /> {labels.costEstimate}</div>
            {selected.costBreakdown.map((item) => (
              <div key={item.id} className="cost-row">
                <span>{item.label}</span>
                <strong>€{Math.round(item.totalEur ?? item.amountEur)}</strong>
              </div>
            ))}
            <div className="cost-row cost-row--total">
              <span>{labels.estimated}</span>
              <strong>€{Math.round(selected.estimatedTotalCostEur).toLocaleString()}</strong>
            </div>
          </section>

          <section>
            <div className="section-kicker"><AlertTriangle className="size-4" /> {labels.warnings}</div>
            {warnings.length === 0 ? <p className="quiet-copy">{labels.noWarnings}</p> : null}
            {warnings.slice(0, 5).map((warning) => (
              <article key={warning.id} className={`warning-line warning-line--${warning.impact.toLowerCase()}`}>
                <strong>{warning.message}</strong>
                <p>{warning.recommendation}</p>
              </article>
            ))}
          </section>
        </aside>
      </div>
    </div>
  );
}
