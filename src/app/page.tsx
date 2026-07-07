"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronDown,
  Database,
  Loader2,
  MessageSquareText,
  RotateCcw,
  Route,
  SearchCheck,
  ShieldCheck,
  Sparkles,
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
import { PromptComposer } from "@/components/PromptComposer";
import { languageNames, type Language, uiText } from "@/i18n";
import type {
  AccommodationAssumption,
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
  PreferenceProbeAnswer,
  TransportAssumption,
  UserMemory
} from "@/types/travel";

type FlowSection = "prompt" | "conflicts" | "probes" | "learned" | "assumptions" | "itinerary" | "feasibility";
type WorkflowStep = FlowSection;
type LoadingStage = "conflicts" | "preferences" | "itinerary" | null;
type PreferenceControlState = "active" | "locked" | "ignored";
type PreferencePriority = "primary" | "normal" | "low";

type PreferenceControl = {
  state: PreferenceControlState;
  priority: PreferencePriority;
};

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
    learnedTitle: "Living Preference Profile",
    learnedBody: "Inspect, lock, lower priority, or ignore the preferences learned for this trip.",
    assumptionsTitle: "Assumptions Triggered by Checkpoints",
    assumptionsBody: "Transport, stay, and cost assumptions created from resolved checkpoints.",
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
    assumptionValue: "Planning assumption",
    assumptionReason: "Why this was inferred",
    useAssumption: "Keep",
    reviewLater: "Needs review",
    excludeAssumption: "Exclude",
    assumptionDecision: "Consequence control",
    assumptionsReadySummary: "ready for itinerary generation",
    traceTitle: "Agent trace",
    explicitSignals: "Explicit signals",
    uncertainty: "Still uncertain",
    whyAsked: "Why the system asked this",
    agentEvidence: "Agent evidence trail",
    whatChanges: "What changes in the plan",
    selectedAnswer: "Selected answer",
    notAnsweredYet: "Not answered yet",
    preferenceStatus: "Preference status",
    modelConfidence: "Model confidence",
    userControl: "User control",
    source: "Source",
    lockPreference: "Lock",
    unlockPreference: "Unlock",
    ignorePreference: "Ignore",
    restorePreference: "Restore",
    makePrimary: "Make primary",
    lowerPriority: "Lower priority",
    activePreference: "Active",
    lockedPreference: "Locked",
    ignoredPreference: "Ignored",
    primaryPriority: "Primary",
    normalPriority: "Normal",
    lowPriority: "Lower priority",
    preferenceProfileHint: "Locked and active preferences guide the planner. Ignored preferences are excluded.",
    consequencesHint: "These assumptions are downstream consequences of the preference profile, not the main research object.",
    preferenceDetail: "Preference detail",
    preferenceDetailHint: "Specify missing details here, such as cities, neighborhoods, dates, or constraints. Edits are sent to the planner without changing model confidence.",
    plannerImpactNote: "This preference is sent to the planner as trip guidance.",
    lowerPriorityPlannerNote: "Treat this preference as lower priority unless it conflicts with locked preferences.",
    promptSignalLabel: "Prompt",
    memorySignalLabel: "Memory",
    noPreferenceInsights: "No hidden preference insights yet."
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
    learnedTitle: "动态偏好画像",
    learnedBody: "查看、锁定、降级或忽略本次旅行学到的偏好。",
    assumptionsTitle: "由检查点触发的假设",
    assumptionsBody: "由已解决检查点推导出的交通、住宿和费用假设。",
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
    assumptionValue: "规划假设",
    assumptionReason: "推断依据",
    useAssumption: "保留",
    reviewLater: "需确认",
    excludeAssumption: "排除",
    assumptionDecision: "后果控制",
    assumptionsReadySummary: "可用于生成行程",
    traceTitle: "智能体轨迹",
    explicitSignals: "明确线索",
    uncertainty: "仍不确定",
    whyAsked: "为什么系统会问",
    agentEvidence: "智能体依据链",
    whatChanges: "会如何改变方案",
    selectedAnswer: "已选回答",
    notAnsweredYet: "尚未回答",
    preferenceStatus: "偏好状态",
    modelConfidence: "模型置信度",
    userControl: "用户控制",
    source: "来源",
    lockPreference: "锁定",
    unlockPreference: "解锁",
    ignorePreference: "忽略",
    restorePreference: "恢复",
    makePrimary: "设为重点",
    lowerPriority: "降低优先级",
    activePreference: "生效中",
    lockedPreference: "已锁定",
    ignoredPreference: "已忽略",
    primaryPriority: "重点",
    normalPriority: "普通",
    lowPriority: "低优先级",
    preferenceProfileHint: "已锁定和生效中的偏好会指导规划；已忽略的偏好不会传给规划器。",
    consequencesHint: "这些假设是偏好画像的下游结果，不是主要研究对象。",
    preferenceDetail: "偏好细节",
    preferenceDetailHint: "可在这里补充城市、街区、日期或限制条件。修改会传给规划器，但不会改变模型置信度。",
    plannerImpactNote: "这个偏好会作为旅行指导传给规划器。",
    lowerPriorityPlannerNote: "除非与已锁定偏好冲突，否则将此偏好视为低优先级。",
    promptSignalLabel: "提示",
    memorySignalLabel: "记忆",
    noPreferenceInsights: "尚无隐藏偏好洞察。"
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
    warnings: [],
    selectedOptionId: null,
    trace: [],
    memoryStatus: null,
    workflowStep: "prompt",
    activeSection: "prompt",
    language
  };
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

function normalizePreferenceControls(
  preferences: LearnedPreference[],
  current: Record<string, PreferenceControl>
): Record<string, PreferenceControl> {
  return Object.fromEntries(
    preferences.map((preference) => {
      const control = current[preference.id] || defaultPreferenceControl();
      return [preference.id, control];
    })
  );
}

function preferenceControlTone(control: PreferenceControl) {
  if (control.state === "ignored") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (control.state === "locked") {
    return "border-indigo-200 bg-indigo-50 text-indigo-700";
  }

  if (control.priority === "primary") {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }

  if (control.priority === "low") {
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
      className="scroll-mt-4 rounded-[8px] border border-slate-200/80 bg-white/88 shadow-[0_18px_48px_rgba(26,35,67,0.08)] backdrop-blur"
    >
      <button
        type="button"
        onClick={() => onOpen(id)}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[8px] border border-slate-200 bg-slate-50 text-slate-700">
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
  const [warnings, setWarnings] = useState<ConstraintWarning[]>([]);
  const [trace, setTrace] = useState<AgentTrace[]>([]);
  const [memory, setMemory] = useState<UserMemory>(emptyMemory());
  const [memoryStatus, setMemoryStatus] = useState<MemoryStatus | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<FlowSection>("prompt");
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>("prompt");
  const [loadingStage, setLoadingStage] = useState<LoadingStage>(null);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [restored, setRestored] = useState(false);

  const labels = uiText[language];
  const copy = flowText[language];
  const [checkpointDecision, setCheckpointDecision] = useState<CheckpointDecision | null>(null);

  useEffect(() => {
    const storedLanguage = window.localStorage.getItem("assumption-aware-agent-planner:language");
    const initialLanguage = storedLanguage === "en" || storedLanguage === "zh" ? storedLanguage : "en";
    const rawSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
    setMemory(loadUserMemory());

    if (rawSession) {
      try {
        const session = JSON.parse(rawSession) as PersistedSession;
        setLanguage(session.language || initialLanguage);
        setPrompt(session.prompt || "");
        setCheckpointDecision(session.checkpointDecision || null);
        setDetectedConflicts(session.detectedConflicts || []);
        setProbeAnswers(session.probeAnswers || {});
        setLearnedPreferences(session.learnedPreferences || []);
        setPreferenceControls(session.preferenceControls || {});
        setAssumptions(session.assumptions || []);
        setTransportAssumptions(session.transportAssumptions || []);
        setAccommodationAssumptions(session.accommodationAssumptions || []);
        setCostAssumptions(session.costAssumptions || []);
        setCritiques(session.critiques || []);
        setItinerary(session.itinerary || null);
        setWarnings(session.warnings || []);
        setSelectedOptionId(session.selectedOptionId || null);
        setTrace(session.trace || []);
        setMemoryStatus(session.memoryStatus || null);
        setWorkflowStep(session.workflowStep || "prompt");
        setActiveSection(session.activeSection || "prompt");
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
    assumptions,
    checkpointDecision,
    costAssumptions,
    critiques,
    detectedConflicts,
    hydrated,
    itinerary,
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
  const checkpointBypassed = Boolean(checkpointDecision?.isPlanningTask && checkpointDecision.checkpointNeeded === false);
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
          const normalizedPreference = {
            ...preference,
            value: preference.value.trim()
          };

          if (control.priority !== "low") {
            return normalizedPreference;
          }

          return {
            ...normalizedPreference,
            planningImpact: `${copy.lowerPriorityPlannerNote} ${normalizedPreference.planningImpact}`
          };
        }),
    [copy.lowerPriorityPlannerNote, learnedPreferences, preferenceControls]
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
      const assumptionConfirmed: ConfirmedPreference[] = assumptions
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
    [activeLearnedPreferences, assumptions]
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

  function applySession(session: PersistedSession) {
    setPrompt(session.prompt);
    setCheckpointDecision(session.checkpointDecision || null);
    setDetectedConflicts(session.detectedConflicts);
    setProbeAnswers(session.probeAnswers);
    setLearnedPreferences(session.learnedPreferences);
    setPreferenceControls(session.preferenceControls || {});
    setAssumptions(session.assumptions);
    setTransportAssumptions(session.transportAssumptions);
    setAccommodationAssumptions(session.accommodationAssumptions);
    setCostAssumptions(session.costAssumptions);
    setCritiques(session.critiques);
    setItinerary(session.itinerary);
    setWarnings(session.warnings);
    setSelectedOptionId(session.selectedOptionId);
    setTrace(session.trace);
    setMemoryStatus(session.memoryStatus);
    setWorkflowStep(session.workflowStep);
    setActiveSection(session.activeSection);
  }

  function handleLanguageChange(nextLanguage: Language) {
    setLanguage(nextLanguage);
    window.localStorage.setItem("assumption-aware-agent-planner:language", nextLanguage);
  }

  function handleStartNewSession() {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    clearUserMemory();
    setMemory(emptyMemory());
    setError(null);
    applySession(emptySession(language));
  }

  function openWorkflowSection(section: FlowSection) {
    setActiveSection(section);
    window.setTimeout(() => {
      document.getElementById(`workflow-${section}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function clearCurrentPlanningArtifacts() {
    setDetectedConflicts([]);
    setCheckpointDecision(null);
    setProbeAnswers({});
    setLearnedPreferences([]);
    setPreferenceControls({});
    setAssumptions([]);
    setTransportAssumptions([]);
    setAccommodationAssumptions([]);
    setCostAssumptions([]);
    setCritiques([]);
    setItinerary(null);
    setWarnings([]);
    setSelectedOptionId(null);
    setMemoryStatus(null);
    setTrace([]);
    setError(null);
  }

  function handlePromptChange(nextPrompt: string) {
    setPrompt(nextPrompt);

    const hasPlanningArtifacts =
      detectedConflicts.length > 0 ||
      Object.keys(probeAnswers).length > 0 ||
      learnedPreferences.length > 0 ||
      Object.keys(preferenceControls).length > 0 ||
      checkpointDecision !== null ||
      assumptions.length > 0 ||
      transportAssumptions.length > 0 ||
      accommodationAssumptions.length > 0 ||
      costAssumptions.length > 0 ||
      critiques.length > 0 ||
      itinerary !== null ||
      warnings.length > 0 ||
      trace.length > 0 ||
      workflowStep !== "prompt";

    if (nextPrompt !== prompt && hasPlanningArtifacts) {
      clearCurrentPlanningArtifacts();
      setWorkflowStep("prompt");
      setActiveSection("prompt");
    }
  }

  async function handleDetectConflicts() {
    if (prompt.trim().length < 4 || loadingStage !== null) {
      return;
    }

    setLoadingStage("conflicts");
    setError(null);
    setTrace([runningTrace("Conflict Detector Agent", copy.detectingConflicts)]);

    try {
      const result = await analyzePreferences({
        prompt,
        memory,
        learnedPreferences,
        language
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

  function handleProbeChoice(conflict: DetectedConflict, optionId: string) {
    const option = conflict.probe.options.find((item) => item.id === optionId);

    if (!option) {
      return;
    }

    const hasDownstreamProfile =
      learnedPreferences.length > 0 ||
      assumptions.length > 0 ||
      transportAssumptions.length > 0 ||
      accommodationAssumptions.length > 0 ||
      costAssumptions.length > 0 ||
      itinerary !== null;

    setProbeAnswers((current) => ({
      ...current,
      [conflict.id]: {
        conflictId: conflict.id,
        optionId: option.id,
        answer: option.label,
        planningImpact: option.planningImpact
      }
    }));

    if (hasDownstreamProfile) {
      setLearnedPreferences([]);
      setPreferenceControls({});
      setAssumptions([]);
      setTransportAssumptions([]);
      setAccommodationAssumptions([]);
      setCostAssumptions([]);
      setCritiques([]);
      setItinerary(null);
      setWarnings([]);
      setSelectedOptionId(null);
      setWorkflowStep("probes");
    }
  }

  async function handleLearnPreferences() {
    if (!allProbesAnswered || loadingStage !== null) {
      return;
    }

    setLoadingStage("preferences");
    setError(null);
    setTrace((current) => [...current, runningTrace("Preference Probe Agent", copy.learningPreferences)]);

    try {
      const result = await learnPreferences({
        prompt,
        detectedConflicts,
        probeAnswers: probeAnswerList,
        memory,
        language
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

  async function handleGenerate() {
    const canGenerateWithoutCheckpoint = Boolean(checkpointDecision?.isPlanningTask && checkpointDecision.checkpointNeeded === false);

    if ((!canGenerateWithoutCheckpoint && (assumptions.length === 0 || activeLearnedPreferences.length === 0)) || loadingStage !== null) {
      return;
    }

    setLoadingStage("itinerary");
    setError(null);
    setTrace((current) => [
      ...current,
      runningTrace("Input Consistency Agent", labels.consistencyRunning),
      runningTrace("Planner Agent", copy.generatingItinerary),
      runningTrace("Constraint Checker Agent", labels.checkerRunning)
    ]);

    try {
      const result = await generateItinerary({
        prompt,
        detectedConflicts,
        probeAnswers: probeAnswerList,
        learnedPreferences: activeLearnedPreferences,
        assumptions: assumptions.filter((assumption) => assumption.status !== "Rejected"),
        transportAssumptions: usefulTransportAssumptions,
        accommodationAssumptions: usefulAccommodationAssumptions,
        costAssumptions: usefulCostAssumptions,
        confirmedPreferences,
        memory,
        language
      });

      setItinerary(result.itinerary);
      setWarnings(result.warnings);
      setMemoryStatus(result.memoryStatus);
      setSelectedOptionId(result.itinerary.selectedOptionId);
      const updatedMemory = mergePreferencesIntoMemory(memory, confirmedPreferences);
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

    openWorkflowSection("assumptions");
  }

  function handleAssumptionStatusChange(id: string, status: Assumption["status"]) {
    setAssumptions((current) => current.map((assumption) => (assumption.id === id ? { ...assumption, status } : assumption)));
  }

  function handleAssumptionValueChange(id: string, value: string) {
    setAssumptions((current) =>
      current.map((assumption) =>
        assumption.id === id
          ? {
              ...assumption,
              value,
              source: "User",
              status: "Edited"
            }
          : assumption
      )
    );
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
    setItinerary(null);
    setWarnings([]);
    setSelectedOptionId(null);

    if (workflowStep === "itinerary" || workflowStep === "feasibility") {
      setWorkflowStep("learned");
      setActiveSection("learned");
    }
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
  const acceptedCount = assumptions.filter((assumption) => assumption.status === "Accepted" || assumption.status === "Edited").length;
  const rejectedCount = assumptions.filter((assumption) => assumption.status === "Rejected").length;
  const inferredCount = assumptions.filter((assumption) => assumption.status === "Pending").length;
  const currentProbe = detectedConflicts.find((conflict) => !probeAnswers[conflict.id]);
  const visiblePreferenceRows = learnedPreferences.length > 0 ? learnedPreferences : [];
  const composerPrimaryLabel = loadingStage === "itinerary"
    ? copy.generatingItinerary
    : sectionComplete.assumptions
      ? copy.generateItinerary
      : !sectionComplete.conflicts
        ? copy.detectConflicts
        : !sectionComplete.probes
          ? copy.probesTitle
          : !sectionComplete.learned
            ? copy.learnPreferences
            : copy.reviewAssumptions;
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
      key: "assumptions",
      title: copy.assumptionsTitle,
      body: assumptions.length ? `${acceptedCount} ${labels.confirmed} - ${inferredCount} ${labels.inferred}` : copy.waiting,
      done: sectionComplete.assumptions
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
  const promptStats = {
    assumptions:
      assumptions.length + usefulTransportAssumptions.length + usefulAccommodationAssumptions.length + usefulCostAssumptions.length,
    missing: Math.max(0, detectedConflicts.length - probeAnswerList.length) + rejectedCount,
    highImpact: critiques.filter((critique) => critique.impact === "High").length,
    memory: memory.preferences.length
  };

  return (
    <main className="min-h-screen p-3 pb-32 text-slate-950 sm:p-4 sm:pb-32 lg:p-5 lg:pb-32">
      <header className="mx-auto flex max-w-[1600px] flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-[8px] bg-gradient-to-br from-violet-600 to-indigo-500 text-white shadow-[0_14px_34px_rgba(92,70,229,0.3)]">
            <Sparkles className="size-7" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-slate-950">{labels.appTitle}</h1>
            <p className="text-sm font-semibold text-slate-500">{copy.eyebrow}</p>
          </div>
        </div>

        <div className="mx-auto flex max-w-full rounded-full border border-slate-200 bg-white/92 p-1 shadow-[0_16px_44px_rgba(26,35,67,0.1)] backdrop-blur">
          <button
            type="button"
            onClick={() => openWorkflowSection("assumptions")}
            className={`flex h-10 min-w-[150px] items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-black transition ${
              activeSection === "assumptions" || activeSection === "probes"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <ShieldCheck className="size-4" />
            {copy.reviewAssumptions}
          </button>
          <button
            type="button"
            onClick={() => openWorkflowSection("itinerary")}
            className={`flex h-10 min-w-[130px] items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-black transition ${
              activeSection === "itinerary" ? "bg-violet-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Route className="size-4" />
            {labels.mapTitle}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {[
            { label: labels.shortAgentLabels["Planner Agent"], icon: BrainCircuit, tone: "text-blue-700 bg-blue-50 border-blue-100" },
            { label: labels.accommodation, icon: Database, tone: "text-orange-700 bg-orange-50 border-orange-100" },
            { label: labels.categoryLabels.food, icon: Sparkles, tone: "text-emerald-700 bg-emerald-50 border-emerald-100" },
            { label: labels.mapTitle, icon: Route, tone: "text-violet-700 bg-violet-50 border-violet-100" }
          ].map((agent) => {
            const Icon = agent.icon;

            return (
              <div key={agent.label} className="flex flex-col items-center gap-1">
                <div className={`flex size-10 items-center justify-center rounded-full border ${agent.tone}`}>
                  <Icon className="size-5" />
                </div>
                <span className="max-w-16 truncate text-[10px] font-black text-slate-600">{agent.label}</span>
              </div>
            );
          })}
          {restored ? (
            <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 2xl:inline-flex">
              {copy.restored}
            </span>
          ) : (
            <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-500 2xl:inline-flex">
              {copy.saved}
            </span>
          )}
          <label className="flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600">
            <span>{labels.language}</span>
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
          <button
            type="button"
            onClick={handleStartNewSession}
            className="flex h-10 items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-700"
            title={copy.resetNotice}
          >
            <RotateCcw className="size-4" />
            {copy.startNewSession}
          </button>
        </div>
      </header>

      <div className="mx-auto mt-4 grid max-w-[1600px] gap-4 xl:grid-cols-[330px_minmax(0,1fr)_340px]">
        <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start">
          <Panel title={copy.preferenceHistory} eyebrow={copy.originalPrompt} icon={<Sparkles className="size-4" />}>
            <p className="rounded-[8px] bg-slate-50 p-3 text-xs font-semibold leading-5 text-slate-600">
              {prompt || copy.promptPlaceholder}
            </p>
            <div className="mt-3 space-y-2">
              {visiblePreferenceRows.length === 0 ? (
                <EmptyState title={copy.noLearned} body={labels.waitingPrompt} />
              ) : null}
              {visiblePreferenceRows.slice(0, 5).map((preference) => (
                <div key={preference.id} className="rounded-[8px] border border-slate-100 bg-white p-3 shadow-sm">
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
                        : (preferenceControls[preference.id] || defaultPreferenceControl()).state === "locked"
                          ? copy.lockedPreference
                          : copy.activePreference}
                    </span>
                  </div>
                </div>
              ))}
              {visiblePreferenceRows.length > 0 ? (
                <button
                  type="button"
                  onClick={() => openWorkflowSection("learned")}
                  className="w-full rounded-[8px] border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700"
                >
                  {copy.userControl}
                </button>
              ) : null}
            </div>
          </Panel>

          <Panel title={copy.currentCheckpoint} eyebrow={copy.current} icon={<AlertTriangle className="size-4" />}>
            {currentProbe ? (
              <div className="rounded-[8px] border border-orange-100 bg-orange-50/70 p-3">
                <p className="text-sm font-black text-orange-950">{currentProbe.title}</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-orange-900/75">{currentProbe.hiddenPreference}</p>
                <button
                  type="button"
                  onClick={() => openWorkflowSection("probes")}
                  className="mt-3 rounded-[8px] bg-violet-600 px-3 py-2 text-xs font-black text-white"
                >
                  {copy.probesTitle}
                </button>
              </div>
            ) : checkpointBypassed ? (
              <div className="rounded-[8px] border border-emerald-100 bg-emerald-50/70 p-3">
                <p className="text-sm font-black text-emerald-950">{copy.noCheckpointNeeded}</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-emerald-900/75">{checkpointDecision?.rationale}</p>
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="mt-3 rounded-[8px] bg-emerald-600 px-3 py-2 text-xs font-black text-white"
                >
                  {copy.proceedWithoutCheckpoint}
                </button>
              </div>
            ) : nonPlanningPrompt ? (
              <div className="rounded-[8px] border border-rose-100 bg-rose-50/70 p-3">
                <p className="text-sm font-black text-rose-950">{copy.nonPlanningPrompt}</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-rose-900/75">{checkpointDecision?.rationale}</p>
              </div>
            ) : assumptions.length > 0 ? (
              <div className="rounded-[8px] border border-indigo-100 bg-indigo-50/70 p-3">
                <p className="text-sm font-black text-indigo-950">{copy.assumptionsTitle}</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-indigo-900/75">
                  {acceptedCount} {labels.confirmed} / {inferredCount} {copy.reviewLater} / {rejectedCount} {copy.excludeAssumption}
                </p>
                <button
                  type="button"
                  onClick={() => openWorkflowSection("assumptions")}
                  className="mt-3 rounded-[8px] bg-violet-600 px-3 py-2 text-xs font-black text-white"
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
          <ItineraryCanvas
            itinerary={itinerary}
            warnings={warnings}
            assumptions={assumptions}
            selectedOptionId={selectedOptionId}
            onSelectOption={setSelectedOptionId}
            planning={loadingStage === "itinerary"}
            labels={labels}
          />

          {error ? (
            <div className="flex items-start gap-3 rounded-[8px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
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
                <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase text-slate-400">{copy.knownFromPrompt}</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{prompt || copy.knownFallback}</p>
                </div>
                <div className="rounded-[8px] border border-indigo-100 bg-indigo-50/60 p-4">
                  <p className="text-xs font-black uppercase text-indigo-500">{copy.stillUncertain}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      copy.uncertainTripShape,
                      copy.uncertainBudgetComfort,
                      copy.uncertainPaceInterests,
                      copy.uncertainLogistics
                    ].map((item) => (
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
                  className="flex h-10 items-center gap-2 rounded-[8px] bg-indigo-600 px-4 text-sm font-bold text-white shadow-[0_12px_28px_rgba(99,68,255,0.28)] disabled:cursor-not-allowed disabled:bg-indigo-200"
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
                  className={`rounded-[8px] border p-4 ${
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
                  <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">{checkpointDecision.rationale}</p>
                  <div className="mt-4 grid gap-2 md:grid-cols-3">
                    <div className="rounded-[8px] border border-white/80 bg-white/80 p-3">
                      <p className="text-[11px] font-black uppercase text-slate-400">{copy.assumptionRisk}</p>
                      <ImpactBadge impact={checkpointDecision.assumptionRisk} labels={labels.impactLabels} />
                    </div>
                    <div className="rounded-[8px] border border-white/80 bg-white/80 p-3">
                      <p className="text-[11px] font-black uppercase text-slate-400">{copy.interactionCost}</p>
                      <ImpactBadge impact={checkpointDecision.interactionCost} labels={labels.impactLabels} />
                    </div>
                    <div className="rounded-[8px] border border-white/80 bg-white/80 p-3">
                      <p className="text-[11px] font-black uppercase text-slate-400">{copy.missingCategories}</p>
                      <p className="mt-1 text-xs font-bold text-slate-700">
                        {checkpointDecision.missingPreferenceCategories.length
                          ? checkpointDecision.missingPreferenceCategories.map((category) => labels.categoryLabels[category]).join(", ")
                          : copy.noneStage}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 rounded-[8px] border border-white/80 bg-white/80 p-3">
                    <p className="text-[11px] font-black uppercase text-slate-400">{copy.expectedPlanImpact}</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{checkpointDecision.expectedPlanImpact}</p>
                  </div>
                  {checkpointBypassed ? (
                    <button
                      type="button"
                      onClick={handleGenerate}
                      disabled={loadingStage !== null}
                      className="mt-4 flex h-10 items-center gap-2 rounded-[8px] bg-emerald-600 px-4 text-sm font-bold text-white shadow-[0_12px_28px_rgba(16,185,129,0.24)] disabled:cursor-not-allowed disabled:bg-emerald-200"
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
                    <article key={insight.id} className="rounded-[8px] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-sm font-black text-slate-950">{insight.title}</h3>
                        <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700">
                          {Math.round(insight.confidence * 100)}% {copy.modelConfidence}
                        </span>
                      </div>
                      <p className="mt-3 text-xs font-black uppercase text-slate-400">{copy.explicitSignals}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {insight.explicitSignals.map((signal) => (
                          <span key={signal} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-600">
                            {signal}
                          </span>
                        ))}
                      </div>
                      <p className="mt-3 text-xs font-black uppercase text-slate-400">{copy.hiddenPreference}</p>
                      <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">{insight.hiddenPreference}</p>
                      <details className="mt-3 rounded-[8px] border border-slate-100 bg-slate-50 p-3">
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
                    <div key={conflict.id} className="rounded-[8px] border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-black uppercase text-indigo-600">{conflict.title}</p>
                          <h3 className="mt-1 text-lg font-black text-slate-950">{conflict.probe.question}</h3>
                        </div>
                        <span
                          className={`rounded-full border px-2 py-1 text-[11px] font-bold ${
                            answer ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"
                          }`}
                        >
                          {answer ? copy.answered : copy.unanswered}
                        </span>
                      </div>
                      {insight ? (
                        <div className="mt-3 rounded-[8px] border border-indigo-100 bg-indigo-50/60 p-3 text-xs font-semibold leading-5 text-indigo-900">
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
                              className={`rounded-[8px] border p-3 text-left shadow-sm transition ${
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
                      <div className="mt-3 rounded-[8px] border border-slate-100 bg-slate-50 p-3">
                        <p className="text-[11px] font-black uppercase text-slate-400">{copy.selectedAnswer}</p>
                        <p className="mt-1 text-sm font-black text-slate-900">{answer?.answer || copy.notAnsweredYet}</p>
                        {answer ? <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">{answer.planningImpact}</p> : null}
                      </div>
                    </div>
                  );
                })}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleLearnPreferences}
                    disabled={!allProbesAnswered || loadingStage !== null}
                    className="flex h-10 items-center gap-2 rounded-[8px] bg-violet-600 px-4 text-sm font-bold text-white shadow-[0_12px_28px_rgba(99,68,255,0.28)] disabled:cursor-not-allowed disabled:bg-violet-200"
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
            status={sectionStatus("learned", workflowStep, activeSection, sectionComplete.learned)}
            statusLabel={statusLabel("learned")}
            activeSection={activeSection}
            onOpen={openWorkflowSection}
          >
            {learnedPreferences.length === 0 ? (
              <EmptyState title={copy.noLearned} />
            ) : (
              <div className="space-y-3">
                <div className="rounded-[8px] border border-indigo-100 bg-indigo-50/70 p-3">
                  <p className="text-sm font-black text-indigo-950">{copy.preferenceProfileHint}</p>
                </div>
                <div className="grid gap-3">
                  {learnedPreferences.map((preference) => {
                    const control = preferenceControls[preference.id] || defaultPreferenceControl();
                    const relatedInsight = hiddenPreferenceInsights.find((insight) => insight.learnedPreference?.id === preference.id);
                    const priorityDisabled = control.state === "ignored";

                    return (
                      <article
                        key={preference.id}
                        className={`rounded-[8px] border bg-white p-4 shadow-sm ${
                          control.state === "ignored" ? "border-rose-200 bg-rose-50/45" : "border-slate-200"
                        }`}
                      >
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-black text-slate-600">
                                {labels.categoryLabels[preference.category]}
                              </span>
                              <SourceBadge source={preference.source} labels={labels.sourceLabels} />
                              <span className={`rounded-full border px-2 py-1 text-[11px] font-black ${preferenceControlTone(control)}`}>
                                {control.state === "ignored"
                                  ? copy.ignoredPreference
                                  : control.state === "locked"
                                    ? copy.lockedPreference
                                    : copy.activePreference}
                              </span>
                              <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-1 text-[11px] font-black text-indigo-700">
                                {control.priority === "primary"
                                  ? copy.primaryPriority
                                  : control.priority === "low"
                                    ? copy.lowPriority
                                    : copy.normalPriority}
                              </span>
                            </div>
                            <h3 className="mt-3 text-base font-black text-slate-950">{preference.value}</h3>
                            <label className="mt-3 block">
                              <span className="text-[11px] font-black uppercase text-slate-400">{copy.preferenceDetail}</span>
                              <textarea
                                value={preference.value}
                                onChange={(event) => handleLearnedPreferenceValueChange(preference.id, event.target.value)}
                                rows={2}
                                className="mt-1 min-h-16 w-full resize-y rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm font-semibold leading-6 text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                              />
                              <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{copy.preferenceDetailHint}</span>
                            </label>
                            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{preference.planningImpact}</p>
                            <div className="mt-3 grid gap-2 md:grid-cols-2">
                              <div className="rounded-[8px] border border-slate-100 bg-slate-50 p-3">
                                <p className="text-[11px] font-black uppercase text-slate-400">{copy.modelConfidence}</p>
                                <p className="mt-1 text-sm font-black text-slate-950">{Math.round(preference.confidence * 100)}%</p>
                              </div>
                              <div className="rounded-[8px] border border-slate-100 bg-slate-50 p-3">
                                <p className="text-[11px] font-black uppercase text-slate-400">{copy.whatChanges}</p>
                                <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{copy.plannerImpactNote}</p>
                              </div>
                            </div>
                            {relatedInsight ? (
                              <details className="mt-3 rounded-[8px] border border-slate-100 bg-slate-50 p-3">
                                <summary className="cursor-pointer text-xs font-black text-indigo-700">{copy.agentEvidence}</summary>
                                <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">{relatedInsight.whyItMatters}</p>
                                <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">
                                  {copy.selectedAnswer}: {relatedInsight.selectedAnswer?.answer || copy.notAnsweredYet}
                                </p>
                              </details>
                            ) : null}
                          </div>

                          <div className="rounded-[8px] border border-slate-200 bg-white p-3">
                            <p className="text-[11px] font-black uppercase text-slate-400">{copy.userControl}</p>
                            <div className="mt-3 grid gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  updatePreferenceControl(preference.id, {
                                    state: control.state === "locked" ? "active" : "locked"
                                  })
                                }
                                className={`rounded-[8px] border px-3 py-2 text-sm font-black transition ${
                                  control.state === "locked"
                                    ? "border-indigo-500 bg-indigo-600 text-white"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50"
                                }`}
                              >
                                {control.state === "locked" ? copy.unlockPreference : copy.lockPreference}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  updatePreferenceControl(preference.id, {
                                    state: control.state === "ignored" ? "active" : "ignored"
                                  })
                                }
                                className={`rounded-[8px] border px-3 py-2 text-sm font-black transition ${
                                  control.state === "ignored"
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                                }`}
                              >
                                {control.state === "ignored" ? copy.restorePreference : copy.ignorePreference}
                              </button>
                              <div className="grid grid-cols-3 gap-2">
                                <button
                                  type="button"
                                  disabled={priorityDisabled}
                                  onClick={() => updatePreferenceControl(preference.id, { priority: "primary" })}
                                  className={`rounded-[8px] border px-2 py-2 text-xs font-black transition ${
                                    priorityDisabled
                                      ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                                      : control.priority === "primary"
                                      ? "border-violet-500 bg-violet-600 text-white"
                                      : "border-slate-200 bg-white text-slate-600 hover:bg-violet-50"
                                  }`}
                                >
                                  {copy.makePrimary}
                                </button>
                                <button
                                  type="button"
                                  disabled={priorityDisabled}
                                  onClick={() => updatePreferenceControl(preference.id, { priority: "normal" })}
                                  className={`rounded-[8px] border px-2 py-2 text-xs font-black transition ${
                                    priorityDisabled
                                      ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                                      : control.priority === "normal"
                                      ? "border-emerald-500 bg-emerald-600 text-white"
                                      : "border-slate-200 bg-white text-slate-600 hover:bg-emerald-50"
                                  }`}
                                >
                                  {copy.normalPriority}
                                </button>
                                <button
                                  type="button"
                                  disabled={priorityDisabled}
                                  onClick={() => updatePreferenceControl(preference.id, { priority: "low" })}
                                  className={`rounded-[8px] border px-2 py-2 text-xs font-black transition ${
                                    priorityDisabled
                                      ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                                      : control.priority === "low"
                                      ? "border-slate-400 bg-slate-700 text-white"
                                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  {copy.lowerPriority}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setWorkflowStep("assumptions");
                    openWorkflowSection("assumptions");
                  }}
                  className="rounded-[8px] border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700"
                >
                  {copy.reviewAssumptions}
                </button>
              </div>
            )}
          </WorkflowSection>

          <WorkflowSection
            id="assumptions"
            title={copy.assumptionsTitle}
            body={copy.assumptionsBody}
            icon={<ShieldCheck className="size-4" />}
            status={sectionStatus("assumptions", workflowStep, activeSection, sectionComplete.assumptions)}
            statusLabel={statusLabel("assumptions")}
            activeSection={activeSection}
            onOpen={openWorkflowSection}
          >
            {assumptions.length === 0 ? (
              <EmptyState title={copy.noAssumptions} />
            ) : (
              <div className="space-y-4">
                <div className="grid gap-2 md:grid-cols-3">
                  <div className="rounded-[8px] border border-emerald-100 bg-emerald-50 p-3">
                    <p className="text-[11px] font-black uppercase text-emerald-700">{labels.confirmed}</p>
                    <p className="mt-1 text-2xl font-black text-emerald-950">{acceptedCount}</p>
                  </div>
                  <div className="rounded-[8px] border border-amber-100 bg-amber-50 p-3">
                    <p className="text-[11px] font-black uppercase text-amber-700">{copy.reviewLater}</p>
                    <p className="mt-1 text-2xl font-black text-amber-950">{inferredCount}</p>
                  </div>
                  <div className="rounded-[8px] border border-rose-100 bg-rose-50 p-3">
                    <p className="text-[11px] font-black uppercase text-rose-700">{copy.excludeAssumption}</p>
                    <p className="mt-1 text-2xl font-black text-rose-950">{rejectedCount}</p>
                  </div>
                </div>

                <div className="rounded-[8px] border border-indigo-100 bg-indigo-50/70 p-3">
                  <p className="text-sm font-black text-indigo-950">
                    {acceptedCount + inferredCount} {copy.assumptionsReadySummary}
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-indigo-900/70">{copy.consequencesHint}</p>
                  <p className="mt-2 text-xs font-semibold leading-5 text-indigo-900/70">{copy.assumptionHint}</p>
                </div>

                <div className="grid gap-3">
                  {assumptions.map((assumption) => {
                    const isAccepted = assumption.status === "Accepted" || assumption.status === "Edited";
                    const isRejected = assumption.status === "Rejected";
                    const isPending = assumption.status === "Pending";

                    return (
                      <article
                        key={assumption.id}
                        className={`rounded-[8px] border bg-white p-4 shadow-sm transition ${
                          isRejected
                            ? "border-rose-200 bg-rose-50/45"
                            : isAccepted
                              ? "border-emerald-200 bg-emerald-50/35"
                              : "border-slate-200"
                        }`}
                      >
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-black text-slate-950">{labels.categoryLabels[assumption.category]}</p>
                              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-bold text-slate-500">
                                {Math.round(assumption.confidence * 100)}% {copy.confidence}
                              </span>
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                                  isRejected
                                    ? "border-rose-200 bg-white text-rose-700"
                                    : isAccepted
                                      ? "border-emerald-200 bg-white text-emerald-700"
                                      : "border-amber-200 bg-white text-amber-700"
                                }`}
                              >
                                {labels.assumptionStatusLabels[assumption.status]}
                              </span>
                            </div>

                            <label className="mt-4 block">
                              <span className="text-[11px] font-black uppercase text-slate-400">{copy.assumptionValue}</span>
                              <textarea
                                value={assumption.value}
                                onChange={(event) => handleAssumptionValueChange(assumption.id, event.target.value)}
                                rows={2}
                                className="mt-1 min-h-20 w-full resize-y rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm font-semibold leading-6 text-slate-900 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                              />
                            </label>

                            <div className="mt-3 rounded-[8px] border border-slate-100 bg-white/75 p-3">
                              <p className="text-[11px] font-black uppercase text-slate-400">{copy.assumptionReason}</p>
                              <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{assumption.rationale}</p>
                            </div>
                          </div>

                          <div className="rounded-[8px] border border-slate-200 bg-white p-3">
                            <p className="text-[11px] font-black uppercase text-slate-400">{copy.assumptionDecision}</p>
                            <div className="mt-3 grid gap-2" role="group" aria-label={copy.reviewAssumptions}>
                              <button
                                type="button"
                                aria-pressed={isAccepted}
                                onClick={() => handleAssumptionStatusChange(assumption.id, "Accepted")}
                                className={`flex h-10 items-center justify-between rounded-[8px] border px-3 text-sm font-black transition ${
                                  isAccepted
                                    ? "border-emerald-500 bg-emerald-600 text-white shadow-sm"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                                }`}
                              >
                                <span>{copy.useAssumption}</span>
                                {isAccepted ? <Check className="size-4" /> : null}
                              </button>
                              <button
                                type="button"
                                aria-pressed={isPending}
                                onClick={() => handleAssumptionStatusChange(assumption.id, "Pending")}
                                className={`flex h-10 items-center justify-between rounded-[8px] border px-3 text-sm font-black transition ${
                                  isPending
                                    ? "border-amber-400 bg-amber-100 text-amber-800"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                                }`}
                              >
                                <span>{copy.reviewLater}</span>
                                {isPending ? <AlertTriangle className="size-4" /> : null}
                              </button>
                              <button
                                type="button"
                                aria-pressed={isRejected}
                                onClick={() => handleAssumptionStatusChange(assumption.id, "Rejected")}
                                className={`flex h-10 items-center justify-between rounded-[8px] border px-3 text-sm font-black transition ${
                                  isRejected
                                    ? "border-rose-500 bg-rose-600 text-white shadow-sm"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                                }`}
                              >
                                <span>{copy.excludeAssumption}</span>
                                {isRejected ? <X className="size-4" /> : null}
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {usefulTransportAssumptions.length > 0 ? (
                    <Panel title={labels.transportAssumptions} icon={<Route className="size-4" />}>
                      <div className="space-y-2">
                        {usefulTransportAssumptions.map((item) => (
                          <div key={item.id} className="rounded-[8px] bg-slate-50 p-2 text-xs font-semibold text-slate-600">
                            <p className="font-black text-slate-900">
                              {item.from} - {item.to}
                            </p>
                            <p className="mt-1">
                              {item.mode} - {item.estimatedTravelTimeMinutes} {labels.minutes}
                            </p>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  ) : null}
                  {usefulAccommodationAssumptions.length > 0 ? (
                    <Panel title={labels.accommodationAssumptions} icon={<Database className="size-4" />}>
                      <div className="space-y-2">
                        {usefulAccommodationAssumptions.map((item) => (
                          <div key={item.id} className="rounded-[8px] bg-slate-50 p-2 text-xs font-semibold text-slate-600">
                            <p className="font-black text-slate-900">
                              {labels.night} {item.night}: {item.area}
                            </p>
                            <p className="mt-1">{item.accommodationStyle}</p>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  ) : null}
                  {usefulCostAssumptions.length > 0 ? (
                    <Panel title={labels.costAssumptions} icon={<Sparkles className="size-4" />}>
                      <div className="space-y-2">
                        {usefulCostAssumptions.map((item) => (
                          <div key={item.id} className="rounded-[8px] bg-slate-50 p-2 text-xs font-semibold text-slate-600">
                            <p className="font-black text-slate-900">{labels.costCategoryLabels[item.category]}</p>
                            <p className="mt-1">
                              {labels.perDay}: EUR {item.perDayEstimateEur} - {labels.total}: EUR {item.totalEstimateEur}
                            </p>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  ) : null}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={activeLearnedPreferences.length === 0 || loadingStage !== null}
                    className="flex h-10 items-center gap-2 rounded-[8px] bg-indigo-600 px-4 text-sm font-bold text-white shadow-[0_12px_28px_rgba(99,68,255,0.28)] disabled:cursor-not-allowed disabled:bg-indigo-200"
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
                  <div key={warning.id} className="rounded-[8px] border border-slate-200 bg-white p-3">
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
                { label: labels.confirmed, value: acceptedCount, color: "bg-emerald-500" },
                { label: labels.inferred, value: inferredCount, color: "bg-orange-500" },
                { label: labels.missing, value: rejectedCount, color: "bg-rose-500" }
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-[8px] bg-slate-50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`size-2.5 rounded-full ${item.color}`} />
                    <span className="text-xs font-black text-slate-600">{item.label}</span>
                  </div>
                  <span className="text-xs font-black text-slate-900">{item.value}</span>
                </div>
              ))}
            </div>
          </Panel>

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
                        {traceEntry?.summary || item.body}
                      </p>
                    </div>
                    <CheckCircle2 className={`mt-1 size-4 ${item.done ? "text-emerald-500" : "text-slate-300"}`} />
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel title={copy.evaluationSignals} eyebrow={copy.checkpointMetrics} icon={<SearchCheck className="size-4" />}>
            <div className="space-y-2">
              <div className="rounded-[8px] bg-slate-50 p-3">
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
                <div className="rounded-[8px] bg-slate-50 p-3">
                  <p className="text-[11px] font-black uppercase text-slate-400">{copy.preferenceExpressedRate}</p>
                  <p className="mt-1 text-sm font-black text-slate-950">
                    {detectedConflicts.length > 0 ? `${Math.round((probeAnswerList.length / detectedConflicts.length) * 100)}%` : checkpointBypassed ? "100%" : "0%"}
                  </p>
                </div>
                <div className="rounded-[8px] bg-slate-50 p-3">
                  <p className="text-[11px] font-black uppercase text-slate-400">{copy.preferenceMetProxy}</p>
                  <p className="mt-1 text-sm font-black text-slate-950">
                    {learnedPreferences.length > 0 ? `${Math.round((activeLearnedPreferences.length / learnedPreferences.length) * 100)}%` : checkpointBypassed ? "100%" : "0%"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-[8px] bg-slate-50 p-3">
                  <p className="text-[11px] font-black uppercase text-slate-400">{copy.checkpointQuestionCount}</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{detectedConflicts.length}</p>
                </div>
                <div className="rounded-[8px] bg-slate-50 p-3">
                  <p className="text-[11px] font-black uppercase text-slate-400">{copy.activePreferenceCount}</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{activeLearnedPreferences.length}</p>
                </div>
              </div>
              {checkpointDecision ? (
                <div className="rounded-[8px] bg-slate-50 p-3">
                  <p className="text-[11px] font-black uppercase text-slate-400">{copy.interactionBurden}</p>
                  <div className="mt-1">
                    <ImpactBadge impact={checkpointDecision.interactionCost} labels={labels.impactLabels} />
                  </div>
                </div>
              ) : null}
              <p className="text-xs font-semibold leading-5 text-slate-500">{copy.noGroundTruth}</p>
            </div>
          </Panel>

          <Panel title={labels.memoryStatusTitle} eyebrow={memoryStatus?.message || labels.memoryEmpty} icon={<Database className="size-4" />}>
            <div className="rounded-[8px] bg-slate-50 p-3">
              <p className="text-xs font-black text-slate-500">
                {memoryStatus?.used ? labels.basedOnMemory : labels.freshRequest}
              </p>
              <p className="mt-1 text-sm font-black text-slate-950">
                {memory.preferences.length} {labels.memoryCountLabel}
              </p>
            </div>
          </Panel>
        </aside>
      </div>

      <PromptComposer
        prompt={prompt}
        onPromptChange={handlePromptChange}
        onGenerate={handleComposerGenerate}
        analyzing={loadingStage !== null && loadingStage !== "itinerary"}
        planning={loadingStage === "itinerary"}
        canGenerate={
          sectionComplete.assumptions &&
          (activeLearnedPreferences.length > 0 || checkpointBypassed) &&
          !nonPlanningPrompt &&
          loadingStage === null
        }
        stats={promptStats}
        labels={{
          promptPlaceholder: copy.promptPlaceholder,
          promptTooShort: copy.promptTooShort,
          generate: composerPrimaryLabel,
          assumptionsInferred: labels.assumptionsInferred,
          missingPreferences: labels.missingPreferences,
          highImpactUnresolved: labels.highImpactUnresolved,
          memoryApplied: labels.memoryApplied,
          examplesLabel: copy.promptExamplesLabel,
          examples: copy.promptExamples
        }}
      />
    </main>
  );
}
