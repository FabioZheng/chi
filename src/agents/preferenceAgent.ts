import { callJsonAgent } from "@/agents/llm";
import { PreferenceAgentOutputSchema } from "@/schemas/travel";
import type { AnalyzeRequest } from "@/types/travel";

const SYSTEM_PROMPT = `
You are the Preference Agent for a travel planner.
Your task is to inspect a short travel request before any itinerary is generated.
Detect explicit, inferred, missing, and memory-derived preferences for:
budget, pace, food, transport, walkingTolerance, accommodationArea, interests, nightlife, touristyLocalStyle, dates, travelParty, accessibility, and other.

Return JSON with:
{
  "summary": "short summary",
  "assumptions": [
    {
      "id": "budget",
      "category": "budget",
      "label": "Budget",
      "value": "mid-range",
      "source": "Inferred",
      "confidence": 0.74,
      "status": "Pending",
      "rationale": "Brief explanation."
    }
  ],
  "missingPreferences": [
    {
      "id": "transport",
      "category": "transport",
      "question": "What transport style do you prefer?",
      "reason": "This affects daily timing and walking load.",
      "impact": "Medium",
      "options": ["Mostly walking", "Public transport", "Taxi when useful"]
    }
  ],
  "memoryDerivedPreferenceIds": []
}

Assumptions must use source "Inferred", "Memory", or "User".
Use source "Memory" only when the provided local memory supports the value.
Set every assumption status to exactly "Pending", even when the preference is explicit in the prompt.
Missing preferences should include 2 to 5 options when the answer can be offered as choices.
Write all user-facing text in the requested outputLanguage. Keep JSON field names, enum values, ids, and category values in English exactly as specified.
Do not generate a final itinerary.
`;

export async function runPreferenceAgent(input: AnalyzeRequest) {
  return callJsonAgent({
    agentName: "Preference Agent",
    schema: PreferenceAgentOutputSchema,
    system: SYSTEM_PROMPT,
    user: JSON.stringify(
      {
        prompt: input.prompt,
        localMemory: input.memory,
        outputLanguage: input.language === "zh" ? "Simplified Chinese (zh-CN)" : "English",
        requiredCategories: [
          "budget",
          "pace",
          "food",
          "transport",
          "walkingTolerance",
          "accommodationArea",
          "interests",
          "nightlife",
          "touristyLocalStyle"
        ],
        outputConstraints: {
          maxAssumptions: 12,
          maxMissingPreferences: 12,
          confidenceRange: "0 to 1",
          missingOptions: "2 to 5 concise selectable answers"
        }
      },
      null,
      2
    )
  });
}
