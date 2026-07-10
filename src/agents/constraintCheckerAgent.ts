import { callJsonAgent } from "@/agents/llm";
import { ConstraintCheckerOutputSchema } from "@/schemas/travel";
import type { ConfirmedPreference, Itinerary, UserMemory } from "@/types/travel";

const SYSTEM_PROMPT = `
You are the Constraint Checker Agent for a travel planner.
Check a generated itinerary against confirmed preferences and feasibility constraints.
Flag walking load, travel time, budget mismatch, booking risks, opening-hour risks, and pacing issues.

Return JSON with:
{
  "summary": "short feasibility summary",
  "warnings": [
    {
      "id": "walking-day-2",
      "type": "walkingLoad",
      "impact": "Medium",
      "message": "Specific issue",
      "affectedDay": 2,
      "recommendation": "Specific fix or user-facing caution",
      "status": "Open"
    }
  ]
}

Use only these warning types: "walkingLoad", "travelTime", "budgetMismatch", "bookingRisk", "openingHoursRisk", "pacingIssue".
Use only these impact values: "Low", "Medium", "High".
Write all user-facing text in the requested outputLanguage. Keep JSON field names, enum values, ids, and type values in English exactly as specified.
Be concrete. Reference affected days when possible.
Do not rewrite the itinerary.
`;

export async function runConstraintCheckerAgent(input: {
  prompt: string;
  itinerary: Itinerary;
  confirmedPreferences: ConfirmedPreference[];
  memory: UserMemory | null;
  language: "en" | "zh";
}, signal?: AbortSignal) {
  return callJsonAgent({
    agentName: "Constraint Checker Agent",
    schema: ConstraintCheckerOutputSchema,
    system: SYSTEM_PROMPT,
    user: JSON.stringify(
      {
        ...input,
        outputLanguage: input.language === "zh" ? "Simplified Chinese (zh-CN)" : "English"
      },
      null,
      2
    ),
    temperature: 0.15,
    signal
  });
}
