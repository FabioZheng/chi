"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  CirclePause,
  CirclePlay,
  Clock3,
  GitBranch,
  Globe2,
  History,
  Loader2,
  Plane,
  Plus,
  RotateCcw,
  Route,
  Send,
  Sparkles,
  TreePalm,
  X
} from "lucide-react";
import { expandBranches, generateItinerary } from "@/api/client";
import {
  BranchExplorer,
  BranchInspector,
  branchFitScore,
  committedPath,
  frontierNodes,
  pinnedLeaf
} from "@/components/BranchExplorer";
import { TripItinerary } from "@/components/TripItinerary";
import { languageNames, type Language } from "@/i18n";
import type {
  BranchDimension,
  ConfirmedPreference,
  ConstraintWarning,
  Itinerary,
  LearnedPreference,
  PlanNode
} from "@/types/travel";

type GenerationStatus =
  | "idle"
  | "generating"
  | "checkpoint"
  | "paused"
  | "repairing"
  | "ready"
  | "planning"
  | "complete"
  | "error";

type WorkspaceView = "tree" | "itinerary";
type PreferenceCategory = LearnedPreference["category"];

type TripRule = {
  id: string;
  value: string;
  category: PreferenceCategory;
  createdAt: string;
};

type ScoreDelta = { from: number; to: number };

type CheckpointSnapshot = {
  id: string;
  label: string;
  dimension: BranchDimension | null;
  createdAt: string;
  tree: PlanNode[];
  rules: TripRule[];
};

type PersistedWorkspace = {
  version: 2;
  language: Language;
  draftPrompt: string;
  sessionPrompt: string;
  tree: PlanNode[];
  rules: TripRule[];
  favoredIds: string[];
  selectedNodeId: string | null;
  activeDimension: BranchDimension | null;
  checkpoints: CheckpointSnapshot[];
  itinerary: Itinerary | null;
  warnings: ConstraintWarning[];
  selectedOptionId: string | null;
  view: WorkspaceView;
  status: GenerationStatus;
  activity: string;
};

const STORAGE_KEY = "trip-tree:workspace:v2";
const BRANCH_STAGES = ["tripShape", "rhythm", "anchors", "logistics"] as const satisfies readonly BranchDimension[];

const text = {
  en: {
    brand: "TripTree",
    subtitle: "Interruptible trip planning",
    newTrip: "New trip",
    language: "Language",
    treeView: "Planning tree",
    itineraryView: "Itinerary",
    startTitle: "Where are you thinking of going?",
    startBody: "A place, duration, or rough idea is enough.",
    promptPlaceholder: "e.g. Italy for one week in October",
    start: "Start branching",
    examples: ["Italy for one week", "Japan in October", "A quiet coastal escape"],
    status: {
      idle: "Ready",
      generating: "Branches emerging",
      checkpoint: "Decision checkpoint",
      paused: "Generation paused",
      repairing: "Repairing branches",
      ready: "Route ready to build",
      planning: "Building itinerary",
      complete: "Itinerary ready",
      error: "Needs attention"
    },
    pause: "Pause",
    resume: "Resume",
    progress: "decisions committed",
    checkpointTitle: "Checkpoint",
    checkpointBody: "Choose a direction, prune what does not fit, or add a trip rule before continuing.",
    readyTitle: "The planning path is committed",
    readyBody: "The route, pace, trip style, and logistics are ready for the itinerary pass.",
    build: "Build itinerary",
    building: "Building itinerary",
    pausedTitle: "Work is held at this checkpoint",
    pausedBody: "The current tree is preserved. Resume when you are ready.",
    history: "Checkpoints",
    historyEmpty: "No checkpoints yet",
    restoreCheckpoint: "Restore checkpoint",
    rules: "Trip rules",
    noRules: "No extra rules yet",
    removeRule: "Remove rule",
    steerTitle: "Steer from here",
    steerBody: "Add a newly realized preference. The affected branches will be rescored and repaired.",
    steerPlaceholder: "Include Bologna, slow the pace, fewer hotel changes...",
    apply: "Apply and continue",
    rescoreSummary: (count: number, pruned: number) => `${count} branches rescored · ${pruned} incompatible pruned`,
    generatingActivity: "Exploring distinct directions",
    pausedActivity: "Generation paused; checkpoint saved",
    resumedActivity: "Continuing from the saved checkpoint",
    branchCommitted: "Branch committed; expanding the next decision",
    branchPruned: "Branch pruned; the rest of the tree is unchanged",
    branchRestored: "Branch restored as a candidate",
    ruleRemoved: "Rule removed; affected branches are being reconsidered",
    itineraryActivity: "Itinerary built from the committed branch",
    adjustActivity: "Tree reopened at the latest checkpoint",
    errorFallback: "Something interrupted planning. Your tree is still here.",
    dismiss: "Dismiss",
    reExplore: "Explore more branches",
    tree: {
      root: "Trip idea",
      liveTree: "Shared planning tree",
      stages: {
        tripShape: "Route",
        rhythm: "Pace",
        anchors: "Trip style",
        logistics: "Logistics"
      },
      stagePrompts: {
        tripShape: "Which cities and direction?",
        rhythm: "How should time be distributed?",
        anchors: "What should anchor the trip?",
        logistics: "How should movement and stays work?"
      },
      checkpoint: "checkpoint",
      exploring: "exploring",
      noBranches: "Waiting for this decision",
      selectedBranch: "Select a node to compare its fit, risks, assumptions, and trade-offs.",
      chooseBranch: "Choose a branch",
      routeFit: "Route fit",
      budgetRisk: "Budget risk",
      logistics: "Logistics",
      paceLoad: "Pace load",
      tradeoff: "Main trade-off",
      assumptions: "Branch assumptions",
      cities: "Route shape",
      transfers: "transfers",
      hotelChanges: "hotel changes",
      nights: "n",
      favor: "Favor branch",
      unfavor: "Remove favor",
      prune: "Prune branch",
      restore: "Restore branch",
      continueHere: "Continue here",
      committed: "Committed",
      pruned: "Pruned",
      favored: "Favored",
      candidate: "Candidate",
      from: "From",
      scoreChange: "Rescored",
      agentNames: {
        route: "Route Mobility Agent",
        budget: "Budget Manager Agent",
        logistics: "Route Mobility Agent",
        pace: "Pace Feasibility Agent"
      }
    },
    itinerary: {
      backToTree: "Back to tree",
      finalPlan: "Final itinerary",
      builtFromBranch: "Built from the committed branch",
      days: "Days",
      estimated: "Estimated",
      walking: "Walking",
      travel: "Travel time",
      day: "Day",
      flexible: "Flexible",
      warnings: "Checks",
      noWarnings: "No material feasibility issues found.",
      adjustPlan: "Adjust at checkpoint",
      costEstimate: "Cost estimate",
      routeOverview: "Route overview"
    }
  },
  zh: {
    brand: "TripTree",
    subtitle: "可中断的分支式旅行规划",
    newTrip: "新旅行",
    language: "语言",
    treeView: "规划树",
    itineraryView: "行程",
    startTitle: "你想去哪里？",
    startBody: "一个地点、时长或大致想法就够了。",
    promptPlaceholder: "例如：十月去意大利一周",
    start: "开始生成分支",
    examples: ["意大利一周", "十月去日本", "安静的海滨假期"],
    status: {
      idle: "就绪",
      generating: "分支生成中",
      checkpoint: "决策检查点",
      paused: "生成已暂停",
      repairing: "正在修复分支",
      ready: "路线可生成行程",
      planning: "正在生成行程",
      complete: "行程已就绪",
      error: "需要处理"
    },
    pause: "暂停",
    resume: "继续",
    progress: "个决策已确认",
    checkpointTitle: "检查点",
    checkpointBody: "选择一个方向、剪掉不合适的分支，或在继续前添加旅行规则。",
    readyTitle: "规划路径已确认",
    readyBody: "路线、节奏、旅行风格和后勤方式已可用于生成行程。",
    build: "生成行程",
    building: "正在生成行程",
    pausedTitle: "工作已保存在此检查点",
    pausedBody: "当前规划树已保留，准备好后可继续。",
    history: "检查点",
    historyEmpty: "暂无检查点",
    restoreCheckpoint: "恢复检查点",
    rules: "旅行规则",
    noRules: "暂无额外规则",
    removeRule: "删除规则",
    steerTitle: "从这里引导",
    steerBody: "添加刚想到的偏好，受影响的分支会重新评分并修复。",
    steerPlaceholder: "加入博洛尼亚、放慢节奏、减少换酒店...",
    apply: "应用并继续",
    rescoreSummary: (count: number, pruned: number) => `${count} 个分支已重评分 · ${pruned} 个不兼容分支已剪除`,
    generatingActivity: "正在探索不同方向",
    pausedActivity: "生成已暂停，检查点已保存",
    resumedActivity: "从已保存的检查点继续",
    branchCommitted: "分支已确认，正在展开下一个决策",
    branchPruned: "分支已剪除，规划树其他部分保持不变",
    branchRestored: "分支已恢复为候选项",
    ruleRemoved: "规则已删除，正在重新评估受影响分支",
    itineraryActivity: "已从确认的分支生成行程",
    adjustActivity: "规划树已在最近检查点重新打开",
    errorFallback: "规划被中断，但当前规划树仍然保留。",
    dismiss: "关闭",
    reExplore: "探索更多分支",
    tree: {
      root: "旅行想法",
      liveTree: "共享规划树",
      stages: {
        tripShape: "路线",
        rhythm: "节奏",
        anchors: "旅行风格",
        logistics: "后勤"
      },
      stagePrompts: {
        tripShape: "选择哪些城市和方向？",
        rhythm: "时间如何分配？",
        anchors: "旅行围绕什么展开？",
        logistics: "移动和住宿如何安排？"
      },
      checkpoint: "检查点",
      exploring: "探索中",
      noBranches: "等待此项决策",
      selectedBranch: "选择节点以比较匹配度、风险、假设和取舍。",
      chooseBranch: "选择分支",
      routeFit: "路线匹配",
      budgetRisk: "预算风险",
      logistics: "后勤难度",
      paceLoad: "节奏负荷",
      tradeoff: "主要取舍",
      assumptions: "分支假设",
      cities: "路线结构",
      transfers: "小时转移",
      hotelChanges: "次换酒店",
      nights: "晚",
      favor: "看好此分支",
      unfavor: "取消看好",
      prune: "剪掉分支",
      restore: "恢复分支",
      continueHere: "从这里继续",
      committed: "已确认",
      pruned: "已剪除",
      favored: "已看好",
      candidate: "候选",
      from: "来自",
      scoreChange: "重新评分",
      agentNames: {
        route: "路线移动智能体",
        budget: "预算管理智能体",
        logistics: "路线移动智能体",
        pace: "节奏可行性智能体"
      }
    },
    itinerary: {
      backToTree: "返回规划树",
      finalPlan: "最终行程",
      builtFromBranch: "由已确认分支生成",
      days: "天数",
      estimated: "预估费用",
      walking: "步行",
      travel: "交通时间",
      day: "第",
      flexible: "灵活安排",
      warnings: "检查结果",
      noWarnings: "未发现重要可行性问题。",
      adjustPlan: "在检查点调整",
      costEstimate: "费用估算",
      routeOverview: "路线概览"
    }
  }
} as const;

function ruleCategory(value: string): PreferenceCategory {
  const normalized = value.toLowerCase();
  if (/budget|cheap|cost|expensive|afford|预算|便宜|费用/.test(normalized)) return "budget";
  if (/slow|pace|rush|rest|relax|节奏|慢|轻松/.test(normalized)) return "pace";
  if (/food|restaurant|market|cuisine|美食|餐厅/.test(normalized)) return "food";
  if (/train|car|flight|transport|transfer|交通|火车|自驾/.test(normalized)) return "transport";
  if (/walk|mobility|步行/.test(normalized)) return "walkingTolerance";
  if (/hotel|stay|base|accommodation|酒店|住宿/.test(normalized)) return "accommodationArea";
  if (/local|tourist|authentic|本地|游客/.test(normalized)) return "touristyLocalStyle";
  if (/museum|art|nature|beach|history|interest|博物馆|艺术|自然|海滩/.test(normalized)) return "interests";
  return "other";
}

function affectedStageForRule(value: string): number {
  const category = ruleCategory(value);
  if (category === "budget" || /include|must|city|cities|route|加入|必须|城市|路线/.test(value.toLowerCase())) return 0;
  if (category === "pace" || category === "walkingTolerance") return 1;
  if (category === "food" || category === "interests" || category === "touristyLocalStyle") return 2;
  if (category === "transport" || category === "accommodationArea") return 3;
  return 2;
}

function learnedPreferences(rules: TripRule[], tree: PlanNode[]): LearnedPreference[] {
  const explicit = rules.map((rule) => ({
    id: rule.id,
    conflictId: "checkpoint-steering",
    category: rule.category,
    label: "Trip rule",
    value: rule.value,
    planningImpact: "Apply this rule to branch scoring, pruning, repair, and final itinerary generation.",
    source: "User" as const,
    confidence: 1
  }));
  const branchChoices = committedPath(tree)
    .filter((node) => node.revealedPreference)
    .map((node) => ({
      id: `choice-${node.id}`,
      conflictId: "branch-choice",
      category: node.revealedPreference!.category,
      label: "Committed branch",
      value: node.revealedPreference!.value,
      planningImpact: node.summary,
      source: "User" as const,
      confidence: 0.95
    }));
  return [...explicit, ...branchChoices];
}

function confirmedPreferences(rules: TripRule[], tree: PlanNode[]): ConfirmedPreference[] {
  return learnedPreferences(rules, tree).map((preference) => ({
    id: preference.id,
    category: preference.category,
    label: preference.label,
    value: preference.value,
    source: "User"
  }));
}

function isDescendant(node: PlanNode, ancestorId: string, tree: PlanNode[]) {
  const byId = new Map(tree.map((item) => [item.id, item]));
  let parentId = node.parentId;
  while (parentId) {
    if (parentId === ancestorId) return true;
    parentId = byId.get(parentId)?.parentId ?? null;
  }
  return false;
}

function incompatibleWithRule(node: PlanNode, value: string, siblingNodes: PlanNode[]): boolean {
  const normalized = value.toLowerCase();
  const mentionedCities = Array.from(new Set(siblingNodes.flatMap((item) => item.cities.map((city) => city.name))))
    .filter((city) => normalized.includes(city.toLowerCase()));
  if (mentionedCities.length > 0 && !mentionedCities.some((city) => node.cities.some((item) => item.name === city))) return true;
  if (/slow|relax|less rushed|fewer cities|慢|轻松|少城市/.test(normalized) && node.estimates.pace === "Packed") return true;
  if (/fewer hotel|hotel change|one base|few moves|少换酒店|少换住处/.test(normalized) && node.estimates.moveCount >= 3) return true;
  if (/cheap|budget|less expensive|便宜|预算|省钱/.test(normalized)) {
    const perDay = node.estimates.budgetBandMaxEur / Math.max(1, node.durationDays);
    if (perDay > 230) return true;
  }
  return false;
}

function rewindTreeForRule(tree: PlanNode[], value: string, requestedStage: number) {
  const path = committedPath(tree);
  const stageIndex = Math.min(requestedStage, path.length);
  const level = stageIndex + 1;
  const parentId = stageIndex === 0 ? null : path[stageIndex - 1]?.id ?? null;
  const siblings = tree.filter((node) => node.level === level && (node.parentId ?? null) === parentId && node.status !== "pruned");
  const incompatible = new Set(siblings.filter((node) => incompatibleWithRule(node, value, siblings)).map((node) => node.id));
  if (incompatible.size === siblings.length) incompatible.clear();

  const next = tree.map((node): PlanNode => {
    if (node.level > level && node.status !== "pruned") return { ...node, status: "pruned" };
    if (node.level === level && (node.parentId ?? null) === parentId) {
      if (incompatible.has(node.id)) return { ...node, status: "pruned" };
      if (node.status === "pinned") return { ...node, status: "candidate" };
    }
    if (node.level >= level && node.status === "pinned") return { ...node, status: "candidate" };
    return node;
  });

  return { tree: next, stageIndex, prunedCount: incompatible.size };
}

function safeWorkspace(raw: string | null): PersistedWorkspace | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedWorkspace>;
    if (parsed.version !== 2 || !Array.isArray(parsed.tree) || !Array.isArray(parsed.rules)) return null;
    return parsed as PersistedWorkspace;
  } catch {
    return null;
  }
}

export default function Home() {
  const [language, setLanguage] = useState<Language>("en");
  const [draftPrompt, setDraftPrompt] = useState("");
  const [sessionPrompt, setSessionPrompt] = useState("");
  const [tree, setTree] = useState<PlanNode[]>([]);
  const [rules, setRules] = useState<TripRule[]>([]);
  const [favoredIds, setFavoredIds] = useState<string[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeDimension, setActiveDimension] = useState<BranchDimension | null>(null);
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [activity, setActivity] = useState("");
  const [rationale, setRationale] = useState("");
  const [steeringDraft, setSteeringDraft] = useState("");
  const [scoreDeltas, setScoreDeltas] = useState<Record<string, ScoreDelta>>({});
  const [checkpoints, setCheckpoints] = useState<CheckpointSnapshot[]>([]);
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [warnings, setWarnings] = useState<ConstraintWarning[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [view, setView] = useState<WorkspaceView>("tree");
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const copy = text[language];
  const committed = useMemo(() => committedPath(tree), [tree]);
  const frontier = useMemo(() => frontierNodes(tree), [tree]);
  const selectedNode = useMemo(
    () => tree.find((node) => node.id === selectedNodeId) ?? frontier.find((node) => node.status !== "pruned") ?? null,
    [frontier, selectedNodeId, tree]
  );
  const budgetSignals = rules.filter((rule) => rule.category === "budget").map((rule) => rule.value).join(" ");
  const isWorking = status === "generating" || status === "repairing" || status === "planning";

  useEffect(() => {
    const restored = safeWorkspace(window.localStorage.getItem(STORAGE_KEY));
    if (restored) {
      setLanguage(restored.language || "en");
      setDraftPrompt(restored.draftPrompt || "");
      setSessionPrompt(restored.sessionPrompt || "");
      setTree(restored.tree || []);
      setRules(restored.rules || []);
      setFavoredIds(restored.favoredIds || []);
      setSelectedNodeId(restored.selectedNodeId || null);
      setActiveDimension(restored.activeDimension || null);
      setCheckpoints(restored.checkpoints || []);
      setItinerary(restored.itinerary || null);
      setWarnings(restored.warnings || []);
      setSelectedOptionId(restored.selectedOptionId || null);
      setView(restored.view || "tree");
      setStatus(["generating", "repairing", "planning"].includes(restored.status) ? "paused" : restored.status || "idle");
      setActivity(restored.activity || "");
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const payload: PersistedWorkspace = {
      version: 2,
      language,
      draftPrompt,
      sessionPrompt,
      tree,
      rules,
      favoredIds,
      selectedNodeId,
      activeDimension,
      checkpoints,
      itinerary,
      warnings,
      selectedOptionId,
      view,
      status,
      activity
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [
    activeDimension,
    activity,
    checkpoints,
    draftPrompt,
    favoredIds,
    hydrated,
    itinerary,
    language,
    rules,
    selectedNodeId,
    selectedOptionId,
    sessionPrompt,
    status,
    tree,
    view,
    warnings
  ]);

  function addCheckpoint(label: string, dimension: BranchDimension | null, checkpointTree: PlanNode[], checkpointRules: TripRule[]) {
    const snapshot: CheckpointSnapshot = {
      id: `checkpoint-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label,
      dimension,
      createdAt: new Date().toISOString(),
      tree: checkpointTree,
      rules: checkpointRules
    };
    setCheckpoints((current) => [...current.slice(-7), snapshot]);
  }

  async function expandTree(options: {
    baseTree: PlanNode[];
    prompt: string;
    activeRules: TripRule[];
    guidance?: string;
    repairing?: boolean;
  }) {
    const path = committedPath(options.baseTree);
    if (path.length >= BRANCH_STAGES.length) {
      setActiveDimension(null);
      setStatus("ready");
      return;
    }

    const dimension = BRANCH_STAGES[path.length];
    const parent = path[path.length - 1] ?? null;
    const level = path.length + 1;
    const parentId = parent?.id ?? null;
    const excludedTitles = options.baseTree
      .filter((node) => node.level === level && (node.parentId ?? null) === parentId && node.status === "pruned")
      .map((node) => node.title);
    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    controllerRef.current?.abort();
    controllerRef.current = controller;
    setActiveDimension(dimension);
    setStatus(options.repairing ? "repairing" : "generating");
    setActivity(options.repairing ? copy.status.repairing : copy.generatingActivity);
    setError(null);

    try {
      const result = await expandBranches(
        {
          prompt: options.prompt,
          dimension,
          parent,
          committedPath: path,
          excludedTitles,
          guidance: options.guidance?.trim() || "",
          learnedPreferences: learnedPreferences(options.activeRules, options.baseTree),
          probeAnswers: [],
          memory: null,
          language
        },
        controller.signal
      );
      if (requestId !== requestIdRef.current) return;

      const nextTree = [
        ...options.baseTree.filter(
          (node) => !(node.level === level && (node.parentId ?? null) === parentId && node.status !== "pruned")
        ),
        ...result.nodes
      ];
      const best = [...result.nodes].sort(
        (a, b) => branchFitScore(b, options.activeRules.map((rule) => rule.value), budgetSignals) - branchFitScore(a, options.activeRules.map((rule) => rule.value), budgetSignals)
      )[0];
      setTree(nextTree);
      setRationale(result.rationale);
      setSelectedNodeId(best?.id ?? null);
      setStatus("checkpoint");
      setActivity(copy.status.checkpoint);
      addCheckpoint(`${copy.tree.stages[dimension]} ${copy.checkpointTitle.toLowerCase()}`, dimension, nextTree, options.activeRules);
    } catch (caught) {
      if (caught instanceof Error && caught.name === "AbortError") return;
      if (requestId !== requestIdRef.current) return;
      setError(caught instanceof Error ? caught.message : copy.errorFallback);
      setStatus("error");
    } finally {
      if (requestId === requestIdRef.current) controllerRef.current = null;
    }
  }

  function handleStart() {
    const prompt = draftPrompt.trim();
    if (prompt.length < 4 || isWorking) return;
    requestIdRef.current += 1;
    controllerRef.current?.abort();
    setSessionPrompt(prompt);
    setTree([]);
    setRules([]);
    setFavoredIds([]);
    setSelectedNodeId(null);
    setActiveDimension("tripShape");
    setCheckpoints([]);
    setItinerary(null);
    setWarnings([]);
    setSelectedOptionId(null);
    setScoreDeltas({});
    setView("tree");
    void expandTree({ baseTree: [], prompt, activeRules: [] });
  }

  function handlePause() {
    if (!isWorking) return;
    requestIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setStatus("paused");
    setActivity(copy.pausedActivity);
    addCheckpoint(`${copy.pause}: ${activeDimension ? copy.tree.stages[activeDimension] : copy.itinerary.finalPlan}`, activeDimension, tree, rules);
  }

  function handleResume() {
    setActivity(copy.resumedActivity);
    if (pinnedLeaf(tree, BRANCH_STAGES.length)) {
      void buildItinerary();
      return;
    }
    if (frontier.some((node) => node.status === "candidate")) {
      setStatus("checkpoint");
      return;
    }
    void expandTree({ baseTree: tree, prompt: sessionPrompt, activeRules: rules });
  }

  function ancestorIds(node: PlanNode) {
    const byId = new Map(tree.map((item) => [item.id, item]));
    const ids = new Set<string>([node.id]);
    let parentId = node.parentId;
    while (parentId) {
      ids.add(parentId);
      parentId = byId.get(parentId)?.parentId ?? null;
    }
    return ids;
  }

  function handleContinue(node: PlanNode) {
    if (isWorking || node.status === "pruned") return;
    const pathIds = ancestorIds(node);
    const nextTree = tree.map((item): PlanNode => {
      if (pathIds.has(item.id) && item.level <= node.level) return { ...item, status: "pinned" };
      if (item.status === "pinned" && !pathIds.has(item.id)) return { ...item, status: "candidate" };
      if (item.level > node.level && !isDescendant(item, node.id, tree) && item.status !== "pruned") return { ...item, status: "pruned" };
      return item;
    });
    setTree(nextTree);
    setSelectedNodeId(node.id);
    setScoreDeltas({});
    setActivity(copy.branchCommitted);
    if (node.level >= BRANCH_STAGES.length) {
      setActiveDimension(null);
      setStatus("ready");
      addCheckpoint(copy.readyTitle, null, nextTree, rules);
      return;
    }
    void expandTree({ baseTree: nextTree, prompt: sessionPrompt, activeRules: rules });
  }

  function handleFavor(node: PlanNode) {
    setFavoredIds((current) => (current.includes(node.id) ? current.filter((id) => id !== node.id) : [...current, node.id]));
  }

  function handlePrune(node: PlanNode) {
    if (node.status === "pinned") return;
    const nextTree = tree.map((item): PlanNode =>
      item.id === node.id || isDescendant(item, node.id, tree) ? { ...item, status: "pruned" } : item
    );
    setTree(nextTree);
    setFavoredIds((current) => current.filter((id) => id !== node.id));
    setSelectedNodeId(frontierNodes(nextTree).find((item) => item.status === "candidate")?.id ?? null);
    setActivity(copy.branchPruned);
  }

  function handleRestore(node: PlanNode) {
    const nextTree = tree.map((item): PlanNode => (item.id === node.id ? { ...item, status: "candidate" } : item));
    setTree(nextTree);
    setSelectedNodeId(node.id);
    setActivity(copy.branchRestored);
    setStatus("checkpoint");
  }

  function applyRule(value: string, nextRules: TripRule[], activityLabel?: string) {
    requestIdRef.current += 1;
    controllerRef.current?.abort();
    const currentScores = Object.fromEntries(tree.map((node) => [node.id, branchFitScore(node, rules.map((rule) => rule.value), budgetSignals)]));
    const rewound = rewindTreeForRule(tree, value, affectedStageForRule(value));
    const nextBudgetSignals = nextRules.filter((rule) => rule.category === "budget").map((rule) => rule.value).join(" ");
    const deltas = Object.fromEntries(
      rewound.tree.map((node) => [
        node.id,
        { from: currentScores[node.id] ?? branchFitScore(node, rules.map((rule) => rule.value), budgetSignals), to: branchFitScore(node, nextRules.map((rule) => rule.value), nextBudgetSignals) }
      ])
    );
    setRules(nextRules);
    setTree(rewound.tree);
    setScoreDeltas(deltas);
    setItinerary(null);
    setWarnings([]);
    setView("tree");
    setActivity(activityLabel || copy.rescoreSummary(rewound.tree.length, rewound.prunedCount));
    void expandTree({
      baseTree: rewound.tree,
      prompt: sessionPrompt,
      activeRules: nextRules,
      guidance: value,
      repairing: true
    });
  }

  function handleApplySteering() {
    const value = steeringDraft.trim();
    if (value.length < 3 || isWorking) return;
    const rule: TripRule = {
      id: `rule-${Date.now()}`,
      value,
      category: ruleCategory(value),
      createdAt: new Date().toISOString()
    };
    setSteeringDraft("");
    applyRule(value, [...rules, rule]);
  }

  function handleRemoveRule(rule: TripRule) {
    if (isWorking) return;
    applyRule(`Reconsider without the previous rule: ${rule.value}`, rules.filter((item) => item.id !== rule.id), copy.ruleRemoved);
  }

  async function buildItinerary() {
    const leaf = pinnedLeaf(tree, BRANCH_STAGES.length);
    if (!leaf) return;
    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    controllerRef.current?.abort();
    controllerRef.current = controller;
    setStatus("planning");
    setActivity(copy.building);
    setError(null);
    const learned = learnedPreferences(rules, tree);
    try {
      const result = await generateItinerary(
        {
          prompt: [sessionPrompt, ...rules.map((rule) => `Trip rule: ${rule.value}`)].join("\n"),
          detectedConflicts: [],
          probeAnswers: [],
          learnedPreferences: learned,
          assumptions: [],
          transportAssumptions: [],
          accommodationAssumptions: [],
          costAssumptions: [],
          confirmedPreferences: confirmedPreferences(rules, tree),
          skeleton: {
            durationDays: leaf.durationDays,
            movementPattern: leaf.movementPattern,
            register: leaf.register,
            anchors: leaf.anchors,
            cities: leaf.cities.map((city) => ({ name: city.name, nights: city.nights }))
          },
          memory: null,
          language
        },
        controller.signal
      );
      if (requestId !== requestIdRef.current) return;
      setItinerary(result.itinerary);
      setWarnings(result.warnings);
      setSelectedOptionId(result.itinerary.selectedOptionId);
      setStatus("complete");
      setActivity(copy.itineraryActivity);
      setView("itinerary");
    } catch (caught) {
      if (caught instanceof Error && caught.name === "AbortError") return;
      if (requestId !== requestIdRef.current) return;
      setError(caught instanceof Error ? caught.message : copy.errorFallback);
      setStatus("error");
    } finally {
      if (requestId === requestIdRef.current) controllerRef.current = null;
    }
  }

  function handleRestoreCheckpoint(checkpoint: CheckpointSnapshot) {
    requestIdRef.current += 1;
    controllerRef.current?.abort();
    setTree(checkpoint.tree);
    setRules(checkpoint.rules);
    setActiveDimension(checkpoint.dimension);
    setSelectedNodeId(frontierNodes(checkpoint.tree).find((node) => node.status !== "pruned")?.id ?? null);
    setScoreDeltas({});
    setStatus(checkpoint.dimension ? "checkpoint" : "ready");
    setView("tree");
    setActivity(`${copy.restoreCheckpoint}: ${checkpoint.label}`);
  }

  function handleNewTrip() {
    requestIdRef.current += 1;
    controllerRef.current?.abort();
    window.localStorage.removeItem(STORAGE_KEY);
    setDraftPrompt("");
    setSessionPrompt("");
    setTree([]);
    setRules([]);
    setFavoredIds([]);
    setSelectedNodeId(null);
    setActiveDimension(null);
    setStatus("idle");
    setActivity("");
    setRationale("");
    setSteeringDraft("");
    setScoreDeltas({});
    setCheckpoints([]);
    setItinerary(null);
    setWarnings([]);
    setSelectedOptionId(null);
    setView("tree");
    setError(null);
  }

  function handleRetry() {
    if (pinnedLeaf(tree, BRANCH_STAGES.length)) {
      void buildItinerary();
      return;
    }

    void expandTree({ baseTree: tree, prompt: sessionPrompt, activeRules: rules });
  }

  const currentStagePrompt = activeDimension ? copy.tree.stagePrompts[activeDimension] : "";
  const statusText = copy.status[status];

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <span><TreePalm className="size-6" /></span>
          <div>
            <h1>{copy.brand}</h1>
            <p>{copy.subtitle}</p>
          </div>
        </div>

        {sessionPrompt ? (
          <div className="header-center">
            <div className="generation-state" data-status={status}>
              {isWorking ? <Loader2 className="size-4 animate-spin" /> : status === "complete" || status === "ready" ? <Check className="size-4" /> : status === "paused" ? <CirclePause className="size-4" /> : <Plane className="size-4" />}
              <span>{statusText}</span>
            </div>
            <div className="progress-track" aria-label={`${committed.length} / ${BRANCH_STAGES.length} ${copy.progress}`}>
              <i style={{ width: `${(committed.length / BRANCH_STAGES.length) * 100}%` }} />
            </div>
            <small>{committed.length}/{BRANCH_STAGES.length} {copy.progress}</small>
          </div>
        ) : null}

        <div className="header-actions">
          {sessionPrompt && isWorking ? (
            <button type="button" className="button-secondary" onClick={handlePause}>
              <CirclePause className="size-4" /> {copy.pause}
            </button>
          ) : null}
          {sessionPrompt && status === "paused" ? (
            <button type="button" className="button-primary" onClick={handleResume}>
              <CirclePlay className="size-4" /> {copy.resume}
            </button>
          ) : null}
          {sessionPrompt ? (
            <details className="checkpoint-history">
              <summary title={copy.history}>
                <History className="size-4" />
                <span>{checkpoints.length}</span>
                <ChevronDown className="size-3" />
              </summary>
              <div>
                <h3>{copy.history}</h3>
                {checkpoints.length === 0 ? <p>{copy.historyEmpty}</p> : null}
                {[...checkpoints].reverse().map((checkpoint) => (
                  <button key={checkpoint.id} type="button" onClick={() => handleRestoreCheckpoint(checkpoint)}>
                    <span>{checkpoint.label}</span>
                    <time>{new Date(checkpoint.createdAt).toLocaleTimeString(language === "zh" ? "zh-CN" : "en", { hour: "2-digit", minute: "2-digit" })}</time>
                  </button>
                ))}
              </div>
            </details>
          ) : null}
          <label className="language-select" title={copy.language}>
            <Globe2 className="size-4" />
            <select value={language} onChange={(event) => setLanguage(event.target.value as Language)} aria-label={copy.language}>
              {(Object.keys(languageNames) as Language[]).map((item) => (
                <option key={item} value={item}>{languageNames[item]}</option>
              ))}
            </select>
          </label>
          {sessionPrompt ? (
            <button type="button" className="icon-button" title={copy.newTrip} onClick={handleNewTrip}>
              <Plus className="size-4" />
            </button>
          ) : null}
        </div>
      </header>

      {!sessionPrompt ? (
        <section className="trip-start">
          <div>
            <span className="start-icon"><Route className="size-5" /></span>
            <h2>{copy.startTitle}</h2>
            <p>{copy.startBody}</p>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleStart();
            }}
          >
            <textarea
              value={draftPrompt}
              onChange={(event) => setDraftPrompt(event.target.value)}
              placeholder={copy.promptPlaceholder}
              rows={3}
              autoFocus
            />
            <div className="start-submit-row">
              <div className="prompt-examples">
                {copy.examples.map((example) => (
                  <button key={example} type="button" onClick={() => setDraftPrompt(example)}>{example}</button>
                ))}
              </div>
              <button type="submit" className="button-primary" disabled={draftPrompt.trim().length < 4}>
                {copy.start} <ArrowRight className="size-4" />
              </button>
            </div>
          </form>
        </section>
      ) : (
        <>
          <nav className="workspace-tabs" aria-label="Workspace views">
            <button type="button" aria-pressed={view === "tree"} onClick={() => setView("tree")}>
              <GitBranch className="size-4" /> {copy.treeView}
            </button>
            {itinerary ? (
              <button type="button" aria-pressed={view === "itinerary"} onClick={() => setView("itinerary")}>
                <Route className="size-4" /> {copy.itineraryView}
              </button>
            ) : null}
          </nav>

          {view === "itinerary" && itinerary ? (
            <TripItinerary
              itinerary={itinerary}
              warnings={warnings}
              selectedOptionId={selectedOptionId}
              labels={copy.itinerary}
              onSelectOption={setSelectedOptionId}
              onBack={() => setView("tree")}
              onAdjust={() => {
                setView("tree");
                setStatus("ready");
                setActivity(copy.adjustActivity);
              }}
            />
          ) : (
            <>
              <section className={`checkpoint-bar checkpoint-bar--${status}`}>
                <div className="checkpoint-bar__icon">
                  {isWorking ? <Loader2 className="size-5 animate-spin" /> : status === "paused" ? <CirclePause className="size-5" /> : <GitBranch className="size-5" />}
                </div>
                <div>
                  <span>{status === "ready" ? copy.readyTitle : status === "paused" ? copy.pausedTitle : copy.checkpointTitle}</span>
                  <h2>{status === "ready" ? copy.readyBody : status === "paused" ? copy.pausedBody : currentStagePrompt || statusText}</h2>
                  {status === "checkpoint" && (rationale || copy.checkpointBody) ? <p>{rationale || copy.checkpointBody}</p> : null}
                </div>
                {status === "ready" ? (
                  <button type="button" className="button-primary" onClick={() => void buildItinerary()}>
                    <Route className="size-4" /> {copy.build}
                  </button>
                ) : status === "paused" ? (
                  <button type="button" className="button-primary" onClick={handleResume}>
                    <CirclePlay className="size-4" /> {copy.resume}
                  </button>
                ) : status === "error" ? (
                  <button type="button" className="button-secondary" onClick={handleRetry}>
                    <RotateCcw className="size-4" /> {copy.reExplore}
                  </button>
                ) : null}
              </section>

              {rules.length > 0 ? (
                <section className="trip-rules" aria-label={copy.rules}>
                  <strong>{copy.rules}</strong>
                  <div>
                    {rules.map((rule) => (
                      <span key={rule.id}>
                        {rule.value}
                        <button type="button" title={copy.removeRule} disabled={isWorking} onClick={() => handleRemoveRule(rule)}>
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </section>
              ) : null}

              {error ? (
                <div className="error-banner" role="alert">
                  <AlertCircle className="size-4" />
                  <p>{error}</p>
                  <button type="button" title={copy.dismiss} onClick={() => setError(null)}><X className="size-4" /></button>
                </div>
              ) : null}

              <div className="workspace-layout">
                <section className="tree-canvas">
                  <div className="tree-canvas__meta">
                    <div>
                      <span>{copy.tree.liveTree}</span>
                      <p>{sessionPrompt}</p>
                    </div>
                    <small><Clock3 className="size-3" /> {activity || statusText}</small>
                  </div>
                  <div className="tree-scroll">
                    <BranchExplorer
                      prompt={sessionPrompt}
                      tree={tree}
                      stages={BRANCH_STAGES}
                      activeDimension={activeDimension}
                      selectedNodeId={selectedNode?.id ?? null}
                      favoredIds={favoredIds}
                      rules={rules.map((rule) => rule.value)}
                      budgetSignals={budgetSignals}
                      scoreDeltas={scoreDeltas}
                      expanding={status === "generating" || status === "repairing"}
                      controlsDisabled={isWorking || status === "paused"}
                      labels={copy.tree}
                      onSelect={(node) => setSelectedNodeId(node.id)}
                      onFavor={handleFavor}
                      onPrune={handlePrune}
                      onRestore={handleRestore}
                      onContinue={handleContinue}
                    />
                  </div>
                </section>

                <aside className="workspace-inspector">
                  <section className="steering-section">
                    <div className="section-kicker"><Sparkles className="size-4" /> {copy.steerTitle}</div>
                    <p>{copy.steerBody}</p>
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        handleApplySteering();
                      }}
                    >
                      <textarea
                        value={steeringDraft}
                        onChange={(event) => setSteeringDraft(event.target.value)}
                        placeholder={copy.steerPlaceholder}
                        rows={3}
                        disabled={isWorking}
                      />
                      <button type="submit" className="button-primary" disabled={steeringDraft.trim().length < 3 || isWorking}>
                        <Send className="size-4" /> {copy.apply}
                      </button>
                    </form>
                  </section>

                  <BranchInspector
                    node={selectedNode}
                    favored={selectedNode ? favoredIds.includes(selectedNode.id) : false}
                    rules={rules.map((rule) => rule.value)}
                    budgetSignals={budgetSignals}
                    scoreDelta={selectedNode ? scoreDeltas[selectedNode.id] : undefined}
                    controlsDisabled={isWorking || status === "paused"}
                    labels={copy.tree}
                    onFavor={handleFavor}
                    onPrune={handlePrune}
                    onRestore={handleRestore}
                    onContinue={handleContinue}
                  />
                </aside>
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
