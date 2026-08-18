import { stablePlanningId } from "@/schemas/travel";
import type { PlanningAssumption, PlanningConsequence } from "@/types/travel";

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "branch";
}

export function nodeId(parentId: string | null, dimension: string, title: string, index: number): string {
  const parent = parentId ? slugify(parentId).slice(-24) : "root";
  return `${parent}-${dimension}-${slugify(title)}-${index}`;
}

export function assumptionKey(assumption: Pick<PlanningAssumption, "category" | "label" | "value">): string {
  return `${assumption.category}|${slugify(assumption.label)}|${slugify(assumption.value)}`;
}

// Every id below is minted through stablePlanningId so it survives a round-trip
// through the schemas unchanged. That normalizer caps ids at 64 characters, so
// the parts that make an id unique must sit near the front — anything past the
// cap is silently cut.
export function assumptionId(
  assumption: Pick<PlanningAssumption, "category" | "label" | "value">,
  index: number
): string {
  return stablePlanningId(
    `assumption-${assumption.category}-${slugify(assumption.label)}-${slugify(assumption.value)}-${index}`,
    `assumption-${assumption.category}-${index}`
  );
}

// The index has to precede the label: trailing a full node id + label it was
// truncated away, collapsing every consequence on a node to one id (duplicate
// React keys). The budget below stays under the cap so nothing is cut in practice.
export function consequenceForNode(
  consequence: PlanningConsequence,
  currentNodeId: string,
  index: number
): PlanningConsequence {
  return {
    ...consequence,
    id: stablePlanningId(
      `${currentNodeId.slice(0, 28)}-effect-${index}-${slugify(consequence.id || consequence.label).slice(0, 20)}`,
      `${currentNodeId.slice(0, 28)}-effect-${index}`
    ),
    affectedNodeIds: [currentNodeId]
  };
}
