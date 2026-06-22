import { NextResponse } from "next/server";
import { z } from "zod";
import { runAssumptionCriticAgent, runPreferenceAgent } from "@/agents";
import { AgentError } from "@/agents/llm";
import { AnalyzeRequestSchema, AnalyzeResponseSchema } from "@/schemas/travel";
import type { AgentTrace, Assumption } from "@/types/travel";

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

const zhCategoryLabels: Record<Assumption["category"], string> = {
  budget: "预算",
  pace: "节奏",
  food: "饮食",
  transport: "交通",
  walkingTolerance: "步行承受度",
  accommodationArea: "住宿区域",
  interests: "兴趣",
  nightlife: "夜生活",
  touristyLocalStyle: "游客/本地风格",
  dates: "日期",
  travelParty: "同行人员",
  accessibility: "无障碍需求",
  other: "其他"
};

function localizeAssumptionLabels(assumptions: Assumption[], language: "en" | "zh") {
  if (language !== "zh") {
    return assumptions;
  }

  return assumptions.map((assumption) => ({
    ...assumption,
    label: zhCategoryLabels[assumption.category] || assumption.label
  }));
}

function errorResponse(error: unknown) {
  if (error instanceof AgentError) {
    const status = error.code === "CONFIG" ? 500 : 502;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: error.message, code: "VALIDATION" }, { status: 400 });
  }

  return NextResponse.json({ error: "Unexpected analysis failure.", code: "UNKNOWN" }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const body = AnalyzeRequestSchema.parse(await request.json());
    const preference = await runPreferenceAgent(body);
    const critic = await runAssumptionCriticAgent({
      prompt: body.prompt,
      assumptions: preference.assumptions,
      missingPreferences: preference.missingPreferences,
      language: body.language
    });

    const assumptions = localizeAssumptionLabels(preference.assumptions, body.language);
    const highImpactCount = critic.critiques.filter((item) => item.impact === "High").length;
    const response = AnalyzeResponseSchema.parse({
      assumptions,
      missingPreferences: preference.missingPreferences,
      critiques: critic.critiques,
      trace: [
        trace(
          "Preference Agent",
          `detected ${preference.missingPreferences.length} missing preferences and ${preference.assumptions.length} assumptions.`,
          preference.missingPreferences.length + preference.assumptions.length
        ),
        trace(
          "Assumption Critic Agent",
          `found ${highImpactCount} high-impact assumptions.`,
          critic.critiques.length
        )
      ]
    });

    return NextResponse.json(response);
  } catch (error) {
    return errorResponse(error);
  }
}
