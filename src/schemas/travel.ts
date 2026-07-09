import { z } from "zod";

type ImpactValue = "Low" | "Medium" | "High";
type PreferenceCategoryValue =
  | "budget"
  | "pace"
  | "food"
  | "transport"
  | "walkingTolerance"
  | "accommodationArea"
  | "interests"
  | "nightlife"
  | "touristyLocalStyle"
  | "dates"
  | "travelParty"
  | "accessibility"
  | "other";
type PreferenceSourceValue = "Inferred" | "Memory" | "User";
type AssumptionStatusValue = "Pending" | "Accepted" | "Edited" | "Rejected";
type ConstraintWarningTypeValue =
  | "walkingLoad"
  | "travelTime"
  | "budgetMismatch"
  | "bookingRisk"
  | "openingHoursRisk"
  | "pacingIssue";
type CostCategoryValue =
  | "accommodation"
  | "transport"
  | "food"
  | "attractions"
  | "localTransit"
  | "optionalActivities"
  | "other";
type LocationStatusValue = "Exact" | "Approximate" | "Unavailable";
type CheckpointStageValue = "beforeAccommodation" | "beforeItinerary" | "beforeFinalPlan" | "none";
type InputConsistencySeverityValue = "Blocking" | "Warning";
type InputConsistencyCategoryValue =
  | "destinationScope"
  | "preferenceConflict"
  | "dateFeasibility"
  | "budgetScope"
  | "transportFeasibility"
  | "other";

const categoryAliases: Record<string, PreferenceCategoryValue> = {
  accommodation: "accommodationArea",
  accommodation_area: "accommodationArea",
  accommodationarea: "accommodationArea",
  area: "accommodationArea",
  budget: "budget",
  cost: "budget",
  dates: "dates",
  date: "dates",
  dining: "food",
  food: "food",
  cuisine: "food",
  interests: "interests",
  interest: "interests",
  localstyle: "touristyLocalStyle",
  nightlife: "nightlife",
  other: "other",
  pace: "pace",
  pacing: "pace",
  style: "touristyLocalStyle",
  touristylocalstyle: "touristyLocalStyle",
  touristy_local_style: "touristyLocalStyle",
  transport: "transport",
  transportation: "transport",
  travelparty: "travelParty",
  travel_party: "travelParty",
  accessibility: "accessibility",
  walking: "walkingTolerance",
  walkingtolerance: "walkingTolerance",
  walking_tolerance: "walkingTolerance"
};

const categoryLabels: Record<PreferenceCategoryValue, string> = {
  budget: "Budget",
  pace: "Pace",
  food: "Food",
  transport: "Transport",
  walkingTolerance: "Walking tolerance",
  accommodationArea: "Accommodation area",
  interests: "Interests",
  nightlife: "Nightlife",
  touristyLocalStyle: "Touristy/local style",
  dates: "Dates",
  travelParty: "Travel party",
  accessibility: "Accessibility",
  other: "Other"
};

const warningTypeAliases: Record<string, ConstraintWarningTypeValue> = {
  walkingload: "walkingLoad",
  walking_load: "walkingLoad",
  walking: "walkingLoad",
  traveltime: "travelTime",
  travel_time: "travelTime",
  transit: "travelTime",
  transit_time: "travelTime",
  budgetmismatch: "budgetMismatch",
  budget_mismatch: "budgetMismatch",
  budget: "budgetMismatch",
  bookingrisk: "bookingRisk",
  booking_risk: "bookingRisk",
  booking: "bookingRisk",
  openinghoursrisk: "openingHoursRisk",
  opening_hours_risk: "openingHoursRisk",
  opening_hours: "openingHoursRisk",
  pacingissue: "pacingIssue",
  pacing_issue: "pacingIssue",
  pacing: "pacingIssue"
};

const inputConsistencyCategoryAliases: Record<string, InputConsistencyCategoryValue> = {
  destinationscope: "destinationScope",
  destination_scope: "destinationScope",
  geography: "destinationScope",
  geographic: "destinationScope",
  location: "destinationScope",
  region: "destinationScope",
  scope: "destinationScope",
  preferenceconflict: "preferenceConflict",
  preference_conflict: "preferenceConflict",
  contradiction: "preferenceConflict",
  conflict: "preferenceConflict",
  datefeasibility: "dateFeasibility",
  date_feasibility: "dateFeasibility",
  dates: "dateFeasibility",
  timing: "dateFeasibility",
  budgetscope: "budgetScope",
  budget_scope: "budgetScope",
  budget: "budgetScope",
  cost: "budgetScope",
  transportfeasibility: "transportFeasibility",
  transport_feasibility: "transportFeasibility",
  transport: "transportFeasibility",
  transit: "transportFeasibility",
  other: "other"
};

const costCategoryAliases: Record<string, CostCategoryValue> = {
  accommodation: "accommodation",
  accommodations: "accommodation",
  hotel: "accommodation",
  lodging: "accommodation",
  stay: "accommodation",
  transport: "transport",
  transportation: "transport",
  train: "transport",
  flight: "transport",
  bus: "transport",
  intercity: "transport",
  food: "food",
  dining: "food",
  meals: "food",
  meal: "food",
  attractions: "attractions",
  attraction: "attractions",
  tickets: "attractions",
  ticket: "attractions",
  admissions: "attractions",
  admission: "attractions",
  localtransit: "localTransit",
  local_transit: "localTransit",
  local_transport: "localTransit",
  metro: "localTransit",
  taxi: "localTransit",
  optionalactivities: "optionalActivities",
  optional_activities: "optionalActivities",
  optional: "optionalActivities",
  activities: "optionalActivities",
  other: "other",
  misc: "other",
  miscellaneous: "other"
};

const costCategoryLabels: Record<CostCategoryValue, string> = {
  accommodation: "Accommodation",
  transport: "Transport",
  food: "Food",
  attractions: "Attractions",
  localTransit: "Local transit",
  optionalActivities: "Optional activities",
  other: "Other"
};

const checkpointStageAliases: Record<string, CheckpointStageValue> = {
  accommodation: "beforeAccommodation",
  beforeaccommodation: "beforeAccommodation",
  before_accommodation: "beforeAccommodation",
  hotel: "beforeAccommodation",
  lodging: "beforeAccommodation",
  stay: "beforeAccommodation",
  itinerary: "beforeItinerary",
  route: "beforeItinerary",
  beforeitinerary: "beforeItinerary",
  before_itinerary: "beforeItinerary",
  plan: "beforeItinerary",
  final: "beforeFinalPlan",
  beforefinalplan: "beforeFinalPlan",
  before_final_plan: "beforeFinalPlan",
  finalplan: "beforeFinalPlan",
  none: "none",
  no: "none",
  skip: "none"
};

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
}

function asText(input: unknown, fallback = ""): string {
  if (typeof input === "string") {
    return input.trim() || fallback;
  }

  if (typeof input === "number" || typeof input === "boolean") {
    return String(input);
  }

  if (Array.isArray(input)) {
    return input.map((item) => asText(item)).filter(Boolean).join(", ") || fallback;
  }

  return fallback;
}

function routePlaceRef(input: unknown, fallback: string): string {
  const direct = asText(input);

  if (direct) {
    return direct;
  }

  const record = asRecord(input);
  return asText(
    record.id ??
      record.placeId ??
      record.place_id ??
      record.sourceActivityId ??
      record.activityId ??
      record.title ??
      record.name ??
      record.location ??
      record.label,
    fallback
  );
}

function normalizedCategory(input: unknown): PreferenceCategoryValue {
  const key = asText(input, "other").replace(/[\s/-]+/g, "_").replace(/[^\w]/g, "").toLowerCase();
  return categoryAliases[key] || "other";
}

function normalizedImpact(input: unknown): ImpactValue {
  const value = asText(input, "Medium").toLowerCase();

  if (value.includes("high")) {
    return "High";
  }

  if (value.includes("low")) {
    return "Low";
  }

  if (value.includes("none") || value.includes("no risk")) {
    return "Low";
  }

  return "Medium";
}

function normalizedSource(input: unknown): PreferenceSourceValue {
  const value = asText(input, "Inferred").toLowerCase();

  if (value.includes("memory")) {
    return "Memory";
  }

  if (value.includes("user") || value.includes("explicit")) {
    return "User";
  }

  return "Inferred";
}

function normalizedStatus(input: unknown): AssumptionStatusValue {
  const value = asText(input, "Pending").toLowerCase();

  if (value.includes("accept")) {
    return "Accepted";
  }

  if (value.includes("edit")) {
    return "Edited";
  }

  if (value.includes("reject")) {
    return "Rejected";
  }

  return "Pending";
}

function normalizedRouteReliability(input: unknown): "Real" | "Estimated" | "Missing" {
  const value = asText(input, "Estimated").toLowerCase();

  if (value.includes("missing") || value.includes("unavailable") || value.includes("unknown")) {
    return "Missing";
  }

  if (value.includes("real") || value.includes("routed") || value.includes("verified")) {
    return "Real";
  }

  return "Estimated";
}

function normalizedConfidence(input: unknown): number {
  const value = typeof input === "number" ? input : Number(asText(input, "0.7"));
  const scaled = value > 1 ? value / 100 : value;
  return Number.isFinite(scaled) ? Math.min(1, Math.max(0, scaled)) : 0.7;
}

function normalizedCheckpointStage(input: unknown): CheckpointStageValue {
  const key = asText(input, "beforeItinerary").replace(/[\s/-]+/g, "_").replace(/[^\w]/g, "").toLowerCase();
  return checkpointStageAliases[key] || "beforeItinerary";
}

function normalizedOptions(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.map((item) => asText(item)).filter(Boolean).slice(0, 5);
}

function normalizedWarningType(input: unknown): ConstraintWarningTypeValue {
  const key = asText(input, "pacingIssue").replace(/[\s/-]+/g, "_").replace(/[^\w]/g, "").toLowerCase();
  return warningTypeAliases[key] || "pacingIssue";
}

function normalizedInputConsistencySeverity(input: unknown): InputConsistencySeverityValue {
  const value = asText(input, "Warning").toLowerCase();

  if (value.includes("block") || value.includes("critical") || value.includes("error") || value.includes("cannot")) {
    return "Blocking";
  }

  return "Warning";
}

function normalizedInputConsistencyCategory(input: unknown): InputConsistencyCategoryValue {
  const key = asText(input, "other").replace(/[\s/-]+/g, "_").replace(/[^\w]/g, "").toLowerCase();
  return inputConsistencyCategoryAliases[key] || "other";
}

function normalizedCostCategory(input: unknown): CostCategoryValue {
  const key = asText(input, "other").replace(/[\s/-]+/g, "_").replace(/[^\w]/g, "").toLowerCase();
  return costCategoryAliases[key] || "other";
}

function normalizedBoolean(input: unknown, fallback = false): boolean {
  if (typeof input === "boolean") {
    return input;
  }

  const value = asText(input).toLowerCase();

  if (["true", "yes", "y", "1", "change", "changed", "different", "needed", "need", "planning"].includes(value)) {
    return true;
  }

  if (["false", "no", "n", "0", "same", "unchanged", "none", "skip", "not needed", "non-planning", "nonplanning"].includes(value)) {
    return false;
  }

  return fallback;
}

function normalizedLocationStatus(input: unknown, hasCoordinates: boolean): LocationStatusValue {
  const value = asText(input, hasCoordinates ? "Approximate" : "Unavailable").toLowerCase();

  if (value.includes("exact")) {
    return "Exact";
  }

  if (value.includes("approx") || value.includes("rough") || value.includes("estimated")) {
    return "Approximate";
  }

  return hasCoordinates ? "Approximate" : "Unavailable";
}

export const ImpactSchema = z.enum(["Low", "Medium", "High"]);
export const LanguageSchema = z.enum(["en", "zh"]);

export const PreferenceCategorySchema = z.enum([
  "budget",
  "pace",
  "food",
  "transport",
  "walkingTolerance",
  "accommodationArea",
  "interests",
  "nightlife",
  "touristyLocalStyle",
  "dates",
  "travelParty",
  "accessibility",
  "other"
]);

export const PreferenceSourceSchema = z.enum(["Inferred", "Memory", "User"]);
export const AssumptionStatusSchema = z.enum(["Pending", "Accepted", "Edited", "Rejected"]);
export const RouteReliabilitySchema = z.enum(["Real", "Estimated", "Missing"]);
export const RouteProviderSchema = z.enum(["google_routes", "fallback_estimated"]);
export const CostCategorySchema = z.enum([
  "accommodation",
  "transport",
  "food",
  "attractions",
  "localTransit",
  "optionalActivities",
  "other"
]);

export const AssumptionSchema = z.preprocess((input) => {
  const record = asRecord(input);
  const category = normalizedCategory(record.category ?? record.type ?? record.key ?? record.name);
  const label = asText(record.label ?? record.title ?? record.name, categoryLabels[category]);
  const value = asText(record.value ?? record.preference ?? record.inferredValue ?? record.answer, label);

  return {
    id: asText(record.id, category),
    category,
    label,
    value,
    source: normalizedSource(record.source),
    confidence: normalizedConfidence(record.confidence ?? record.confidenceScore ?? record.confidence_score),
    status: normalizedStatus(record.status),
    rationale: asText(record.rationale ?? record.reason ?? record.why ?? record.explanation, "Detected from the prompt.")
  };
}, z.object({
  id: z.string().min(1),
  category: PreferenceCategorySchema,
  label: z.string().min(1),
  value: z.string().min(1),
  source: PreferenceSourceSchema,
  confidence: z.number().min(0).max(1),
  status: AssumptionStatusSchema,
  rationale: z.string().min(1)
}));

export const MissingPreferenceSchema = z.preprocess((input) => {
  const record = asRecord(input);
  const category = normalizedCategory(record.category ?? record.type ?? record.key ?? record.name);

  return {
    id: asText(record.id, category),
    category,
    question: asText(record.question ?? record.prompt ?? record.label, `What is your ${categoryLabels[category]} preference?`),
    reason: asText(record.reason ?? record.rationale ?? record.whyItMatters ?? record.why, "This affects the trip plan."),
    impact: normalizedImpact(record.impact ?? record.priority),
    options: normalizedOptions(record.options ?? record.suggestions ?? record.choices)
  };
}, z.object({
  id: z.string().min(1),
  category: PreferenceCategorySchema,
  question: z.string().min(1),
  reason: z.string().min(1),
  impact: ImpactSchema,
  options: z.array(z.string().min(1)).max(5)
}));

export const AssumptionCritiqueSchema = z.preprocess((input) => {
  const record = asRecord(input);
  const category = normalizedCategory(record.category ?? record.type ?? record.key);

  return {
    id: asText(record.id, `critique-${category}`),
    assumptionId: record.assumptionId === undefined || record.assumptionId === null ? null : asText(record.assumptionId),
    category,
    impact: normalizedImpact(record.impact ?? record.priority),
    issue: asText(record.issue ?? record.risk ?? record.title, "Assumption may affect plan quality."),
    whyItMatters: asText(record.whyItMatters ?? record.reason ?? record.rationale, "This preference can change the itinerary."),
    recommendedQuestion: asText(
      record.recommendedQuestion ?? record.question,
      `Can you confirm your ${categoryLabels[category]} preference?`
    ),
    suggestedResolution: asText(
      record.suggestedResolution ?? record.resolution ?? record.recommendation,
      "Ask the user to confirm or edit this preference."
    )
  };
}, z.object({
  id: z.string().min(1),
  assumptionId: z.string().nullable(),
  category: PreferenceCategorySchema,
  impact: ImpactSchema,
  issue: z.string().min(1),
  whyItMatters: z.string().min(1),
  recommendedQuestion: z.string().min(1),
  suggestedResolution: z.string().min(1)
}));

export const ConfirmedPreferenceSchema = z.object({
  id: z.string().min(1),
  category: PreferenceCategorySchema,
  label: z.string().min(1),
  value: z.string().min(1),
  source: PreferenceSourceSchema
});

export const ConflictProbeOptionSchema = z.preprocess((input) => {
  const record = asRecord(input);
  const label = asText(record.label ?? record.title ?? record.value ?? record.option, "Preference option");

  return {
    id: asText(record.id, label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "option"),
    label,
    planningImpact: asText(
      record.planningImpact ?? record.impact ?? record.impact_per_option ?? record.effect,
      "This choice changes itinerary pacing, routing, or trade-offs."
    )
  };
}, z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  planningImpact: z.string().min(1)
}));

export const ConflictProbeImpactSchema = z.preprocess((input) => {
  const record = asRecord(input);

  return {
    optionId: asText(record.optionId ?? record.option_id ?? record.id ?? record.option, "option"),
    impact: asText(record.impact ?? record.planningImpact ?? record.planning_impact, "Changes the itinerary strategy.")
  };
}, z.object({
  optionId: z.string().min(1),
  impact: z.string().min(1)
}));

export const ConflictProbeSchema = z.preprocess((input) => {
  const record = asRecord(input);
  const options = Array.isArray(record.options) ? record.options : [];
  const rawImpact = record.impactPerOption ?? record.impact_per_option ?? record.impacts;
  const impactPerOption = Array.isArray(rawImpact)
    ? rawImpact
    : Object.entries(asRecord(rawImpact)).map(([optionId, impact]) => ({ optionId, impact }));

  return {
    question: asText(record.question ?? record.prompt, "Which trade-off feels closer to what you want?"),
    options,
    impactPerOption
  };
}, z.object({
  question: z.string().min(1),
  options: z.array(ConflictProbeOptionSchema).min(2).max(6),
  impactPerOption: z.array(ConflictProbeImpactSchema)
}));

export const DetectedConflictSchema = z.preprocess((input) => {
  const record = asRecord(input);
  const title = asText(record.title ?? record.name ?? record.conflictName ?? record.conflict_name, "Planning trade-off");

  return {
    id: asText(record.id, title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "conflict"),
    title,
    explanation: asText(
      record.explanation ?? record.whyItMatters ?? record.why_it_matters ?? record.reason,
      "This trade-off can materially change the itinerary."
    ),
    hiddenPreference: asText(
      record.hiddenPreference ?? record.hidden_preference ?? record.preference,
      "The planner needs to uncover the traveler's preferred trade-off."
    ),
    confidence: normalizedConfidence(record.confidence),
    probe: record.probe ?? record.question ?? {}
  };
}, z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  explanation: z.string().min(1),
  hiddenPreference: z.string().min(1),
  confidence: z.number().min(0).max(1),
  probe: ConflictProbeSchema
}));

export const PreferenceProbeAnswerSchema = z.object({
  conflictId: z.string().min(1),
  optionId: z.string().min(1),
  answer: z.string().min(1),
  planningImpact: z.string().min(1)
});

export const LearnedPreferenceSchema = z.preprocess((input) => {
  const record = asRecord(input);
  const category = normalizedCategory(record.category ?? record.type ?? record.key);
  const value = asText(record.value ?? record.answer ?? record.preference, "Learned preference");

  return {
    id: asText(record.id, `learned-${category}-${value}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")),
    conflictId: asText(record.conflictId ?? record.conflict_id ?? record.sourceConflictId ?? record.source_conflict_id, "conflict"),
    category,
    label: asText(record.label ?? record.title, categoryLabels[category]),
    value,
    planningImpact: asText(
      record.planningImpact ?? record.impact ?? record.planning_impact,
      "Use this preference to shape route, pace, comfort, and activity choices."
    ),
    source: normalizedSource(record.source ?? "User"),
    confidence: normalizedConfidence(record.confidence)
  };
}, z.object({
  id: z.string().min(1),
  conflictId: z.string().min(1),
  category: PreferenceCategorySchema,
  label: z.string().min(1),
  value: z.string().min(1),
  planningImpact: z.string().min(1),
  source: PreferenceSourceSchema,
  confidence: z.number().min(0).max(1)
}));

export const PreferenceInfluenceSchema = z.preprocess((input) => {
  const record = asRecord(input);

  return {
    preferenceId: asText(record.preferenceId ?? record.preference_id ?? record.id, "preference"),
    preference: asText(record.preference ?? record.label ?? record.value, "Learned preference"),
    influence: asText(record.influence ?? record.planningImpact ?? record.planning_impact ?? record.reason, "Influenced the itinerary.")
  };
}, z.object({
  preferenceId: z.string().min(1),
  preference: z.string().min(1),
  influence: z.string().min(1)
}));

function normalizedNonNegativeNumber(input: unknown, fallback = 0): number {
  const value = typeof input === "number" ? input : Number(asText(input, String(fallback)));
  return Number.isFinite(value) ? Math.max(0, value) : fallback;
}

function optionIdFromRaw(input: unknown, fallback: string): string {
  const record = asRecord(input);
  return asText(record.id ?? record.optionId ?? record.option_id ?? record.name ?? record.title, fallback);
}

function dayNumberFromRaw(input: unknown, fallback = 1): number {
  const record = asRecord(input);
  const value = normalizedNonNegativeNumber(record.dayNumber ?? record.day ?? record.dayIndex, fallback);
  return Math.max(1, Math.round(value));
}

function normalizedNullableDay(input: unknown): number | null {
  if (input === undefined || input === null || asText(input).toLowerCase() === "all") {
    return null;
  }

  return Math.max(1, Math.round(normalizedNonNegativeNumber(input, 1)));
}

function normalizedCoordinateNumber(input: unknown, min: number, max: number): number | null {
  const value = typeof input === "number" ? input : Number(asText(input));

  if (!Number.isFinite(value) || value < min || value > max) {
    return null;
  }

  return value;
}

function normalizedCoordinates(input: unknown): { lat: number; lng: number } | null {
  if (Array.isArray(input)) {
    const lat = normalizedCoordinateNumber(input[0], -90, 90);
    const lng = normalizedCoordinateNumber(input[1], -180, 180);
    return lat === null || lng === null ? null : { lat, lng };
  }

  const record = asRecord(input);
  const lat = normalizedCoordinateNumber(record.lat ?? record.latitude, -90, 90);
  const lng = normalizedCoordinateNumber(record.lng ?? record.lon ?? record.long ?? record.longitude, -180, 180);

  return lat === null || lng === null ? null : { lat, lng };
}

export const CoordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180)
});

export const CostBreakdownItemSchema = z.preprocess((input) => {
  const record = asRecord(input);
  const category = normalizedCostCategory(record.category ?? record.type ?? record.name);
  const amount = normalizedNonNegativeNumber(
    record.amountEur ??
      record.estimatedCostEur ??
      record.estimatedCostEUR ??
      record.totalEur ??
      record.totalEUR ??
      record.costEur ??
      record.costEUR
  );
  const perDayRaw = record.perDayEur ?? record.perDayEUR ?? record.dailyEstimateEur ?? record.dailyEstimateEUR;
  const totalRaw = record.totalEur ?? record.totalEUR ?? record.totalEstimateEur ?? record.totalEstimateEUR;

  return {
    id: asText(record.id, category),
    category,
    label: asText(record.label ?? record.title ?? record.name, costCategoryLabels[category]),
    amountEur: amount,
    perDayEur: perDayRaw === undefined || perDayRaw === null ? null : normalizedNonNegativeNumber(perDayRaw),
    totalEur: totalRaw === undefined || totalRaw === null ? null : normalizedNonNegativeNumber(totalRaw),
    basis: asText(record.basis ?? record.assumption ?? record.rationale ?? record.note, "Rough category estimate."),
    isRoughEstimate: normalizedBoolean(record.isRoughEstimate ?? record.roughEstimate ?? record.rough, true)
  };
}, z.object({
  id: z.string().min(1),
  category: CostCategorySchema,
  label: z.string().min(1),
  amountEur: z.number().min(0),
  perDayEur: z.number().min(0).nullable(),
  totalEur: z.number().min(0).nullable(),
  basis: z.string().min(1),
  isRoughEstimate: z.boolean()
}));

export const TransportAssumptionSchema = z.preprocess((input) => {
  const record = asRecord(input);
  const from = asText(record.from ?? record.origin ?? record.start, "Origin not specified");
  const to = asText(record.to ?? record.destination ?? record.end, "Destination not specified");

  return {
    id: asText(record.id, `${from}-to-${to}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "transport"),
    from,
    to,
    mode: asText(record.mode ?? record.transportMode ?? record.transport, "Unspecified transport"),
    estimatedTravelTimeMinutes: normalizedNonNegativeNumber(
      record.estimatedTravelTimeMinutes ?? record.travelTimeMinutes ?? record.durationMinutes ?? record.minutes
    ),
    travelBurden: normalizedImpact(record.travelBurden ?? record.burden ?? record.impact),
    confidence: normalizedConfidence(record.confidence),
    status: normalizedStatus(record.status),
    rationale: asText(record.rationale ?? record.reason ?? record.note, "Transport assumption inferred from the trip request.")
  };
}, z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  mode: z.string().min(1),
  estimatedTravelTimeMinutes: z.number().min(0),
  travelBurden: ImpactSchema,
  confidence: z.number().min(0).max(1),
  status: AssumptionStatusSchema,
  rationale: z.string().min(1)
}));

export const AccommodationAssumptionSchema = z.preprocess((input) => {
  const record = asRecord(input);
  const night = Math.max(1, Math.round(normalizedNonNegativeNumber(record.night ?? record.nightNumber ?? record.dayNumber, 1)));

  return {
    id: asText(record.id, `night-${night}-accommodation`),
    night,
    area: asText(record.area ?? record.location ?? record.neighborhood ?? record.city, "Accommodation area not specified"),
    accommodationStyle: asText(record.accommodationStyle ?? record.style ?? record.level ?? record.type, "Unspecified accommodation"),
    changeFromPreviousNight: normalizedBoolean(record.changeFromPreviousNight ?? record.changeAccommodation ?? record.changed, night > 1),
    confidence: normalizedConfidence(record.confidence),
    status: normalizedStatus(record.status),
    rationale: asText(record.rationale ?? record.reason ?? record.note, "Accommodation assumption inferred from the trip request.")
  };
}, z.object({
  id: z.string().min(1),
  night: z.number().int().min(1),
  area: z.string().min(1),
  accommodationStyle: z.string().min(1),
  changeFromPreviousNight: z.boolean(),
  confidence: z.number().min(0).max(1),
  status: AssumptionStatusSchema,
  rationale: z.string().min(1)
}));

export const CostAssumptionSchema = z.preprocess((input) => {
  const record = asRecord(input);
  const category = normalizedCostCategory(record.category ?? record.type ?? record.name);

  return {
    id: asText(record.id, `cost-${category}`),
    category,
    label: asText(record.label ?? record.title ?? record.name, costCategoryLabels[category]),
    perDayEstimateEur: normalizedNonNegativeNumber(
      record.perDayEstimateEur ?? record.perDayEstimateEUR ?? record.dailyEstimateEur ?? record.dailyEstimateEUR
    ),
    totalEstimateEur: normalizedNonNegativeNumber(
      record.totalEstimateEur ?? record.totalEstimateEUR ?? record.totalEur ?? record.totalEUR
    ),
    confidence: normalizedConfidence(record.confidence),
    status: normalizedStatus(record.status),
    basis: asText(record.basis ?? record.assumption ?? record.rationale ?? record.note, "Rough estimate based on stated preferences."),
    isRoughEstimate: normalizedBoolean(record.isRoughEstimate ?? record.roughEstimate ?? record.rough, true)
  };
}, z.object({
  id: z.string().min(1),
  category: CostCategorySchema,
  label: z.string().min(1),
  perDayEstimateEur: z.number().min(0),
  totalEstimateEur: z.number().min(0),
  confidence: z.number().min(0).max(1),
  status: AssumptionStatusSchema,
  basis: z.string().min(1),
  isRoughEstimate: z.boolean()
}));

export const MapPlaceSchema = z.preprocess((input) => {
  const record = asRecord(input);
  const coordinates = normalizedCoordinates(
    record.coordinates ?? record.coordinate ?? record.coords ?? {
      lat: record.lat ?? record.latitude,
      lng: record.lng ?? record.lon ?? record.longitude
    }
  );
  const title = asText(record.title ?? record.name ?? record.place, "Place");

  return {
    id: asText(record.id ?? record.placeId ?? record.place_id, title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "place"),
    dayNumber: normalizedNullableDay(record.dayNumber ?? record.day),
    title,
    location: asText(record.location ?? record.area ?? record.address, title),
    coordinates,
    locationStatus: normalizedLocationStatus(record.locationStatus ?? record.status ?? record.coordinateStatus, Boolean(coordinates)),
    sourceActivityId: record.sourceActivityId === undefined || record.sourceActivityId === null ? null : asText(record.sourceActivityId),
    unavailableReason: coordinates
      ? null
      : asText(record.unavailableReason ?? record.locationUnavailableReason ?? record.reason, "Coordinates unavailable.")
  };
}, z.object({
  id: z.string().min(1),
  dayNumber: z.number().int().min(1).nullable(),
  title: z.string().min(1),
  location: z.string().min(1),
  coordinates: CoordinatesSchema.nullable(),
  locationStatus: z.enum(["Exact", "Approximate", "Unavailable"]),
  sourceActivityId: z.string().nullable(),
  unavailableReason: z.string().nullable()
}));

export const RouteSegmentSchema = z.preprocess((input) => {
  const record = asRecord(input);
  const dayNumber = normalizedNullableDay(record.dayNumber ?? record.day);
  const fromPlaceId = routePlaceRef(
    record.fromPlaceId ?? record.fromStopId ?? record.fromId ?? record.originId ?? record.originPlaceId ?? record.from ?? record.origin ?? record.start,
    dayNumber ? `day-${dayNumber}-route-origin` : "route-origin"
  );
  const toPlaceId = routePlaceRef(
    record.toPlaceId ?? record.toStopId ?? record.toId ?? record.destinationId ?? record.destinationPlaceId ?? record.to ?? record.destination ?? record.end,
    dayNumber ? `day-${dayNumber}-route-destination` : "route-destination"
  );
  const rawDistanceMeters = normalizedNonNegativeNumber(record.distanceMeters ?? record.meters);
  const distanceKm = normalizedNonNegativeNumber(record.distanceKm ?? record.km ?? record.distance, rawDistanceMeters / 1000);
  const distanceMeters = normalizedNonNegativeNumber(record.distanceMeters ?? record.meters, distanceKm * 1000);
  const durationSeconds = normalizedNonNegativeNumber(
    record.durationSeconds ?? record.duration_seconds ?? record.seconds,
    normalizedNonNegativeNumber(record.estimatedTravelTimeMinutes ?? record.travelTimeMinutes ?? record.durationMinutes ?? record.minutes) * 60
  );
  const routeStatus = normalizedRouteReliability(record.geometryStatus ?? record.routeStatus ?? record.routingStatus ?? record.reliability ?? record.status);
  const providerText = asText(record.provider, routeStatus === "Real" ? "google_routes" : "fallback_estimated");
  const warnings = Array.isArray(record.warnings)
    ? record.warnings.map((warning) => asText(warning)).filter(Boolean).slice(0, 8)
    : asText(record.warning)
      ? [asText(record.warning)]
      : [];

  return {
    id: asText(record.id, `${fromPlaceId}-to-${toPlaceId}`.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "route-segment"),
    dayNumber,
    fromPlaceId,
    toPlaceId,
    fromStopId: asText(record.fromStopId ?? record.fromPlaceId, fromPlaceId),
    toStopId: asText(record.toStopId ?? record.toPlaceId, toPlaceId),
    fromCoordinates: normalizedCoordinates(record.fromCoordinates ?? record.originCoordinates ?? record.origin_coordinate),
    toCoordinates: normalizedCoordinates(record.toCoordinates ?? record.destinationCoordinates ?? record.destination_coordinate),
    transportMode: asText(record.transportMode ?? record.mode ?? record.transport, "Unspecified transport"),
    estimatedTravelTimeMinutes: normalizedNonNegativeNumber(
      record.estimatedTravelTimeMinutes ?? record.travelTimeMinutes ?? record.durationMinutes ?? record.minutes,
      durationSeconds / 60
    ),
    durationSeconds,
    distanceKm,
    distanceMeters,
    encodedPolyline: asText(record.encodedPolyline ?? record.polyline ?? record.routePolyline) || null,
    provider: providerText === "google_routes" ? "google_routes" : "fallback_estimated",
    geometryStatus: routeStatus,
    confidence: normalizedConfidence(record.confidence ?? record.routeConfidence ?? record.routingConfidence),
    routeStatus,
    reason: asText(
      record.reason ?? record.choiceReason ?? record.transportReason ?? record.rationale ?? record.notes ?? record.note,
      "Transport choice follows the reviewed preferences and available route data."
    ),
    relatedPreference:
      record.relatedPreference === undefined && record.relatedPreferenceId === undefined && record.preference === undefined
        ? null
        : asText(record.relatedPreference ?? record.relatedPreferenceId ?? record.preference),
    notes: asText(record.notes ?? record.note ?? record.rationale, "Estimated movement between places."),
    warnings
  };
}, z.object({
  id: z.string().min(1),
  dayNumber: z.number().int().min(1).nullable(),
  fromPlaceId: z.string().min(1),
  toPlaceId: z.string().min(1),
  fromStopId: z.string().min(1),
  toStopId: z.string().min(1),
  fromCoordinates: CoordinatesSchema.nullable(),
  toCoordinates: CoordinatesSchema.nullable(),
  transportMode: z.string().min(1),
  estimatedTravelTimeMinutes: z.number().min(0),
  durationSeconds: z.number().min(0),
  distanceKm: z.number().min(0),
  distanceMeters: z.number().min(0),
  encodedPolyline: z.string().nullable(),
  provider: RouteProviderSchema,
  geometryStatus: RouteReliabilitySchema,
  confidence: z.number().min(0).max(1),
  routeStatus: RouteReliabilitySchema,
  reason: z.string().min(1),
  relatedPreference: z.string().nullable(),
  notes: z.string().min(1),
  warnings: z.array(z.string())
}));

export const ActivitySchema = z.preprocess((input) => {
  const record = asRecord(input);
  const title = asText(record.title ?? record.name ?? record.activity, "Activity");
  const coordinates = normalizedCoordinates(
    record.coordinates ?? record.coordinate ?? record.coords ?? {
      lat: record.lat ?? record.latitude,
      lng: record.lng ?? record.lon ?? record.longitude
    }
  );

  return {
    id: asText(record.id, title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "activity"),
    time: asText(record.time ?? record.startTime ?? record.timeslot, "Flexible"),
    title,
    location: asText(record.location ?? record.area ?? record.neighborhood, title),
    coordinates,
    locationStatus: normalizedLocationStatus(record.locationStatus ?? record.coordinateStatus, Boolean(coordinates)),
    locationUnavailableReason: coordinates
      ? null
      : asText(record.locationUnavailableReason ?? record.unavailableReason ?? record.geocodingStatus ?? record.reason, "Coordinates unavailable."),
    description: asText(record.description ?? record.note ?? record.summary, "Planned activity."),
    estimatedCostEur: normalizedNonNegativeNumber(
      record.estimatedCostEur ?? record.estimatedCostEUR ?? record.estimatedCost ?? record.costEur ?? record.costEUR
    ),
    walkingKm: normalizedNonNegativeNumber(
      record.walkingKm ?? record.estimatedWalkingKm ?? record.walkingDistanceKm ?? record.walkKm
    ),
    travelTimeMinutes: normalizedNonNegativeNumber(
      record.travelTimeMinutes ?? record.transitTimeMinutes ?? record.totalTransitMinutes ?? record.travelMinutes
    ),
    bookingRisk: normalizedImpact(record.bookingRisk),
    openingHoursRisk: normalizedImpact(record.openingHoursRisk),
    preferenceFit: asText(record.preferenceFit ?? record.fit, "Aligned with confirmed preferences."),
    imageHint: asText(record.imageHint ?? record.image ?? record.thumbnail, title)
  };
}, z.object({
  id: z.string().min(1),
  time: z.string().min(1),
  title: z.string().min(1),
  location: z.string().min(1),
  coordinates: CoordinatesSchema.nullable(),
  locationStatus: z.enum(["Exact", "Approximate", "Unavailable"]),
  locationUnavailableReason: z.string().nullable(),
  description: z.string().min(1),
  estimatedCostEur: z.number().min(0),
  walkingKm: z.number().min(0),
  travelTimeMinutes: z.number().min(0),
  bookingRisk: ImpactSchema,
  openingHoursRisk: ImpactSchema,
  preferenceFit: z.string().min(1),
  imageHint: z.string().min(1)
}));

export const AlternativeOptionSchema = z.preprocess((input) => {
  const record = asRecord(input);
  const title = asText(record.title ?? record.name, "Flexible alternative");

  return {
    id: asText(record.id, title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "alternative"),
    title,
    tradeoff: asText(record.tradeoff ?? record.description ?? record.note, "Changes pacing or preference fit."),
    bestFor: asText(record.bestFor ?? record.fit ?? record.audience, "Travelers who want a different emphasis.")
  };
}, z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  tradeoff: z.string().min(1),
  bestFor: z.string().min(1)
}));

export const ItineraryDaySchema = z.preprocess((input) => {
  const record = asRecord(input);
  const dayNumber = dayNumberFromRaw(record);
  const activities = Array.isArray(record.activities) ? record.activities : [];
  const alternatives = Array.isArray(record.alternatives)
    ? record.alternatives
    : [
        {
          id: `alt-day-${dayNumber}`,
          title: "Flexible swap",
          tradeoff: "Replace one activity if energy, weather, or bookings change.",
          bestFor: "Keeping the day preference-aligned without overpacking it."
        }
      ];

  return {
    dayNumber,
    title: asText(record.title ?? record.date ?? record.name, `Day ${dayNumber}`),
    theme: asText(record.theme ?? record.focus ?? record.subtitle ?? record.notes, `Day ${dayNumber} plan`),
    activities,
    alternatives,
    costBreakdown: Array.isArray(record.costBreakdown ?? record.costs ?? record.costCategories)
      ? (record.costBreakdown ?? record.costs ?? record.costCategories)
      : [],
    routeSegments: Array.isArray(record.routeSegments ?? record.transportSegments ?? record.movements)
      ? (record.routeSegments ?? record.transportSegments ?? record.movements)
      : [],
    accommodation: record.accommodation ?? record.stay ?? null,
    totalWalkingKm: normalizedNonNegativeNumber(
      record.totalWalkingKm ?? record.walkingKm ?? record.estimatedWalkingKm,
      activities.reduce((sum, activity) => sum + normalizedNonNegativeNumber(asRecord(activity).estimatedWalkingKm ?? asRecord(activity).walkingKm), 0)
    ),
    totalTravelTimeMinutes: normalizedNonNegativeNumber(
      record.totalTravelTimeMinutes ?? record.totalTransitMinutes ?? record.travelTimeMinutes,
      activities.reduce(
        (sum, activity) =>
          sum + normalizedNonNegativeNumber(asRecord(activity).transitTimeMinutes ?? asRecord(activity).travelTimeMinutes),
        0
      )
    ),
    estimatedCostEur: normalizedNonNegativeNumber(
      record.estimatedCostEur ?? record.totalCostEUR ?? record.totalCostEur ?? record.costEur,
      activities.reduce(
        (sum, activity) =>
          sum + normalizedNonNegativeNumber(asRecord(activity).estimatedCostEUR ?? asRecord(activity).estimatedCostEur),
        0
      )
    ),
    pacingNote: asText(record.pacingNote ?? record.notes ?? record.note, "Designed around the confirmed pace preference.")
  };
}, z.object({
  dayNumber: z.number().int().min(1),
  title: z.string().min(1),
  theme: z.string().min(1),
  activities: z.array(ActivitySchema),
  alternatives: z.array(AlternativeOptionSchema),
  costBreakdown: z.array(CostBreakdownItemSchema),
  routeSegments: z.array(RouteSegmentSchema),
  accommodation: AccommodationAssumptionSchema.nullable(),
  totalWalkingKm: z.number().min(0),
  totalTravelTimeMinutes: z.number().min(0),
  estimatedCostEur: z.number().min(0),
  pacingNote: z.string().min(1)
}));

export const ItineraryOptionSchema = z.preprocess((input) => {
  const record = asRecord(input);
  const id = optionIdFromRaw(record, "option-1");
  const days = Array.isArray(record.days) ? record.days : [];

  return {
    id,
    title: asText(record.title ?? record.name, id),
    positioning: asText(record.positioning ?? record.focus ?? record.description, "Preference-aligned itinerary option."),
    fitSummary: asText(record.fitSummary ?? record.summary ?? record.description, "Built from confirmed preferences."),
    days,
    mapPlaces: Array.isArray(record.mapPlaces ?? record.places ?? record.routePlaces)
      ? (record.mapPlaces ?? record.places ?? record.routePlaces)
      : [],
    routeSegments: Array.isArray(record.routeSegments ?? record.transportSegments ?? record.movements)
      ? (record.routeSegments ?? record.transportSegments ?? record.movements)
      : [],
    costBreakdown: Array.isArray(record.costBreakdown ?? record.costs ?? record.costCategories)
      ? (record.costBreakdown ?? record.costs ?? record.costCategories)
      : [],
    costAssumptions: Array.isArray(record.costAssumptions ?? record.costBasis ?? record.costNotes)
      ? (record.costAssumptions ?? record.costBasis ?? record.costNotes)
      : [],
    preferenceInfluences: Array.isArray(record.preferenceInfluences ?? record.learnedPreferenceInfluences ?? record.preference_influences)
      ? (record.preferenceInfluences ?? record.learnedPreferenceInfluences ?? record.preference_influences)
      : [],
    estimatedTotalCostEur: normalizedNonNegativeNumber(
      record.estimatedTotalCostEur ?? record.totalCostEUR ?? record.totalCostEur,
      days.reduce(
        (sum, day) =>
          sum + normalizedNonNegativeNumber(asRecord(day).estimatedCostEur ?? asRecord(day).totalCostEUR ?? asRecord(day).totalCostEur),
        0
      )
    )
  };
}, z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  positioning: z.string().min(1),
  fitSummary: z.string().min(1),
  days: z.array(ItineraryDaySchema).min(1),
  mapPlaces: z.array(MapPlaceSchema),
  routeSegments: z.array(RouteSegmentSchema),
  costBreakdown: z.array(CostBreakdownItemSchema),
  costAssumptions: z.array(CostAssumptionSchema),
  preferenceInfluences: z.array(PreferenceInfluenceSchema),
  estimatedTotalCostEur: z.number().min(0)
}));

export const ItinerarySchema = z.preprocess((input) => {
  const record = Array.isArray(input) ? { options: input } : asRecord(input);
  const rawOptions = Array.isArray(record.options)
    ? record.options
    : Array.isArray(record.itineraryOptions)
      ? record.itineraryOptions
      : [];
  const firstOption = rawOptions[0];
  const firstOptionRecord = asRecord(firstOption);
  const firstDays = Array.isArray(firstOptionRecord.days) ? firstOptionRecord.days : [];
  const selectedOptionId = asText(
    record.selectedOptionId ?? record.selected_option_id ?? optionIdFromRaw(firstOption, "option-1"),
    "option-1"
  );

  return {
    destination: asText(record.destination ?? record.city ?? record.location, "Trip destination"),
    durationDays: Math.max(
      1,
      Math.round(normalizedNonNegativeNumber(record.durationDays ?? record.duration_days ?? firstDays.length, firstDays.length || 1))
    ),
    currency: asText(record.currency, "EUR"),
    summary: asText(record.summary ?? record.overview, "Generated itinerary based on confirmed preferences."),
    selectedOptionId,
    options: rawOptions
  };
}, z.object({
  destination: z.string().min(1),
  durationDays: z.number().int().min(1),
  currency: z.string().min(1),
  summary: z.string().min(1),
  selectedOptionId: z.string().min(1),
  options: z.array(ItineraryOptionSchema).min(1)
}));

export const ConstraintWarningTypeSchema = z.enum([
  "walkingLoad",
  "travelTime",
  "budgetMismatch",
  "bookingRisk",
  "openingHoursRisk",
  "pacingIssue"
]);

export const ConstraintWarningSchema = z.preprocess((input) => {
  const record = asRecord(input);
  const type = normalizedWarningType(record.type ?? record.category ?? record.issueType);
  const affectedDayRaw = record.affectedDay ?? record.day ?? record.dayNumber;
  const affectedDay =
    affectedDayRaw === undefined || affectedDayRaw === null || asText(affectedDayRaw).toLowerCase() === "all"
      ? null
      : Math.max(1, Math.round(normalizedNonNegativeNumber(affectedDayRaw, 1)));
  const statusText = asText(record.status, "Open").toLowerCase();

  return {
    id: asText(record.id, `warning-${type}`),
    type,
    impact: normalizedImpact(record.impact ?? record.severity),
    message: asText(record.message ?? record.issue ?? record.warning, "Potential feasibility issue."),
    affectedDay,
    recommendation: asText(record.recommendation ?? record.suggestedFix ?? record.fix, "Review this before booking."),
    status: statusText.includes("resolve") ? "Resolved" : statusText.includes("ack") ? "Acknowledged" : "Open"
  };
}, z.object({
  id: z.string().min(1),
  type: ConstraintWarningTypeSchema,
  impact: ImpactSchema,
  message: z.string().min(1),
  affectedDay: z.number().int().min(1).nullable(),
  recommendation: z.string().min(1),
  status: z.enum(["Open", "Acknowledged", "Resolved"])
}));

export const InputConsistencyIssueSchema = z.preprocess((input) => {
  const record = asRecord(input);
  const category = normalizedInputConsistencyCategory(record.category ?? record.type ?? record.issueType);
  const severity = normalizedInputConsistencySeverity(record.severity ?? record.impact ?? record.status);
  const rawConflictingInputs = record.conflictingInputs ?? record.conflicting_inputs ?? record.evidence ?? record.conflicts;
  const conflictingInputs = Array.isArray(rawConflictingInputs)
    ? rawConflictingInputs.map((item) => asText(item)).filter(Boolean).slice(0, 8)
    : asText(rawConflictingInputs)
      ? [asText(rawConflictingInputs)]
      : [];

  return {
    id: asText(record.id, `consistency-${category}`),
    category,
    severity,
    message: asText(record.message ?? record.issue ?? record.title, "The request contains a planning consistency issue."),
    conflictingInputs,
    recommendation: asText(record.recommendation ?? record.fix ?? record.suggestedFix, "Revise the conflicting preference before planning.")
  };
}, z.object({
  id: z.string().min(1),
  category: z.enum(["destinationScope", "preferenceConflict", "dateFeasibility", "budgetScope", "transportFeasibility", "other"]),
  severity: z.enum(["Blocking", "Warning"]),
  message: z.string().min(1),
  conflictingInputs: z.array(z.string().min(1)),
  recommendation: z.string().min(1)
}));

export const InputConsistencyOutputSchema = z.preprocess((input) => {
  const record = asRecord(input);
  const issueCandidate = record.issues ?? record.validationIssues ?? record.problems;
  const rawIssues: unknown[] = Array.isArray(issueCandidate) ? issueCandidate : [];
  const parsedIssues = rawIssues.map((issue) => InputConsistencyIssueSchema.parse(issue));
  const hasBlockingIssue = parsedIssues.some((issue) => issue.severity === "Blocking");
  const explicitCanProceed =
    record.canProceed ?? record.can_proceed ?? record.shouldProceed ?? record.should_proceed ?? record.isConsistent ?? record.is_consistent;

  return {
    summary: asText(
      record.summary ?? record.rationale ?? record.overview,
      hasBlockingIssue ? "The request has a blocking consistency issue." : "The request is internally consistent enough to plan."
    ),
    canProceed: explicitCanProceed === undefined ? !hasBlockingIssue : normalizedBoolean(explicitCanProceed, !hasBlockingIssue),
    issues: parsedIssues
  };
}, z.object({
  summary: z.string().min(1),
  canProceed: z.boolean(),
  issues: z.array(InputConsistencyIssueSchema)
}));

export const AgentTraceSchema = z.object({
  agent: z.enum([
    "Conflict Detector Agent",
    "Preference Probe Agent",
    "Preference Agent",
    "Assumption Critic Agent",
    "Input Consistency Agent",
    "Planner Agent",
    "Constraint Checker Agent",
    "Memory Agent"
  ]),
  summary: z.string().min(1),
  status: z.enum(["Idle", "Running", "Complete", "Error"]),
  count: z.number().int().min(0),
  timestamp: z.string().min(1)
});

export const MemoryPreferenceSchema = z.object({
  id: z.string().min(1),
  category: PreferenceCategorySchema,
  label: z.string().min(1),
  value: z.string().min(1),
  source: z.literal("User"),
  updatedAt: z.string().min(1)
});

export const UserMemorySchema = z.object({
  preferences: z.array(MemoryPreferenceSchema),
  lastUpdated: z.string().min(1),
  tripCount: z.number().int().min(0)
});

export const MemoryStatusSchema = z.object({
  used: z.boolean(),
  preferenceCount: z.number().int().min(0),
  appliedPreferenceCount: z.number().int().min(0),
  message: z.string().min(1)
});

export const CheckpointStageSchema = z.enum(["beforeAccommodation", "beforeItinerary", "beforeFinalPlan", "none"]);

export const CheckpointDecisionSchema = z.preprocess((input) => {
  const record = asRecord(input);
  const rawCategories = record.missingPreferenceCategories ?? record.missing_preference_categories ?? record.categories;
  const missingPreferenceCategories = Array.isArray(rawCategories) ? rawCategories.map(normalizedCategory) : [];
  const checkpointNeeded = normalizedBoolean(record.checkpointNeeded ?? record.checkpoint_needed ?? record.needed, missingPreferenceCategories.length > 0);
  const isPlanningTask = normalizedBoolean(record.isPlanningTask ?? record.is_planning_task ?? record.planningTask, true);
  const checkpointStage = checkpointNeeded ? normalizedCheckpointStage(record.checkpointStage ?? record.checkpoint_stage ?? record.stage) : "none";

  return {
    isPlanningTask,
    checkpointNeeded: isPlanningTask && checkpointNeeded,
    checkpointStage: isPlanningTask && checkpointNeeded ? checkpointStage : "none",
    missingPreferenceCategories,
    assumptionRisk: normalizedImpact(record.assumptionRisk ?? record.assumption_risk ?? record.risk),
    expectedPlanImpact: asText(
      record.expectedPlanImpact ?? record.expected_plan_impact ?? record.planImpact ?? record.impact,
      checkpointNeeded
        ? "Resolving this checkpoint could materially change the plan."
        : "The prompt appears specific enough to continue without an extra checkpoint."
    ),
    interactionCost: normalizedImpact(record.interactionCost ?? record.interaction_cost ?? record.userBurden ?? record.burden),
    rationale: asText(
      record.rationale ?? record.reason ?? record.explanation,
      checkpointNeeded
        ? "A missing preference would meaningfully affect the plan."
        : "No lightweight checkpoint is needed before planning."
    )
  };
}, z.object({
  isPlanningTask: z.boolean(),
  checkpointNeeded: z.boolean(),
  checkpointStage: CheckpointStageSchema,
  missingPreferenceCategories: z.array(PreferenceCategorySchema),
  assumptionRisk: ImpactSchema,
  expectedPlanImpact: z.string().min(1),
  interactionCost: ImpactSchema,
  rationale: z.string().min(1)
}));

export const ConflictDetectorOutputSchema = z.preprocess((input) => {
  const record = asRecord(input);
  const rawConflicts = record.detectedConflicts ?? record.detected_conflicts ?? record.conflicts;
  const detectedConflicts = Array.isArray(rawConflicts) ? rawConflicts : [];

  return {
    summary: asText(record.summary ?? record.overview, "Detected latent planning conflicts."),
    checkpointDecision: record.checkpointDecision ?? record.checkpoint_decision ?? record.decision ?? {
      checkpointNeeded: detectedConflicts.length > 0,
      missingPreferenceCategories: [],
      checkpointStage: detectedConflicts.length > 0 ? "beforeItinerary" : "none"
    },
    detectedConflicts
  };
}, z.object({
  summary: z.string().min(1),
  checkpointDecision: CheckpointDecisionSchema,
  detectedConflicts: z.array(DetectedConflictSchema)
}));

export const PreferenceAgentOutputSchema = z.preprocess((input) => {
  const record = asRecord(input);

  return {
    summary: asText(record.summary, "Detected travel preferences."),
    assumptions: Array.isArray(record.assumptions) ? record.assumptions : [],
    missingPreferences: Array.isArray(record.missingPreferences) ? record.missingPreferences : [],
    memoryDerivedPreferenceIds: Array.isArray(record.memoryDerivedPreferenceIds) ? record.memoryDerivedPreferenceIds : [],
    transportAssumptions: Array.isArray(record.transportAssumptions) ? record.transportAssumptions : [],
    accommodationAssumptions: Array.isArray(record.accommodationAssumptions) ? record.accommodationAssumptions : [],
    costAssumptions: Array.isArray(record.costAssumptions) ? record.costAssumptions : []
  };
}, z.object({
  summary: z.string().min(1),
  assumptions: z.array(AssumptionSchema).min(1),
  missingPreferences: z.array(MissingPreferenceSchema),
  memoryDerivedPreferenceIds: z.array(z.string()),
  transportAssumptions: z.array(TransportAssumptionSchema),
  accommodationAssumptions: z.array(AccommodationAssumptionSchema),
  costAssumptions: z.array(CostAssumptionSchema)
}));

export const PreferenceProbeAgentOutputSchema = z.preprocess((input) => {
  const record = asRecord(input);

  return {
    summary: asText(record.summary ?? record.overview, "Learned preferences from probe answers."),
    learnedPreferences: Array.isArray(record.learnedPreferences ?? record.learned_preferences)
      ? (record.learnedPreferences ?? record.learned_preferences)
      : [],
    assumptions: Array.isArray(record.assumptions) ? record.assumptions : [],
    transportAssumptions: Array.isArray(record.transportAssumptions) ? record.transportAssumptions : [],
    accommodationAssumptions: Array.isArray(record.accommodationAssumptions) ? record.accommodationAssumptions : [],
    costAssumptions: Array.isArray(record.costAssumptions) ? record.costAssumptions : [],
    memoryDerivedPreferenceIds: Array.isArray(record.memoryDerivedPreferenceIds) ? record.memoryDerivedPreferenceIds : []
  };
}, z.object({
  summary: z.string().min(1),
  learnedPreferences: z.array(LearnedPreferenceSchema).min(1),
  assumptions: z.array(AssumptionSchema).min(1),
  transportAssumptions: z.array(TransportAssumptionSchema),
  accommodationAssumptions: z.array(AccommodationAssumptionSchema),
  costAssumptions: z.array(CostAssumptionSchema),
  memoryDerivedPreferenceIds: z.array(z.string())
}));

export const AssumptionCriticOutputSchema = z.object({
  summary: z.string().min(1),
  critiques: z.array(AssumptionCritiqueSchema)
});

export const PlannerAgentOutputSchema = z.preprocess((input) => {
  const record = asRecord(input);
  const summary = asText(record.summary ?? record.overview, "Generated itinerary.");
  const itineraryRecord = Array.isArray(record.itinerary) ? { options: record.itinerary } : asRecord(record.itinerary);

  return {
    summary,
    itinerary: {
      ...itineraryRecord,
      summary: asText(itineraryRecord.summary, summary)
    }
  };
}, z.object({
  summary: z.string().min(1),
  itinerary: ItinerarySchema
}));

export const ConstraintCheckerOutputSchema = z.object({
  summary: z.string().min(1),
  warnings: z.array(ConstraintWarningSchema)
});

export const AnalyzeRequestSchema = z.object({
  prompt: z.string().min(4),
  memory: UserMemorySchema.nullable(),
  learnedPreferences: z.array(LearnedPreferenceSchema).default([]),
  language: LanguageSchema.default("en")
});

export const AnalyzeResponseSchema = z.object({
  checkpointDecision: CheckpointDecisionSchema,
  detectedConflicts: z.array(DetectedConflictSchema),
  assumptions: z.array(AssumptionSchema),
  transportAssumptions: z.array(TransportAssumptionSchema),
  accommodationAssumptions: z.array(AccommodationAssumptionSchema),
  costAssumptions: z.array(CostAssumptionSchema),
  learnedPreferences: z.array(LearnedPreferenceSchema),
  missingPreferences: z.array(MissingPreferenceSchema),
  critiques: z.array(AssumptionCritiqueSchema),
  memoryStatus: MemoryStatusSchema,
  trace: z.array(AgentTraceSchema)
});

export const PreferenceProbeRequestSchema = z.object({
  prompt: z.string().min(4),
  detectedConflicts: z.array(DetectedConflictSchema),
  probeAnswers: z.array(PreferenceProbeAnswerSchema),
  memory: UserMemorySchema.nullable(),
  language: LanguageSchema.default("en")
});

export const PreferenceProbeResponseSchema = z.object({
  learnedPreferences: z.array(LearnedPreferenceSchema),
  assumptions: z.array(AssumptionSchema),
  transportAssumptions: z.array(TransportAssumptionSchema),
  accommodationAssumptions: z.array(AccommodationAssumptionSchema),
  costAssumptions: z.array(CostAssumptionSchema),
  critiques: z.array(AssumptionCritiqueSchema),
  memoryStatus: MemoryStatusSchema,
  trace: z.array(AgentTraceSchema)
});

export const PlanRequestSchema = z.object({
  prompt: z.string().min(4),
  detectedConflicts: z.array(DetectedConflictSchema).default([]),
  probeAnswers: z.array(PreferenceProbeAnswerSchema).default([]),
  learnedPreferences: z.array(LearnedPreferenceSchema).default([]),
  assumptions: z.array(AssumptionSchema),
  transportAssumptions: z.array(TransportAssumptionSchema).default([]),
  accommodationAssumptions: z.array(AccommodationAssumptionSchema).default([]),
  costAssumptions: z.array(CostAssumptionSchema).default([]),
  confirmedPreferences: z.array(ConfirmedPreferenceSchema),
  memory: UserMemorySchema.nullable(),
  language: LanguageSchema.default("en")
});

export const PlanResponseSchema = z.object({
  itinerary: ItinerarySchema,
  warnings: z.array(ConstraintWarningSchema),
  memoryStatus: MemoryStatusSchema,
  trace: z.array(AgentTraceSchema)
});
