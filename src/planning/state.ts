import type {
  PlanNode,
  PlanningAssumption,
  PlanningAssumptionSource,
  PlanningConsequence
} from "@/types/travel";

export type PlanningAssumptionMap = Record<string, PlanningAssumption>;

export type AssumptionMutation =
  | { type: "confirm"; source?: PlanningAssumptionSource }
  | { type: "correct"; value: string; source?: PlanningAssumptionSource }
  | { type: "reject"; source?: PlanningAssumptionSource }
  | { type: "set-lock"; locked: boolean; source?: PlanningAssumptionSource };

export type PlanningSnapshot = {
  tree: PlanNode[];
  assumptions: PlanningAssumptionMap;
};

export type AssumptionMutationResult = {
  tree: PlanNode[];
  assumptions: PlanningAssumptionMap;
  affectedNodeIds: string[];
  invalidatedNodeIds: string[];
  preservedLockedNodeIds: string[];
  firstAffectedLevel: number | null;
  previousValue: string;
  nextValue: string;
};

export type CounterfactualPreview = {
  assumptionId: string;
  title: string;
  effects: string[];
  affectedNodeIds: string[];
  requiresConfirmation: boolean;
};

export type ContinuationAction = "review-checkpoint" | "expand-next-stage" | "build-itinerary";

const fallbackOptions: Partial<Record<PlanningAssumption["category"], string[]>> = {
  pace: ["Relaxed", "Balanced", "Fast"],
  walkingTolerance: ["Lower", "Moderate", "Higher"],
  transport: ["Mostly public transport", "Flexible mix", "Prefer private transport"],
  budget: ["Value-focused", "Mid-range", "Comfort-first"],
  touristyLocalStyle: ["Local-first", "Balanced", "Iconic sights first"],
  accommodationArea: ["Central", "Quiet residential", "Best transport links"],
  food: ["Casual and local", "Balanced", "Destination dining"],
  nightlife: ["Quiet evenings", "Some nightlife", "Nightlife is a priority"]
};

const categoryEffects: Partial<Record<PlanningAssumption["category"], string[]>> = {
  pace: ["Activity count and rest time will be recalculated.", "Evening plans may move or be removed."],
  walkingTolerance: ["Walking legs and transport choices will be recalculated.", "Daily stop order may change."],
  transport: ["Transfer strategy and hotel-base logic may change.", "Travel time between stops will be recalculated."],
  budget: ["Accommodation, dining, and paid attractions may change.", "Branch fit and budget risk will be rescored."],
  accommodationArea: ["Hotel area and first/last stops of each day may change.", "Local travel time will be recalculated."],
  interests: ["Anchor experiences and activity selection may change.", "Unrelated route decisions will stay in place."],
  food: ["Meal timing and food-led activities may change.", "Route choices without a food dependency will stay in place."],
  touristyLocalStyle: ["The mix of headline sights and local neighborhoods may change."],
  accessibility: ["Walking, transfers, and venue choices will be rechecked."],
  travelParty: ["Room, pacing, and activity suitability may change."]
};

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function cloneAssumptionMap(assumptions: PlanningAssumptionMap): PlanningAssumptionMap {
  return Object.fromEntries(
    Object.entries(assumptions).map(([id, assumption]) => [
      id,
      {
        ...assumption,
        affectedNodeIds: [...assumption.affectedNodeIds],
        correctionOptions: [...assumption.correctionOptions],
        consequences: assumption.consequences.map((consequence) => ({
          ...consequence,
          affectedNodeIds: [...consequence.affectedNodeIds]
        }))
      }
    ])
  );
}

function cloneTree(tree: PlanNode[]): PlanNode[] {
  return tree.map((node) => ({
    ...node,
    anchors: [...node.anchors],
    cities: node.cities.map((city) => ({ ...city })),
    implicitAssumptions: [...node.implicitAssumptions],
    assumptionIds: [...node.assumptionIds],
    consequences: node.consequences.map((consequence) => ({
      ...consequence,
      affectedNodeIds: [...consequence.affectedNodeIds]
    })),
    invalidatedByAssumptionIds: [...node.invalidatedByAssumptionIds]
  }));
}

function nodeMap(tree: PlanNode[]): Map<string, PlanNode> {
  return new Map(tree.map((node) => [node.id, node]));
}

function committedPlanningPath(tree: PlanNode[]): PlanNode[] {
  const pinned = tree.filter((node) => node.status === "pinned").sort((a, b) => a.level - b.level);
  const path: PlanNode[] = [];

  pinned.forEach((node) => {
    const expectedParent = path[path.length - 1]?.id ?? null;
    if ((node.parentId ?? null) === expectedParent) path.push(node);
  });

  return path;
}

function descendantsOf(tree: PlanNode[], ancestorIds: Iterable<string>): Set<string> {
  const affected = new Set(ancestorIds);
  const ordered = [...tree].sort((a, b) => a.level - b.level);
  let changed = true;

  while (changed) {
    changed = false;
    for (const node of ordered) {
      if (node.parentId && affected.has(node.parentId) && !affected.has(node.id)) {
        affected.add(node.id);
        changed = true;
      }
    }
  }

  return affected;
}

function consequenceKey(consequence: PlanningConsequence): string {
  return `${consequence.affectedArea.toLowerCase()}|${consequence.label.toLowerCase()}`;
}

function mergeConsequences(
  current: PlanningConsequence[],
  incoming: PlanningConsequence[]
): PlanningConsequence[] {
  const byKey = new Map(current.map((consequence) => [consequenceKey(consequence), consequence]));

  incoming.forEach((consequence) => {
    const key = consequenceKey(consequence);
    const existing = byKey.get(key);
    byKey.set(
      key,
      existing
        ? {
            ...existing,
            affectedNodeIds: unique([...existing.affectedNodeIds, ...consequence.affectedNodeIds])
          }
        : consequence
    );
  });

  return Array.from(byKey.values());
}

export function assumptionMap(values: PlanningAssumption[]): PlanningAssumptionMap {
  return Object.fromEntries(values.map((assumption) => [assumption.id, assumption]));
}

export function continuationAction(tree: PlanNode[], stageCount = 4): ContinuationAction {
  const path = committedPlanningPath(tree);
  if (path.length >= stageCount) return "build-itinerary";
  const parentId = path[path.length - 1]?.id ?? null;
  const level = path.length + 1;
  const hasCandidates = tree.some(
    (node) =>
      node.level === level &&
      (node.parentId ?? null) === parentId &&
      node.status === "candidate"
  );
  return hasCandidates ? "review-checkpoint" : "expand-next-stage";
}

export function mergeAssumptions(
  current: PlanningAssumptionMap,
  incoming: PlanningAssumption[]
): PlanningAssumptionMap {
  const next = cloneAssumptionMap(current);

  incoming.forEach((assumption) => {
    const existing = next[assumption.id];
    next[assumption.id] = existing
      ? {
          ...existing,
          ...assumption,
          affectedNodeIds: unique([...existing.affectedNodeIds, ...assumption.affectedNodeIds]),
          consequences: mergeConsequences(existing.consequences, assumption.consequences)
        }
      : assumption;
  });

  return next;
}

export function linkAssumptionsToTree(
  tree: PlanNode[],
  assumptions: PlanningAssumptionMap
): PlanningAssumptionMap {
  const next = cloneAssumptionMap(assumptions);
  const byId = nodeMap(tree);

  Object.values(next).forEach((assumption) => {
    const affected = descendantsOf(
      tree,
      assumption.affectedNodeIds.filter((id) => byId.has(id))
    );
    assumption.affectedNodeIds = Array.from(affected);
    assumption.consequences = assumption.consequences.map((consequence) => ({
      ...consequence,
      affectedNodeIds: unique([...consequence.affectedNodeIds, ...affected])
    }));
  });

  return next;
}

export function assumptionsForNode(
  node: PlanNode,
  assumptions: PlanningAssumptionMap,
  includeRejected = false
): PlanningAssumption[] {
  return node.assumptionIds
    .map((id) => assumptions[id])
    .filter((assumption): assumption is PlanningAssumption => Boolean(assumption))
    .filter((assumption) => includeRejected || assumption.status !== "rejected")
    .sort((a, b) => {
      const impact = { High: 3, Medium: 2, Low: 1 };
      const confidence = { Low: 3, Medium: 2, High: 1 };
      return impact[b.impact] - impact[a.impact] || confidence[b.confidence] - confidence[a.confidence];
    });
}

export function checkpointAssumptions(
  assumptions: PlanningAssumptionMap,
  limit = 3
): PlanningAssumption[] {
  return Object.values(assumptions)
    .filter((assumption) => assumption.status !== "rejected")
    .filter(
      (assumption) =>
        assumption.impact === "High" ||
        assumption.confidence === "Low" ||
        assumption.status === "corrected" ||
        (!assumption.confirmed && assumption.impact === "Medium")
    )
    .sort((a, b) => {
      const urgency = (assumption: PlanningAssumption) =>
        (assumption.impact === "High" ? 4 : assumption.impact === "Medium" ? 2 : 0) +
        (assumption.confidence === "Low" ? 3 : assumption.confidence === "Medium" ? 1 : 0) +
        (assumption.confirmed ? 0 : 2);
      return urgency(b) - urgency(a);
    })
    .slice(0, limit);
}

export function correctionOptionsFor(assumption: PlanningAssumption): string[] {
  return assumption.correctionOptions.length > 0
    ? assumption.correctionOptions
    : fallbackOptions[assumption.category] ?? [];
}

export function applyAssumptionMutation(
  tree: PlanNode[],
  assumptions: PlanningAssumptionMap,
  assumptionId: string,
  mutation: AssumptionMutation
): AssumptionMutationResult {
  const current = assumptions[assumptionId];
  if (!current) {
    return {
      tree,
      assumptions,
      affectedNodeIds: [],
      invalidatedNodeIds: [],
      preservedLockedNodeIds: [],
      firstAffectedLevel: null,
      previousValue: "",
      nextValue: ""
    };
  }

  const nextAssumptions = cloneAssumptionMap(assumptions);
  const source = mutation.source ?? current.source;
  const updated: PlanningAssumption =
    mutation.type === "confirm"
      ? { ...current, confirmed: true, source }
      : mutation.type === "correct"
        ? { ...current, value: mutation.value, status: "corrected", confirmed: true, source }
        : mutation.type === "reject"
          ? { ...current, status: "rejected", confirmed: true, locked: false, source }
          : { ...current, locked: mutation.locked, confirmed: mutation.locked ? true : current.confirmed, source };
  nextAssumptions[assumptionId] = updated;

  const disruptive = mutation.type === "correct" || mutation.type === "reject";
  const affected = disruptive ? descendantsOf(tree, current.affectedNodeIds) : new Set<string>();
  const invalidatedNodeIds: string[] = [];
  const preservedLockedNodeIds: string[] = [];
  const nextTree = tree.map((node): PlanNode => {
    if (!affected.has(node.id) || node.status === "pruned") return node;
    if (node.locked) {
      preservedLockedNodeIds.push(node.id);
      return node;
    }

    invalidatedNodeIds.push(node.id);
    return {
      ...node,
      status: node.status === "pinned" ? "candidate" : node.status,
      stale: true,
      invalidatedByAssumptionIds: unique([...node.invalidatedByAssumptionIds, assumptionId])
    };
  });
  const byId = nodeMap(nextTree);
  const affectedNodeIds = Array.from(affected).filter((id) => byId.has(id));
  const firstAffectedLevel =
    invalidatedNodeIds.length > 0
      ? Math.min(...invalidatedNodeIds.map((id) => byId.get(id)?.level ?? Number.POSITIVE_INFINITY))
      : null;

  return {
    tree: nextTree,
    assumptions: nextAssumptions,
    affectedNodeIds,
    invalidatedNodeIds,
    preservedLockedNodeIds,
    firstAffectedLevel,
    previousValue: current.value,
    nextValue: updated.value
  };
}

export function setDecisionLock(tree: PlanNode[], nodeId: string, locked: boolean): PlanNode[] {
  return tree.map((node) => (node.id === nodeId ? { ...node, locked } : node));
}

export function counterfactualPreview(
  assumption: PlanningAssumption,
  tree: PlanNode[],
  mutation: Extract<AssumptionMutation, { type: "correct" | "reject" }>
): CounterfactualPreview {
  const affected = descendantsOf(tree, assumption.affectedNodeIds);
  const consequenceEffects = assumption.consequences.map((consequence) => consequence.label);
  const deterministic = categoryEffects[assumption.category] ?? ["Dependent planning choices will be recalculated."];
  const effects = unique([
    ...consequenceEffects,
    ...deterministic,
    ...(mutation.type === "reject" ? ["This inference will no longer influence branch scoring or generation."] : [])
  ]).slice(0, 4);

  return {
    assumptionId: assumption.id,
    title:
      mutation.type === "correct"
        ? `Change ${assumption.label} to ${mutation.value}?`
        : `Stop using ${assumption.label}?`,
    effects,
    affectedNodeIds: Array.from(affected),
    requiresConfirmation: assumption.impact !== "Low"
  };
}

export function createPlanningSnapshot(
  tree: PlanNode[],
  assumptions: PlanningAssumptionMap
): PlanningSnapshot {
  return {
    tree: cloneTree(tree),
    assumptions: cloneAssumptionMap(assumptions)
  };
}

export function restorePlanningSnapshot(snapshot: PlanningSnapshot): PlanningSnapshot {
  return createPlanningSnapshot(snapshot.tree, snapshot.assumptions);
}

export function migrateLegacyPlanningState(
  tree: PlanNode[],
  existing: PlanningAssumptionMap = {}
): PlanningSnapshot {
  const assumptions = cloneAssumptionMap(existing);
  const migratedTree = tree.map((node): PlanNode => {
    const legacyIds = node.implicitAssumptions.map((value, index) => {
      const id = `legacy-${node.id}-${index}`;
      if (!assumptions[id]) {
        assumptions[id] = {
          id,
          category: "other",
          label: "Planning assumption",
          value: value.replace(/^assumes?\s+/i, ""),
          confidence: node.confidence < 0.45 ? "Low" : node.confidence >= 0.78 ? "High" : "Medium",
          impact: node.importance ?? "Medium",
          source: "model-inference",
          status: "active",
          confirmed: false,
          locked: false,
          affectedNodeIds: [node.id],
          consequences: node.consequences ?? [],
          correctionOptions: []
        };
      }
      return id;
    });

    return {
      ...node,
      implicitAssumptions: [],
      assumptionIds: unique([...(node.assumptionIds ?? []), ...legacyIds]),
      consequences: node.consequences ?? [],
      importance: node.importance ?? "Medium",
      locked: node.locked ?? false,
      stale: node.stale ?? false,
      invalidatedByAssumptionIds: node.invalidatedByAssumptionIds ?? []
    };
  });

  const sanitizedTree = migratedTree.map((node) => ({
    ...node,
    assumptionIds: node.assumptionIds.filter((id) => Boolean(assumptions[id]))
  }));

  return {
    tree: sanitizedTree,
    assumptions: linkAssumptionsToTree(sanitizedTree, assumptions)
  };
}
