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
import { EmptyState, ImpactBadge, Panel } from "@/components/Panel";
import { PromptComposer } from "@/components/PromptComposer";
import { languageNames, type Language, uiText } from "@/i18n";
import type {
  AccommodationAssumption,
  AgentTrace,
  Assumption,
  AssumptionCritique,
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

type PersistedSession = {
  prompt: string;
  detectedConflicts: DetectedConflict[];
  probeAnswers: Record<string, PreferenceProbeAnswer>;
  learnedPreferences: LearnedPreference[];
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
    eyebrow: "Conflict-based discovery",
    title: "Discover hidden travel preferences through trade-offs",
    subtitle:
      "Start with a lazy prompt. The planner detects conflicts, asks deeper probes, learns preferences, then reviews assumptions before building the itinerary.",
    startNewSession: "Start New Session",
    restored: "Previous session restored",
    saved: "Session saved locally",
    promptTitle: "Lazy Prompt",
    promptBody: "Describe the trip loosely. The system will look for hidden trade-offs instead of showing a static preference form.",
    promptPlaceholder: "e.g. Plan a trip to the Dolomites in September",
    promptTooShort: "Type at least 4 characters",
    detectConflicts: "Detect Conflicts",
    detectingConflicts: "Detecting conflicts",
    conflictsTitle: "Conflict Detection",
    conflictsBody: "Latent conflicts and risky assumptions found in the prompt.",
    probesTitle: "Preference Probes",
    probesBody: "Answer trade-off questions with options that meaningfully change the plan.",
    learnedTitle: "Learned Preferences",
    learnedBody: "Preferences inferred from your answers, ready to guide planning.",
    assumptionsTitle: "Assumption Review",
    assumptionsBody: "Review assumptions derived from learned preferences before planning.",
    itineraryTitle: "Itinerary Generation",
    itineraryBody: "The final plan explains which learned preferences influenced decisions.",
    feasibilityTitle: "Feasibility Checks",
    current: "Current",
    completed: "Completed",
    waiting: "Waiting",
    confidence: "confidence",
    hiddenPreference: "Hidden preference",
    whyItMatters: "Why it matters",
    planningImpact: "Planning impact",
    chooseOption: "Choose this option",
    answered: "Answered",
    unanswered: "Unanswered",
    learnPreferences: "Learn Preferences",
    learningPreferences: "Learning preferences",
    reviewAssumptions: "Review assumptions",
    generateItinerary: "Generate Itinerary",
    generatingItinerary: "Generating itinerary",
    assumptionHint: "Accepted, edited, and non-rejected assumptions remain available to the planner.",
    originalPrompt: "Original prompt",
    learnedInfluences: "Learned preference influence",
    noConflicts: "No conflicts detected yet.",
    noLearned: "No learned preferences yet.",
    noAssumptions: "No assumptions ready for review yet.",
    noItinerary: "No itinerary generated yet.",
    noWarnings: "No feasibility warnings yet.",
    accepted: "Accepted",
    rejected: "Rejected",
    resetNotice: "Clears prompt, conflicts, answers, learned preferences, itinerary, warnings, and persisted session state.",
    errorTitle: "Workflow step failed",
    preferenceHistory: "Detected Preferences",
    currentCheckpoint: "Current Checkpoint",
    planningSteps: "Planning Steps",
    assumptionValue: "Planning assumption",
    assumptionReason: "Why this was inferred",
    useAssumption: "Use",
    reviewLater: "Review",
    excludeAssumption: "Exclude",
    assumptionDecision: "Planning decision",
    assumptionsReadySummary: "ready for itinerary generation",
    traceTitle: "Agent trace"
  },
  zh: {
    eyebrow: "冲突式偏好发现",
    title: "通过取舍发现隐藏旅行偏好",
    subtitle: "从模糊提示开始，先识别潜在冲突，再用深入问题学习偏好，最后审核假设并生成行程。",
    startNewSession: "开始新会话",
    restored: "已恢复上次会话",
    saved: "会话已保存到本地",
    promptTitle: "模糊提示",
    promptBody: "简单描述行程，系统会寻找隐藏取舍，而不是展示静态偏好表单。",
    promptPlaceholder: "例如：帮我规划九月去多洛米蒂的旅行",
    promptTooShort: "请至少输入 4 个字符",
    detectConflicts: "检测冲突",
    detectingConflicts: "正在检测冲突",
    conflictsTitle: "冲突检测",
    conflictsBody: "从提示中发现的潜在冲突和风险假设。",
    probesTitle: "偏好探问",
    probesBody: "回答会真正改变规划策略的取舍问题。",
    learnedTitle: "已学到的偏好",
    learnedBody: "从回答中推断出的偏好，将用于指导规划。",
    assumptionsTitle: "假设审核",
    assumptionsBody: "在规划前审核由已学偏好推导出的假设。",
    itineraryTitle: "行程生成",
    itineraryBody: "最终方案会说明哪些已学偏好影响了规划决策。",
    feasibilityTitle: "可行性检查",
    current: "当前",
    completed: "已完成",
    waiting: "等待中",
    confidence: "置信度",
    hiddenPreference: "隐藏偏好",
    whyItMatters: "为什么重要",
    planningImpact: "规划影响",
    chooseOption: "选择此项",
    answered: "已回答",
    unanswered: "未回答",
    learnPreferences: "学习偏好",
    learningPreferences: "正在学习偏好",
    reviewAssumptions: "审核假设",
    generateItinerary: "生成行程",
    generatingItinerary: "正在生成行程",
    assumptionHint: "已接受、已编辑和未拒绝的假设会继续提供给规划器。",
    originalPrompt: "原始提示",
    learnedInfluences: "已学偏好的影响",
    noConflicts: "尚未检测到冲突。",
    noLearned: "尚未学到偏好。",
    noAssumptions: "尚无可审核假设。",
    noItinerary: "尚未生成行程。",
    noWarnings: "暂无可行性提醒。",
    accepted: "已接受",
    rejected: "已拒绝",
    resetNotice: "会清空提示、冲突、回答、已学偏好、行程、提醒和本地会话状态。",
    errorTitle: "流程步骤失败",
    preferenceHistory: "已识别偏好",
    currentCheckpoint: "当前检查点",
    planningSteps: "规划步骤",
    assumptionValue: "规划假设",
    assumptionReason: "推断依据",
    useAssumption: "采用",
    reviewLater: "待确认",
    excludeAssumption: "排除",
    assumptionDecision: "规划处理",
    assumptionsReadySummary: "可用于生成行程",
    traceTitle: "智能体轨迹"
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
    detectedConflicts: [],
    probeAnswers: {},
    learnedPreferences: [],
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
        setDetectedConflicts(session.detectedConflicts || []);
        setProbeAnswers(session.probeAnswers || {});
        setLearnedPreferences(session.learnedPreferences || []);
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
      detectedConflicts,
      probeAnswers,
      learnedPreferences,
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
    costAssumptions,
    critiques,
    detectedConflicts,
    hydrated,
    itinerary,
    language,
    learnedPreferences,
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
  const allProbesAnswered = detectedConflicts.length > 0 && detectedConflicts.every((conflict) => probeAnswers[conflict.id]);
  const confirmedPreferences = useMemo<ConfirmedPreference[]>(
    () => {
      const learnedConfirmed: ConfirmedPreference[] = learnedPreferences.map((preference) => ({
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
    [assumptions, learnedPreferences]
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
    setDetectedConflicts(session.detectedConflicts);
    setProbeAnswers(session.probeAnswers);
    setLearnedPreferences(session.learnedPreferences);
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
    setProbeAnswers({});
    setLearnedPreferences([]);
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

      setDetectedConflicts(result.detectedConflicts);
      setProbeAnswers({});
      setLearnedPreferences([]);
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
      setWorkflowStep("probes");
      openWorkflowSection("probes");
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

    setProbeAnswers((current) => ({
      ...current,
      [conflict.id]: {
        conflictId: conflict.id,
        optionId: option.id,
        answer: option.label,
        planningImpact: option.planningImpact
      }
    }));
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
    if (assumptions.length === 0 || loadingStage !== null) {
      return;
    }

    setLoadingStage("itinerary");
    setError(null);
    setTrace((current) => [
      ...current,
      runningTrace("Planner Agent", copy.generatingItinerary),
      runningTrace("Constraint Checker Agent", labels.checkerRunning)
    ]);

    try {
      const result = await generateItinerary({
        prompt,
        detectedConflicts,
        probeAnswers: probeAnswerList,
        learnedPreferences,
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
        ...current.filter((entry) => entry.agent !== "Planner Agent" && entry.agent !== "Constraint Checker Agent"),
        ...result.trace
      ]);
      setWorkflowStep("itinerary");
      openWorkflowSection("itinerary");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : labels.planError);
      setTrace((current) =>
        current.map((entry) =>
          entry.agent === "Planner Agent" || entry.agent === "Constraint Checker Agent" ? { ...entry, status: "Error" } : entry
        )
      );
    } finally {
      setLoadingStage(null);
    }
  }

  function handleComposerGenerate() {
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

  const sectionComplete: Record<FlowSection, boolean> = {
    prompt: prompt.trim().length >= 4,
    conflicts: detectedConflicts.length > 0,
    probes: allProbesAnswered,
    learned: learnedPreferences.length > 0,
    assumptions: assumptions.length > 0,
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
      body: detectedConflicts.length ? `${detectedConflicts.length} ${copy.completed.toLowerCase()}` : copy.waiting,
      done: sectionComplete.conflicts
    },
    {
      key: "probes",
      title: copy.probesTitle,
      body: detectedConflicts.length ? `${probeAnswerList.length}/${detectedConflicts.length} ${copy.answered.toLowerCase()}` : copy.waiting,
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
            { label: "Planner", icon: BrainCircuit, tone: "text-blue-700 bg-blue-50 border-blue-100" },
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
              {visiblePreferenceRows.length === 0 && assumptions.length === 0 ? (
                <EmptyState title={copy.noLearned} body={labels.waitingPrompt} />
              ) : null}
              {visiblePreferenceRows.slice(0, 5).map((preference) => (
                <div key={preference.id} className="rounded-[8px] border border-slate-100 bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-950">{labels.categoryLabels[preference.category]}</p>
                      <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">{preference.value}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">
                      {labels.confirmed}
                    </span>
                  </div>
                </div>
              ))}
              {visiblePreferenceRows.length === 0
                ? assumptions.slice(0, 5).map((assumption) => (
                    <div key={assumption.id} className="rounded-[8px] border border-slate-100 bg-white p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-950">{labels.categoryLabels[assumption.category]}</p>
                          <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">{assumption.value}</p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${
                            assumption.status === "Rejected"
                              ? "bg-rose-50 text-rose-700"
                              : assumption.status === "Accepted" || assumption.status === "Edited"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-orange-50 text-orange-700"
                          }`}
                        >
                          {labels.assumptionStatusLabels[assumption.status]}
                        </span>
                      </div>
                    </div>
                  ))
                : null}
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
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase text-slate-400">{copy.originalPrompt}</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{prompt || labels.waitingPrompt}</p>
                </div>
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
            {detectedConflicts.length === 0 ? (
              <EmptyState title={copy.noConflicts} />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {detectedConflicts.map((conflict) => (
                  <div key={conflict.id} className="rounded-[8px] border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-black text-slate-950">{conflict.title}</h3>
                      <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700">
                        {Math.round(conflict.confidence * 100)}% {copy.confidence}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-black uppercase text-slate-400">{copy.whyItMatters}</p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{conflict.explanation}</p>
                    <p className="mt-3 text-xs font-black uppercase text-slate-400">{copy.hiddenPreference}</p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">{conflict.hiddenPreference}</p>
                  </div>
                ))}
              </div>
            )}
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
              <EmptyState title={copy.noConflicts} />
            ) : (
              <div className="space-y-4">
                {detectedConflicts.map((conflict) => {
                  const answer = probeAnswers[conflict.id];

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
                <div className="grid gap-3 md:grid-cols-2">
                  {learnedPreferences.map((preference) => (
                    <div key={preference.id} className="rounded-[8px] border border-emerald-100 bg-emerald-50/60 p-3">
                      <p className="text-xs font-black uppercase text-emerald-700">{labels.categoryLabels[preference.category]}</p>
                      <h3 className="mt-1 text-sm font-black text-slate-950">{preference.value}</h3>
                      <p className="mt-2 text-xs font-semibold leading-5 text-emerald-900/75">{preference.planningImpact}</p>
                    </div>
                  ))}
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
                  <p className="mt-1 text-xs font-semibold leading-5 text-indigo-900/70">{copy.assumptionHint}</p>
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
                    disabled={learnedPreferences.length === 0 || loadingStage !== null}
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
                        ? entry.agent === "Planner Agent"
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
        onAnalyze={handleDetectConflicts}
        onGenerate={handleComposerGenerate}
        analyzing={loadingStage !== null && loadingStage !== "itinerary"}
        planning={loadingStage === "itinerary"}
        canGenerate={sectionComplete.assumptions && loadingStage === null}
        stats={promptStats}
        labels={{
          promptPlaceholder: copy.promptPlaceholder,
          promptTooShort: copy.promptTooShort,
          analyze: copy.detectConflicts,
          generate: composerPrimaryLabel,
          assumptionsInferred: labels.assumptionsInferred,
          missingPreferences: labels.missingPreferences,
          highImpactUnresolved: labels.highImpactUnresolved,
          memoryApplied: labels.memoryApplied
        }}
      />
    </main>
  );
}
