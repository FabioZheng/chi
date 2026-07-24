import { describe, expect, it } from "vitest";
import type { PlanNode, PlanningAssumption, PlanningConsequence } from "../types/travel";
import {
  applyAssumptionMutation,
  assumptionMap,
  checkpointAssumptions,
  continuationAction,
  counterfactualPreview,
  createPlanningSnapshot,
  migrateLegacyPlanningState,
  restorePlanningSnapshot,
  setDecisionLock,
  type PlanningAssumptionMap
} from "./state";

const dimensions: PlanNode["dimension"][] = ["tripShape", "rhythm", "anchors", "logistics"];

function consequence(
  id: string,
  label: string,
  affectedNodeIds: string[] = []
): PlanningConsequence {
  return {
    id,
    label,
    affectedArea: "itinerary",
    affectedNodeIds
  };
}

function node(
  id: string,
  parentId: string | null,
  level: number,
  overrides: Partial<PlanNode> = {}
): PlanNode {
  return {
    id,
    parentId,
    level,
    dimension: dimensions[Math.min(dimensions.length - 1, Math.max(0, level - 1))],
    title: id,
    summary: `${id} summary`,
    durationDays: 7,
    movementPattern: "linear chain",
    register: "balanced",
    anchors: [`${id} anchor`],
    cities: [{ name: "Rome", nights: 7, lat: 41.9028, lng: 12.4964 }],
    implicitAssumptions: [],
    assumptionIds: [],
    consequences: [],
    importance: "Medium",
    locked: false,
    stale: false,
    invalidatedByAssumptionIds: [],
    revealedPreference: null,
    estimates: {
      transferKm: 0,
      transferHours: 0,
      moveCount: 0,
      budgetBandMinEur: 700,
      budgetBandMaxEur: 1400,
      pace: "Balanced"
    },
    confidence: 0.7,
    status: "candidate",
    ...overrides
  };
}

function assumption(
  id: string,
  affectedNodeIds: string[],
  overrides: Partial<PlanningAssumption> = {}
): PlanningAssumption {
  return {
    id,
    category: "pace",
    label: "Trip pace",
    value: "Balanced",
    confidence: "Medium",
    impact: "High",
    source: "model-inference",
    status: "active",
    confirmed: false,
    locked: false,
    affectedNodeIds,
    consequences: [consequence(`${id}-effect`, "Changes daily activity density.", affectedNodeIds)],
    correctionOptions: ["Relaxed", "Balanced", "Fast"],
    ...overrides
  };
}

function byId(tree: PlanNode[], id: string): PlanNode {
  const match = tree.find((item) => item.id === id);
  if (!match) throw new Error(`Missing fixture node: ${id}`);
  return match;
}

describe("applyAssumptionMutation", () => {
  it("corrects an assumption and records the changed provenance without mutating the input", () => {
    const tree = [node("route", null, 1, { status: "pinned" })];
    const assumptions = assumptionMap([assumption("pace", ["route"])]);

    const result = applyAssumptionMutation(tree, assumptions, "pace", {
      type: "correct",
      value: "Relaxed",
      source: "user-edit"
    });

    expect(result.previousValue).toBe("Balanced");
    expect(result.nextValue).toBe("Relaxed");
    expect(result.assumptions.pace).toMatchObject({
      value: "Relaxed",
      status: "corrected",
      confirmed: true,
      source: "user-edit"
    });
    expect(result.invalidatedNodeIds).toEqual(["route"]);
    expect(byId(result.tree, "route")).toMatchObject({
      status: "candidate",
      stale: true,
      invalidatedByAssumptionIds: ["pace"]
    });
    expect(assumptions.pace.value).toBe("Balanced");
    expect(tree[0]).toMatchObject({ status: "pinned", stale: false });
  });

  it("rejects an assumption, removes its lock, and invalidates its dependent node", () => {
    const tree = [node("route", null, 1)];
    const assumptions = assumptionMap([
      assumption("pace", ["route"], { locked: true, confirmed: true })
    ]);

    const result = applyAssumptionMutation(tree, assumptions, "pace", {
      type: "reject",
      source: "user-edit"
    });

    expect(result.assumptions.pace).toMatchObject({
      status: "rejected",
      confirmed: true,
      locked: false,
      source: "user-edit"
    });
    expect(result.invalidatedNodeIds).toEqual(["route"]);
    expect(byId(result.tree, "route").stale).toBe(true);
  });

  it("invalidates only directly affected nodes and their descendants", () => {
    const tree = [
      node("route-a", null, 1, { status: "pinned" }),
      node("pace-a", "route-a", 2, { status: "pinned" }),
      node("anchor-a", "pace-a", 3),
      node("route-b", null, 1),
      node("pace-b", "route-b", 2)
    ];
    const assumptions = assumptionMap([assumption("walking", ["pace-a"])]);

    const result = applyAssumptionMutation(tree, assumptions, "walking", {
      type: "correct",
      value: "Lower"
    });

    expect(new Set(result.affectedNodeIds)).toEqual(new Set(["pace-a", "anchor-a"]));
    expect(new Set(result.invalidatedNodeIds)).toEqual(new Set(["pace-a", "anchor-a"]));
    expect(result.firstAffectedLevel).toBe(2);
    expect(byId(result.tree, "route-a").stale).toBe(false);
    expect(byId(result.tree, "route-b").stale).toBe(false);
    expect(byId(result.tree, "pace-b").stale).toBe(false);
  });

  it("preserves an unrelated locked branch while invalidating the affected branch", () => {
    const tree = [
      node("route-a", null, 1, { status: "pinned" }),
      node("pace-a", "route-a", 2, { status: "pinned" }),
      node("route-b", null, 1, { locked: true, status: "pinned" }),
      node("pace-b", "route-b", 2, { locked: true, status: "pinned" })
    ];
    const assumptions = assumptionMap([assumption("pace", ["route-a"])]);

    const result = applyAssumptionMutation(tree, assumptions, "pace", {
      type: "reject"
    });

    expect(new Set(result.invalidatedNodeIds)).toEqual(new Set(["route-a", "pace-a"]));
    expect(byId(result.tree, "route-b")).toMatchObject({
      locked: true,
      status: "pinned",
      stale: false
    });
    expect(byId(result.tree, "pace-b")).toMatchObject({
      locked: true,
      status: "pinned",
      stale: false
    });
  });
});

describe("decision locking", () => {
  it("locks and unlocks only the requested decision without mutating the source tree", () => {
    const tree = [node("route-a", null, 1), node("route-b", null, 1)];

    const locked = setDecisionLock(tree, "route-a", true);
    const unlocked = setDecisionLock(locked, "route-a", false);

    expect(byId(locked, "route-a").locked).toBe(true);
    expect(byId(locked, "route-b").locked).toBe(false);
    expect(byId(unlocked, "route-a").locked).toBe(false);
    expect(byId(tree, "route-a").locked).toBe(false);
  });
});

describe("planning snapshots", () => {
  it("restores an isolated deep copy of the prior tree and assumption state", () => {
    const tree = [node("route", null, 1)];
    const assumptions = assumptionMap([assumption("pace", ["route"])]);
    const snapshot = createPlanningSnapshot(tree, assumptions);

    tree[0].anchors.push("later anchor");
    assumptions.pace.value = "Fast";
    assumptions.pace.consequences[0].affectedNodeIds.push("later-node");

    const restored = restorePlanningSnapshot(snapshot);
    restored.tree[0].cities[0].name = "Florence";
    restored.assumptions.pace.value = "Relaxed";

    expect(snapshot.tree[0].anchors).toEqual(["route anchor"]);
    expect(snapshot.tree[0].cities[0].name).toBe("Rome");
    expect(snapshot.assumptions.pace.value).toBe("Balanced");
    expect(snapshot.assumptions.pace.consequences[0].affectedNodeIds).toEqual(["route"]);
    expect(restored.tree[0].anchors).toEqual(["route anchor"]);
  });
});

describe("legacy planning-state migration", () => {
  it("converts inline assumptions and removes every dangling assumption reference", () => {
    const root = {
      ...node("route", null, 1, {
        implicitAssumptions: ["Assumes long train transfers are acceptable"],
        assumptionIds: ["known-assumption", "missing-assumption"]
      }),
      consequences: undefined,
      importance: undefined,
      locked: undefined,
      stale: undefined,
      invalidatedByAssumptionIds: undefined
    } as unknown as PlanNode;
    const child = {
      ...node("pace", "route", 2, {
        implicitAssumptions: ["Assumes a balanced activity load"]
      }),
      assumptionIds: undefined
    } as unknown as PlanNode;
    const existing: PlanningAssumptionMap = {
      "known-assumption": assumption("known-assumption", ["route"])
    };

    const migrated = migrateLegacyPlanningState([root, child], existing);

    expect(migrated.tree.every((item) => item.implicitAssumptions.length === 0)).toBe(true);
    expect(byId(migrated.tree, "route").assumptionIds).toContain("known-assumption");
    expect(byId(migrated.tree, "route").assumptionIds).not.toContain("missing-assumption");
    expect(
      migrated.tree.every((item) =>
        item.assumptionIds.every((assumptionId) => Boolean(migrated.assumptions[assumptionId]))
      )
    ).toBe(true);
    expect(Object.values(migrated.assumptions).map((item) => item.value)).toEqual(
      expect.arrayContaining([
        "long train transfers are acceptable",
        "a balanced activity load"
      ])
    );
    expect(migrated.assumptions["known-assumption"].affectedNodeIds).toEqual(
      expect.arrayContaining(["route", "pace"])
    );
  });
});

describe("checkpoint selection", () => {
  it("prioritizes high-impact, low-confidence unresolved assumptions and excludes rejected ones", () => {
    const assumptions = assumptionMap([
      assumption("critical", ["route"], { impact: "High", confidence: "Low" }),
      assumption("uncertain", ["route"], { impact: "Medium", confidence: "Low" }),
      assumption("confirmed", ["route"], {
        impact: "High",
        confidence: "High",
        confirmed: true
      }),
      assumption("minor", ["route"], { impact: "Low", confidence: "High" }),
      assumption("rejected", ["route"], {
        impact: "High",
        confidence: "Low",
        status: "rejected"
      })
    ]);

    expect(checkpointAssumptions(assumptions, 2).map((item) => item.id)).toEqual([
      "critical",
      "uncertain"
    ]);
  });
});

describe("checkpoint continuation", () => {
  it("reviews an existing frontier, expands an incomplete path, and builds only after all stages are committed", () => {
    const route = node("route", null, 1, { status: "pinned" });
    const paceCandidate = node("pace-candidate", "route", 2);
    expect(continuationAction([route, paceCandidate])).toBe("review-checkpoint");
    expect(continuationAction([route])).toBe("expand-next-stage");

    const pace = node("pace", "route", 2, { status: "pinned" });
    const anchors = node("anchors", "pace", 3, { status: "pinned" });
    const logistics = node("logistics", "anchors", 4, { status: "pinned" });
    expect(continuationAction([route, pace, anchors, logistics])).toBe("build-itinerary");
  });
});

describe("counterfactual previews", () => {
  it("uses explicit consequences plus deterministic category effects over the affected subtree", () => {
    const tree = [
      node("route", null, 1),
      node("pace", "route", 2),
      node("anchors", "pace", 3),
      node("unrelated", null, 1)
    ];
    const current = assumption("pace-setting", ["pace"], {
      consequences: [
        consequence("fewer-stops", "Schedules fewer activities each day.", ["pace"])
      ]
    });

    const preview = counterfactualPreview(current, tree, {
      type: "correct",
      value: "Relaxed"
    });

    expect(preview.title).toBe("Change Trip pace to Relaxed?");
    expect(new Set(preview.affectedNodeIds)).toEqual(new Set(["pace", "anchors"]));
    expect(preview.effects).toEqual(
      expect.arrayContaining([
        "Schedules fewer activities each day.",
        "Activity count and rest time will be recalculated."
      ])
    );
    expect(preview.effects).toHaveLength(3);
    expect(preview.requiresConfirmation).toBe(true);
  });
});
