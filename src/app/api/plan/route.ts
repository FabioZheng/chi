import { NextResponse } from "next/server";
import { z } from "zod";
import { runConstraintCheckerAgent, runPlannerAgent } from "@/agents";
import { AgentError } from "@/agents/llm";
import { PlanRequestSchema, PlanResponseSchema } from "@/schemas/travel";
import type { AgentTrace } from "@/types/travel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function trace(agent: AgentTrace["agent"], summary: string, count: number): AgentTrace {
  return {
    agent,
    summary,
    status: "Complete",
    count,
    timestamp: new Date().toISOString()
  };
}

function errorResponse(error: unknown) {
  if (error instanceof AgentError) {
    const status = error.code === "CONFIG" ? 500 : 502;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: error.message, code: "VALIDATION" }, { status: 400 });
  }

  return NextResponse.json({ error: "Unexpected planning failure.", code: "UNKNOWN" }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const body = PlanRequestSchema.parse(await request.json());
    const planner = await runPlannerAgent(body);
    const checker = await runConstraintCheckerAgent({
      prompt: body.prompt,
      itinerary: planner.itinerary,
      confirmedPreferences: body.confirmedPreferences,
      memory: body.memory,
      language: body.language
    });

    const response = PlanResponseSchema.parse({
      itinerary: planner.itinerary,
      warnings: checker.warnings,
      trace: [
        trace(
          "Planner Agent",
          `generated ${planner.itinerary.options.length} itinerary options.`,
          planner.itinerary.options.length
        ),
        trace(
          "Constraint Checker Agent",
          `flagged ${checker.warnings.length} feasibility issues.`,
          checker.warnings.length
        )
      ]
    });

    return NextResponse.json(response);
  } catch (error) {
    return errorResponse(error);
  }
}
