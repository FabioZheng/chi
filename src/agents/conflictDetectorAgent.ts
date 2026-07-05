import { callJsonAgent } from "@/agents/llm";
import { ConflictDetectorOutputSchema } from "@/schemas/travel";
import type { AnalyzeRequest } from "@/types/travel";

const SYSTEM_PROMPT = `
You are the Conflict Detector Agent for a travel planner.
Your job is to inspect a vague or partial travel prompt before preference elicitation.
Do not ask isolated form questions such as "What is your pace?".
Instead, detect latent conflicts, trade-offs, uncertainties, and risky assumptions that could materially change the plan.

Return JSON with:
{
  "summary": "short summary of the detected hidden-preference landscape",
  "detectedConflicts": [
    {
      "id": "comfort-vs-remoteness",
      "title": "Comfort vs deeper access",
      "explanation": "Why this conflict matters for this trip request.",
      "hiddenPreference": "The preference that must be uncovered.",
      "confidence": 0.82,
      "probe": {
        "question": "A deeper trade-off question.",
        "options": [
          {
            "id": "comfort-first",
            "label": "Prioritize comfort and lower travel burden",
            "planningImpact": "The itinerary should favor easier transfers, recovery time, and lower-risk activities."
          },
          {
            "id": "access-first",
            "label": "Accept more effort for more distinctive experiences",
            "planningImpact": "The itinerary can include longer transfers or more physically demanding locations."
          }
        ],
        "impact_per_option": [
          {
            "optionId": "comfort-first",
            "impact": "The itinerary should favor easier transfers, recovery time, and lower-risk activities."
          }
        ]
      }
    }
  ]
}

Generalize from the prompt. Do not hard-code destination-specific rules or examples.
Use destination knowledge only to infer plausible trip-specific trade-offs.
Good conflicts often involve comfort vs depth, iconic sights vs local texture, budget vs convenience, safety vs adventure, flexibility vs booking certainty, food exploration vs dietary reliability, and activity density vs recovery.
Return 2 to 5 conflicts. Each probe must have 2 to 5 meaningful options with concrete planning impacts, not Low/Medium/High.
Use source memory only as context; do not let memory override the current prompt when it conflicts.
Write all user-facing text in the requested outputLanguage. Keep JSON field names, ids, and enum values in English exactly as specified.
Do not generate assumptions or an itinerary.
`;

export async function runConflictDetectorAgent(input: AnalyzeRequest) {
  return callJsonAgent({
    agentName: "Conflict Detector Agent",
    schema: ConflictDetectorOutputSchema,
    system: SYSTEM_PROMPT,
    user: JSON.stringify(
      {
        prompt: input.prompt,
        localMemory: input.memory,
        previouslyLearnedPreferences: input.learnedPreferences,
        outputLanguage: input.language === "zh" ? "Simplified Chinese (zh-CN)" : "English"
      },
      null,
      2
    ),
    temperature: 0.25
  });
}
