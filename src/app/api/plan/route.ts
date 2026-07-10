import { NextResponse } from "next/server";
import { z } from "zod";
import { runConstraintCheckerAgent, runInputConsistencyAgent, runPlannerAgent } from "@/agents";
import { enrichItineraryWithGoogleRoutes } from "@/agents/googleMaps";
import { AgentError } from "@/agents/llm";
import {
  mergeWarnings,
  runBudgetManagerAgent,
  runPaceFeasibilityAgent,
  runRouteMobilityAgent
} from "@/agents/planAnalysis";
import { buildPlanDigests } from "@/agents/presentationAgent";
import { buildRouteScaffold, sanitizeItineraryCoordinates } from "@/agents/routeScaffold";
import { PlanRequestSchema, PlanResponseSchema } from "@/schemas/travel";
import type {
  AgentTrace,
  ConfirmedPreference,
  InputConsistencyOutput,
  Itinerary,
  ItineraryOption,
  MemoryStatus,
  UserMemory
} from "@/types/travel";

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

async function timed<T>(run: () => Promise<T>): Promise<{ value: T; durationMs: number }> {
  const startedAt = Date.now();
  const value = await run();
  return { value, durationMs: Date.now() - startedAt };
}

const OPTION_DIRECTIVES = {
  comfort:
    "Option 1 of 2, comfort-forward: honor every confirmed preference while minimizing logistical burden — shorter transfers, recovery time, reliable bookings. Title and positioning must reflect this comfort-forward framing.",
  experience:
    "Option 2 of 2, experience-forward: honor the same confirmed preferences but trade some convenience for more distinctive local depth where the preferences allow it. Title and positioning must reflect this experience-forward framing."
} as const;

function dedupeOptionIds(options: ItineraryOption[]): ItineraryOption[] {
  const seen = new Set<string>();

  return options.map((option) => {
    let id = option.id;

    while (seen.has(id)) {
      id = `${id}-alt`;
    }

    seen.add(id);
    return id === option.id ? option : { ...option, id };
  });
}

function mergeItineraries(primary: Itinerary, secondary: Itinerary | null): Itinerary {
  if (!secondary) {
    return primary;
  }

  const options = dedupeOptionIds([...primary.options.slice(0, 1), ...secondary.options.slice(0, 1)]);

  return {
    ...primary,
    options,
    selectedOptionId: options[0]?.id ?? primary.selectedOptionId
  };
}

async function runPlannerStage(body: z.infer<typeof PlanRequestSchema>) {
  if (process.env.PARALLEL_PLANNER === "0") {
    const single = await runPlannerAgent(body);
    return { summary: single.summary, itinerary: single.itinerary, agentRuns: 1 };
  }

  const [comfort, experience] = await Promise.allSettled([
    runPlannerAgent(body, OPTION_DIRECTIVES.comfort),
    runPlannerAgent(body, OPTION_DIRECTIVES.experience)
  ]);

  if (comfort.status === "rejected" && experience.status === "rejected") {
    throw comfort.reason;
  }

  const primary = comfort.status === "fulfilled" ? comfort.value : (experience as PromiseFulfilledResult<Awaited<ReturnType<typeof runPlannerAgent>>>).value;
  const secondary = comfort.status === "fulfilled" && experience.status === "fulfilled" ? experience.value : null;

  return {
    summary: primary.summary,
    itinerary: mergeItineraries(primary.itinerary, secondary?.itinerary ?? null),
    agentRuns: secondary ? 2 : 1
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

function planTraceSummaries(input: { language: "en" | "zh"; optionCount: number; warningCount: number; plannerRuns: number }) {
  if (input.language === "zh") {
    return {
      planner: `${input.plannerRuns} 个并行规划器生成了 ${input.optionCount} 个行程方案。`,
      checker: `标记了 ${input.warningCount} 个可行性问题。`
    };
  }

  return {
    planner: `${input.plannerRuns} parallel planner agent(s) generated ${input.optionCount} itinerary options.`,
    checker: `flagged ${input.warningCount} feasibility issues.`
  };
}

function consistencyErrorMessage(validation: InputConsistencyOutput, language: "en" | "zh") {
  const blockingIssue = validation.issues.find((issue) => issue.severity === "Blocking");

  if (!blockingIssue) {
    return validation.summary;
  }

  if (language === "zh") {
    return `规划一致性错误：${blockingIssue.message} 建议：${blockingIssue.recommendation}`;
  }

  return `Planning consistency error: ${blockingIssue.message} Recommendation: ${blockingIssue.recommendation}`;
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

    // Stage A: consistency gate and planner(s) run concurrently; a blocking
    // consistency issue still aborts before anything is returned. The planner
    // payload drops detectedConflicts (answers + learned preferences carry the
    // same signal) to cut input tokens and time-to-first-token.
    const plannerBody = { ...body, detectedConflicts: [] };
    const [consistencyRun, plannerRun] = await Promise.all([
      timed(() => runInputConsistencyAgent(body)),
      timed(() => runPlannerStage(plannerBody))
    ]);
    const consistency = consistencyRun.value;
    const blockingIssues = consistency.issues.filter((issue) => issue.severity === "Blocking");

    if (!consistency.canProceed || blockingIssues.length > 0) {
      return NextResponse.json(
        {
          error: consistencyErrorMessage(consistency, body.language),
          code: "INPUT_CONSISTENCY",
          issues: consistency.issues
        },
        { status: 422 }
      );
    }

    // Stage B: the deterministic route scaffold derives leg structure from the
    // planned activities (the Planner no longer emits routeSegments), then
    // Google enrichment and the LLM constraint checker run concurrently.
    const planner = plannerRun.value;
    const scaffolded = buildRouteScaffold(sanitizeItineraryCoordinates(planner.itinerary, body.language), body.language);
    const [routedRun, checkerRun] = await Promise.all([
      timed(() => enrichItineraryWithGoogleRoutes(scaffolded)),
      timed(() =>
        runConstraintCheckerAgent({
          prompt: body.prompt,
          itinerary: scaffolded,
          confirmedPreferences: body.confirmedPreferences,
          memory: body.memory,
          language: body.language
        })
      )
    ]);
    const routedItinerary = routedRun.value;
    const checker = checkerRun.value;
    const attributedWarnings = checker.warnings.map((warning) => ({
      ...warning,
      sourceAgent: "Constraint Checker Agent" as const
    }));

    // Stage C: deterministic analysis agents run in parallel over the routed
    // itinerary. They are pure arithmetic — instant and reproducible — so the
    // LLM budget stays on elicitation, planning, and explanation.
    const budgetSignals = [
      ...body.learnedPreferences.filter((preference) => preference.category === "budget").map((preference) => preference.value),
      ...body.confirmedPreferences.filter((preference) => preference.category === "budget").map((preference) => preference.value)
    ].join(" ");
    const [budgetRun, routeRun, paceRun, presentationRun] = await Promise.all([
      timed(async () => runBudgetManagerAgent(routedItinerary, body, body.language)),
      timed(async () => runRouteMobilityAgent(routedItinerary, body.language)),
      timed(async () => runPaceFeasibilityAgent(routedItinerary, body.language)),
      timed(async () => buildPlanDigests(routedItinerary, budgetSignals))
    ]);

    // Deterministic findings first: when the LLM checker flags the same
    // (type, day), the numerically grounded warning wins.
    const warnings = mergeWarnings(
      budgetRun.value.warnings,
      routeRun.value.warnings,
      paceRun.value.warnings,
      attributedWarnings
    );
    const summaries = planTraceSummaries({
      language: body.language,
      optionCount: routedItinerary.options.length,
      warningCount: warnings.length,
      plannerRuns: planner.agentRuns
    });
    const presentationSummary =
      body.language === "zh"
        ? `压缩了 ${presentationRun.value.length} 个方案供概览显示。`
        : `Compressed ${presentationRun.value.length} option(s) for the overview display.`;

    const response = PlanResponseSchema.parse({
      itinerary: routedItinerary,
      warnings,
      memoryStatus: memoryStatus(body.memory, body.confirmedPreferences, body.language),
      trace: [
        trace("Input Consistency Agent", consistency.summary, consistency.issues.length, consistencyRun.durationMs),
        trace("Planner Agent", summaries.planner, routedItinerary.options.length, plannerRun.durationMs),
        trace("Constraint Checker Agent", summaries.checker, attributedWarnings.length, checkerRun.durationMs),
        trace("Budget Manager Agent", budgetRun.value.summary, budgetRun.value.warnings.length, budgetRun.durationMs),
        trace("Route Mobility Agent", routeRun.value.summary, routeRun.value.warnings.length, routeRun.durationMs),
        trace("Pace Feasibility Agent", paceRun.value.summary, paceRun.value.warnings.length, paceRun.durationMs),
        trace("Presentation Agent", presentationSummary, presentationRun.value.length, presentationRun.durationMs)
      ],
      digests: presentationRun.value
    });

    return NextResponse.json(response);
  } catch (error) {
    return errorResponse(error);
  }
}
