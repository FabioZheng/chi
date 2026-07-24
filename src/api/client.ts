import { z } from "zod";
import {
  AnalyzeResponseSchema,
  ExpandResponseSchema,
  PlanResponseSchema,
  PreferenceProbeResponseSchema
} from "@/schemas/travel";
import type {
  AnalyzeRequest,
  AnalyzeResponse,
  ExpandRequest,
  ExpandResponse,
  PlanRequest,
  PlanResponse,
  PreferenceProbeRequest,
  PreferenceProbeResponse
} from "@/types/travel";

const REQUEST_TIMEOUT_MS = 110_000;
const PROBE_REQUEST_TIMEOUT_MS = 230_000;
const PLAN_REQUEST_TIMEOUT_MS = 270_000;

async function postJson<ResponseBody>(
  url: string,
  payload: unknown,
  schema: z.ZodType<ResponseBody>,
  timeoutMs = REQUEST_TIMEOUT_MS,
  signal?: AbortSignal
): Promise<ResponseBody> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort();

  // Let callers cancel in-flight work (e.g. pruning a branch mid-expansion).
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", abortFromCaller, { once: true });
    }
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(detail.error || response.statusText);
    }

    return schema.parse(await response.json());
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      if (signal?.aborted) {
        throw new DOMException("Planning paused", "AbortError");
      }

      throw new Error("The planning request timed out. Please try again.");
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}

export function analyzePreferences(payload: AnalyzeRequest) {
  return postJson<AnalyzeResponse>("/api/analyze", payload, AnalyzeResponseSchema);
}

export function learnPreferences(payload: PreferenceProbeRequest) {
  return postJson<PreferenceProbeResponse>(
    "/api/probe",
    payload,
    PreferenceProbeResponseSchema,
    PROBE_REQUEST_TIMEOUT_MS
  );
}

export function generateItinerary(payload: PlanRequest, signal?: AbortSignal) {
  return postJson<PlanResponse>("/api/plan", payload, PlanResponseSchema, PLAN_REQUEST_TIMEOUT_MS, signal);
}

export function expandBranches(payload: ExpandRequest, signal?: AbortSignal) {
  return postJson<ExpandResponse>("/api/expand", payload, ExpandResponseSchema, REQUEST_TIMEOUT_MS, signal);
}
