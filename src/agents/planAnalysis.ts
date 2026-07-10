import {
  budgetRiskRating,
  dailyBudgetCapEur,
  dayPaceRating,
  optionTotalCostEur
} from "@/agents/presentationAgent";
import type { ConstraintWarning, Itinerary, ItineraryOption, PlanRequest } from "@/types/travel";

/**
 * Deterministic planning checkers. These run as named agents in the trace but
 * are pure arithmetic over the generated itinerary — no LLM latency or cost.
 * LLM use stays where language actually matters (elicitation, conflict
 * framing, planning, explanation); these produce grounded numeric findings.
 */

type AnalysisResult = {
  summary: string;
  warnings: ConstraintWarning[];
};

function warning(
  id: string,
  type: ConstraintWarning["type"],
  impact: ConstraintWarning["impact"],
  message: string,
  affectedDay: number | null,
  recommendation: string,
  sourceAgent: ConstraintWarning["sourceAgent"]
): ConstraintWarning {
  return { id, type, impact, message, affectedDay, recommendation, status: "Open", sourceAgent };
}

function budgetSignalsFromRequest(request: PlanRequest): string {
  return [
    ...request.learnedPreferences.filter((preference) => preference.category === "budget").map((preference) => preference.value),
    ...request.confirmedPreferences.filter((preference) => preference.category === "budget").map((preference) => preference.value),
    ...request.assumptions.filter((assumption) => assumption.category === "budget").map((assumption) => assumption.value)
  ].join(" ");
}

function selectedOption(itinerary: Itinerary): ItineraryOption {
  return itinerary.options.find((option) => option.id === itinerary.selectedOptionId) ?? itinerary.options[0];
}

export function runBudgetManagerAgent(itinerary: Itinerary, request: PlanRequest, language: "en" | "zh"): AnalysisResult {
  const option = selectedOption(itinerary);
  const totalEur = optionTotalCostEur(option);
  const perDayEur = Math.round(totalEur / Math.max(1, option.days.length));
  const capEur = dailyBudgetCapEur(budgetSignalsFromRequest(request));
  const risk = budgetRiskRating(perDayEur, capEur);
  const warnings: ConstraintWarning[] = [];

  if (risk !== "Low") {
    warnings.push(
      warning(
        "budget-manager-over-cap",
        "budgetMismatch",
        risk,
        language === "zh"
          ? `预计每日花费约 €${perDayEur}，高于该预算风格的参考上限 €${capEur}。`
          : `Estimated spend is ~€${perDayEur}/day, above the ~€${capEur}/day reference for this budget style.`,
        null,
        language === "zh"
          ? "考虑更换住宿档次、减少付费景点或选择更省的交通方式。"
          : "Consider a cheaper accommodation tier, fewer paid attractions, or lower-cost transport.",
        "Budget Manager Agent"
      )
    );
  }

  return {
    summary:
      language === "zh"
        ? `总预算约 €${totalEur}（每日约 €${perDayEur}），预算风险：${risk}。`
        : `Estimated total €${totalEur} (~€${perDayEur}/day); budget risk ${risk}.`,
    warnings
  };
}

export function runRouteMobilityAgent(itinerary: Itinerary, language: "en" | "zh"): AnalysisResult {
  const option = selectedOption(itinerary);
  const warnings: ConstraintWarning[] = [];

  option.days.forEach((day) => {
    const walkingKm = day.totalWalkingKm || day.activities.reduce((sum, activity) => sum + activity.walkingKm, 0);
    const travelMinutes =
      day.totalTravelTimeMinutes || day.activities.reduce((sum, activity) => sum + activity.travelTimeMinutes, 0);

    if (walkingKm > 8) {
      warnings.push(
        warning(
          `route-mobility-walking-day-${day.dayNumber}`,
          "walkingLoad",
          walkingKm > 12 ? "High" : "Medium",
          language === "zh"
            ? `第 ${day.dayNumber} 天步行约 ${walkingKm.toFixed(1)} 公里，负担偏高。`
            : `Day ${day.dayNumber} involves ~${walkingKm.toFixed(1)} km of walking.`,
          day.dayNumber,
          language === "zh"
            ? "考虑合并相邻景点、增加公共交通或减少一个站点。"
            : "Cluster nearby stops, add public transport, or drop one stop.",
          "Route Mobility Agent"
        )
      );
    }

    if (travelMinutes > 150) {
      warnings.push(
        warning(
          `route-mobility-transfer-day-${day.dayNumber}`,
          "travelTime",
          travelMinutes > 240 ? "High" : "Medium",
          language === "zh"
            ? `第 ${day.dayNumber} 天在途时间约 ${Math.round(travelMinutes)} 分钟。`
            : `Day ${day.dayNumber} spends ~${Math.round(travelMinutes)} minutes in transit.`,
          day.dayNumber,
          language === "zh"
            ? "考虑调整站点顺序或将远距离目的地移到相邻日。"
            : "Reorder stops or move the far destination to an adjacent day.",
          "Route Mobility Agent"
        )
      );
    }
  });

  const verified = option.routeSegments.filter((segment) => segment.provider === "google_routes").length;

  return {
    summary:
      language === "zh"
        ? `检查了 ${option.days.length} 天的步行与在途负担；${verified}/${option.routeSegments.length} 段路线已验证。`
        : `Checked walking and transit load across ${option.days.length} days; ${verified}/${option.routeSegments.length} route segments verified.`,
    warnings
  };
}

export function runPaceFeasibilityAgent(itinerary: Itinerary, language: "en" | "zh"): AnalysisResult {
  const option = selectedOption(itinerary);
  const warnings: ConstraintWarning[] = [];
  const packedDays: number[] = [];

  option.days.forEach((day) => {
    if (dayPaceRating(day) === "Packed") {
      packedDays.push(day.dayNumber);
      warnings.push(
        warning(
          `pace-feasibility-day-${day.dayNumber}`,
          "pacingIssue",
          day.activities.length >= 6 ? "High" : "Medium",
          language === "zh"
            ? `第 ${day.dayNumber} 天安排偏满（${day.activities.length} 个活动），可能感觉赶。`
            : `Day ${day.dayNumber} is packed (${day.activities.length} activities) and may feel rushed.`,
          day.dayNumber,
          language === "zh"
            ? "考虑移除一个活动或延后到备选日，为休息留出时间。"
            : "Drop one activity or move it to a lighter day to leave recovery time.",
          "Pace Feasibility Agent"
        )
      );
    }
  });

  return {
    summary:
      packedDays.length > 0
        ? language === "zh"
          ? `${packedDays.length} 天节奏偏满（第 ${packedDays.join("、")} 天）。`
          : `${packedDays.length} day(s) look packed (day ${packedDays.join(", ")}).`
        : language === "zh"
          ? "各天节奏均在可承受范围内。"
          : "Daily pacing is within a comfortable range.",
    warnings
  };
}

/** Merge warnings, preferring the first occurrence of each (type, day) pair. */
export function mergeWarnings(...groups: ConstraintWarning[][]): ConstraintWarning[] {
  const seen = new Set<string>();
  const merged: ConstraintWarning[] = [];

  groups.flat().forEach((item) => {
    const key = `${item.type}|${item.affectedDay ?? "all"}`;

    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  });

  return merged;
}
