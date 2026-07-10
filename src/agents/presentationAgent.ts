import type {
  CostBreakdownItem,
  Itinerary,
  ItineraryDay,
  ItineraryOption,
  PaceRating,
  PlanDigest
} from "@/types/travel";

/**
 * Presentation Agent — deterministic. Compresses a full itinerary option into
 * the compact structure the overview UI renders (day rows, budget summary,
 * pace ratings). No LLM call: everything here is arithmetic over data the
 * Planner already produced, so it is instant and reproducible across
 * participants.
 */

export function dayPaceRating(day: ItineraryDay): PaceRating {
  const activityCount = day.activities.length;
  const walkingKm = day.totalWalkingKm || day.activities.reduce((sum, activity) => sum + activity.walkingKm, 0);
  const travelMinutes =
    day.totalTravelTimeMinutes || day.activities.reduce((sum, activity) => sum + activity.travelTimeMinutes, 0);
  const load = activityCount + walkingKm * 0.6 + travelMinutes / 45;

  if (load > 7 || activityCount >= 6 || walkingKm > 9) {
    return "Packed";
  }

  if (load < 3.5 && activityCount <= 3) {
    return "Relaxed";
  }

  return "Balanced";
}

function overallPace(days: ItineraryDay[]): PaceRating {
  const ratings = days.map(dayPaceRating);
  const packed = ratings.filter((rating) => rating === "Packed").length;
  const relaxed = ratings.filter((rating) => rating === "Relaxed").length;

  if (packed >= Math.max(1, Math.ceil(days.length / 3))) {
    return "Packed";
  }

  if (relaxed > days.length / 2) {
    return "Relaxed";
  }

  return "Balanced";
}

function dayCity(day: ItineraryDay): string {
  return day.accommodation?.area || day.activities[0]?.location || day.title;
}

function dayCostEur(day: ItineraryDay): number {
  return day.estimatedCostEur || day.activities.reduce((sum, activity) => sum + activity.estimatedCostEur, 0);
}

export function aggregateCostCategories(option: ItineraryOption): Array<{ category: CostBreakdownItem["category"]; totalEur: number }> {
  const items = option.costBreakdown.length > 0 ? option.costBreakdown : option.days.flatMap((day) => day.costBreakdown);
  const totals = new Map<CostBreakdownItem["category"], number>();

  items.forEach((item) => {
    totals.set(item.category, (totals.get(item.category) ?? 0) + (item.totalEur ?? item.amountEur));
  });

  return Array.from(totals.entries())
    .map(([category, totalEur]) => ({ category, totalEur: Math.round(totalEur) }))
    .sort((a, b) => b.totalEur - a.totalEur);
}

export function optionTotalCostEur(option: ItineraryOption): number {
  if (option.estimatedTotalCostEur > 0) {
    return Math.round(option.estimatedTotalCostEur);
  }

  return Math.round(option.days.reduce((sum, day) => sum + dayCostEur(day), 0));
}

/** Heuristic daily budget cap inferred from the traveler's stated budget style. */
export function dailyBudgetCapEur(budgetSignals: string): number {
  const text = budgetSignals.toLowerCase();

  if (/luxur|premium|high-end|5-star|five star/.test(text)) {
    return 400;
  }

  if (/budget|cheap|low[- ]cost|backpack|hostel|frugal|affordable/.test(text)) {
    return 90;
  }

  if (/mid[- ]range|moderate|comfortable/.test(text)) {
    return 180;
  }

  return 160;
}

export function budgetRiskRating(perDayCostEur: number, capEur: number): "Low" | "Medium" | "High" {
  if (perDayCostEur > capEur * 1.3) {
    return "High";
  }

  if (perDayCostEur > capEur) {
    return "Medium";
  }

  return "Low";
}

export function buildPlanDigest(itinerary: Itinerary, option: ItineraryOption, budgetSignals = ""): PlanDigest {
  const totalCostEur = optionTotalCostEur(option);
  const dayCount = Math.max(1, option.days.length);
  const perDayCostEur = Math.round(totalCostEur / dayCount);
  const longestTransferMinutes = option.routeSegments.reduce(
    (longest, segment) => Math.max(longest, segment.estimatedTravelTimeMinutes),
    0
  );

  return {
    optionId: option.id,
    destination: itinerary.destination,
    durationDays: itinerary.durationDays,
    style: option.positioning,
    totalCostEur,
    perDayCostEur,
    budgetRisk: budgetRiskRating(perDayCostEur, dailyBudgetCapEur(budgetSignals)),
    paceOverall: overallPace(option.days),
    totalWalkingKm: Number(option.days.reduce((sum, day) => sum + day.totalWalkingKm, 0).toFixed(1)),
    longestTransferMinutes,
    categories: aggregateCostCategories(option).slice(0, 5),
    days: option.days.map((day) => ({
      dayNumber: day.dayNumber,
      city: dayCity(day),
      stops: day.activities.slice(0, 3).map((activity) => ({ time: activity.time, title: activity.title })),
      walkingKm: Number((day.totalWalkingKm || 0).toFixed(1)),
      travelMinutes: Math.round(day.totalTravelTimeMinutes || 0),
      costEur: Math.round(dayCostEur(day)),
      pace: dayPaceRating(day)
    }))
  };
}

export function buildPlanDigests(itinerary: Itinerary, budgetSignals = ""): PlanDigest[] {
  return itinerary.options.map((option) => buildPlanDigest(itinerary, option, budgetSignals));
}
