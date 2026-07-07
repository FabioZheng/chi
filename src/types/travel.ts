import type { z } from "zod";
import type {
  ActivitySchema,
  AgentTraceSchema,
  AlternativeOptionSchema,
  AnalyzeRequestSchema,
  AnalyzeResponseSchema,
  AccommodationAssumptionSchema,
  AssumptionCritiqueSchema,
  AssumptionSchema,
  CheckpointDecisionSchema,
  ConfirmedPreferenceSchema,
  ConflictDetectorOutputSchema,
  ConflictProbeOptionSchema,
  ConstraintWarningSchema,
  CostAssumptionSchema,
  CostBreakdownItemSchema,
  DetectedConflictSchema,
  ItineraryDaySchema,
  ItineraryOptionSchema,
  ItinerarySchema,
  InputConsistencyIssueSchema,
  InputConsistencyOutputSchema,
  LearnedPreferenceSchema,
  MapPlaceSchema,
  MemoryStatusSchema,
  MemoryPreferenceSchema,
  MissingPreferenceSchema,
  PlanRequestSchema,
  PlanResponseSchema,
  PreferenceInfluenceSchema,
  PreferenceProbeAnswerSchema,
  PreferenceProbeRequestSchema,
  PreferenceProbeResponseSchema,
  RouteSegmentSchema,
  TransportAssumptionSchema,
  UserMemorySchema
} from "@/schemas/travel";

export type Activity = z.infer<typeof ActivitySchema>;
export type AgentTrace = z.infer<typeof AgentTraceSchema>;
export type AgentTraceStep = AgentTrace;
export type AlternativeOption = z.infer<typeof AlternativeOptionSchema>;
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;
export type AccommodationAssumption = z.infer<typeof AccommodationAssumptionSchema>;
export type Assumption = z.infer<typeof AssumptionSchema>;
export type AssumptionCritique = z.infer<typeof AssumptionCritiqueSchema>;
export type RiskyAssumption = AssumptionCritique;
export type CheckpointDecision = z.infer<typeof CheckpointDecisionSchema>;
export type ConfirmedPreference = z.infer<typeof ConfirmedPreferenceSchema>;
export type ConflictDetectorOutput = z.infer<typeof ConflictDetectorOutputSchema>;
export type ConflictProbeOption = z.infer<typeof ConflictProbeOptionSchema>;
export type ConstraintWarning = z.infer<typeof ConstraintWarningSchema>;
export type CostAssumption = z.infer<typeof CostAssumptionSchema>;
export type CostBreakdownItem = z.infer<typeof CostBreakdownItemSchema>;
export type DetectedConflict = z.infer<typeof DetectedConflictSchema>;
export type Itinerary = z.infer<typeof ItinerarySchema>;
export type ItineraryDay = z.infer<typeof ItineraryDaySchema>;
export type ItineraryOption = z.infer<typeof ItineraryOptionSchema>;
export type InputConsistencyIssue = z.infer<typeof InputConsistencyIssueSchema>;
export type InputConsistencyOutput = z.infer<typeof InputConsistencyOutputSchema>;
export type LearnedPreference = z.infer<typeof LearnedPreferenceSchema>;
export type MapPlace = z.infer<typeof MapPlaceSchema>;
export type MemoryStatus = z.infer<typeof MemoryStatusSchema>;
export type MemoryPreference = z.infer<typeof MemoryPreferenceSchema>;
export type MissingPreference = z.infer<typeof MissingPreferenceSchema>;
export type PlanRequest = z.infer<typeof PlanRequestSchema>;
export type PlanResponse = z.infer<typeof PlanResponseSchema>;
export type PreferenceInfluence = z.infer<typeof PreferenceInfluenceSchema>;
export type PreferenceProbeAnswer = z.infer<typeof PreferenceProbeAnswerSchema>;
export type PreferenceProbeRequest = z.infer<typeof PreferenceProbeRequestSchema>;
export type PreferenceProbeResponse = z.infer<typeof PreferenceProbeResponseSchema>;
export type RouteSegment = z.infer<typeof RouteSegmentSchema>;
export type TransportAssumption = z.infer<typeof TransportAssumptionSchema>;
export type UserMemory = z.infer<typeof UserMemorySchema>;

export type ProcessStep =
  | "request"
  | "conflicts"
  | "probes"
  | "learned"
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
