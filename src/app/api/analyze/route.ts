import { NextResponse } from "next/server";
import { z } from "zod";
import { runConflictDetectorAgent } from "@/agents";
import { AgentError } from "@/agents/llm";
import { AnalyzeRequestSchema, AnalyzeResponseSchema } from "@/schemas/travel";
import type { AgentTrace, MemoryStatus, UserMemory } from "@/types/travel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function memoryStatus(memory: UserMemory | null, language: "en" | "zh"): MemoryStatus {
  const preferenceCount = memory?.preferences.length ?? 0;

  return {
    used: preferenceCount > 0,
    preferenceCount,
    appliedPreferenceCount: preferenceCount,
    message:
      language === "zh"
        ? preferenceCount > 0
          ? `本次冲突检测参考了 ${preferenceCount} 项会话记忆。`
          : "本次冲突检测未使用会话记忆。"
        : preferenceCount > 0
          ? `Conflict detection considered ${preferenceCount} session-memory preferences.`
          : "No session memory was used for conflict detection."
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

  return NextResponse.json({ error: "Unexpected conflict detection failure.", code: "UNKNOWN" }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const body = AnalyzeRequestSchema.parse(await request.json());
    const startedAt = Date.now();
    const conflicts = await runConflictDetectorAgent(body);
    const durationMs = Date.now() - startedAt;

    const response = AnalyzeResponseSchema.parse({
      checkpointDecision: conflicts.checkpointDecision,
      detectedConflicts: conflicts.detectedConflicts.map((conflict) => ({
        ...conflict,
        sourceAgent: "Conflict Detector Agent" as const
      })),
      learnedPreferences: body.learnedPreferences,
      assumptions: [],
      transportAssumptions: [],
      accommodationAssumptions: [],
      costAssumptions: [],
      missingPreferences: [],
      critiques: [],
      memoryStatus: memoryStatus(body.memory, body.language),
      trace: [trace("Conflict Detector Agent", conflicts.summary, conflicts.detectedConflicts.length, durationMs)]
    });

    return NextResponse.json(response);
  } catch (error) {
    return errorResponse(error);
  }
}
