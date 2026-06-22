import type { z } from "zod";
import type {
  ActivitySchema,
  AgentTraceSchema,
  AlternativeOptionSchema,
  AnalyzeRequestSchema,
  AnalyzeResponseSchema,
  AssumptionCritiqueSchema,
  AssumptionSchema,
  ConfirmedPreferenceSchema,
  ConstraintWarningSchema,
  ItineraryDaySchema,
  ItineraryOptionSchema,
  ItinerarySchema,
  MemoryPreferenceSchema,
  MissingPreferenceSchema,
  PlanRequestSchema,
  PlanResponseSchema,
  UserMemorySchema
} from "@/schemas/travel";

export type Activity = z.infer<typeof ActivitySchema>;
export type AgentTrace = z.infer<typeof AgentTraceSchema>;
export type AgentTraceStep = AgentTrace;
export type AlternativeOption = z.infer<typeof AlternativeOptionSchema>;
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;
export type Assumption = z.infer<typeof AssumptionSchema>;
export type AssumptionCritique = z.infer<typeof AssumptionCritiqueSchema>;
export type RiskyAssumption = AssumptionCritique;
export type ConfirmedPreference = z.infer<typeof ConfirmedPreferenceSchema>;
export type ConstraintWarning = z.infer<typeof ConstraintWarningSchema>;
export type Itinerary = z.infer<typeof ItinerarySchema>;
export type ItineraryDay = z.infer<typeof ItineraryDaySchema>;
export type ItineraryOption = z.infer<typeof ItineraryOptionSchema>;
export type MemoryPreference = z.infer<typeof MemoryPreferenceSchema>;
export type MissingPreference = z.infer<typeof MissingPreferenceSchema>;
export type PlanRequest = z.infer<typeof PlanRequestSchema>;
export type PlanResponse = z.infer<typeof PlanResponseSchema>;
export type UserMemory = z.infer<typeof UserMemorySchema>;

export type ProcessStep =
  | "request"
  | "preferences"
  | "critic"
  | "checkpoint"
  | "planner"
  | "checker"
  | "memory";

export type WorkflowState = {
  currentStep: ProcessStep;
  trace: AgentTraceStep[];
  unresolvedHighImpactCount: number;
  confirmedPreferenceCount: number;
  memoryPreferenceCount: number;
};
