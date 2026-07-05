import type {
  AnalyzeRequest,
  AnalyzeResponse,
  PlanRequest,
  PlanResponse,
  PreferenceProbeRequest,
  PreferenceProbeResponse
} from "@/types/travel";

const REQUEST_TIMEOUT_MS = 90000;

async function postJson<ResponseBody>(url: string, payload: unknown): Promise<ResponseBody> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The planning request timed out. Please try again.");
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const detail = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(detail.error || response.statusText);
  }

  return response.json() as Promise<ResponseBody>;
}

export function analyzePreferences(payload: AnalyzeRequest) {
  return postJson<AnalyzeResponse>("/api/analyze", payload);
}

export function learnPreferences(payload: PreferenceProbeRequest) {
  return postJson<PreferenceProbeResponse>("/api/probe", payload);
}

export function generateItinerary(payload: PlanRequest) {
  return postJson<PlanResponse>("/api/plan", payload);
}
