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

function normalizedConfidence(input: unknown): number {
  const value = typeof input === "number" ? input : Number(asText(input, "0.7"));
  const scaled = value > 1 ? value / 100 : value;
  return Number.isFinite(scaled) ? Math.min(1, Math.max(0, scaled)) : 0.7;
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

export const ActivitySchema = z.preprocess((input) => {
  const record = asRecord(input);
  const title = asText(record.title ?? record.name ?? record.activity, "Activity");

  return {
    id: asText(record.id, title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "activity"),
    time: asText(record.time ?? record.startTime ?? record.timeslot, "Flexible"),
    title,
    location: asText(record.location ?? record.area ?? record.neighborhood, title),
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

export const AgentTraceSchema = z.object({
  agent: z.enum([
    "Preference Agent",
    "Assumption Critic Agent",
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

export const PreferenceAgentOutputSchema = z.object({
  summary: z.string().min(1),
  assumptions: z.array(AssumptionSchema).min(1),
  missingPreferences: z.array(MissingPreferenceSchema),
  memoryDerivedPreferenceIds: z.array(z.string())
});

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
  language: LanguageSchema.default("en")
});

export const AnalyzeResponseSchema = z.object({
  assumptions: z.array(AssumptionSchema),
  missingPreferences: z.array(MissingPreferenceSchema),
  critiques: z.array(AssumptionCritiqueSchema),
  trace: z.array(AgentTraceSchema)
});

export const PlanRequestSchema = z.object({
  prompt: z.string().min(4),
  assumptions: z.array(AssumptionSchema),
  confirmedPreferences: z.array(ConfirmedPreferenceSchema),
  memory: UserMemorySchema.nullable(),
  language: LanguageSchema.default("en")
});

export const PlanResponseSchema = z.object({
  itinerary: ItinerarySchema,
  warnings: z.array(ConstraintWarningSchema),
  trace: z.array(AgentTraceSchema)
});
