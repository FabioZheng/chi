import { budgetRiskRating, dailyBudgetCapEur } from "@/agents/presentationAgent";
import type { BranchCandidate, BranchDimension, BranchEstimates, PaceRating, PlanNode } from "@/types/travel";

/**
 * Deterministic branch scoring. Every candidate node the Branch Explorer
 * proposes is annotated with grounded estimates — transfer burden, budget
 * band, pace — computed by the same evaluator logic used on full plans.
 * This is what makes branches comparable rather than decorative, and it is
 * instant, so annotations never delay the frontier.
 */

function haversineKm(
  from: { lat: number | null; lng: number | null },
  to: { lat: number | null; lng: number | null }
): number {
  if (from.lat === null || from.lng === null || to.lat === null || to.lng === null) {
    return 0;
  }

  const radiusKm = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function transferChainKm(candidate: BranchCandidate): number {
  const located = candidate.cities.filter((city) => city.lat !== null && city.lng !== null);

  if (located.length < 2) {
    return 0;
  }

  const isHub = /hub|base|day.?trip|radial|星形|放射|基地/.test(candidate.movementPattern.toLowerCase());

  if (isHub) {
    // Hub-and-spoke: out-and-back legs from the first (base) city.
    const [base, ...spokes] = located;
    return spokes.reduce((sum, city) => sum + 2 * haversineKm(base, city), 0);
  }

  return located.slice(1).reduce((sum, city, index) => sum + haversineKm(located[index], city), 0);
}

function paceForCandidate(candidate: BranchCandidate): PaceRating {
  const moveCount = Math.max(0, candidate.cities.length - 1);
  const movesPerDay = moveCount / Math.max(1, candidate.durationDays);
  const shortestStay = candidate.cities.reduce((min, city) => Math.min(min, city.nights || 0), Infinity);

  if (movesPerDay > 0.45 || (Number.isFinite(shortestStay) && shortestStay <= 1 && candidate.cities.length >= 3)) {
    return "Packed";
  }

  if (movesPerDay < 0.2 && candidate.cities.length <= 2) {
    return "Relaxed";
  }

  return "Balanced";
}

export function scoreBranchCandidate(candidate: BranchCandidate, budgetSignals: string): BranchEstimates {
  const transferKm = Math.round(transferChainKm(candidate));
  // Mixed regional rail/driving average; flights dominate past ~600 km legs
  // but at skeleton level a coarse figure is what the comparison needs.
  const transferHours = Number((transferKm / 80).toFixed(1));
  const moveCount = Math.max(0, candidate.cities.length - 1);
  const capEur = dailyBudgetCapEur(budgetSignals);
  const baseCost = candidate.durationDays * capEur;
  const transferCost = moveCount * 35;

  return {
    transferKm,
    transferHours,
    moveCount,
    budgetBandMinEur: Math.round((baseCost * 0.7 + transferCost) / 10) * 10,
    budgetBandMaxEur: Math.round((baseCost * 1.25 + transferCost * 1.5) / 10) * 10,
    pace: paceForCandidate(candidate)
  };
}

/** Budget risk of a scored branch against the traveler's stated budget style. */
export function branchBudgetRisk(estimates: BranchEstimates, durationDays: number, budgetSignals: string) {
  const perDayMid = (estimates.budgetBandMinEur + estimates.budgetBandMaxEur) / 2 / Math.max(1, durationDays);
  return budgetRiskRating(perDayMid, dailyBudgetCapEur(budgetSignals));
}

/**
 * Distinctness guard: candidates whose city sets overlap too heavily with an
 * already-accepted sibling are dropped, so the frontier offers genuinely
 * different directions instead of three flavours of the same trip.
 */
export function filterDistinctCandidates(candidates: BranchCandidate[], maxJaccard = 0.6): BranchCandidate[] {
  const accepted: BranchCandidate[] = [];

  candidates.forEach((candidate) => {
    const citySet = new Set(candidate.cities.map((city) => city.name.toLowerCase().trim()));
    const isDistinct = accepted.every((existing) => {
      const existingSet = new Set(existing.cities.map((city) => city.name.toLowerCase().trim()));

      if (citySet.size === 0 || existingSet.size === 0) {
        return existing.title.toLowerCase() !== candidate.title.toLowerCase();
      }

      const intersection = [...citySet].filter((name) => existingSet.has(name)).length;
      const union = new Set([...citySet, ...existingSet]).size;
      return union === 0 || intersection / union <= maxJaccard;
    });

    if (isDistinct) {
      accepted.push(candidate);
    }
  });

  return accepted;
}

/**
 * A branch's structural fingerprint for the decision it represents. Two
 * siblings with the same fingerprint are the same option under different
 * names, which is what "show more options" tends to produce: the explorer
 * reliably avoids repeating a title but will happily restate its substance.
 *
 * The differentiator depends on the dimension being decided — nights carry the
 * rhythm decision but are legitimately identical across anchor candidates — so
 * comparing whole nodes would either miss duplicates or reject valid branches.
 */
export function branchSignature(
  node: Pick<PlanNode, "cities" | "anchors" | "movementPattern" | "register">,
  dimension: BranchDimension
): string {
  const normalize = (value: string) => value.toLowerCase().trim();
  const cityNights = node.cities.map((city) => `${normalize(city.name)}:${city.nights}`).join("|");

  switch (dimension) {
    case "rhythm":
      return cityNights;
    case "anchors":
      return [...node.anchors].map(normalize).sort().join("|");
    case "logistics":
      return `${normalize(node.movementPattern)}::${cityNights}`;
    case "tripShape":
    default:
      return [...node.cities.map((city) => normalize(city.name))].sort().join("|");
  }
}
