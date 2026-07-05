import { NextResponse } from "next/server";
import { z } from "zod";
import { runAssumptionCriticAgent, runPreferenceProbeAgent } from "@/agents";
import { AgentError } from "@/agents/llm";
import { PreferenceProbeRequestSchema, PreferenceProbeResponseSchema } from "@/schemas/travel";
import type { AgentTrace, MemoryStatus, UserMemory } from "@/types/travel";

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

function memoryStatus(memory: UserMemory | null, appliedPreferenceCount: number, language: "en" | "zh"): MemoryStatus {
  const preferenceCount = memory?.preferences.length ?? 0;
  const used = appliedPreferenceCount > 0;

  return {
    used,
    preferenceCount,
    appliedPreferenceCount,
    message:
      language === "zh"
        ? used
          ? `偏好学习使用了 ${appliedPreferenceCount} 项会话记忆。`
          : "偏好学习未直接使用会话记忆。"
        : used
          ? `Preference learning used ${appliedPreferenceCount} session-memory preferences.`
          : "Preference learning did not directly use session memory."
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

  return NextResponse.json({ error: "Unexpected preference probe failure.", code: "UNKNOWN" }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const body = PreferenceProbeRequestSchema.parse(await request.json());
    const probe = await runPreferenceProbeAgent(body);
    const critic = await runAssumptionCriticAgent({
      prompt: body.prompt,
      assumptions: probe.assumptions,
      missingPreferences: [],
      language: body.language
    });

    const response = PreferenceProbeResponseSchema.parse({
      learnedPreferences: probe.learnedPreferences,
      assumptions: probe.assumptions,
      transportAssumptions: probe.transportAssumptions,
      accommodationAssumptions: probe.accommodationAssumptions,
      costAssumptions: probe.costAssumptions,
      critiques: critic.critiques,
      memoryStatus: memoryStatus(body.memory, probe.memoryDerivedPreferenceIds.length, body.language),
      trace: [
        trace("Preference Probe Agent", probe.summary, probe.learnedPreferences.length),
        trace("Assumption Critic Agent", critic.summary, critic.critiques.length)
      ]
    });

    return NextResponse.json(response);
  } catch (error) {
    return errorResponse(error);
  }
}
