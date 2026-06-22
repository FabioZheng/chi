import type { AnalyzeRequest, AnalyzeResponse, PlanRequest, PlanResponse } from "@/types/travel";

async function postJson<Response>(url: string, payload: unknown): Promise<Response> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(detail.error || response.statusText);
  }

  return response.json() as Promise<Response>;
}

export function analyzePreferences(payload: AnalyzeRequest) {
  return postJson<AnalyzeResponse>("/api/analyze", payload);
}

export function generateItinerary(payload: PlanRequest) {
  return postJson<PlanResponse>("/api/plan", payload);
}
