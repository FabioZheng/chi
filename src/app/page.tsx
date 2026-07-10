"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronDown,
  Database,
  Download,
  Loader2,
  MessageSquareText,
  Plane,
  RotateCcw,
  Route,
  SearchCheck,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Stamp,
  X
} from "lucide-react";
import { analyzePreferences, generateItinerary, learnPreferences } from "@/api/client";
import {
  clearUserMemory,
  emptyMemory,
  loadUserMemory,
  mergePreferencesIntoMemory,
  saveUserMemory
} from "@/agents/memoryAgent";
import { ItineraryCanvas } from "@/components/ItineraryCanvas";
import { EmptyState, ImpactBadge, Panel, SourceBadge } from "@/components/Panel";
import { PromptComposer, type PromptStatusChip } from "@/components/PromptComposer";
import { languageNames, type Language, uiText } from "@/i18n";
import { defaultStudyCondition, parseStudyCondition, conditionCode, type StudyCondition } from "@/study/condition";
import { exportStudyLog, logStudyEvent, type StudyEventName } from "@/study/logger";
import type {
  AccommodationAssumption,
  AgentName,
  AgentTrace,
  Assumption,
  AssumptionCritique,
  CheckpointDecision,
  ConfirmedPreference,
  ConstraintWarning,
  CostAssumption,
  DetectedConflict,
  Itinerary,
  LearnedPreference,
  MemoryStatus,
  PlanDigest,
  PreferenceControl,
  PreferenceProbeAnswer,
  TransportAssumption,
  UserMemory
} from "@/types/travel";

type FlowSection = "prompt" | "conflicts" | "probes" | "learned" | "assumptions" | "itinerary" | "feasibility";
type WorkflowStep = FlowSection;
type LoadingStage = "conflicts" | "preferences" | "itinerary" | null;
type PreferencePriority = PreferenceControl["priority"];

type HiddenPreferenceInsight = {
  id: string;
  title: string;
  explicitSignals: string[];
  uncertainty: string;
  hiddenPreference: string;
  whyItMatters: string;
  confidence: number;
  probeQuestion: string;
  selectedAnswer: PreferenceProbeAnswer | null;
  learnedPreference: LearnedPreference | null;
  control: PreferenceControl;
};

type PersistedSession = {
  prompt: string;
  analyzedPrompt: string;
  plannedPrompt: string;
  checkpointDecision: CheckpointDecision | null;
  detectedConflicts: DetectedConflict[];
  probeAnswers: Record<string, PreferenceProbeAnswer>;
  learnedPreferences: LearnedPreference[];
  preferenceControls: Record<string, PreferenceControl>;
  assumptions: Assumption[];
  transportAssumptions: TransportAssumption[];
  accommodationAssumptions: AccommodationAssumption[];
  costAssumptions: CostAssumption[];
  critiques: AssumptionCritique[];
  itinerary: Itinerary | null;
  previousItinerary: Itinerary | null;
  digests: PlanDigest[];
  warnings: ConstraintWarning[];
  selectedOptionId: string | null;
  trace: AgentTrace[];
  memoryStatus: MemoryStatus | null;
  workflowStep: WorkflowStep;
  activeSection: FlowSection;
  language: Language;
};

const SESSION_STORAGE_KEY = "assumption-aware-agent-planner:guided-session";

const flowText = {
  en: {
    eyebrow: "Ambiguity-first trip planning",
    title: "Start with a rough travel idea",
    subtitle:
      "Type something short like \"Italy for one week\" or \"somewhere warm\". The planner turns that ambiguity into a few useful trade-off questions, then builds the trip from what it learns.",
    startNewSession: "Start New Session",
    restored: "Previous session restored",
    saved: "Session saved locally",
    promptTitle: "Rough Trip Idea",
    promptBody: "A destination, season, mood, or simple constraint is enough. The planner separates what you said from what still needs to be discovered.",
    promptPlaceholder: "Try \"Japan in October\", \"somewhere warm\", or \"I have 5 days off\"",
    promptTooShort: "Type at least 4 characters",
    promptExamplesLabel: "Try",
    promptExamples: ["Italy for one week", "Somewhere warm", "Cheap trip to Europe", "Things to do in Tokyo", "I have 5 days off"],
    knownFromPrompt: "What you already said",
    knownFallback: "A rough idea is enough to begin.",
    stillUncertain: "What we will discover next",
    uncertainTripShape: "Trip shape",
    uncertainBudgetComfort: "Budget and comfort",
    uncertainPaceInterests: "Pace and interests",
    uncertainLogistics: "Transport and stay choices",
    detectConflicts: "Check for Hidden Preferences",
    detectingConflicts: "Checking whether a checkpoint is needed",
    conflictsTitle: "Hidden-Preference Checkpoints",
    conflictsBody: "Checkpoint decision, evidence, stage, and hidden preferences detected from the vague prompt.",
    probesTitle: "Checkpoint Questions",
    probesBody: "Answer only the lightweight questions that should materially change the plan.",
    learnedTitle: "What we learned about you",
    learnedBody: "Review the living preference profile before it shapes this trip.",
    assumptionsTitle: "How this changes the itinerary",
    assumptionsBody: "Planner behaviors generated from active preferences.",
    itineraryTitle: "Trip Plan",
    itineraryBody: "A route, map, costs, and trade-offs based on what we learned.",
    feasibilityTitle: "Feasibility Checks",
    current: "Current",
    completed: "Completed",
    waiting: "Waiting",
    confidence: "confidence",
    hiddenPreference: "What we need to learn",
    whyItMatters: "Why it matters",
    planningImpact: "Planning impact",
    chooseOption: "This feels right",
    answered: "Answered",
    unanswered: "Unanswered",
    learnPreferences: "Use My Answers",
    learningPreferences: "Learning from your answers",
    reviewAssumptions: "Review Planning Assumptions",
    generateItinerary: "Build the Trip",
    generatingItinerary: "Generating itinerary",
    assumptionHint: "Kept, edited, and non-excluded consequences remain available to the planner.",
    originalPrompt: "Original prompt",
    learnedInfluences: "Learned preference influence",
    noConflicts: "Start with any rough trip idea.",
    noCheckpointNeeded: "No checkpoint needed",
    checkpointNeeded: "Checkpoint needed",
    nonPlanningPrompt: "This does not look like a planning task",
    checkpointDecision: "Checkpoint decision",
    checkpointStage: "Checkpoint stage",
    missingCategories: "Missing preference categories",
    assumptionRisk: "Assumption risk",
    expectedPlanImpact: "Expected plan impact",
    interactionCost: "Interaction cost",
    proceedWithoutCheckpoint: "Proceed without checkpoint",
    beforeAccommodation: "Before accommodation",
    beforeItinerary: "Before itinerary",
    beforeFinalPlan: "Before final plan",
    noneStage: "None",
    evaluationSignals: "Evaluation Signals",
    checkpointMetrics: "Checkpoint metrics",
    preferenceExpressedRate: "Preference Expressed Rate",
    preferenceMetProxy: "Preference Met Proxy",
    checkpointQuestionCount: "Checkpoint questions",
    activePreferenceCount: "Active preferences",
    interactionBurden: "Interaction burden",
    noGroundTruth: "Ground-truth precision/recall needs labeled evaluation data.",
    noLearned: "Answer a clarifying question to start shaping the plan.",
    noAssumptions: "No assumptions ready for review yet.",
    noItinerary: "No itinerary generated yet.",
    noWarnings: "No feasibility warnings yet.",
    accepted: "Accepted",
    rejected: "Rejected",
    resetNotice: "Clears prompt, conflicts, answers, learned preferences, itinerary, warnings, and persisted session state.",
    errorTitle: "Workflow step failed",
    preferenceHistory: "Preference Profile",
    currentCheckpoint: "Next Best Step",
    planningSteps: "Planning Flow",
    assumptionValue: "Planner behavior",
    assumptionReason: "Why this was inferred",
    useAssumption: "Use in plan",
    reviewLater: "Review suggested",
    excludeAssumption: "Exclude from plan",
    assumptionDecision: "Consequence control",
    assumptionsReadySummary: "ready for itinerary generation",
    traceTitle: "Agent trace",
    explicitSignals: "Explicit signals",
    uncertainty: "Still uncertain",
    whyAsked: "Why the system asked this",
    agentEvidence: "Agent evidence trail",
    selectedAnswer: "Selected answer",
    notAnsweredYet: "Not answered yet",
    preferenceStatus: "Preference status",
    modelConfidence: "Model confidence",
    userControl: "User control",
    source: "Source",
    ignorePreference: "Ignore",
    restorePreference: "Restore",
    makePrimary: "Make primary",
    lowerPriority: "Lower priority",
    activePreference: "Active",
    ignoredPreference: "Ignored",
    primaryPriority: "Primary",
    normalPriority: "Normal",
    lowPriority: "Lower priority",
    preferenceProfileHint: "This is the user model. Confirm whether each learned preference is true about you, then decide how strongly it should matter.",
    consequencesHint: "Planning consequences are planner behaviors generated from active preferences. They control this itinerary only; they do not rewrite the user model.",
    preferenceDetail: "Preference detail",
    preferenceDetailHint: "Specify missing details here, such as cities, neighborhoods, dates, or constraints. Edits update the user model and the next generated plan.",
    editPreference: "Edit preference",
    inferredFrom: "Why we think this is true",
    noActiveConsequences: "Ignored preferences do not create active planning consequences.",
    noLinkedConsequences: "No concrete planner behavior is linked to this preference yet.",
    usedInPlan: "Used in plan",
    excludedFromPlan: "Excluded from plan",
    lowConfidence: "Low confidence",
    highImpact: "High impact",
    mayAffectBudget: "May affect budget",
    profileFlowPrompt: "Prompt and checkpoints",
    profileFlowProfile: "Living Preference Profile",
    profileFlowConsequences: "Planning Consequences",
    profileFlowItinerary: "Itinerary generation",
    lowerPriorityPlannerNote: "Treat this preference as lower priority unless it conflicts with primary preferences.",
    promptSignalLabel: "Prompt",
    memorySignalLabel: "Memory",
    noPreferenceInsights: "No hidden preference insights yet.",
    chipClickHint: "Click the chip or an item to open the related review area.",
    chipAssumptionsTitle: "Planning consequences",
    chipMissingTitle: "Missing or excluded preferences",
    chipHighImpactTitle: "High-impact unresolved items",
    chipMemoryTitle: "Memory preferences",
    chipNoItems: "No items to show.",
    unresolvedStatus: "Unresolved",
    savedStatus: "Saved",
    appliedStatus: "Applied",
    notAppliedStatus: "Not applied",
    memorySaved: "memory preferences saved",
    skipProbe: "Skip — no strong preference",
    skippedAnswer: "Skipped",
    skipPlanningImpact: "The planner will not assume a preference for this trade-off.",
    refineAnswer: "Add detail in your own words (optional)",
    refinePlaceholder: "e.g. I can walk a lot in the morning, less at night",
    criticFollowUp: "Critic follow-up question",
    applyRefinement: "Apply refinement",
    refinementPlaceholder: "Answer in your own words to refine this consequence",
    planDiffTitle: "Changed plan",
    planDiffBody: "How your latest edits changed the itinerary.",
    beforePlan: "Before (assumption-filled)",
    afterPlan: "After (preference-aware)",
    diffAdded: "Added",
    diffRemoved: "Removed",
    diffKept: "kept",
    boardingTotalDays: "Total days",
    boardingBudget: "Est. budget",
    boardingPace: "Pace",
    boardingWalking: "Walking load",
    agentBoardTitle: "Multi-Agent Backend",
    agentBoardBody: "Live status and timing of each planning agent.",
    agentStatusIdle: "Idle",
    agentStatusRunning: "Running",
    agentStatusComplete: "Done",
    agentStatusError: "Error",
    agentShortNames: {
      "Conflict Detector Agent": "Detector",
      "Preference Probe Agent": "Probe",
      "Preference Agent": "Preference",
      "Assumption Critic Agent": "Critic",
      "Input Consistency Agent": "Consistency",
      "Planner Agent": "Planner",
      "Constraint Checker Agent": "Checker",
      "Budget Manager Agent": "Budget",
      "Route Mobility Agent": "Route",
      "Pace Feasibility Agent": "Pace",
      "Presentation Agent": "Present",
      "Memory Agent": "Memory"
    } as Record<AgentName, string>,
    studySession: "Study session",
    exportLog: "Export log",
    readOnlyNotice: "Review-only study condition — editing controls are disabled.",
    producedBy: "Produced by",
    refinePlan: "Refine plan",
    refinePlanning: "Refining the plan",
    reanalyze: "Re-analyze from scratch",
    promptChangedTitle: "You changed the trip idea",
    promptChangedBody:
      "Refine keeps your reviewed preferences and re-plans around the new details. Re-analyze starts hidden-preference discovery over from this prompt.",
    promptChangedShort: "Prompt edited since this plan",
    refinementPreferenceLabel: "Latest instruction",
    refinementOverridesNote: "LATEST INSTRUCTION — overrides any conflicting earlier preference in this plan.",
    scopeMinor: "Minor adjustment — refines the current plan",
    scopeRework: "Major change — the route will be reworked",
    planMaturity: "Plan maturity",
    maturityDraft: "Draft",
    maturityRefining: "Refining",
    maturityPrecise: "Precise"
  },
  zh: {
    eyebrow: "从模糊想法开始的旅行规划",
    title: "先说一个粗略旅行想法",
    subtitle: "可以只输入“意大利一周”或“想去温暖的地方”。系统会把模糊想法变成几个有用的取舍问题，再根据学到的偏好生成行程。",
    startNewSession: "开始新会话",
    restored: "已恢复上次会话",
    saved: "会话已保存到本地",
    promptTitle: "粗略旅行想法",
    promptBody: "只说目的地、季节、心情或一个简单限制就够了。系统会区分你已经说出的信息，以及还需要一起弄清楚的部分。",
    promptPlaceholder: "试试“十月去日本”“想去温暖的地方”或“我有 5 天假”",
    promptTooShort: "请至少输入 4 个字符",
    promptExamplesLabel: "可以这样开始",
    promptExamples: ["意大利一周", "想去温暖的地方", "欧洲低预算旅行", "东京有什么好玩", "我有 5 天假"],
    knownFromPrompt: "你已经说出的信息",
    knownFallback: "一个粗略想法就可以开始。",
    stillUncertain: "接下来要一起弄清楚",
    uncertainTripShape: "行程形状",
    uncertainBudgetComfort: "预算与舒适度",
    uncertainPaceInterests: "节奏与兴趣",
    uncertainLogistics: "交通与住宿选择",
    detectConflicts: "检查隐藏偏好",
    detectingConflicts: "正在判断是否需要检查点",
    conflictsTitle: "隐藏偏好检查点",
    conflictsBody: "从模糊提示中识别检查点决策、依据、阶段和隐藏偏好。",
    probesTitle: "检查点问题",
    probesBody: "只回答会明显改变方案的轻量问题。",
    learnedTitle: "我们对你的了解",
    learnedBody: "先检查动态偏好画像，再让它影响本次行程。",
    assumptionsTitle: "这会怎样改变行程",
    assumptionsBody: "由生效偏好生成的规划行为。",
    itineraryTitle: "旅行方案",
    itineraryBody: "根据已学偏好生成路线、地图、费用和取舍说明。",
    feasibilityTitle: "可行性检查",
    current: "当前",
    completed: "已完成",
    waiting: "等待中",
    confidence: "置信度",
    hiddenPreference: "需要了解的偏好",
    whyItMatters: "为什么重要",
    planningImpact: "规划影响",
    chooseOption: "这更符合我",
    answered: "已回答",
    unanswered: "未回答",
    learnPreferences: "采用我的回答",
    learningPreferences: "正在理解你的回答",
    reviewAssumptions: "审核规划假设",
    generateItinerary: "生成旅行方案",
    generatingItinerary: "正在生成行程",
    assumptionHint: "保留、已编辑和未排除的规划后果会继续提供给规划器。",
    originalPrompt: "原始提示",
    learnedInfluences: "已学偏好的影响",
    noConflicts: "先输入任意粗略旅行想法。",
    noCheckpointNeeded: "无需检查点",
    checkpointNeeded: "需要检查点",
    nonPlanningPrompt: "这看起来不是规划任务",
    checkpointDecision: "检查点决策",
    checkpointStage: "检查点阶段",
    missingCategories: "缺失偏好类别",
    assumptionRisk: "假设风险",
    expectedPlanImpact: "预期方案影响",
    interactionCost: "交互成本",
    proceedWithoutCheckpoint: "无需检查点，直接继续",
    beforeAccommodation: "住宿前",
    beforeItinerary: "行程前",
    beforeFinalPlan: "最终方案前",
    noneStage: "无",
    evaluationSignals: "评估信号",
    checkpointMetrics: "检查点指标",
    preferenceExpressedRate: "偏好表达率",
    preferenceMetProxy: "偏好满足代理指标",
    checkpointQuestionCount: "检查点问题数",
    activePreferenceCount: "生效偏好数",
    interactionBurden: "交互负担",
    noGroundTruth: "精确率/召回率需要带标注的评估数据。",
    noLearned: "回答一个澄清问题后，方案就会开始成形。",
    noAssumptions: "尚无可审核假设。",
    noItinerary: "尚未生成行程。",
    noWarnings: "暂无可行性提醒。",
    accepted: "已接受",
    rejected: "已拒绝",
    resetNotice: "会清空提示、冲突、回答、已学偏好、行程、提醒和本地会话状态。",
    errorTitle: "流程步骤失败",
    preferenceHistory: "偏好画像",
    currentCheckpoint: "下一步建议",
    planningSteps: "规划流程",
    assumptionValue: "规划行为",
    assumptionReason: "推断依据",
    useAssumption: "用于本次方案",
    reviewLater: "建议检查",
    excludeAssumption: "不用于本次方案",
    assumptionDecision: "后果控制",
    assumptionsReadySummary: "可用于生成行程",
    traceTitle: "智能体轨迹",
    explicitSignals: "明确线索",
    uncertainty: "仍不确定",
    whyAsked: "为什么系统会问",
    agentEvidence: "智能体依据链",
    selectedAnswer: "已选回答",
    notAnsweredYet: "尚未回答",
    preferenceStatus: "偏好状态",
    modelConfidence: "模型置信度",
    userControl: "用户控制",
    source: "来源",
    ignorePreference: "忽略",
    restorePreference: "恢复",
    makePrimary: "设为重点",
    lowerPriority: "降低优先级",
    activePreference: "生效中",
    ignoredPreference: "已忽略",
    primaryPriority: "重点",
    normalPriority: "普通",
    lowPriority: "低优先级",
    preferenceProfileHint: "这里是用户模型。先确认每个已学偏好是否真的符合你，再决定它在规划中有多重要。",
    consequencesHint: "规划后果是由生效偏好生成的规划行为，只影响本次行程，不会改写用户模型。",
    preferenceDetail: "偏好细节",
    preferenceDetailHint: "可在这里补充城市、街区、日期或限制条件。修改会更新用户模型，并影响下一次生成的方案。",
    editPreference: "编辑偏好",
    inferredFrom: "为什么认为这是真的",
    noActiveConsequences: "已忽略的偏好不会产生生效中的规划后果。",
    noLinkedConsequences: "这个偏好暂时没有关联到具体规划行为。",
    usedInPlan: "用于方案",
    excludedFromPlan: "已排除",
    lowConfidence: "低置信度",
    highImpact: "高影响",
    mayAffectBudget: "可能影响预算",
    profileFlowPrompt: "提示与检查点",
    profileFlowProfile: "动态偏好画像",
    profileFlowConsequences: "规划后果",
    profileFlowItinerary: "生成行程",
    lowerPriorityPlannerNote: "除非与重点偏好冲突，否则将此偏好视为低优先级。",
    promptSignalLabel: "提示",
    memorySignalLabel: "记忆",
    noPreferenceInsights: "尚无隐藏偏好洞察。",
    chipClickHint: "点击标签或条目即可打开对应的审核区域。",
    chipAssumptionsTitle: "规划后果",
    chipMissingTitle: "缺失或已排除偏好",
    chipHighImpactTitle: "高影响待解决项",
    chipMemoryTitle: "记忆偏好",
    chipNoItems: "暂无条目。",
    unresolvedStatus: "待解决",
    savedStatus: "已保存",
    appliedStatus: "已应用",
    notAppliedStatus: "未应用",
    memorySaved: "项已保存记忆偏好",
    skipProbe: "跳过——没有明显偏好",
    skippedAnswer: "已跳过",
    skipPlanningImpact: "规划器不会对这个取舍做偏好假设。",
    refineAnswer: "用自己的话补充细节（可选）",
    refinePlaceholder: "例如：上午可以多走路，晚上少走",
    criticFollowUp: "评审智能体追问",
    applyRefinement: "应用修改",
    refinementPlaceholder: "用自己的话回答，进一步修正这个规划后果",
    planDiffTitle: "方案变化",
    planDiffBody: "你的最新修改如何改变了行程。",
    beforePlan: "修改前（基于假设）",
    afterPlan: "修改后（符合偏好）",
    diffAdded: "新增",
    diffRemoved: "移除",
    diffKept: "项保留",
    boardingTotalDays: "总天数",
    boardingBudget: "预估预算",
    boardingPace: "节奏",
    boardingWalking: "步行负担",
    agentBoardTitle: "多智能体后台",
    agentBoardBody: "每个规划智能体的实时状态与耗时。",
    agentStatusIdle: "待命",
    agentStatusRunning: "运行中",
    agentStatusComplete: "完成",
    agentStatusError: "出错",
    agentShortNames: {
      "Conflict Detector Agent": "冲突检测",
      "Preference Probe Agent": "偏好探询",
      "Preference Agent": "偏好",
      "Assumption Critic Agent": "假设评审",
      "Input Consistency Agent": "一致性",
      "Planner Agent": "规划器",
      "Constraint Checker Agent": "可行性",
      "Budget Manager Agent": "预算",
      "Route Mobility Agent": "路线",
      "Pace Feasibility Agent": "节奏",
      "Presentation Agent": "呈现",
      "Memory Agent": "记忆"
    } as Record<AgentName, string>,
    studySession: "研究会话",
    exportLog: "导出日志",
    readOnlyNotice: "只读研究条件——编辑控制已停用。",
    producedBy: "产生自",
    refinePlan: "优化方案",
    refinePlanning: "正在优化方案",
    reanalyze: "重新分析",
    promptChangedTitle: "你修改了旅行想法",
    promptChangedBody:
      "「优化方案」会保留你已确认的偏好，并围绕新的细节重新规划。「重新分析」会基于当前提示，从隐藏偏好发现重新开始。",
    promptChangedShort: "自本方案后提示已修改",
    refinementPreferenceLabel: "最新指令",
    refinementOverridesNote: "最新指令——覆盖本方案中任何冲突的旧偏好。",
    scopeMinor: "小幅调整——在当前方案上优化",
    scopeRework: "重大变更——将重新规划路线",
    planMaturity: "方案成熟度",
    maturityDraft: "草稿",
    maturityRefining: "打磨中",
    maturityPrecise: "精确"
  }
} as const;

function runningTrace(agent: AgentTrace["agent"], summary: string): AgentTrace {
  return {
    agent,
    summary,
    status: "Running",
    count: 0,
    timestamp: new Date().toISOString()
  };
}

function emptySession(language: Language): PersistedSession {
  return {
    prompt: "",
    analyzedPrompt: "",
    plannedPrompt: "",
    checkpointDecision: null,
    detectedConflicts: [],
    probeAnswers: {},
    learnedPreferences: [],
    preferenceControls: {},
    assumptions: [],
    transportAssumptions: [],
    accommodationAssumptions: [],
    costAssumptions: [],
    critiques: [],
    itinerary: null,
    previousItinerary: null,
    digests: [],
    warnings: [],
    selectedOptionId: null,
    trace: [],
    memoryStatus: null,
    workflowStep: "prompt",
    activeSection: "prompt",
    language
  };
}

const AGENT_BOARD_ORDER: AgentName[] = [
  "Conflict Detector Agent",
  "Preference Probe Agent",
  "Assumption Critic Agent",
  "Input Consistency Agent",
  "Planner Agent",
  "Constraint Checker Agent",
  "Budget Manager Agent",
  "Route Mobility Agent",
  "Pace Feasibility Agent",
  "Presentation Agent",
  "Memory Agent"
];

function formatAgentDuration(durationMs: number | undefined): string | null {
  if (durationMs === undefined) {
    return null;
  }

  return `${(durationMs / 1000).toFixed(1)}s`;
}

function guessRefinementCategory(text: string): LearnedPreference["category"] {
  const value = text.toLowerCase();

  if (/tourist|local|authentic|off the beaten|crowd|游客|本地|小众/.test(value)) {
    return "touristyLocalStyle";
  }

  if (/budget|cheap|cost|expensive|price|money|€|\$|预算|便宜|省钱/.test(value)) {
    return "budget";
  }

  if (/pace|relax|slow|rush|rest|chill|节奏|放慢|休息/.test(value)) {
    return "pace";
  }

  if (/walk|步行/.test(value)) {
    return "walkingTolerance";
  }

  if (/food|eat|restaurant|cuisine|美食|餐/.test(value)) {
    return "food";
  }

  if (/train|bus|taxi|drive|transport|metro|flight|交通|火车|打车/.test(value)) {
    return "transport";
  }

  if (/hotel|hostel|stay|accommodation|neighborhood|住宿|酒店/.test(value)) {
    return "accommodationArea";
  }

  if (/night|bar|club|夜/.test(value)) {
    return "nightlife";
  }

  return "other";
}

type RefinementScope = "minor" | "rework";

// Deterministic scope detection: geographic-redirection phrasing means the
// route itself must be rebuilt; taste/budget/pace adjustments refine in place.
function classifyRefinementScope(text: string): RefinementScope {
  const value = text.toLowerCase();
  const reworkPattern =
    /(focus on|go to|switch to|instead of|instead|rather than|change (the )?(destination|route|city|cities|region|country)|different (destination|route|city|region|country)|another (city|country|region)|somewhere else|start over|redo|rework|replan|only (visit|go|stay)|改成|换成|换到|改去|聚焦|专注于|重做|重新规划|只去|换个)/;

  if (reworkPattern.test(value)) {
    return "rework";
  }

  if (guessRefinementCategory(text) !== "other") {
    return "minor";
  }

  // Free text without a known taste category that reads geographic → rework.
  return /(north|south|east|west|coast|island|mountain|countryside|region|北部|南部|东部|西部|海边|山区|乡村)/.test(value)
    ? "rework"
    : "minor";
}

function MaturityGauge({
  score,
  copy
}: {
  score: number;
  copy: (typeof flowText)["en"] | (typeof flowText)["zh"];
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const stageLabel = clamped < 40 ? copy.maturityDraft : clamped < 72 ? copy.maturityRefining : copy.maturityPrecise;
  const stageColor = clamped < 40 ? "#c04a3c" : clamped < 72 ? "#c08a26" : "#2e7d64";
  // Needle sweeps the semicircle from 180° (score 0) to 0° (score 100).
  const angle = Math.PI * (1 - clamped / 100);
  const needleX = 60 + 40 * Math.cos(angle);
  const needleY = 54 - 40 * Math.sin(angle);

  return (
    <div className="flex shrink-0 flex-col items-center justify-center rounded-xl border border-slate-200/80 bg-white/92 px-4 py-2.5 shadow-[0_10px_30px_rgba(26,35,67,0.08)]">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{copy.planMaturity}</p>
      <svg width="120" height="62" viewBox="0 0 120 62" aria-hidden className="mt-0.5">
        <path d="M 12 54 A 48 48 0 0 1 40 11" fill="none" stroke="#c04a3c" strokeOpacity="0.75" strokeWidth="7" strokeLinecap="round" />
        <path d="M 45 8.5 A 48 48 0 0 1 75 8.5" fill="none" stroke="#c08a26" strokeOpacity="0.75" strokeWidth="7" strokeLinecap="round" />
        <path d="M 80 11 A 48 48 0 0 1 108 54" fill="none" stroke="#2e7d64" strokeOpacity="0.75" strokeWidth="7" strokeLinecap="round" />
        <line x1="60" y1="54" x2={needleX} y2={needleY} stroke="#142c46" strokeWidth="3" strokeLinecap="round" />
        <circle cx="60" cy="54" r="4.5" fill="#142c46" />
      </svg>
      <p className="display-serif -mt-1 text-sm font-black" style={{ color: stageColor }}>
        {stageLabel}
      </p>
    </div>
  );
}

function sectionStatus(section: FlowSection, workflowStep: WorkflowStep, activeSection: FlowSection, complete: boolean) {
  if (activeSection === section) {
    return "current";
  }

  if (complete || workflowStep === "itinerary") {
    return "completed";
  }

  return "waiting";
}

function statusTone(status: ReturnType<typeof sectionStatus>) {
  if (status === "current") {
    return "border-indigo-200 bg-indigo-50 text-indigo-700";
  }

  if (status === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-500";
}

function defaultPreferenceControl(): PreferenceControl {
  return {
    state: "active",
    priority: "normal"
  };
}

function effectivePreferencePriority(control: PreferenceControl): PreferencePriority {
  return control.state === "locked" ? "primary" : control.priority;
}

function normalizePreferenceControls(
  preferences: LearnedPreference[],
  current: Record<string, PreferenceControl>
): Record<string, PreferenceControl> {
  return Object.fromEntries(
    preferences.map((preference) => {
      const control = current[preference.id] || defaultPreferenceControl();
      return [
        preference.id,
        control.state === "locked"
          ? {
              state: "active",
              priority: "primary"
            }
          : control
      ];
    })
  );
}

function preferenceControlTone(control: PreferenceControl) {
  if (control.state === "ignored") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (effectivePreferencePriority(control) === "primary") {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }

  if (effectivePreferencePriority(control) === "low") {
    return "border-slate-200 bg-slate-50 text-slate-500";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function checkpointStageLabel(
  stage: CheckpointDecision["checkpointStage"],
  copy: {
    beforeAccommodation: string;
    beforeItinerary: string;
    beforeFinalPlan: string;
    noneStage: string;
  }
) {
  if (stage === "beforeAccommodation") {
    return copy.beforeAccommodation;
  }

  if (stage === "beforeItinerary") {
    return copy.beforeItinerary;
  }

  if (stage === "beforeFinalPlan") {
    return copy.beforeFinalPlan;
  }

  return copy.noneStage;
}

function isUnspecifiedText(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length === 0 ||
    normalized.includes("not specified") ||
    normalized.includes("unspecified") ||
    normalized.includes("unknown") ||
    normalized === "n/a"
  );
}

function isUsefulTransportAssumption(item: TransportAssumption) {
  const hasSpecificEndpoint = !isUnspecifiedText(item.from) || !isUnspecifiedText(item.to);
  const hasSpecificMode = !isUnspecifiedText(item.mode);
  return hasSpecificEndpoint || hasSpecificMode || item.estimatedTravelTimeMinutes > 0;
}

function isUsefulAccommodationAssumption(item: AccommodationAssumption) {
  return !isUnspecifiedText(item.area) || !isUnspecifiedText(item.accommodationStyle);
}

function isUsefulCostAssumption(item: CostAssumption) {
  return item.perDayEstimateEur > 0 || item.totalEstimateEur > 0 || !isUnspecifiedText(item.basis);
}

function WorkflowSection({
  id,
  title,
  body,
  icon,
  status,
  statusLabel,
  activeSection,
  onOpen,
  children
}: {
  id: FlowSection;
  title: string;
  body: string;
  icon: ReactNode;
  status: ReturnType<typeof sectionStatus>;
  statusLabel: string;
  activeSection: FlowSection;
  onOpen: (section: FlowSection) => void;
  children: ReactNode;
}) {
  const open = activeSection === id;

  return (
    <section
      id={`workflow-${id}`}
      className="scroll-mt-4 rounded-xl border border-slate-200/80 bg-white/88 shadow-[0_10px_30px_rgba(26,35,67,0.06)] backdrop-blur"
    >
      <button
        type="button"
        onClick={() => onOpen(id)}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-black text-slate-950">{title}</h2>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${statusTone(status)}`}>
                {statusLabel}
              </span>
            </div>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{body}</p>
          </div>
        </div>
        <ChevronDown className={`size-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <div className="border-t border-slate-100 p-4">{children}</div> : null}
    </section>
  );
}

function AssumptionRefine({
  question,
  placeholder,
  applyLabel,
  eyebrow,
  onApply
}: {
  question: string;
  placeholder: string;
  applyLabel: string;
  eyebrow: string;
  onApply: (value: string) => void;
}) {
  const [draft, setDraft] = useState("");

  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
      <p className="text-[11px] font-black uppercase text-amber-600">{eyebrow}</p>
      <p className="mt-1 text-xs font-semibold leading-5 text-amber-900">{question}</p>
      <div className="mt-2 flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 outline-none transition focus:border-amber-300 focus:ring-4 focus:ring-amber-100"
        />
        <button
          type="button"
          disabled={draft.trim().length === 0}
          onClick={() => {
            onApply(draft);
            setDraft("");
          }}
          className="shrink-0 rounded-xl bg-amber-600 px-3 py-2 text-xs font-black text-white transition disabled:cursor-not-allowed disabled:bg-amber-200"
        >
          {applyLabel}
        </button>
      </div>
    </div>
  );
}

function RefineBanner({
  copy,
  canRefine,
  scope,
  loading,
  onRefine,
  onReanalyze
}: {
  copy: (typeof flowText)["en"] | (typeof flowText)["zh"];
  canRefine: boolean;
  scope: RefinementScope;
  loading: boolean;
  onRefine: () => void;
  onReanalyze: () => void;
}) {
  return (
    <section className="rounded-xl border border-amber-300 bg-amber-50/80 p-4 shadow-[0_10px_30px_rgba(119,80,13,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Stamp className="size-4 shrink-0 text-amber-700" />
            <h2 className="display-serif text-sm font-black text-amber-900">{copy.promptChangedTitle}</h2>
            {canRefine ? (
              <span className={`stamp-badge ${scope === "rework" ? "text-rose-700" : "text-emerald-700"}`}>
                {scope === "rework" ? copy.scopeRework : copy.scopeMinor}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs font-semibold leading-5 text-amber-900/80">{copy.promptChangedBody}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {canRefine ? (
            <button
              type="button"
              onClick={onRefine}
              disabled={loading}
              className="flex h-9 items-center gap-2 rounded-xl bg-amber-600 px-4 text-xs font-black text-white shadow-[0_10px_24px_rgba(119,80,13,0.24)] transition disabled:cursor-not-allowed disabled:bg-amber-300"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Route className="size-4" />}
              {loading ? copy.refinePlanning : copy.refinePlan}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onReanalyze}
            disabled={loading}
            className="flex h-9 items-center gap-2 rounded-xl border border-amber-400 bg-white px-4 text-xs font-black text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <SearchCheck className="size-4" />
            {copy.reanalyze}
          </button>
        </div>
      </div>
    </section>
  );
}

function PlanDiffCard({
  diff,
  copy
}: {
  diff: { removed: string[]; added: string[]; keptCount: number };
  copy: (typeof flowText)["en"] | (typeof flowText)["zh"];
}) {
  return (
    <section className="rounded-xl border border-slate-200/80 bg-white/88 p-4 shadow-[0_10px_30px_rgba(26,35,67,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="display-serif text-sm font-black text-slate-950">{copy.planDiffTitle}</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">{copy.planDiffBody}</p>
        </div>
        <span className="stamp-badge text-emerald-700">
          {diff.keptCount} {copy.diffKept}
        </span>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3">
          <p className="text-[11px] font-black uppercase text-rose-600">{copy.beforePlan}</p>
          <ul className="mt-2 space-y-1.5">
            {diff.removed.length === 0 ? (
              <li className="text-xs font-semibold text-rose-900/60">—</li>
            ) : (
              diff.removed.map((title) => (
                <li key={title} className="flex items-start gap-2 text-xs font-semibold leading-5 text-rose-900">
                  <X className="mt-0.5 size-3.5 shrink-0 text-rose-500" />
                  {title}
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
          <p className="text-[11px] font-black uppercase text-emerald-600">{copy.afterPlan}</p>
          <ul className="mt-2 space-y-1.5">
            {diff.added.length === 0 ? (
              <li className="text-xs font-semibold text-emerald-900/60">—</li>
            ) : (
              diff.added.map((title) => (
                <li key={title} className="flex items-start gap-2 text-xs font-semibold leading-5 text-emerald-900">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                  {title}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}

function BoardingPass({
  itinerary,
  selectedOptionId,
  learnedPreferences,
  copy,
  impactLabels
}: {
  itinerary: Itinerary;
  selectedOptionId: string | null;
  learnedPreferences: LearnedPreference[];
  copy: (typeof flowText)["en"] | (typeof flowText)["zh"];
  impactLabels: Record<"Low" | "Medium" | "High", string>;
}) {
  const option = itinerary.options.find((item) => item.id === (selectedOptionId ?? itinerary.selectedOptionId)) ?? itinerary.options[0];

  if (!option) {
    return null;
  }

  const totalWalkingKm = option.days.reduce((sum, day) => sum + day.totalWalkingKm, 0);
  const walkingPerDay = option.days.length > 0 ? totalWalkingKm / option.days.length : 0;
  const walkingLoad = walkingPerDay < 4 ? impactLabels.Low : walkingPerDay < 8 ? impactLabels.Medium : impactLabels.High;
  const pace = learnedPreferences.find((preference) => preference.category === "pace")?.value ?? option.positioning;

  return (
    <section className="boarding-pass rounded-xl border border-slate-200/80 bg-white/92 shadow-[0_10px_30px_rgba(26,35,67,0.08)]">
      <div className="grid gap-3 p-4 sm:grid-cols-[repeat(4,minmax(0,1fr))_90px]">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{copy.boardingTotalDays}</p>
          <p className="display-serif mt-1 truncate text-lg font-black text-slate-950">{itinerary.durationDays}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{copy.boardingBudget}</p>
          <p className="display-serif mt-1 truncate text-lg font-black text-slate-950">
            {itinerary.currency === "EUR" ? "€" : itinerary.currency} {Math.round(option.estimatedTotalCostEur)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{copy.boardingPace}</p>
          <p className="mt-1 line-clamp-2 text-xs font-black leading-4 text-slate-800">{pace}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{copy.boardingWalking}</p>
          <p className="display-serif mt-1 truncate text-lg font-black text-slate-950">{walkingLoad}</p>
        </div>
        <div className="barcode hidden self-stretch rounded sm:block" aria-hidden />
      </div>
    </section>
  );
}

export default function Home() {
  const [language, setLanguage] = useState<Language>("en");
  const [prompt, setPrompt] = useState("");
  const [detectedConflicts, setDetectedConflicts] = useState<DetectedConflict[]>([]);
  const [probeAnswers, setProbeAnswers] = useState<Record<string, PreferenceProbeAnswer>>({});
  const [learnedPreferences, setLearnedPreferences] = useState<LearnedPreference[]>([]);
  const [preferenceControls, setPreferenceControls] = useState<Record<string, PreferenceControl>>({});
  const [assumptions, setAssumptions] = useState<Assumption[]>([]);
  const [transportAssumptions, setTransportAssumptions] = useState<TransportAssumption[]>([]);
  const [accommodationAssumptions, setAccommodationAssumptions] = useState<AccommodationAssumption[]>([]);
  const [costAssumptions, setCostAssumptions] = useState<CostAssumption[]>([]);
  const [critiques, setCritiques] = useState<AssumptionCritique[]>([]);
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [previousItinerary, setPreviousItinerary] = useState<Itinerary | null>(null);
  const [digests, setDigests] = useState<PlanDigest[]>([]);
  const [analyzedPrompt, setAnalyzedPrompt] = useState("");
  const [plannedPrompt, setPlannedPrompt] = useState("");
  const [warnings, setWarnings] = useState<ConstraintWarning[]>([]);
  const [trace, setTrace] = useState<AgentTrace[]>([]);
  const [memory, setMemory] = useState<UserMemory>(emptyMemory());
  const [memoryStatus, setMemoryStatus] = useState<MemoryStatus | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [reviewFocusDay, setReviewFocusDay] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState<FlowSection>("prompt");
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>("prompt");
  const [loadingStage, setLoadingStage] = useState<LoadingStage>(null);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [restored, setRestored] = useState(false);

  const labels = uiText[language];
  const copy = flowText[language];
  const [checkpointDecision, setCheckpointDecision] = useState<CheckpointDecision | null>(null);
  const [study, setStudy] = useState<StudyCondition>(defaultStudyCondition());

  const showAgentVisibility = study.visibility === "high";
  const allowControls = study.controllability === "high";
  const showEvaluationPanel = !study.active || study.experimenter;

  function recordEvent(event: StudyEventName, objectId?: string, payload?: Record<string, unknown>) {
    if (study.active || study.experimenter) {
      logStudyEvent(study, event, objectId, payload);
    }
  }

  useEffect(() => {
    const condition = parseStudyCondition(window.location.search);
    setStudy(condition);

    if (condition.active) {
      logStudyEvent(condition, "session_start");
    }

    const storedLanguage = window.localStorage.getItem("assumption-aware-agent-planner:language");
    const initialLanguage = storedLanguage === "en" || storedLanguage === "zh" ? storedLanguage : "en";
    const rawSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
    setMemory(loadUserMemory());

    if (rawSession) {
      try {
        const session = JSON.parse(rawSession) as PersistedSession;
        setLanguage(session.language || initialLanguage);
        setPrompt(session.prompt || "");
        // Backfill prompt tracking for sessions saved before refinement existed,
        // so a restored plan can still be refined from the composer.
        const restoredPrompt = session.prompt || "";
        setAnalyzedPrompt(session.analyzedPrompt || (session.itinerary ? restoredPrompt : ""));
        setPlannedPrompt(session.plannedPrompt || (session.itinerary ? restoredPrompt : ""));
        setCheckpointDecision(session.checkpointDecision || null);
        setDetectedConflicts(session.detectedConflicts || []);
        setProbeAnswers(session.probeAnswers || {});
        setLearnedPreferences(session.learnedPreferences || []);
        setPreferenceControls(normalizePreferenceControls(session.learnedPreferences || [], session.preferenceControls || {}));
        setAssumptions(session.assumptions || []);
        setTransportAssumptions(session.transportAssumptions || []);
        setAccommodationAssumptions(session.accommodationAssumptions || []);
        setCostAssumptions(session.costAssumptions || []);
        setCritiques(session.critiques || []);
        setItinerary(session.itinerary || null);
        setPreviousItinerary(session.previousItinerary || null);
        setDigests(session.digests || []);
        setWarnings(session.warnings || []);
        setSelectedOptionId(session.selectedOptionId || null);
        setTrace(session.trace || []);
        setMemoryStatus(session.memoryStatus || null);
        setWorkflowStep(session.workflowStep || "prompt");
        setActiveSection(session.activeSection === "assumptions" ? "learned" : session.activeSection || "prompt");
        setRestored(true);
      } catch {
        setLanguage(initialLanguage);
      }
    } else {
      setLanguage(initialLanguage);
    }

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const session: PersistedSession = {
      prompt,
      analyzedPrompt,
      plannedPrompt,
      checkpointDecision,
      detectedConflicts,
      probeAnswers,
      learnedPreferences,
      preferenceControls,
      assumptions,
      transportAssumptions,
      accommodationAssumptions,
      costAssumptions,
      critiques,
      itinerary,
      previousItinerary,
      digests,
      warnings,
      selectedOptionId,
      trace,
      memoryStatus,
      workflowStep,
      activeSection,
      language
    };

    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }, [
    accommodationAssumptions,
    activeSection,
    analyzedPrompt,
    assumptions,
    checkpointDecision,
    plannedPrompt,
    costAssumptions,
    critiques,
    detectedConflicts,
    digests,
    hydrated,
    itinerary,
    previousItinerary,
    language,
    learnedPreferences,
    preferenceControls,
    memoryStatus,
    probeAnswers,
    prompt,
    selectedOptionId,
    trace,
    transportAssumptions,
    warnings,
    workflowStep
  ]);

  const probeAnswerList = useMemo(() => Object.values(probeAnswers), [probeAnswers]);
  const allProbesSkipped =
    detectedConflicts.length > 0 && detectedConflicts.every((conflict) => probeAnswers[conflict.id]?.skipped);
  const checkpointBypassed = Boolean(
    checkpointDecision?.isPlanningTask && (checkpointDecision.checkpointNeeded === false || allProbesSkipped)
  );
  const nonPlanningPrompt = Boolean(checkpointDecision && !checkpointDecision.isPlanningTask);
  const allProbesAnswered = detectedConflicts.length > 0 && detectedConflicts.every((conflict) => probeAnswers[conflict.id]);
  const learnedPreferenceByConflict = useMemo(
    () => new Map(learnedPreferences.map((preference) => [preference.conflictId, preference])),
    [learnedPreferences]
  );
  const hiddenPreferenceInsights = useMemo<HiddenPreferenceInsight[]>(
    () =>
      detectedConflicts.map((conflict) => {
        const answer = probeAnswers[conflict.id] || null;
        const learnedPreference = learnedPreferenceByConflict.get(conflict.id) || null;
        const control = learnedPreference ? preferenceControls[learnedPreference.id] || defaultPreferenceControl() : defaultPreferenceControl();
        const explicitSignals = prompt.trim()
          ? [`${copy.promptSignalLabel}: ${prompt.trim()}`]
          : [copy.knownFallback];

        if (memoryStatus?.used) {
          explicitSignals.push(`${copy.memorySignalLabel}: ${memoryStatus.appliedPreferenceCount} ${labels.memoryAppliedLabel}`);
        }

        return {
          id: conflict.id,
          title: conflict.title,
          explicitSignals,
          uncertainty: conflict.hiddenPreference,
          hiddenPreference: conflict.hiddenPreference,
          whyItMatters: conflict.explanation,
          confidence: conflict.confidence,
          probeQuestion: conflict.probe.question,
          selectedAnswer: answer,
          learnedPreference,
          control
        };
      }),
    [
      copy.knownFallback,
      copy.memorySignalLabel,
      copy.promptSignalLabel,
      detectedConflicts,
      labels.memoryAppliedLabel,
      learnedPreferenceByConflict,
      memoryStatus,
      preferenceControls,
      probeAnswers,
      prompt
    ]
  );
  const activeLearnedPreferences = useMemo(
    () =>
      learnedPreferences
        .filter((preference) => {
          const control = preferenceControls[preference.id] || defaultPreferenceControl();
          return control.state !== "ignored" && preference.value.trim().length > 0;
        })
        .map((preference) => {
          const control = preferenceControls[preference.id] || defaultPreferenceControl();
          const priority = effectivePreferencePriority(control);
          const normalizedPreference = {
            ...preference,
            value: preference.value.trim()
          };

          if (priority !== "low") {
            return normalizedPreference;
          }

          return {
            ...normalizedPreference,
            planningImpact: `${copy.lowerPriorityPlannerNote} ${normalizedPreference.planningImpact}`
          };
        }),
    [copy.lowerPriorityPlannerNote, learnedPreferences, preferenceControls]
  );
  const activePreferenceCategories = useMemo(
    () => new Set(activeLearnedPreferences.map((preference) => preference.category)),
    [activeLearnedPreferences]
  );
  const plannerAssumptions = useMemo(
    () =>
      assumptions.filter(
        (assumption) => activePreferenceCategories.has(assumption.category) && assumption.status !== "Rejected"
      ),
    [activePreferenceCategories, assumptions]
  );
  const confirmedPreferences = useMemo<ConfirmedPreference[]>(
    () => {
      const learnedConfirmed: ConfirmedPreference[] = activeLearnedPreferences.map((preference) => ({
        id: preference.id,
        category: preference.category,
        label: preference.label,
        value: preference.value,
        source: preference.source as ConfirmedPreference["source"]
      }));
      const assumptionConfirmed: ConfirmedPreference[] = plannerAssumptions
        .filter((assumption) => assumption.status === "Accepted" || assumption.status === "Edited" || assumption.source === "Memory")
        .map((assumption) => ({
          id: assumption.id,
          category: assumption.category,
          label: assumption.label,
          value: assumption.value,
          source: assumption.source === "Memory" && assumption.status !== "Edited" ? "Memory" : "User"
        }));

      return [...learnedConfirmed, ...assumptionConfirmed];
    },
    [activeLearnedPreferences, plannerAssumptions]
  );
  const usefulTransportAssumptions = useMemo(
    () => transportAssumptions.filter(isUsefulTransportAssumption),
    [transportAssumptions]
  );
  const usefulAccommodationAssumptions = useMemo(
    () => accommodationAssumptions.filter(isUsefulAccommodationAssumption),
    [accommodationAssumptions]
  );
  const usefulCostAssumptions = useMemo(() => costAssumptions.filter(isUsefulCostAssumption), [costAssumptions]);
  const planDiff = useMemo(() => {
    if (!previousItinerary || !itinerary) {
      return null;
    }

    const previousOption =
      previousItinerary.options.find((option) => option.id === previousItinerary.selectedOptionId) ?? previousItinerary.options[0];
    const nextOption =
      itinerary.options.find((option) => option.id === (selectedOptionId ?? itinerary.selectedOptionId)) ?? itinerary.options[0];

    if (!previousOption || !nextOption) {
      return null;
    }

    const previousTitles = new Set(previousOption.days.flatMap((day) => day.activities.map((activity) => activity.title)));
    const nextTitles = new Set(nextOption.days.flatMap((day) => day.activities.map((activity) => activity.title)));
    const removed = [...previousTitles].filter((title) => !nextTitles.has(title));
    const added = [...nextTitles].filter((title) => !previousTitles.has(title));

    if (removed.length === 0 && added.length === 0) {
      return null;
    }

    return {
      removed,
      added,
      keptCount: [...nextTitles].filter((title) => previousTitles.has(title)).length
    };
  }, [previousItinerary, itinerary, selectedOptionId]);
  const agentBoardEntries = useMemo(() => {
    const latestByAgent = new Map<AgentName, AgentTrace>();
    trace.forEach((entry) => latestByAgent.set(entry.agent, entry));

    return AGENT_BOARD_ORDER.map((agent) => {
      if (agent === "Memory Agent" && !latestByAgent.has(agent)) {
        return {
          agent,
          entry:
            memory.preferences.length > 0
              ? ({
                  agent,
                  summary: `${memory.preferences.length} ${copy.memorySaved}`,
                  status: "Complete",
                  count: memory.preferences.length,
                  timestamp: memory.lastUpdated
                } satisfies AgentTrace)
              : undefined
        };
      }

      return { agent, entry: latestByAgent.get(agent) };
    });
  }, [trace, memory, copy.memorySaved]);

  function applySession(session: PersistedSession) {
    setPrompt(session.prompt);
    setAnalyzedPrompt(session.analyzedPrompt || "");
    setPlannedPrompt(session.plannedPrompt || "");
    setCheckpointDecision(session.checkpointDecision || null);
    setDetectedConflicts(session.detectedConflicts);
    setProbeAnswers(session.probeAnswers);
    setLearnedPreferences(session.learnedPreferences);
    setPreferenceControls(normalizePreferenceControls(session.learnedPreferences, session.preferenceControls || {}));
    setAssumptions(session.assumptions);
    setTransportAssumptions(session.transportAssumptions);
    setAccommodationAssumptions(session.accommodationAssumptions);
    setCostAssumptions(session.costAssumptions);
    setCritiques(session.critiques);
    setItinerary(session.itinerary);
    setPreviousItinerary(session.previousItinerary);
    setDigests(session.digests || []);
    setWarnings(session.warnings);
    setSelectedOptionId(session.selectedOptionId);
    setTrace(session.trace);
    setMemoryStatus(session.memoryStatus);
    setWorkflowStep(session.workflowStep);
    setActiveSection(session.activeSection === "assumptions" ? "learned" : session.activeSection);
  }

  function handleLanguageChange(nextLanguage: Language) {
    setLanguage(nextLanguage);
    window.localStorage.setItem("assumption-aware-agent-planner:language", nextLanguage);
  }

  function handleStartNewSession() {
    recordEvent("session_reset");
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    clearUserMemory();
    setMemory(emptyMemory());
    setError(null);
    applySession(emptySession(language));
  }

  function openWorkflowSection(section: FlowSection) {
    const targetSection = section === "assumptions" ? "learned" : section;
    recordEvent("section_opened", targetSection);
    setActiveSection(targetSection);
    window.setTimeout(() => {
      document.getElementById(`workflow-${targetSection}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function openReviewTarget(targetId: string, section: FlowSection = "learned") {
    const targetSection = section === "assumptions" ? "learned" : section;
    setActiveSection(targetSection);
    window.setTimeout(() => {
      const target = document.getElementById(targetId) || document.getElementById(`workflow-${targetSection}`);
      const enclosingDetails = target?.closest("details");

      if (enclosingDetails) {
        enclosingDetails.open = true;
      }

      target?.scrollIntoView({ behavior: "smooth", block: "start" });

      if (target && target.id === targetId) {
        target.classList.add("ring-4", "ring-indigo-200", "ring-offset-2");
        window.setTimeout(() => {
          target.classList.remove("ring-4", "ring-indigo-200", "ring-offset-2");
        }, 1800);
      }
    }, 120);
  }

  function openReviewPlanning(dayNumber?: number | null) {
    setReviewFocusDay(dayNumber ?? null);
    setActiveSection("assumptions");
    window.setTimeout(() => {
      const target = dayNumber ? document.getElementById(`day-plan-${dayNumber}`) : document.getElementById("workflow-assumptions");
      const enclosingDetails = target?.closest("details");

      if (enclosingDetails) {
        enclosingDetails.open = true;
      }

      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }

  useEffect(() => {
    if (activeSection === "itinerary" || !reviewFocusDay) {
      return;
    }

    const timer = window.setTimeout(() => {
      const target = document.getElementById(`day-plan-${reviewFocusDay}`);
      const enclosingDetails = target?.closest("details");

      if (enclosingDetails) {
        enclosingDetails.open = true;
      }

      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [activeSection, reviewFocusDay]);

  function handlePromptChange(nextPrompt: string) {
    // Editing the prompt no longer wipes the plan. Existing preferences and the
    // itinerary are retained so the new text can *refine* the current plan; the
    // RefineBanner then offers "Refine plan" (re-plan around the kept profile)
    // or "Re-analyze from scratch" (full hidden-preference discovery again).
    setPrompt(nextPrompt);

    if (nextPrompt !== prompt) {
      setError(null);
    }
  }

  async function handleDetectConflicts() {
    if (prompt.trim().length < 4 || loadingStage !== null) {
      return;
    }

    setLoadingStage("conflicts");
    setError(null);
    setTrace([runningTrace("Conflict Detector Agent", copy.detectingConflicts)]);
    recordEvent("detect_conflicts", undefined, { prompt });

    try {
      const result = await analyzePreferences({
        prompt,
        memory,
        learnedPreferences,
        language
      });

      recordEvent("conflicts_received", undefined, {
        conflictCount: result.detectedConflicts.length,
        checkpointNeeded: result.checkpointDecision.checkpointNeeded,
        assumptionRisk: result.checkpointDecision.assumptionRisk
      });

      setCheckpointDecision(result.checkpointDecision);
      setDetectedConflicts(result.detectedConflicts);
      setProbeAnswers({});
      setLearnedPreferences([]);
      setPreferenceControls({});
      setAssumptions([]);
      setTransportAssumptions([]);
      setAccommodationAssumptions([]);
      setCostAssumptions([]);
      setCritiques([]);
      setItinerary(null);
      setPreviousItinerary(null);
      setDigests([]);
      setPlannedPrompt("");
      setAnalyzedPrompt(prompt);
      setWarnings([]);
      setSelectedOptionId(null);
      setMemoryStatus(result.memoryStatus);
      setTrace(result.trace);
      if (result.checkpointDecision.isPlanningTask && result.checkpointDecision.checkpointNeeded && result.detectedConflicts.length > 0) {
        setWorkflowStep("probes");
        openWorkflowSection("probes");
      } else {
        setWorkflowStep("conflicts");
        openWorkflowSection("conflicts");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : labels.analyzeError);
      setTrace((current) => current.map((entry) => ({ ...entry, status: "Error" })));
    } finally {
      setLoadingStage(null);
    }
  }

  function clearDownstreamProfileIfPresent() {
    const hasDownstreamProfile =
      learnedPreferences.length > 0 ||
      assumptions.length > 0 ||
      transportAssumptions.length > 0 ||
      accommodationAssumptions.length > 0 ||
      costAssumptions.length > 0 ||
      itinerary !== null;

    if (hasDownstreamProfile) {
      setLearnedPreferences([]);
      setPreferenceControls({});
      setAssumptions([]);
      setTransportAssumptions([]);
      setAccommodationAssumptions([]);
      setCostAssumptions([]);
      setCritiques([]);
      setItinerary(null);
      setDigests([]);
      setWarnings([]);
      setSelectedOptionId(null);
      setWorkflowStep("probes");
    }
  }

  function handleProbeChoice(conflict: DetectedConflict, optionId: string) {
    const option = conflict.probe.options.find((item) => item.id === optionId);

    if (!option) {
      return;
    }

    setProbeAnswers((current) => ({
      ...current,
      [conflict.id]: {
        conflictId: conflict.id,
        optionId: option.id,
        answer: option.label,
        planningImpact: option.planningImpact,
        skipped: false,
        customAnswer: current[conflict.id]?.customAnswer ?? ""
      }
    }));
    recordEvent("probe_answered", conflict.id, { optionId: option.id });
    clearDownstreamProfileIfPresent();
  }

  function handleProbeSkip(conflict: DetectedConflict) {
    setProbeAnswers((current) => ({
      ...current,
      [conflict.id]: {
        conflictId: conflict.id,
        optionId: "skipped",
        answer: copy.skippedAnswer,
        planningImpact: copy.skipPlanningImpact,
        skipped: true,
        customAnswer: ""
      }
    }));
    recordEvent("probe_skipped", conflict.id);
    clearDownstreamProfileIfPresent();
  }

  function handleProbeRefine(conflictId: string, customAnswer: string) {
    setProbeAnswers((current) => {
      const existing = current[conflictId];

      if (!existing) {
        return current;
      }

      return {
        ...current,
        [conflictId]: { ...existing, customAnswer }
      };
    });
    clearDownstreamProfileIfPresent();
  }

  async function handleLearnPreferences() {
    if (!allProbesAnswered || loadingStage !== null) {
      return;
    }

    setLoadingStage("preferences");
    setError(null);
    setTrace((current) => [...current, runningTrace("Preference Probe Agent", copy.learningPreferences)]);
    recordEvent("learn_preferences", undefined, {
      answered: probeAnswerList.filter((answer) => !answer.skipped).length,
      skipped: probeAnswerList.filter((answer) => answer.skipped).length,
      refined: probeAnswerList.filter((answer) => answer.customAnswer.trim().length > 0).length
    });

    try {
      const result = await learnPreferences({
        prompt,
        detectedConflicts,
        probeAnswers: probeAnswerList,
        memory,
        language
      });

      recordEvent("preferences_received", undefined, {
        learnedCount: result.learnedPreferences.length,
        assumptionCount: result.assumptions.length,
        critiqueCount: result.critiques.length
      });
      setLearnedPreferences(result.learnedPreferences);
      setPreferenceControls((current) => normalizePreferenceControls(result.learnedPreferences, current));
      setAssumptions(result.assumptions);
      setTransportAssumptions(result.transportAssumptions);
      setAccommodationAssumptions(result.accommodationAssumptions);
      setCostAssumptions(result.costAssumptions);
      setCritiques(result.critiques);
      setMemoryStatus(result.memoryStatus);
      setTrace((current) => [
        ...current.filter((entry) => entry.agent !== "Preference Probe Agent" && entry.agent !== "Assumption Critic Agent"),
        ...result.trace
      ]);
      setWorkflowStep("learned");
      openWorkflowSection("learned");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : labels.analyzeError);
      setTrace((current) => current.map((entry) => (entry.agent === "Preference Probe Agent" ? { ...entry, status: "Error" } : entry)));
    } finally {
      setLoadingStage(null);
    }
  }

  async function handleGenerate(refinementOverride?: string) {
    if (loadingStage !== null) {
      return;
    }

    const hasReviewedProfile = assumptions.length > 0 && activeLearnedPreferences.length > 0;

    // Allow generation when the profile is ready, when the checkpoint was
    // bypassed, or when refining an existing plan around an edited prompt.
    if (!checkpointBypassed && !hasReviewedProfile && itinerary === null) {
      return;
    }

    // `analyzedPrompt` accumulates the trip's full description (base prompt plus
    // any refinements folded in). A follow-up like "prioritise less touristy
    // places" is layered on top of it rather than replacing it, so the planner
    // keeps the destination and treats the new line as an overriding instruction.
    // `refinementOverride` carries one-click adjustments ("Relax the plan").
    const basePrompt = analyzedPrompt.trim();
    const currentPrompt = (refinementOverride ?? prompt).trim();
    const isRefinement =
      itinerary !== null &&
      basePrompt.length > 0 &&
      currentPrompt.length > 0 &&
      (refinementOverride !== undefined || currentPrompt !== basePrompt);
    // Minor adjustments refine the current plan in place; a geographic
    // redirection ("focus on northern italy") reworks the route: the new
    // instruction becomes the dominant trip description and route-bound
    // assumptions (transfers, hotels, costs) are dropped as stale.
    const refinementScope: RefinementScope = isRefinement ? classifyRefinementScope(currentPrompt) : "minor";
    const isRework = isRefinement && refinementScope === "rework";
    const alreadyFolded = basePrompt.toLowerCase().includes(currentPrompt.toLowerCase());
    const effectivePrompt = isRework
      ? `${currentPrompt}\n\n(Full route rework requested: rebuild the destinations and route to satisfy the line above. Context from the earlier trip idea — keep only taste preferences that still apply: ${basePrompt})`
      : isRefinement && !alreadyFolded
        ? `${basePrompt}\n\nRefinement request from the traveler (apply this and let it override any earlier preference or assumption it conflicts with): ${currentPrompt}`
        : itinerary !== null && basePrompt.length > 0
          ? basePrompt
          : prompt;

    // The refinement also becomes a first-class learned preference — the field
    // the Planner treats as primary guidance — with top priority, so the plan
    // genuinely reworks instead of the old preferences winning.
    const refinementPreference: LearnedPreference | null = isRefinement
      ? {
          id: `refinement-${currentPrompt.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "latest"}`,
          conflictId: "refinement",
          category: guessRefinementCategory(currentPrompt),
          label: copy.refinementPreferenceLabel,
          value: currentPrompt,
          planningImpact: copy.refinementOverridesNote,
          source: "User",
          confidence: 1
        }
      : null;
    const requestLearnedPreferences = refinementPreference
      ? [refinementPreference, ...activeLearnedPreferences.filter((preference) => preference.id !== refinementPreference.id)]
      : activeLearnedPreferences;
    const requestConfirmedPreferences = refinementPreference
      ? [
          {
            id: refinementPreference.id,
            category: refinementPreference.category,
            label: refinementPreference.label,
            value: refinementPreference.value,
            source: "User" as const
          },
          ...confirmedPreferences.filter((preference) => preference.id !== refinementPreference.id)
        ]
      : confirmedPreferences;

    if (itinerary) {
      setPreviousItinerary(itinerary);
    }

    setLoadingStage("itinerary");
    setError(null);
    setTrace((current) => [
      ...current,
      runningTrace("Input Consistency Agent", labels.consistencyRunning),
      runningTrace("Planner Agent", isRefinement ? copy.refinePlanning : copy.generatingItinerary),
      runningTrace("Constraint Checker Agent", labels.checkerRunning)
    ]);
    recordEvent(isRefinement ? "plan_refined" : "generate_requested", undefined, {
      activePreferences: activeLearnedPreferences.length,
      plannerAssumptions: plannerAssumptions.length,
      isRegeneration: itinerary !== null || previousItinerary !== null,
      isRefinement,
      ...(isRefinement ? { refinement: currentPrompt, scope: refinementScope } : {})
    });

    try {
      const result = await generateItinerary({
        prompt: effectivePrompt,
        detectedConflicts,
        probeAnswers: probeAnswerList,
        learnedPreferences: requestLearnedPreferences,
        assumptions: plannerAssumptions,
        transportAssumptions: isRework ? [] : usefulTransportAssumptions,
        accommodationAssumptions: isRework ? [] : usefulAccommodationAssumptions,
        costAssumptions: isRework ? [] : usefulCostAssumptions,
        confirmedPreferences: requestConfirmedPreferences,
        memory,
        language
      });

      recordEvent("plan_received", undefined, {
        optionCount: result.itinerary.options.length,
        warningCount: result.warnings.length
      });
      setItinerary(result.itinerary);
      setDigests(result.digests);
      setWarnings(result.warnings);
      setMemoryStatus(result.memoryStatus);
      setSelectedOptionId(result.itinerary.selectedOptionId);
      setPlannedPrompt(prompt);
      // Fold the applied refinement into the accumulated trip prompt so further
      // follow-ups build on it. After a rework, the new instruction becomes the
      // fresh base instead of accumulating the stale route description.
      setAnalyzedPrompt(isRework ? currentPrompt : effectivePrompt);

      // Surface the refinement in the visible preference profile so it can be
      // reviewed, edited, or ignored like any other learned preference.
      if (refinementPreference) {
        setLearnedPreferences((current) =>
          current.some((preference) => preference.id === refinementPreference.id) ? current : [...current, refinementPreference]
        );
        setPreferenceControls((current) => ({
          ...current,
          [refinementPreference.id]: { state: "active", priority: "primary" }
        }));
      }

      const updatedMemory = mergePreferencesIntoMemory(memory, requestConfirmedPreferences);
      setMemory(updatedMemory);
      saveUserMemory(updatedMemory);
      setTrace((current) => [
        ...current.filter(
          (entry) =>
            entry.agent !== "Input Consistency Agent" &&
            entry.agent !== "Planner Agent" &&
            entry.agent !== "Constraint Checker Agent"
        ),
        ...result.trace
      ]);
      setWorkflowStep("itinerary");
      openWorkflowSection("itinerary");
    } catch (caught) {
      recordEvent("plan_error", undefined, { message: caught instanceof Error ? caught.message : "unknown" });
      setError(caught instanceof Error ? caught.message : labels.planError);
      setTrace((current) =>
        current.map((entry) =>
          entry.agent === "Input Consistency Agent" ||
          entry.agent === "Planner Agent" ||
          entry.agent === "Constraint Checker Agent"
            ? { ...entry, status: "Error" }
            : entry
        )
      );
    } finally {
      setLoadingStage(null);
    }
  }

  function handleComposerGenerate() {
    // An edited prompt over an existing plan refines that plan in place.
    if (itinerary !== null && prompt.trim() !== plannedPrompt.trim()) {
      void handleGenerate();
      return;
    }

    if (nonPlanningPrompt) {
      openWorkflowSection("conflicts");
      return;
    }

    if (sectionComplete.assumptions) {
      void handleGenerate();
      return;
    }

    if (!sectionComplete.conflicts) {
      void handleDetectConflicts();
      return;
    }

    if (!sectionComplete.probes) {
      openWorkflowSection("probes");
      return;
    }

    if (!sectionComplete.learned) {
      void handleLearnPreferences();
      return;
    }

    openWorkflowSection("learned");
  }

  function resetGeneratedPlanAfterProfileChange() {
    if (itinerary) {
      setPreviousItinerary(itinerary);
    }

    setItinerary(null);
    setDigests([]);
    setWarnings([]);
    setSelectedOptionId(null);

    if (workflowStep === "itinerary" || workflowStep === "feasibility") {
      setWorkflowStep("learned");
      setActiveSection("learned");
    }
  }

  function handleAssumptionStatusChange(id: string, status: Assumption["status"]) {
    setAssumptions((current) => current.map((assumption) => (assumption.id === id ? { ...assumption, status } : assumption)));
    recordEvent("assumption_status_changed", id, { status });
    resetGeneratedPlanAfterProfileChange();
  }

  function handleAssumptionRefine(id: string, value: string) {
    if (value.trim().length === 0) {
      return;
    }

    setAssumptions((current) =>
      current.map((assumption) =>
        assumption.id === id
          ? {
              ...assumption,
              value: value.trim(),
              status: "Edited",
              source: "User"
            }
          : assumption
      )
    );
    recordEvent("assumption_refined", id, { value: value.trim() });
    resetGeneratedPlanAfterProfileChange();
  }

  function handleLearnedPreferenceValueChange(id: string, value: string) {
    setLearnedPreferences((current) =>
      current.map((preference) =>
        preference.id === id
          ? {
              ...preference,
              value,
              source: "User"
            }
          : preference
      )
    );
    resetGeneratedPlanAfterProfileChange();
  }

  function updatePreferenceControl(id: string, update: Partial<PreferenceControl>) {
    setPreferenceControls((current) => {
      const existing = current[id] || defaultPreferenceControl();

      return {
        ...current,
        [id]: {
          ...existing,
          ...update
        }
      };
    });
    recordEvent("preference_control_changed", id, update);
    resetGeneratedPlanAfterProfileChange();
  }

  const sectionComplete: Record<FlowSection, boolean> = {
    prompt: prompt.trim().length >= 4,
    conflicts: checkpointDecision !== null,
    probes: checkpointBypassed || allProbesAnswered,
    learned: checkpointBypassed || learnedPreferences.length > 0,
    assumptions: checkpointBypassed || assumptions.length > 0,
    itinerary: Boolean(itinerary),
    feasibility: warnings.length > 0
  };

  const statusLabel = (section: FlowSection) => {
    const status = sectionStatus(section, workflowStep, activeSection, sectionComplete[section]);
    return status === "current" ? copy.current : status === "completed" ? copy.completed : copy.waiting;
  };
  const acceptedCount = plannerAssumptions.filter((assumption) => assumption.status === "Accepted" || assumption.status === "Edited").length;
  const rejectedCount = assumptions.filter((assumption) => assumption.status === "Rejected").length;
  const inferredCount = plannerAssumptions.filter((assumption) => assumption.status === "Pending").length;
  const currentProbe = detectedConflicts.find((conflict) => !probeAnswers[conflict.id]);
  const visiblePreferenceRows = learnedPreferences.length > 0 ? learnedPreferences : [];
  const promptReady = prompt.trim().length >= 4;
  const promptChangedSincePlan =
    itinerary !== null && plannedPrompt.trim().length > 0 && prompt.trim() !== plannedPrompt.trim();
  const promptChangedSinceAnalysis =
    analyzedPrompt.trim().length > 0 && prompt.trim() !== analyzedPrompt.trim();
  // With a plan present, prompt edits refine it (promptChangedSincePlan). Before
  // a plan exists but after conflicts are detected, an edit makes those
  // questions stale, so we only offer re-analysis.
  const showRefineBanner =
    promptReady &&
    (itinerary !== null ? promptChangedSincePlan : promptChangedSinceAnalysis && detectedConflicts.length > 0);
  const liveRefinementScope: RefinementScope = promptChangedSincePlan ? classifyRefinementScope(prompt.trim()) : "minor";
  const planMaturityScore = useMemo(() => {
    if (!itinerary) {
      return 0;
    }

    const option =
      itinerary.options.find((item) => item.id === (selectedOptionId ?? itinerary.selectedOptionId)) ?? itinerary.options[0];
    const segments = option?.routeSegments ?? [];
    const verifiedShare =
      segments.length > 0 ? segments.filter((segment) => segment.provider === "google_routes").length / segments.length : 0;
    const refinementCount = learnedPreferences.filter((preference) => preference.conflictId === "refinement").length;
    const highOpenCount = warnings.filter((warning) => warning.impact === "High" && warning.status === "Open").length;
    const answeredShare =
      detectedConflicts.length > 0
        ? probeAnswerList.filter((answer) => !answer.skipped).length / detectedConflicts.length
        : checkpointBypassed
          ? 0.5
          : 0;

    return Math.round(
      20 + 20 * answeredShare + 20 * verifiedShare + (highOpenCount === 0 ? 15 : 0) + Math.min(2, refinementCount) * 12.5
    );
  }, [itinerary, selectedOptionId, learnedPreferences, warnings, detectedConflicts, probeAnswerList, checkpointBypassed]);
  const composerPrimaryLabel = loadingStage === "itinerary"
    ? promptChangedSincePlan
      ? copy.refinePlanning
      : copy.generatingItinerary
    : promptChangedSincePlan
      ? copy.refinePlan
      : sectionComplete.assumptions
        ? copy.generateItinerary
        : !sectionComplete.conflicts
          ? copy.detectConflicts
          : !sectionComplete.probes
            ? copy.probesTitle
            : !sectionComplete.learned
              ? copy.learnPreferences
              : copy.learnedTitle;
  const processItems: Array<{ key: FlowSection; title: string; body: string; done: boolean }> = [
    { key: "prompt", title: copy.promptTitle, body: prompt.trim() ? prompt : labels.waitingPrompt, done: sectionComplete.prompt },
    {
      key: "conflicts",
      title: copy.conflictsTitle,
      body: checkpointDecision
        ? checkpointDecision.checkpointNeeded
          ? `${detectedConflicts.length} ${copy.checkpointQuestionCount.toLowerCase()}`
          : checkpointDecision.isPlanningTask
            ? copy.noCheckpointNeeded
            : copy.nonPlanningPrompt
        : copy.waiting,
      done: sectionComplete.conflicts
    },
    {
      key: "probes",
      title: copy.probesTitle,
      body: checkpointBypassed
        ? copy.proceedWithoutCheckpoint
        : detectedConflicts.length
          ? `${probeAnswerList.length}/${detectedConflicts.length} ${copy.answered.toLowerCase()}`
          : copy.waiting,
      done: sectionComplete.probes
    },
    {
      key: "learned",
      title: copy.learnedTitle,
      body:
        learnedPreferences.length || assumptions.length
          ? `${activeLearnedPreferences.length} ${copy.activePreferenceCount.toLowerCase()} - ${acceptedCount + inferredCount} ${copy.assumptionsReadySummary}`
          : copy.waiting,
      done: sectionComplete.learned && sectionComplete.assumptions
    },
    {
      key: "itinerary",
      title: copy.itineraryTitle,
      body: itinerary ? itinerary.summary : labels.waitingItineraryOutput,
      done: sectionComplete.itinerary
    },
    {
      key: "feasibility",
      title: copy.feasibilityTitle,
      body: warnings.length ? `${warnings.length} ${labels.warnings}` : copy.waiting,
      done: sectionComplete.feasibility
    }
  ];
  const activeProcessIndex = Math.max(
    0,
    processItems.findIndex((item) => item.key === activeSection)
  );
  const missingConflicts = detectedConflicts.filter((conflict) => !probeAnswers[conflict.id]);
  const visibleAssumptionIds = new Set(plannerAssumptions.map((assumption) => assumption.id));
  const highImpactCritiques = critiques.filter(
    (critique) => critique.impact === "High" && Boolean(critique.assumptionId && visibleAssumptionIds.has(critique.assumptionId))
  );
  const highImpactWarnings = warnings.filter((warning) => warning.impact === "High");
  const highImpactItems = [
    ...highImpactCritiques.map((critique) => ({
      id: critique.id,
      title: `${labels.categoryLabels[critique.category]}: ${critique.issue}`,
      detail: critique.recommendedQuestion,
      status: `${labels.impactLabels[critique.impact]} / ${copy.unresolvedStatus}`,
      onSelect: () => openReviewTarget(`planning-consequence-${critique.assumptionId}`)
    })),
    ...highImpactWarnings.map((warning) => ({
      id: warning.id,
      title: `${labels.warningTypeLabels[warning.type]}: ${warning.message}`,
      detail: warning.recommendation,
      status: labels.impactLabels[warning.impact],
      onSelect: () => openReviewTarget(`feasibility-warning-${warning.id}`, "feasibility")
    }))
  ];
  const firstRejectedAssumption = assumptions.find((assumption) => assumption.status === "Rejected");
  const promptChips: PromptStatusChip[] = [
    {
      id: "planning-consequences",
      label: `${plannerAssumptions.length} ${labels.assumptionsInferred}`,
      title: copy.chipAssumptionsTitle,
      emptyText: copy.chipNoItems,
      clickHint: copy.chipClickHint,
      onClick: () => openReviewTarget(plannerAssumptions[0] ? `planning-consequence-${plannerAssumptions[0].id}` : "workflow-learned"),
      items: plannerAssumptions.map((assumption) => ({
        id: assumption.id,
        title: `${labels.categoryLabels[assumption.category]}: ${assumption.value}`,
        detail: assumption.rationale,
        status: labels.assumptionStatusLabels[assumption.status],
        onSelect: () => openReviewTarget(`planning-consequence-${assumption.id}`)
      }))
    },
    {
      id: "missing-preferences",
      label: `${missingConflicts.length + rejectedCount} ${labels.missingPreferences}`,
      title: copy.chipMissingTitle,
      emptyText: copy.chipNoItems,
      clickHint: copy.chipClickHint,
      onClick: () =>
        openReviewTarget(
          missingConflicts.length > 0 ? "workflow-probes" : firstRejectedAssumption
            ? `planning-consequence-${firstRejectedAssumption.id}`
            : "workflow-learned",
          missingConflicts.length > 0 ? "probes" : "learned"
        ),
      items: [
        ...missingConflicts.map((conflict) => ({
          id: conflict.id,
          title: conflict.title,
          detail: conflict.hiddenPreference,
          status: copy.unanswered,
          onSelect: () => openReviewTarget("workflow-probes", "probes")
        })),
        ...assumptions
          .filter((assumption) => assumption.status === "Rejected")
          .map((assumption) => ({
            id: assumption.id,
            title: `${labels.categoryLabels[assumption.category]}: ${assumption.value}`,
            detail: assumption.rationale,
            status: labels.assumptionStatusLabels[assumption.status],
            onSelect: () => openReviewTarget(`planning-consequence-${assumption.id}`)
          }))
      ]
    },
    {
      id: "high-impact",
      label: `${highImpactItems.length} ${labels.highImpactUnresolved}`,
      title: copy.chipHighImpactTitle,
      emptyText: copy.chipNoItems,
      clickHint: copy.chipClickHint,
      onClick: () =>
        openReviewTarget(
          highImpactItems[0]?.id && highImpactWarnings.some((warning) => warning.id === highImpactItems[0].id)
            ? `feasibility-warning-${highImpactItems[0].id}`
            : highImpactCritiques[0]?.assumptionId
              ? `planning-consequence-${highImpactCritiques[0].assumptionId}`
              : "evaluation-signals-panel",
          highImpactItems[0]?.id && highImpactWarnings.some((warning) => warning.id === highImpactItems[0].id) ? "feasibility" : "learned"
        ),
      items: highImpactItems
    }
  ];

  return (
    <main className="min-h-screen p-3 pb-32 text-slate-950 sm:p-4 sm:pb-32 lg:p-5 lg:pb-32">
      <header className="sticky top-3 z-[1100] mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-slate-200/70 bg-white/82 px-4 py-2.5 shadow-[0_10px_36px_rgba(26,35,67,0.1)] backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-3">
          <div className="passport-cover flex size-10 shrink-0 items-center justify-center rounded-xl text-white">
            <Plane className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="display-serif truncate text-base font-black leading-tight text-slate-950">{labels.appTitle}</h1>
            <p className="hidden truncate text-xs font-semibold text-slate-500 md:block">{copy.eyebrow}</p>
          </div>
        </div>

        {study.active ? (
          <span className="stamp-badge hidden items-center gap-1.5 text-rose-700 md:inline-flex" title={copy.studySession}>
            <Stamp className="size-3.5" />
            {study.participantId ?? copy.studySession} · {conditionCode(study)}
          </span>
        ) : null}

        <div className="order-last mx-auto flex w-full max-w-full rounded-full border border-slate-200 bg-slate-100/80 p-1 md:order-none md:w-auto">
          <button
            type="button"
            onClick={() => openWorkflowSection("learned")}
            className={`flex h-9 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-black transition md:min-w-[150px] md:flex-none ${
              activeSection !== "itinerary"
                ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <ShieldCheck className="size-4" />
            {labels.assumptionsView}
          </button>
          <button
            type="button"
            onClick={() => openWorkflowSection("itinerary")}
            className={`flex h-9 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-black transition md:min-w-[130px] md:flex-none ${
              activeSection === "itinerary"
                ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Route className="size-4" />
            {labels.canvasView}
          </button>
        </div>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <span
            className={`hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold xl:inline-flex ${
              restored ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"
            }`}
          >
            <span className={`size-1.5 rounded-full ${restored ? "bg-emerald-500" : "bg-slate-400"}`} />
            {restored ? copy.restored : copy.saved}
          </span>
          <label className="flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600">
            <span className="hidden sm:inline">{labels.language}</span>
            <select
              value={language}
              onChange={(event) => handleLanguageChange(event.target.value as Language)}
              className="bg-transparent text-xs font-black text-indigo-700 outline-none"
            >
              {(Object.keys(languageNames) as Language[]).map((item) => (
                <option key={item} value={item}>
                  {languageNames[item]}
                </option>
              ))}
            </select>
          </label>
          {study.active || study.experimenter ? (
            <button
              type="button"
              onClick={() => exportStudyLog(study)}
              className="flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
              title={copy.exportLog}
            >
              <Download className="size-4" />
              <span className="hidden sm:inline">{copy.exportLog}</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleStartNewSession}
            className="flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
            title={copy.resetNotice}
          >
            <RotateCcw className="size-4" />
            <span className="hidden sm:inline">{copy.startNewSession}</span>
          </button>
        </div>
      </header>

      {activeSection === "itinerary" ? (
        <div className="mx-auto mt-4 max-w-[1600px]">
          {showRefineBanner ? (
            <div className="mb-4">
              <RefineBanner
                copy={copy}
                canRefine={promptChangedSincePlan}
                scope={liveRefinementScope}
                loading={loadingStage === "itinerary"}
                onRefine={() => void handleGenerate()}
                onReanalyze={() => void handleDetectConflicts()}
              />
            </div>
          ) : null}

          {error ? (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-semibold">{copy.errorTitle}</p>
                <p className="mt-1 leading-5">{error}</p>
              </div>
            </div>
          ) : null}

          <ItineraryCanvas
            itinerary={itinerary}
            warnings={warnings}
            assumptions={assumptions}
            selectedOptionId={selectedOptionId}
            onSelectOption={(optionId) => {
              setSelectedOptionId(optionId);
              recordEvent("option_selected", optionId ?? undefined);
            }}
            planning={loadingStage === "itinerary"}
            labels={labels}
            mode="map"
            onOpenReview={openReviewPlanning}
          />

          {itinerary ? (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-stretch">
              <div className="min-w-0 flex-1">
                <BoardingPass
                  itinerary={itinerary}
                  selectedOptionId={selectedOptionId}
                  learnedPreferences={learnedPreferences}
                  copy={copy}
                  impactLabels={labels.impactLabels}
                />
              </div>
              <MaturityGauge score={planMaturityScore} copy={copy} />
            </div>
          ) : null}
        </div>
      ) : (
      <div className="mx-auto mt-4 grid max-w-[1600px] gap-4 xl:grid-cols-[330px_minmax(0,1fr)_340px]">
        <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start">
          <Panel title={copy.preferenceHistory} eyebrow={copy.originalPrompt} icon={<Sparkles className="size-4" />}>
            <p className="rounded-xl bg-slate-50 p-3 text-xs font-semibold leading-5 text-slate-600">
              {prompt || copy.promptPlaceholder}
            </p>
            <div className="mt-3 space-y-2">
              {visiblePreferenceRows.length === 0 ? (
                <EmptyState title={copy.noLearned} body={labels.waitingPrompt} />
              ) : null}
              {visiblePreferenceRows.slice(0, 5).map((preference) => (
                <div key={preference.id} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-950">{labels.categoryLabels[preference.category]}</p>
                      <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">{preference.value}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-black ${preferenceControlTone(
                        preferenceControls[preference.id] || defaultPreferenceControl()
                      )}`}
                    >
                      {(preferenceControls[preference.id] || defaultPreferenceControl()).state === "ignored"
                        ? copy.ignoredPreference
                        : copy.activePreference}
                    </span>
                  </div>
                </div>
              ))}
              {visiblePreferenceRows.length > 0 ? (
                <button
                  type="button"
                  onClick={() => openWorkflowSection("learned")}
                  className="w-full rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700"
                >
                  {copy.userControl}
                </button>
              ) : null}
            </div>
          </Panel>

          <Panel title={copy.currentCheckpoint} eyebrow={copy.current} icon={<AlertTriangle className="size-4" />}>
            {currentProbe ? (
              <div className="rounded-xl border border-orange-100 bg-orange-50/70 p-3">
                <p className="text-sm font-black text-orange-950">{currentProbe.title}</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-orange-900/75">{currentProbe.hiddenPreference}</p>
                <button
                  type="button"
                  onClick={() => openWorkflowSection("probes")}
                  className="mt-3 rounded-xl bg-violet-600 px-3 py-2 text-xs font-black text-white"
                >
                  {copy.probesTitle}
                </button>
              </div>
            ) : checkpointBypassed ? (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
                <p className="text-sm font-black text-emerald-950">{copy.noCheckpointNeeded}</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-emerald-900/75">{checkpointDecision?.rationale}</p>
                <button
                  type="button"
                  onClick={() => void handleGenerate()}
                  className="mt-3 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white"
                >
                  {copy.proceedWithoutCheckpoint}
                </button>
              </div>
            ) : nonPlanningPrompt ? (
              <div className="rounded-xl border border-rose-100 bg-rose-50/70 p-3">
                <p className="text-sm font-black text-rose-950">{copy.nonPlanningPrompt}</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-rose-900/75">{checkpointDecision?.rationale}</p>
              </div>
            ) : assumptions.length > 0 ? (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-3">
                <p className="text-sm font-black text-indigo-950">{copy.assumptionsTitle}</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-indigo-900/75">
                  {acceptedCount} {copy.usedInPlan} / {inferredCount} {copy.reviewLater} / {rejectedCount} {copy.excludedFromPlan}
                </p>
                <button
                  type="button"
                  onClick={() => openWorkflowSection("learned")}
                  className="mt-3 rounded-xl bg-violet-600 px-3 py-2 text-xs font-black text-white"
                >
                  {copy.reviewAssumptions}
                </button>
              </div>
            ) : (
              <EmptyState title={copy.noConflicts} body={copy.promptBody} />
            )}
          </Panel>

          <Panel title={copy.planningSteps} eyebrow={copy.completed} icon={<Route className="size-4" />}>
            <div className="grid grid-cols-6 gap-1">
              {processItems.map((item, index) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => openWorkflowSection(item.key)}
                  className="flex min-w-0 flex-col items-center gap-1"
                  title={item.title}
                >
                  <span
                    className={`flex size-8 items-center justify-center rounded-full border text-xs font-black ${
                      item.done
                        ? "border-emerald-200 bg-emerald-500 text-white"
                        : index === activeProcessIndex
                          ? "border-violet-200 bg-violet-600 text-white"
                          : "border-slate-200 bg-white text-slate-400"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="max-w-full truncate text-[10px] font-bold text-slate-500">{item.title}</span>
                </button>
              ))}
            </div>
          </Panel>
        </aside>

        <section className="space-y-3">
          {showRefineBanner ? (
            <RefineBanner
              copy={copy}
              canRefine={promptChangedSincePlan}
              scope={liveRefinementScope}
              loading={loadingStage === "itinerary"}
              onRefine={() => void handleGenerate()}
              onReanalyze={() => void handleDetectConflicts()}
            />
          ) : null}
          <ItineraryCanvas
            itinerary={itinerary}
            warnings={warnings}
            assumptions={assumptions}
            selectedOptionId={selectedOptionId}
            onSelectOption={(optionId) => {
              setSelectedOptionId(optionId);
              recordEvent("option_selected", optionId ?? undefined);
            }}
            planning={loadingStage === "itinerary"}
            labels={labels}
            mode="review"
            digests={digests}
            onQuickAdjust={(instruction) => void handleGenerate(instruction)}
          />

          {itinerary ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
              <div className="min-w-0 flex-1">
                <BoardingPass
                  itinerary={itinerary}
                  selectedOptionId={selectedOptionId}
                  learnedPreferences={learnedPreferences}
                  copy={copy}
                  impactLabels={labels.impactLabels}
                />
              </div>
              <MaturityGauge score={planMaturityScore} copy={copy} />
            </div>
          ) : null}

          {planDiff ? <PlanDiffCard diff={planDiff} copy={copy} /> : null}

          {error ? (
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-semibold">{copy.errorTitle}</p>
                <p className="mt-1 leading-5">{error}</p>
              </div>
            </div>
          ) : null}

          <WorkflowSection
            id="prompt"
            title={copy.promptTitle}
            body={copy.promptBody}
            icon={<MessageSquareText className="size-4" />}
            status={sectionStatus("prompt", workflowStep, activeSection, sectionComplete.prompt)}
            statusLabel={statusLabel("prompt")}
            activeSection={activeSection}
            onOpen={openWorkflowSection}
          >
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase text-slate-400">{copy.knownFromPrompt}</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{prompt || copy.knownFallback}</p>
                </div>
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                  <p className="text-xs font-black uppercase text-indigo-500">{copy.stillUncertain}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(checkpointDecision && checkpointDecision.missingPreferenceCategories.length > 0
                      ? checkpointDecision.missingPreferenceCategories.map((category) => labels.categoryLabels[category])
                      : [copy.uncertainTripShape, copy.uncertainBudgetComfort, copy.uncertainPaceInterests, copy.uncertainLogistics]
                    ).map((item) => (
                      <span key={item} className="rounded-full border border-white/80 bg-white px-2.5 py-1 text-xs font-bold text-indigo-700">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleDetectConflicts}
                  disabled={prompt.trim().length < 4 || loadingStage !== null}
                  className="flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white shadow-[0_12px_28px_rgba(99,68,255,0.28)] disabled:cursor-not-allowed disabled:bg-indigo-200"
                >
                  {loadingStage === "conflicts" ? <Loader2 className="size-4 animate-spin" /> : <SearchCheck className="size-4" />}
                  {loadingStage === "conflicts" ? copy.detectingConflicts : copy.detectConflicts}
                </button>
              </div>
              <p className="text-xs font-semibold text-slate-500">{copy.resetNotice}</p>
            </div>
          </WorkflowSection>

          <WorkflowSection
            id="conflicts"
            title={copy.conflictsTitle}
            body={copy.conflictsBody}
            icon={<AlertTriangle className="size-4" />}
            status={sectionStatus("conflicts", workflowStep, activeSection, sectionComplete.conflicts)}
            statusLabel={statusLabel("conflicts")}
            activeSection={activeSection}
            onOpen={openWorkflowSection}
          >
            <div className="space-y-3">
              {checkpointDecision ? (
                <div
                  className={`rounded-xl border p-4 ${
                    nonPlanningPrompt
                      ? "border-rose-200 bg-rose-50"
                      : checkpointDecision.checkpointNeeded
                        ? "border-amber-200 bg-amber-50"
                        : "border-emerald-200 bg-emerald-50"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase opacity-70">{copy.checkpointDecision}</p>
                      <h3 className="mt-1 text-lg font-black text-slate-950">
                        {nonPlanningPrompt
                          ? copy.nonPlanningPrompt
                          : checkpointDecision.checkpointNeeded
                            ? copy.checkpointNeeded
                            : copy.noCheckpointNeeded}
                      </h3>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-black ${
                        checkpointDecision.checkpointNeeded
                          ? "border-amber-300 bg-white text-amber-700"
                          : "border-emerald-300 bg-white text-emerald-700"
                      }`}
                    >
                      {checkpointStageLabel(checkpointDecision.checkpointStage, copy)}
                    </span>
                  </div>
                  {showAgentVisibility ? (
                    <>
                      <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">{checkpointDecision.rationale}</p>
                      <div className="mt-4 grid gap-2 md:grid-cols-3">
                        <div className="rounded-xl border border-white/80 bg-white/80 p-3">
                          <p className="text-[11px] font-black uppercase text-slate-400">{copy.assumptionRisk}</p>
                          <ImpactBadge impact={checkpointDecision.assumptionRisk} labels={labels.impactLabels} />
                        </div>
                        <div className="rounded-xl border border-white/80 bg-white/80 p-3">
                          <p className="text-[11px] font-black uppercase text-slate-400">{copy.interactionCost}</p>
                          <ImpactBadge impact={checkpointDecision.interactionCost} labels={labels.impactLabels} />
                        </div>
                        <div className="rounded-xl border border-white/80 bg-white/80 p-3">
                          <p className="text-[11px] font-black uppercase text-slate-400">{copy.missingCategories}</p>
                          <p className="mt-1 text-xs font-bold text-slate-700">
                            {checkpointDecision.missingPreferenceCategories.length
                              ? checkpointDecision.missingPreferenceCategories.map((category) => labels.categoryLabels[category]).join(", ")
                              : copy.noneStage}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 rounded-xl border border-white/80 bg-white/80 p-3">
                        <p className="text-[11px] font-black uppercase text-slate-400">{copy.expectedPlanImpact}</p>
                        <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{checkpointDecision.expectedPlanImpact}</p>
                      </div>
                    </>
                  ) : null}
                  {checkpointBypassed ? (
                    <button
                      type="button"
                      onClick={() => void handleGenerate()}
                      disabled={loadingStage !== null}
                      className="mt-4 flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-[0_12px_28px_rgba(16,185,129,0.24)] disabled:cursor-not-allowed disabled:bg-emerald-200"
                    >
                      {loadingStage === "itinerary" ? <Loader2 className="size-4 animate-spin" /> : <Route className="size-4" />}
                      {loadingStage === "itinerary" ? copy.generatingItinerary : copy.proceedWithoutCheckpoint}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {hiddenPreferenceInsights.length === 0 ? (
                <EmptyState title={checkpointDecision ? copy.noCheckpointNeeded : copy.noPreferenceInsights} body={copy.promptBody} />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {hiddenPreferenceInsights.map((insight) => (
                    <article key={insight.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-sm font-black text-slate-950">{insight.title}</h3>
                        {showAgentVisibility ? (
                          <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700">
                            {Math.round(insight.confidence * 100)}% {copy.modelConfidence}
                          </span>
                        ) : null}
                      </div>
                      {showAgentVisibility ? (
                        <>
                          <p className="mt-3 text-xs font-black uppercase text-slate-400">{copy.explicitSignals}</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {insight.explicitSignals.map((signal) => (
                              <span key={signal} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-600">
                                {signal}
                              </span>
                            ))}
                          </div>
                        </>
                      ) : null}
                      <p className="mt-3 text-xs font-black uppercase text-slate-400">{copy.hiddenPreference}</p>
                      <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">{insight.hiddenPreference}</p>
                      {showAgentVisibility ? (
                        <details className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                          <summary className="cursor-pointer text-xs font-black text-indigo-700">{copy.agentEvidence}</summary>
                          <div className="mt-3 space-y-2 text-xs font-semibold leading-5 text-slate-600">
                            <p>
                              <span className="font-black text-slate-800">{copy.whyItMatters}: </span>
                              {insight.whyItMatters}
                            </p>
                            <p>
                              <span className="font-black text-slate-800">{copy.whyAsked}: </span>
                              {insight.probeQuestion}
                            </p>
                          </div>
                        </details>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </WorkflowSection>

          <WorkflowSection
            id="probes"
            title={copy.probesTitle}
            body={copy.probesBody}
            icon={<Sparkles className="size-4" />}
            status={sectionStatus("probes", workflowStep, activeSection, sectionComplete.probes)}
            statusLabel={statusLabel("probes")}
            activeSection={activeSection}
            onOpen={openWorkflowSection}
          >
            {detectedConflicts.length === 0 ? (
              <EmptyState title={checkpointBypassed ? copy.proceedWithoutCheckpoint : copy.noConflicts} body={checkpointDecision?.rationale} />
            ) : (
              <div className="space-y-4">
                {detectedConflicts.map((conflict) => {
                  const answer = probeAnswers[conflict.id];
                  const insight = hiddenPreferenceInsights.find((item) => item.id === conflict.id);

                  return (
                    <div key={conflict.id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-black uppercase text-indigo-600">{conflict.title}</p>
                          <h3 className="mt-1 text-lg font-black text-slate-950">{conflict.probe.question}</h3>
                        </div>
                        <span
                          className={`rounded-full border px-2 py-1 text-[11px] font-bold ${
                            answer?.skipped
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : answer
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-slate-50 text-slate-500"
                          }`}
                        >
                          {answer?.skipped ? copy.skippedAnswer : answer ? copy.answered : copy.unanswered}
                        </span>
                      </div>
                      {insight && showAgentVisibility ? (
                        <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-xs font-semibold leading-5 text-indigo-900">
                          <p className="font-black uppercase text-indigo-600">{copy.whyAsked}</p>
                          <p className="mt-1">{insight.hiddenPreference}</p>
                        </div>
                      ) : null}
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {conflict.probe.options.map((option) => {
                          const selected = answer?.optionId === option.id;

                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => handleProbeChoice(conflict, option.id)}
                              className={`rounded-xl border p-3 text-left shadow-sm transition ${
                                selected
                                  ? "border-indigo-300 bg-indigo-50 text-indigo-900"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200"
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <div
                                  className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border ${
                                    selected ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white text-transparent"
                                  }`}
                                >
                                  <Check className="size-3" />
                                </div>
                                <div>
                                  <p className="text-sm font-black">{option.label}</p>
                                  <p className="mt-2 text-xs font-black uppercase opacity-55">{copy.planningImpact}</p>
                                  <p className="mt-1 text-xs font-semibold leading-5 opacity-80">{option.planningImpact}</p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleProbeSkip(conflict)}
                          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                            answer?.skipped
                              ? "border-amber-300 bg-amber-50 text-amber-700"
                              : "border-slate-200 bg-white text-slate-500 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                          }`}
                        >
                          <SkipForward className="size-3.5" />
                          {copy.skipProbe}
                        </button>
                      </div>
                      <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <p className="text-[11px] font-black uppercase text-slate-400">{copy.selectedAnswer}</p>
                        <p className="mt-1 text-sm font-black text-slate-900">{answer?.answer || copy.notAnsweredYet}</p>
                        {answer ? <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">{answer.planningImpact}</p> : null}
                        {answer && !answer.skipped ? (
                          <label className="mt-3 block">
                            <span className="text-[11px] font-black uppercase text-slate-400">{copy.refineAnswer}</span>
                            <input
                              value={answer.customAnswer}
                              onChange={(event) => handleProbeRefine(conflict.id, event.target.value)}
                              onBlur={(event) => {
                                if (event.target.value.trim().length > 0) {
                                  recordEvent("probe_refined", conflict.id, { customAnswer: event.target.value.trim() });
                                }
                              }}
                              placeholder={copy.refinePlaceholder}
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                            />
                          </label>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleLearnPreferences}
                    disabled={!allProbesAnswered || loadingStage !== null}
                    className="flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white shadow-[0_12px_28px_rgba(99,68,255,0.28)] disabled:cursor-not-allowed disabled:bg-violet-200"
                  >
                    {loadingStage === "preferences" ? <Loader2 className="size-4 animate-spin" /> : <BrainCircuit className="size-4" />}
                    {loadingStage === "preferences" ? copy.learningPreferences : copy.learnPreferences}
                  </button>
                </div>
              </div>
            )}
          </WorkflowSection>

          <WorkflowSection
            id="learned"
            title={copy.learnedTitle}
            body={copy.learnedBody}
            icon={<CheckCircle2 className="size-4" />}
            status={sectionStatus("learned", workflowStep, activeSection, sectionComplete.learned && sectionComplete.assumptions)}
            statusLabel={statusLabel("learned")}
            activeSection={activeSection}
            onOpen={openWorkflowSection}
          >
            {learnedPreferences.length === 0 ? (
              <EmptyState title={copy.noLearned} />
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4">
                  <p className="text-xs font-black uppercase text-indigo-600">{copy.learnedTitle}</p>
                  <p className="mt-1 text-sm font-black text-indigo-950">{copy.preferenceProfileHint}</p>
                  <div className="mt-3 grid gap-2 md:grid-cols-4">
                    {[copy.profileFlowPrompt, copy.profileFlowProfile, copy.profileFlowConsequences, copy.profileFlowItinerary].map((step, index) => (
                      <div key={step} className="flex items-center gap-2 rounded-xl border border-white/70 bg-white/72 px-3 py-2 text-xs font-black text-indigo-900">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] text-white">
                          {index + 1}
                        </span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {!allowControls ? (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">
                    <ShieldCheck className="size-4 shrink-0" />
                    {copy.readOnlyNotice}
                  </div>
                ) : null}

                <div className="grid gap-3">
                  {learnedPreferences.map((preference) => {
                    const control = preferenceControls[preference.id] || defaultPreferenceControl();
                    const priority = effectivePreferencePriority(control);
                    const relatedInsight = hiddenPreferenceInsights.find((insight) => insight.learnedPreference?.id === preference.id);
                    const priorityDisabled = control.state === "ignored" || !allowControls;
                    const relatedConsequences = assumptions.filter((assumption) => assumption.category === preference.category);
                    const activeRelatedCount =
                      control.state === "ignored" ? 0 : relatedConsequences.filter((assumption) => assumption.status !== "Rejected").length;
                    const showTransportImpact = preference.category === "transport" && usefulTransportAssumptions.length > 0;
                    const showAccommodationImpact = preference.category === "accommodationArea" && usefulAccommodationAssumptions.length > 0;
                    const showCostImpact = preference.category === "budget" && usefulCostAssumptions.length > 0;
                    const hasLinkedConsequences =
                      relatedConsequences.length > 0 || showTransportImpact || showAccommodationImpact || showCostImpact;

                    return (
                      <article
                        id={`learned-preference-${preference.id}`}
                        key={preference.id}
                        className={`rounded-xl border bg-white p-4 shadow-sm ${
                          control.state === "ignored" ? "border-rose-200 bg-rose-50/45" : "border-slate-200"
                        }`}
                      >
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_270px]">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-black text-slate-600">
                                {labels.categoryLabels[preference.category]}
                              </span>
                              <SourceBadge source={preference.source} labels={labels.sourceLabels} />
                              <span className={`rounded-full border px-2 py-1 text-[11px] font-black ${preferenceControlTone(control)}`}>
                                {control.state === "ignored" ? copy.ignoredPreference : copy.activePreference}
                              </span>
                              <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-1 text-[11px] font-black text-indigo-700">
                                {priority === "primary"
                                  ? copy.primaryPriority
                                  : priority === "low"
                                    ? copy.lowPriority
                                    : copy.normalPriority}
                              </span>
                            </div>

                            <h3 className="mt-3 text-lg font-black leading-7 text-slate-950">{preference.value}</h3>

                            {showAgentVisibility ? (
                              <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                                <p className="text-[11px] font-black uppercase text-slate-400">{copy.inferredFrom}</p>
                                <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
                                  {relatedInsight?.selectedAnswer?.planningImpact || relatedInsight?.whyItMatters || preference.planningImpact}
                                </p>
                              </div>
                            ) : null}

                            {showAgentVisibility ? (
                              <div className="mt-3 grid gap-2">
                                <div className="rounded-xl border border-slate-100 bg-white p-3">
                                  <p className="text-[11px] font-black uppercase text-slate-400">{copy.modelConfidence}</p>
                                  <p className="mt-1 text-sm font-black text-slate-950">{Math.round(preference.confidence * 100)}%</p>
                                </div>
                              </div>
                            ) : null}

                            {allowControls ? (
                              <details className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                                <summary className="cursor-pointer text-xs font-black text-indigo-700">{copy.editPreference}</summary>
                                <label className="mt-3 block">
                                  <span className="text-[11px] font-black uppercase text-slate-400">{copy.preferenceDetail}</span>
                                  <textarea
                                    value={preference.value}
                                    onChange={(event) => handleLearnedPreferenceValueChange(preference.id, event.target.value)}
                                    onBlur={() => recordEvent("preference_edited", preference.id, { value: preference.value })}
                                    rows={2}
                                    className="mt-1 min-h-16 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold leading-6 text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                                  />
                                  <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{copy.preferenceDetailHint}</span>
                                </label>
                              </details>
                            ) : null}

                            {relatedInsight && showAgentVisibility ? (
                              <details className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                                <summary className="cursor-pointer text-xs font-black text-indigo-700">{copy.agentEvidence}</summary>
                                <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">{relatedInsight.whyItMatters}</p>
                                <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">
                                  {copy.selectedAnswer}: {relatedInsight.selectedAnswer?.answer || copy.notAnsweredYet}
                                </p>
                              </details>
                            ) : null}
                          </div>

                          <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <p className="text-[11px] font-black uppercase text-slate-400">{copy.userControl}</p>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                disabled={!allowControls}
                                aria-pressed={control.state !== "ignored"}
                                onClick={() => updatePreferenceControl(preference.id, { state: "active" })}
                                className={`rounded-xl border px-3 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                  control.state !== "ignored"
                                    ? "border-emerald-500 bg-emerald-600 text-white"
                                    : "border-slate-200 bg-white text-slate-600 hover:bg-emerald-50"
                                }`}
                              >
                                {copy.activePreference}
                              </button>
                              <button
                                type="button"
                                disabled={!allowControls}
                                aria-pressed={control.state === "ignored"}
                                onClick={() => updatePreferenceControl(preference.id, { state: "ignored" })}
                                className={`rounded-xl border px-3 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                  control.state === "ignored"
                                    ? "border-rose-500 bg-rose-600 text-white"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                                }`}
                              >
                                {copy.ignorePreference}
                              </button>
                            </div>
                            <p className="mt-4 text-[11px] font-black uppercase text-slate-400">{copy.planningImpact}</p>
                            <div className="mt-2 grid grid-cols-3 gap-2">
                              <button
                                type="button"
                                disabled={priorityDisabled}
                                onClick={() => updatePreferenceControl(preference.id, { state: "active", priority: "primary" })}
                                className={`rounded-xl border px-2 py-2 text-xs font-black transition ${
                                  priorityDisabled
                                    ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                                    : priority === "primary"
                                      ? "border-violet-500 bg-violet-600 text-white"
                                      : "border-slate-200 bg-white text-slate-600 hover:bg-violet-50"
                                }`}
                              >
                                {copy.makePrimary}
                              </button>
                              <button
                                type="button"
                                disabled={priorityDisabled}
                                onClick={() => updatePreferenceControl(preference.id, { state: "active", priority: "normal" })}
                                className={`rounded-xl border px-2 py-2 text-xs font-black transition ${
                                  priorityDisabled
                                    ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                                    : priority === "normal"
                                      ? "border-emerald-500 bg-emerald-600 text-white"
                                      : "border-slate-200 bg-white text-slate-600 hover:bg-emerald-50"
                                }`}
                              >
                                {copy.normalPriority}
                              </button>
                              <button
                                type="button"
                                disabled={priorityDisabled}
                                onClick={() => updatePreferenceControl(preference.id, { state: "active", priority: "low" })}
                                className={`rounded-xl border px-2 py-2 text-xs font-black transition ${
                                  priorityDisabled
                                    ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                                    : priority === "low"
                                      ? "border-slate-400 bg-slate-700 text-white"
                                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                }`}
                              >
                                {copy.lowerPriority}
                              </button>
                            </div>
                          </div>
                        </div>

                        <details className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/45 p-3">
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-black uppercase text-indigo-600">{copy.assumptionsTitle}</p>
                              <p className="mt-1 text-sm font-semibold text-indigo-950/75">
                                {control.state === "ignored"
                                  ? copy.noActiveConsequences
                                  : `${activeRelatedCount} ${labels.assumptionsInferred}`}
                              </p>
                            </div>
                            <ChevronDown className="size-4 shrink-0 text-indigo-600" />
                          </summary>

                          <div className="mt-3 space-y-3 border-t border-indigo-100 pt-3">
                            <p className="text-xs font-semibold leading-5 text-indigo-950/70">{copy.consequencesHint}</p>
                            {control.state === "ignored" ? (
                              <div className="rounded-xl border border-rose-100 bg-white/80 p-3 text-xs font-black text-rose-700">
                                {copy.noActiveConsequences}
                              </div>
                            ) : null}
                            {!hasLinkedConsequences ? (
                              <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-500">
                                {copy.noLinkedConsequences}
                              </div>
                            ) : null}

                            {relatedConsequences.map((assumption) => {
                              const isRejected = assumption.status === "Rejected";
                              const isPending = assumption.status === "Pending";
                              const relatedCritique = critiques.find((critique) => critique.assumptionId === assumption.id);
                              const isHighImpact = relatedCritique?.impact === "High";
                              const isLowConfidence = assumption.confidence < 0.75;
                              const controlsDisabled = control.state === "ignored" || !allowControls;

                              return (
                                <div
                                  id={`planning-consequence-${assumption.id}`}
                                  key={assumption.id}
                                  className={`scroll-mt-28 rounded-xl border p-3 shadow-sm transition ${
                                    isRejected
                                      ? "border-rose-200 bg-rose-50/70"
                                      : controlsDisabled
                                        ? "border-slate-200 bg-white/70 opacity-75"
                                        : "border-slate-200 bg-white"
                                  }`}
                                >
                                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span
                                          className={`rounded-full border px-2 py-1 text-[11px] font-black ${
                                            isRejected
                                              ? "border-rose-200 bg-white text-rose-700"
                                              : isPending
                                                ? "border-amber-200 bg-white text-amber-700"
                                                : "border-emerald-200 bg-white text-emerald-700"
                                          }`}
                                        >
                                          {isRejected ? copy.excludedFromPlan : isPending ? copy.reviewLater : copy.usedInPlan}
                                        </span>
                                        {showAgentVisibility ? (
                                          <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-500">
                                            {Math.round(assumption.confidence * 100)}% {copy.confidence}
                                          </span>
                                        ) : null}
                                        {isLowConfidence && showAgentVisibility ? (
                                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-black text-amber-700">
                                            {copy.lowConfidence}
                                          </span>
                                        ) : null}
                                        {isHighImpact && showAgentVisibility ? (
                                          <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-black text-rose-700">
                                            {copy.highImpact}
                                          </span>
                                        ) : null}
                                        {assumption.category === "budget" ? (
                                          <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-black text-violet-700">
                                            {copy.mayAffectBudget}
                                          </span>
                                        ) : null}
                                      </div>
                                      <p className="mt-2 text-sm font-black leading-6 text-slate-950">{assumption.value}</p>
                                      {showAgentVisibility ? (
                                        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{assumption.rationale}</p>
                                      ) : null}
                                      {relatedCritique && allowControls && control.state !== "ignored" ? (
                                        <AssumptionRefine
                                          eyebrow={copy.criticFollowUp}
                                          question={relatedCritique.recommendedQuestion}
                                          placeholder={copy.refinementPlaceholder}
                                          applyLabel={copy.applyRefinement}
                                          onApply={(value) => handleAssumptionRefine(assumption.id, value)}
                                        />
                                      ) : null}
                                    </div>

                                    <div className="grid gap-2" role="group" aria-label={copy.assumptionDecision}>
                                      <button
                                        type="button"
                                        disabled={controlsDisabled}
                                        aria-pressed={!isRejected && !controlsDisabled}
                                        onClick={() => handleAssumptionStatusChange(assumption.id, "Accepted")}
                                        className={`flex h-10 items-center justify-between rounded-xl border px-3 text-sm font-black transition ${
                                          controlsDisabled
                                            ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                                            : !isRejected
                                              ? "border-emerald-500 bg-emerald-600 text-white shadow-sm"
                                              : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                                        }`}
                                      >
                                        <span>{copy.useAssumption}</span>
                                        {!isRejected && !controlsDisabled ? <Check className="size-4" /> : null}
                                      </button>
                                      <button
                                        type="button"
                                        disabled={controlsDisabled}
                                        aria-pressed={isRejected && !controlsDisabled}
                                        onClick={() => handleAssumptionStatusChange(assumption.id, "Rejected")}
                                        className={`flex h-10 items-center justify-between rounded-xl border px-3 text-sm font-black transition ${
                                          controlsDisabled
                                            ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                                            : isRejected
                                              ? "border-rose-500 bg-rose-600 text-white shadow-sm"
                                              : "border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                                        }`}
                                      >
                                        <span>{copy.excludeAssumption}</span>
                                        {isRejected && !controlsDisabled ? <X className="size-4" /> : null}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}

                            {showTransportImpact ? (
                              <div className="rounded-xl border border-slate-200 bg-white p-3">
                                <p className="text-xs font-black uppercase text-slate-400">{labels.transportAssumptions}</p>
                                <div className="mt-2 grid gap-2 md:grid-cols-2">
                                  {usefulTransportAssumptions.map((item) => (
                                    <div key={item.id} className="rounded-xl bg-slate-50 p-2 text-xs font-semibold text-slate-600">
                                      <p className="font-black text-slate-900">
                                        {item.from} - {item.to}
                                      </p>
                                      <p className="mt-1">
                                        {item.mode} - {item.estimatedTravelTimeMinutes} {labels.minutes}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            {showAccommodationImpact ? (
                              <div className="rounded-xl border border-slate-200 bg-white p-3">
                                <p className="text-xs font-black uppercase text-slate-400">{labels.accommodationAssumptions}</p>
                                <div className="mt-2 grid gap-2 md:grid-cols-2">
                                  {usefulAccommodationAssumptions.map((item) => (
                                    <div key={item.id} className="rounded-xl bg-slate-50 p-2 text-xs font-semibold text-slate-600">
                                      <p className="font-black text-slate-900">
                                        {labels.night} {item.night}: {item.area}
                                      </p>
                                      <p className="mt-1">{item.accommodationStyle}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            {showCostImpact ? (
                              <div className="rounded-xl border border-slate-200 bg-white p-3">
                                <p className="text-xs font-black uppercase text-slate-400">{labels.costAssumptions}</p>
                                <div className="mt-2 grid gap-2 md:grid-cols-2">
                                  {usefulCostAssumptions.map((item) => (
                                    <div key={item.id} className="rounded-xl bg-slate-50 p-2 text-xs font-semibold text-slate-600">
                                      <p className="font-black text-slate-900">{labels.costCategoryLabels[item.category]}</p>
                                      <p className="mt-1">
                                        {labels.perDay}: EUR {item.perDayEstimateEur} - {labels.total}: EUR {item.totalEstimateEur}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </details>
                      </article>
                    );
                  })}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void handleGenerate()}
                    disabled={activeLearnedPreferences.length === 0 || loadingStage !== null}
                    className="flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white shadow-[0_12px_28px_rgba(99,68,255,0.28)] disabled:cursor-not-allowed disabled:bg-indigo-200"
                  >
                    {loadingStage === "itinerary" ? <Loader2 className="size-4 animate-spin" /> : <Route className="size-4" />}
                    {loadingStage === "itinerary" ? copy.generatingItinerary : copy.generateItinerary}
                  </button>
                </div>
              </div>
            )}
          </WorkflowSection>

          {!itinerary ? (
            <WorkflowSection
              id="itinerary"
              title={copy.itineraryTitle}
              body={copy.itineraryBody}
              icon={<Route className="size-4" />}
              status={sectionStatus("itinerary", workflowStep, activeSection, sectionComplete.itinerary)}
              statusLabel={statusLabel("itinerary")}
              activeSection={activeSection}
              onOpen={openWorkflowSection}
            >
              <EmptyState title={copy.noItinerary} />
            </WorkflowSection>
          ) : null}

          <WorkflowSection
            id="feasibility"
            title={copy.feasibilityTitle}
            body={labels.constraintSummary}
            icon={<ShieldCheck className="size-4" />}
            status={sectionStatus("feasibility", workflowStep, activeSection, sectionComplete.feasibility)}
            statusLabel={statusLabel("feasibility")}
            activeSection={activeSection}
            onOpen={openWorkflowSection}
          >
            {warnings.length === 0 ? (
              <EmptyState title={copy.noWarnings} />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {warnings.map((warning) => (
                  <div
                    id={`feasibility-warning-${warning.id}`}
                    key={warning.id}
                    className="scroll-mt-28 rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-black text-slate-950">{warning.message}</p>
                      <ImpactBadge impact={warning.impact} labels={labels.impactLabels} />
                    </div>
                    <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{warning.recommendation}</p>
                  </div>
                ))}
              </div>
            )}
          </WorkflowSection>
        </section>

        <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start">
          <Panel title={labels.statusTitle} eyebrow={labels.liveLegend} icon={<ShieldCheck className="size-4" />}>
            <div className="space-y-2">
              {[
                { label: copy.usedInPlan, value: acceptedCount, color: "bg-emerald-500" },
                { label: copy.reviewLater, value: inferredCount, color: "bg-orange-500" },
                { label: copy.excludedFromPlan, value: rejectedCount, color: "bg-rose-500" }
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`size-2.5 rounded-full ${item.color}`} />
                    <span className="text-xs font-black text-slate-600">{item.label}</span>
                  </div>
                  <span className="text-xs font-black text-slate-900">{item.value}</span>
                </div>
              ))}
            </div>
          </Panel>

          {showAgentVisibility ? (
            <Panel title={copy.agentBoardTitle} eyebrow={copy.agentBoardBody} icon={<Stamp className="size-4" />}>
              <div className="grid grid-cols-2 gap-2">
                {agentBoardEntries.map(({ agent, entry }) => {
                  const status = entry?.status ?? "Idle";
                  const duration = formatAgentDuration(entry?.durationMs);
                  const statusLabelText =
                    status === "Running"
                      ? copy.agentStatusRunning
                      : status === "Complete"
                        ? copy.agentStatusComplete
                        : status === "Error"
                          ? copy.agentStatusError
                          : copy.agentStatusIdle;
                  const tone =
                    status === "Running"
                      ? "border-amber-300 bg-amber-50 text-amber-800"
                      : status === "Complete"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : status === "Error"
                          ? "border-rose-300 bg-rose-50 text-rose-800"
                          : "border-slate-200 bg-slate-50 text-slate-400";

                  return (
                    <div
                      key={agent}
                      title={entry?.summary || agent}
                      className={`agent-stamp rounded-lg border-2 border-dashed p-2 ${tone}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <p className="truncate text-[11px] font-black uppercase tracking-wide">{copy.agentShortNames[agent]}</p>
                        {status === "Running" ? <Loader2 className="size-3 shrink-0 animate-spin" /> : null}
                      </div>
                      <p className="mt-1 text-[10px] font-bold opacity-80">
                        {statusLabelText}
                        {duration ? ` · ${duration}` : ""}
                      </p>
                    </div>
                  );
                })}
              </div>
            </Panel>
          ) : null}

          <Panel title={labels.processTitle} eyebrow={copy.traceTitle} icon={<BrainCircuit className="size-4" />}>
            <div className="space-y-4">
              {processItems.map((item, index) => {
                const active = index === activeProcessIndex;
                const traceEntry = trace.find((entry) =>
                  item.key === "conflicts"
                    ? entry.agent === "Conflict Detector Agent"
                    : item.key === "probes" || item.key === "learned" || item.key === "assumptions"
                      ? entry.agent === "Preference Probe Agent" || entry.agent === "Assumption Critic Agent"
                      : item.key === "itinerary"
                        ? entry.agent === "Input Consistency Agent" || entry.agent === "Planner Agent"
                        : item.key === "feasibility"
                          ? entry.agent === "Constraint Checker Agent"
                          : false
                );

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => openWorkflowSection(item.key)}
                    className="grid w-full grid-cols-[30px_minmax(0,1fr)_24px] gap-3 text-left"
                  >
                    <div className="relative flex justify-center">
                      <span
                        className={`flex size-7 items-center justify-center rounded-full text-xs font-black text-white ${
                          item.done ? "bg-emerald-500" : active ? "bg-orange-500" : "bg-slate-400"
                        }`}
                      >
                        {index + 1}
                      </span>
                      {index < processItems.length - 1 ? <span className="absolute top-8 h-8 border-l border-slate-200" /> : null}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950">{item.title}</p>
                      <p
                        className={`mt-1 text-xs font-bold ${
                          item.done ? "text-emerald-600" : active ? "text-orange-600" : "text-slate-400"
                        }`}
                      >
                        {item.done ? labels.stepStateLabels.Done : active ? labels.stepStateLabels["Needs User Input"] : labels.stepStateLabels.Pending}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">
                        {(showAgentVisibility ? traceEntry?.summary : null) || item.body}
                      </p>
                    </div>
                    <CheckCircle2 className={`mt-1 size-4 ${item.done ? "text-emerald-500" : "text-slate-300"}`} />
                  </button>
                );
              })}
            </div>
          </Panel>

          {showEvaluationPanel ? (
          <div id="evaluation-signals-panel" className="scroll-mt-28">
            <Panel title={copy.evaluationSignals} eyebrow={copy.checkpointMetrics} icon={<SearchCheck className="size-4" />}>
              <div className="space-y-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[11px] font-black uppercase text-slate-400">{copy.checkpointDecision}</p>
                <p className="mt-1 text-sm font-black text-slate-950">
                  {checkpointDecision
                    ? nonPlanningPrompt
                      ? copy.nonPlanningPrompt
                      : checkpointDecision.checkpointNeeded
                        ? copy.checkpointNeeded
                        : copy.noCheckpointNeeded
                    : copy.waiting}
                </p>
                {checkpointDecision ? (
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                    {copy.checkpointStage}: {checkpointStageLabel(checkpointDecision.checkpointStage, copy)}
                  </p>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[11px] font-black uppercase text-slate-400">{copy.preferenceExpressedRate}</p>
                  <p className="mt-1 text-sm font-black text-slate-950">
                    {detectedConflicts.length > 0 ? `${Math.round((probeAnswerList.length / detectedConflicts.length) * 100)}%` : checkpointBypassed ? "100%" : "0%"}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[11px] font-black uppercase text-slate-400">{copy.preferenceMetProxy}</p>
                  <p className="mt-1 text-sm font-black text-slate-950">
                    {learnedPreferences.length > 0 ? `${Math.round((activeLearnedPreferences.length / learnedPreferences.length) * 100)}%` : checkpointBypassed ? "100%" : "0%"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[11px] font-black uppercase text-slate-400">{copy.checkpointQuestionCount}</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{detectedConflicts.length}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[11px] font-black uppercase text-slate-400">{copy.activePreferenceCount}</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{activeLearnedPreferences.length}</p>
                </div>
              </div>
              {checkpointDecision ? (
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[11px] font-black uppercase text-slate-400">{copy.interactionBurden}</p>
                  <div className="mt-1">
                    <ImpactBadge impact={checkpointDecision.interactionCost} labels={labels.impactLabels} />
                  </div>
                </div>
              ) : null}
              <p className="text-xs font-semibold leading-5 text-slate-500">{copy.noGroundTruth}</p>
              </div>
            </Panel>
          </div>
          ) : null}

          <div id="memory-status-panel" className="scroll-mt-28">
            <Panel title={labels.memoryStatusTitle} eyebrow={memoryStatus?.message || labels.memoryEmpty} icon={<Database className="size-4" />}>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-black text-slate-500">
                  {memoryStatus?.used ? labels.basedOnMemory : labels.freshRequest}
                </p>
                <p className="mt-1 text-sm font-black text-slate-950">
                  {memory.preferences.length} {labels.memoryCountLabel}
                </p>
              </div>
            </Panel>
          </div>
        </aside>
      </div>
      )}

      <PromptComposer
        prompt={prompt}
        onPromptChange={handlePromptChange}
        onGenerate={handleComposerGenerate}
        analyzing={loadingStage !== null && loadingStage !== "itinerary"}
        planning={loadingStage === "itinerary"}
        canGenerate={
          loadingStage === null &&
          (promptChangedSincePlan ||
            (sectionComplete.assumptions && (activeLearnedPreferences.length > 0 || checkpointBypassed) && !nonPlanningPrompt))
        }
        chips={promptChips}
        labels={{
          promptPlaceholder: copy.promptPlaceholder,
          promptTooShort: copy.promptTooShort,
          generate: composerPrimaryLabel,
          examplesLabel: copy.promptExamplesLabel,
          examples: copy.promptExamples
        }}
      />
    </main>
  );
}
