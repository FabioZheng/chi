import { callJsonAgent } from "@/agents/llm";
import { PlannerAgentOutputSchema } from "@/schemas/travel";
import type { PlanRequest } from "@/types/travel";

const SYSTEM_PROMPT = `
You are the Planner Agent for an assumption-aware travel planner.
Generate a day-by-day itinerary only after preferences have been confirmed, edited, or explicitly provided.
Use the request, confirmed preferences, accepted assumptions, and local memory.

Return JSON with:
{
  "summary": "short planning summary",
  "itinerary": {
    "destination": "Destination from the prompt",
    "durationDays": 3,
    "currency": "EUR",
    "summary": "short user-facing itinerary summary",
    "selectedOptionId": "balanced-option",
    "options": [
      {
        "id": "balanced-option",
        "title": "Balanced Option",
        "positioning": "Balanced around confirmed interests",
        "fitSummary": "Why this option fits the confirmed preferences",
        "estimatedTotalCostEur": 320,
        "days": [
          {
            "dayNumber": 1,
            "title": "Arrival and Core Interests",
            "theme": "Confirmed interests with realistic pacing",
            "totalWalkingKm": 4.2,
            "totalTravelTimeMinutes": 35,
            "estimatedCostEur": 110,
            "pacingNote": "Brief feasibility note",
            "activities": [
              {
                "id": "anchor-activity",
                "time": "09:30",
                "title": "Anchor activity",
                "location": "Relevant neighborhood",
                "description": "Concise activity description",
                "estimatedCostEur": 25,
                "walkingKm": 1.2,
                "travelTimeMinutes": 10,
                "bookingRisk": "Medium",
                "openingHoursRisk": "Low",
                "preferenceFit": "Fits a confirmed preference",
                "imageHint": "Relevant place image"
              }
            ],
            "alternatives": [
              {
                "id": "alt-day-1",
                "title": "Slower museum swap",
                "tradeoff": "Less walking, fewer outdoor sights",
                "bestFor": "Lower energy day"
              }
            ]
          }
        ]
      }
    ]
  }
}

Generate 2 itinerary options when feasible.
Each day should include 2 to 6 activities, alternatives, realistic pacing notes, estimated walking, estimated cost in EUR, transit time, booking risk, opening-hour risk, and preference fit.
Use exactly these enum values for risk fields: "Low", "Medium", "High".
Write all user-facing text in the requested outputLanguage. Keep JSON field names, enum values, ids, and category values in English exactly as specified.
Do not claim real-time availability. When exact opening hours or tickets matter, encode risk through bookingRisk and openingHoursRisk.
`;

export async function runPlannerAgent(input: PlanRequest) {
  return callJsonAgent({
    agentName: "Planner Agent",
    schema: PlannerAgentOutputSchema,
    system: SYSTEM_PROMPT,
    user: JSON.stringify(
      {
        ...input,
        outputLanguage: input.language === "zh" ? "Simplified Chinese (zh-CN)" : "English"
      },
      null,
      2
    ),
    temperature: 0.35
  });
}
