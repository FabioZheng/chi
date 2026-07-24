import { NextResponse } from "next/server";
import { z } from "zod";
import { runBranchExplorerAgent } from "@/agents/branchExplorerAgent";
import { filterDistinctCandidates, scoreBranchCandidate } from "@/agents/branchScoring";
import { AgentError } from "@/agents/llm";
import { guardApiRequest } from "@/app/api/requestGuard";
import { ExpandRequestSchema, ExpandResponseSchema } from "@/schemas/travel";
import type { AgentTrace, BranchCandidate, PlanNode, PlanningAssumption, PlanningConsequence } from "@/types/travel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function trace(agent: AgentTrace["agent"], summary: string, count: number, durationMs?: number): AgentTrace {
  return {
    agent,
    summary,
    status: "Complete",
    count,
    timestamp: new Date().toISOString(),
    ...(durationMs !== undefined ? { durationMs } : {})
  };
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "branch";
}

function nodeId(parentId: string | null, dimension: string, title: string, index: number): string {
  const parent = parentId ? slugify(parentId).slice(-24) : "root";
  return `${parent}-${dimension}-${slugify(title)}-${index}`;
}

function consequenceForNode(
  consequence: PlanningConsequence,
  currentNodeId: string,
  index: number
): PlanningConsequence {
  return {
    ...consequence,
    id: `${currentNodeId}-effect-${slugify(consequence.id || consequence.label)}-${index}`,
    affectedNodeIds: [currentNodeId]
  };
}

function importanceForDimension(dimension: PlanNode["dimension"]): PlanNode["importance"] {
  return dimension === "tripShape" || dimension === "rhythm" ? "High" : "Medium";
}

function assumptionKey(assumption: Pick<PlanningAssumption, "category" | "label" | "value">): string {
  return `${assumption.category}|${slugify(assumption.label)}|${slugify(assumption.value)}`;
}

function mergeConsequence(
  existing: PlanningConsequence[],
  incoming: PlanningConsequence
): PlanningConsequence[] {
  const matchIndex = existing.findIndex(
    (item) => slugify(item.label) === slugify(incoming.label) && slugify(item.affectedArea) === slugify(incoming.affectedArea)
  );

  if (matchIndex === -1) return [...existing, incoming];
  return existing.map((item, index) =>
    index === matchIndex
      ? {
          ...item,
          affectedNodeIds: Array.from(new Set([...item.affectedNodeIds, ...incoming.affectedNodeIds]))
        }
      : item
  );
}

function errorResponse(error: unknown) {
  if (error instanceof AgentError) {
    const status = error.code === "CONFIG" ? 500 : 502;
    console.error(`[expand:${error.code}]`, error.message);
    const message = error.code === "CONFIG" ? error.message : "The branch provider could not complete this request.";
    return NextResponse.json({ error: message, code: error.code }, { status });
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: "Branch request validation failed.", code: "VALIDATION" }, { status: 400 });
  }

  return NextResponse.json({ error: "Unexpected branch expansion failure.", code: "UNKNOWN" }, { status: 500 });
}

export async function POST(request: Request) {
  const blocked = guardApiRequest(request, "expand", 12);
  if (blocked) return blocked;

  try {
    const body = ExpandRequestSchema.parse(await request.json());
    const startedAt = Date.now();
    const explorer = await runBranchExplorerAgent(body, request.signal);
    const durationMs = Date.now() - startedAt;

    // Distinctness is enforced structurally at the trip-shape level (city-set
    // overlap); deeper levels share cities by design and differ by title.
    const distinct: BranchCandidate[] =
      body.dimension === "tripShape" ? filterDistinctCandidates(explorer.candidates) : explorer.candidates;
    const excluded = new Set(body.excludedTitles.map((title) => title.toLowerCase().trim()));
    const budgetSignals = body.learnedPreferences
      .filter((preference) => preference.category === "budget")
      .map((preference) => preference.value)
      .join(" ");
    const parentDuration = body.parent?.durationDays ?? body.committedPath[body.committedPath.length - 1]?.durationDays;
    const level = (body.parent?.level ?? body.committedPath.length) + 1;

    const assumptionById = new Map(body.assumptions.map((assumption) => [assumption.id, assumption]));
    const assumptionIdByKey = new Map(body.assumptions.map((assumption) => [assumptionKey(assumption), assumption.id]));
    const nodes: PlanNode[] = distinct
      .filter((candidate) => !excluded.has(candidate.title.toLowerCase().trim()))
      .slice(0, 4)
      .map((candidate, index) => {
        const durationDays = parentDuration ?? candidate.durationDays;
        const normalized = { ...candidate, durationDays };
        const currentNodeId = nodeId(body.parent?.id ?? null, body.dimension, candidate.title, index);
        const nodeConsequences = candidate.consequences.map((consequence, consequenceIndex) =>
          consequenceForNode(consequence, currentNodeId, consequenceIndex)
        );
        const nodeAssumptions = candidate.assumptions.map((assumption, assumptionIndex): PlanningAssumption => {
          const key = assumptionKey(assumption);
          const id =
            assumptionIdByKey.get(key) ??
            `assumption-${assumption.category}-${slugify(assumption.label)}-${slugify(assumption.value)}-${assumptionIndex}`;
          const incoming: PlanningAssumption = {
            ...assumption,
            id,
            affectedNodeIds: [currentNodeId],
            consequences: assumption.consequences.map((consequence, consequenceIndex) =>
              consequenceForNode(consequence, currentNodeId, consequenceIndex)
            )
          };
          const existing = assumptionById.get(id);
          const merged = existing
            ? {
                ...existing,
                affectedNodeIds: Array.from(new Set([...existing.affectedNodeIds, currentNodeId])),
                consequences: incoming.consequences.reduce(
                  (consequences, consequence) => mergeConsequence(consequences, consequence),
                  existing.consequences
                )
              }
            : incoming;
          assumptionIdByKey.set(key, id);
          assumptionById.set(id, merged);
          return merged;
        });

        return {
          id: currentNodeId,
          parentId: body.parent?.id ?? null,
          level,
          dimension: body.dimension,
          title: candidate.title,
          summary: candidate.summary,
          durationDays,
          movementPattern: candidate.movementPattern,
          register: candidate.register,
          anchors: candidate.anchors,
          cities: candidate.cities,
          implicitAssumptions: [],
          assumptionIds: nodeAssumptions.map((assumption) => assumption.id),
          consequences: nodeConsequences,
          importance: importanceForDimension(body.dimension),
          locked: false,
          stale: false,
          invalidatedByAssumptionIds: [],
          revealedPreference: candidate.revealedPreference,
          estimates: scoreBranchCandidate(normalized, budgetSignals),
          confidence: candidate.confidence,
          status: "candidate" as const,
          sourceAgent: "Branch Explorer Agent" as const
        };
      });
    if (nodes.length === 0) {
      throw new AgentError("Branch Explorer Agent returned no usable candidates after validation.", "VALIDATION");
    }

    const response = ExpandResponseSchema.parse({
      nodes,
      assumptions: Array.from(assumptionById.values()),
      rationale: explorer.rationale,
      trace: [trace("Branch Explorer Agent", explorer.rationale, nodes.length, durationMs)]
    });

    return NextResponse.json(response);
  } catch (error) {
    return errorResponse(error);
  }
}
