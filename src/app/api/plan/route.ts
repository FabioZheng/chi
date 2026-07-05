import { NextResponse } from "next/server";
import { z } from "zod";
import { runConstraintCheckerAgent, runPlannerAgent } from "@/agents";
import { AgentError } from "@/agents/llm";
import { PlanRequestSchema, PlanResponseSchema } from "@/schemas/travel";
import type { AgentTrace, ConfirmedPreference, MemoryStatus, UserMemory } from "@/types/travel";

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

function memoryStatus(
  memory: UserMemory | null,
  confirmedPreferences: ConfirmedPreference[],
  language: "en" | "zh"
): MemoryStatus {
  const preferenceCount = memory?.preferences.length ?? 0;
  const appliedPreferenceCount = confirmedPreferences.filter((preference) => preference.source === "Memory").length;
  const used = appliedPreferenceCount > 0;

  return {
    used,
    preferenceCount,
    appliedPreferenceCount,
    message:
      language === "zh"
        ? used
          ? `本次规划使用了 ${appliedPreferenceCount} 项会话记忆。`
          : preferenceCount > 0
            ? "存在会话记忆，但本次规划没有直接应用。"
            : "本次规划未使用会话记忆。"
        : used
          ? `Used ${appliedPreferenceCount} session-memory preferences.`
          : preferenceCount > 0
            ? "Session memory was available but not directly applied."
            : "No session memory was used."
  };
}

function planTraceSummaries(input: { language: "en" | "zh"; optionCount: number; warningCount: number }) {
  if (input.language === "zh") {
    return {
      planner: `生成了 ${input.optionCount} 个行程方案。`,
      checker: `标记了 ${input.warningCount} 个可行性问题。`
    };
  }

  return {
    planner: `generated ${input.optionCount} itinerary options.`,
    checker: `flagged ${input.warningCount} feasibility issues.`
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
    const summaries = planTraceSummaries({
      language: body.language,
      optionCount: planner.itinerary.options.length,
      warningCount: checker.warnings.length
    });

    const response = PlanResponseSchema.parse({
      itinerary: planner.itinerary,
      warnings: checker.warnings,
      memoryStatus: memoryStatus(body.memory, body.confirmedPreferences, body.language),
      trace: [
        trace("Planner Agent", summaries.planner, planner.itinerary.options.length),
        trace("Constraint Checker Agent", summaries.checker, checker.warnings.length)
      ]
    });

    return NextResponse.json(response);
  } catch (error) {
    return errorResponse(error);
  }
}
