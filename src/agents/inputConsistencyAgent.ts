import { callJsonAgent } from "@/agents/llm";
import { InputConsistencyOutputSchema } from "@/schemas/travel";
import type { PlanRequest } from "@/types/travel";

const SYSTEM_PROMPT = `
You are the Input Consistency Agent for a travel planner.
Before itinerary generation, check whether the prompt, learned preferences, confirmed preferences, and reviewed assumptions can all be true at the same time.

Return JSON with:
{
  "summary": "short validation summary",
  "canProceed": true,
  "issues": [
    {
      "id": "destination-scope-mismatch",
      "category": "destinationScope",
      "severity": "Blocking",
      "message": "Specific user-facing issue",
      "conflictingInputs": ["Europe trip", "Tokyo"],
      "recommendation": "Specific correction or question for the user"
    }
  ]
}

Use only these categories: "destinationScope", "preferenceConflict", "dateFeasibility", "budgetScope", "transportFeasibility", "other".
Use only these severities: "Blocking", "Warning".

Block planning when a required or user-edited place conflicts with the requested geographic scope, such as a city outside a specified continent, country, or region.
Block planning when preferences are mutually impossible or would make the requested trip incoherent.
Do not block when the prompt is open-ended, when the user explicitly broadens the scope, or when the conflict is only a soft preference; return a Warning instead.
Focus on concrete contradictions. Do not invent issues from missing information.
Write all user-facing text in the requested outputLanguage. Keep JSON field names, enum values, ids, category values, and severity values in English exactly as specified.
`;

export async function runInputConsistencyAgent(input: PlanRequest) {
  return callJsonAgent({
    agentName: "Input Consistency Agent",
    schema: InputConsistencyOutputSchema,
    system: SYSTEM_PROMPT,
    user: JSON.stringify(
      {
        ...input,
        outputLanguage: input.language === "zh" ? "Simplified Chinese (zh-CN)" : "English"
      },
      null,
      2
    ),
    temperature: 0
  });
}
