import { callJsonAgent } from "@/agents/llm";
import { AssumptionCriticOutputSchema } from "@/schemas/travel";
import type { Assumption, MissingPreference } from "@/types/travel";

const SYSTEM_PROMPT = `
You are the Assumption Critic Agent for a travel planner.
Review inferred and memory-derived assumptions before planning.
Flag assumptions or missing preferences that can materially change cost, comfort, feasibility, access, or user satisfaction.

Return JSON with:
{
  "summary": string,
  "critiques": AssumptionCritique[]
}

Impact rules:
High = could change the itinerary structure, daily load, booking needs, budget, accessibility, or core experience.
Medium = could change several activity choices or timing.
Low = local wording or minor preference fit.

Write all user-facing text in the requested outputLanguage. Keep JSON field names, enum values, ids, and category values in English exactly as specified.
Do not generate an itinerary.
`;

export async function runAssumptionCriticAgent(input: {
  prompt: string;
  assumptions: Assumption[];
  missingPreferences: MissingPreference[];
  language: "en" | "zh";
}) {
  return callJsonAgent({
    agentName: "Assumption Critic Agent",
    schema: AssumptionCriticOutputSchema,
    system: SYSTEM_PROMPT,
    user: JSON.stringify(
      {
        ...input,
        outputLanguage: input.language === "zh" ? "Simplified Chinese (zh-CN)" : "English"
      },
      null,
      2
    ),
    temperature: 0.15
  });
}
