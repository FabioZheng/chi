import { describe, expect, it } from "vitest";
import { PlanningAssumptionSchema, stablePlanningId } from "./travel";

describe("stablePlanningId", () => {
  it("is idempotent, including when truncation lands on a separator", () => {
    const samples = [
      "assumption-budget-mid-range-comfort-with-occasional-splurges-traveller-accepts-three-star",
      // 64th character is a dash, so a naive slice would leave a trailing dash
      `${"a".repeat(63)}-tail`,
      "Assumption With CAPS And  Spaces",
      "早稲田-京都-奈良"
    ];

    for (const sample of samples) {
      const once = stablePlanningId(sample, "fallback");
      expect(stablePlanningId(once, "fallback")).toBe(once);
      expect(once.length).toBeLessThanOrEqual(64);
    }
  });
});

describe("PlanningAssumptionSchema", () => {
  // Regression: the expand route minted long raw ids while the schema silently
  // slugified/truncated them, so node.assumptionIds no longer matched the
  // assumption ids and ExpandResponseSchema's superRefine rejected the response
  // with "Branch request validation failed."
  it("preserves an id that was already normalized by stablePlanningId", () => {
    const rawId =
      "assumption-budget-mid-range-comfort-with-occasional-splurges-traveller-accepts-three-star-hotels-0";
    const normalized = stablePlanningId(rawId, "assumption-budget-0");

    const parsed = PlanningAssumptionSchema.parse({
      id: normalized,
      category: "budget",
      label: "Mid-range comfort",
      value: "Three-star hotels with one standout meal per city",
      confidence: 0.6,
      impact: "Medium",
      source: "model-inference",
      status: "active",
      confirmed: false,
      locked: false,
      affectedNodeIds: ["node-1"],
      consequences: [],
      correctionOptions: []
    });

    expect(parsed.id).toBe(normalized);
  });
});
