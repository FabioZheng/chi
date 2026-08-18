import { describe, expect, it } from "vitest";
import { PlanningAssumptionSchema, PlanningConsequenceSchema, stablePlanningId } from "@/schemas/travel";
import { assumptionId, consequenceForNode, nodeId } from "./planningIds";

const longTitle = "Classic Art and Culinary Loop Through Northern Italy With Slow Mornings";

describe("consequenceForNode", () => {
  const currentNodeId = nodeId(null, "tripShape", longTitle, 0);

  it("gives every consequence on a node a distinct id", () => {
    // Regression: the index sat after a full node id + label, so the 64-char cap
    // truncated it away and all consequences collapsed to one id (duplicate keys).
    const consequences = [
      { id: "", label: "Multiple hotel changes with stays of four to five nights", affectedArea: "logistics", affectedNodeIds: [] },
      { id: "", label: "Allows slow mornings with focused afternoon visits", affectedArea: "daily rhythm", affectedNodeIds: [] },
      { id: "", label: "Concentrates spending on food and museum entries", affectedArea: "budget", affectedNodeIds: [] }
    ];

    const ids = consequences.map((consequence, index) => consequenceForNode(consequence, currentNodeId, index).id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.length).toBeLessThanOrEqual(64);
  });

  it("survives a round-trip through PlanningConsequenceSchema unchanged", () => {
    const built = consequenceForNode(
      { id: "", label: "Multiple hotel changes with stays of four to five nights", affectedArea: "logistics", affectedNodeIds: [] },
      currentNodeId,
      0
    );

    expect(PlanningConsequenceSchema.parse(built).id).toBe(built.id);
  });
});

describe("assumptionId", () => {
  it("survives a round-trip through PlanningAssumptionSchema unchanged", () => {
    // This mismatch was the cause of "Branch request validation failed.": the
    // node kept the raw id while the schema slugified/truncated the assumption's,
    // so ExpandResponseSchema's superRefine saw a dangling reference.
    const assumption = {
      category: "budget" as const,
      label: "Mid-range comfort with occasional splurges",
      value: "Three-star hotels and one standout meal per city"
    };
    const id = assumptionId(assumption, 0);

    const parsed = PlanningAssumptionSchema.parse({
      ...assumption,
      id,
      confidence: 0.6,
      impact: "Medium",
      source: "model-inference",
      status: "active",
      confirmed: false,
      locked: false,
      affectedNodeIds: [],
      consequences: [],
      correctionOptions: []
    });

    expect(parsed.id).toBe(id);
    expect(id).toBe(stablePlanningId(id, "fallback"));
  });
});
