import { NextResponse } from "next/server";
import { z } from "zod";
import { runBranchExplorerAgent } from "@/agents/branchExplorerAgent";
import { filterDistinctCandidates, scoreBranchCandidate } from "@/agents/branchScoring";
import { AgentError } from "@/agents/llm";
import { guardApiRequest } from "@/app/api/requestGuard";
import { ExpandRequestSchema, ExpandResponseSchema } from "@/schemas/travel";
import type { AgentTrace, BranchCandidate, PlanNode } from "@/types/travel";

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

    const nodes: PlanNode[] = distinct
      .filter((candidate) => !excluded.has(candidate.title.toLowerCase().trim()))
      .slice(0, 4)
      .map((candidate, index) => {
        const durationDays = parentDuration ?? candidate.durationDays;
        const normalized = { ...candidate, durationDays };

        return {
          id: nodeId(body.parent?.id ?? null, body.dimension, candidate.title, index),
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
          implicitAssumptions: candidate.implicitAssumptions,
          revealedPreference: candidate.revealedPreference,
          estimates: scoreBranchCandidate(normalized, budgetSignals),
          confidence: candidate.confidence,
          status: "candidate" as const,
          sourceAgent: "Branch Explorer Agent" as const
        };
      });

    const response = ExpandResponseSchema.parse({
      nodes,
      rationale: explorer.rationale,
      trace: [trace("Branch Explorer Agent", explorer.rationale, nodes.length, durationMs)]
    });

    return NextResponse.json(response);
  } catch (error) {
    return errorResponse(error);
  }
}
