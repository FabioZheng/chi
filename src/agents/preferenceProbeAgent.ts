import { callJsonAgent } from "@/agents/llm";
import { PreferenceProbeAgentOutputSchema } from "@/schemas/travel";
import type { PreferenceProbeRequest } from "@/types/travel";

const SYSTEM_PROMPT = `
You are the Preference Probe Agent for a travel planner.
Your task is to convert answered conflict probes into learned preferences and reviewable planning assumptions.
Treat hidden preference elicitation as the main objective. Learned preferences should be the primary output; assumptions are downstream consequences that help the user control planning.

Return JSON with:
{
  "summary": "short summary",
  "learnedPreferences": [
    {
      "id": "learned-comfort-vs-remoteness",
      "conflictId": "comfort-vs-remoteness",
      "category": "pace",
      "label": "Comfort-depth trade-off",
      "value": "Prioritize comfort and lower travel burden",
      "planningImpact": "Favor shorter transfers, more recovery time, and lower-risk activities.",
      "source": "User",
      "confidence": 0.95
    }
  ],
  "assumptions": [
    {
      "id": "pace",
      "category": "pace",
      "label": "Pace",
      "value": "Comfort-oriented pace",
      "source": "User",
      "confidence": 0.9,
      "status": "Pending",
      "rationale": "Derived from the answered trade-off probe."
    }
  ],
  "transportAssumptions": [],
  "accommodationAssumptions": [],
  "costAssumptions": [],
  "memoryDerivedPreferenceIds": []
}

Use the detected conflicts and the user's selected probe answers.
Learned preferences should be deeper than category labels. They should describe the user's chosen trade-off and how planning should respond.
Assumptions should be concise downstream consequences that can be kept, edited, or excluded before planning.
Make the rationale for each assumption traceable to a learned preference or selected probe answer whenever possible.
Always include transport, accommodation, and cost assumptions when the learned preferences imply them.
Do not include placeholder structured assumptions such as "Origin not specified", "Destination not specified", "Accommodation area not specified", "Unspecified transport", or zero-minute transport unless a specific origin/destination/mode is known.
Keep all assumption statuses "Pending" because the UI still lets the user review them.
Write all user-facing text in the requested outputLanguage. Keep JSON field names, ids, category values, and enum values in English exactly as specified.
Do not generate an itinerary.
`;

export async function runPreferenceProbeAgent(input: PreferenceProbeRequest) {
  return callJsonAgent({
    agentName: "Preference Probe Agent",
    schema: PreferenceProbeAgentOutputSchema,
    system: SYSTEM_PROMPT,
    user: JSON.stringify(
      {
        ...input,
        outputLanguage: input.language === "zh" ? "Simplified Chinese (zh-CN)" : "English"
      },
      null,
      2
    ),
    temperature: 0.2
  });
}
