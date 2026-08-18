"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleDollarSign,
  Compass,
  GitBranch,
  Gauge,
  Hotel,
  Landmark,
  LockKeyhole,
  MapPin,
  Mountain,
  RotateCcw,
  Sparkles,
  Star,
  Sun,
  TrainFront,
  Trash2,
  UnlockKeyhole,
  UtensilsCrossed,
  WavesHorizontal,
  Zap,
  type LucideIcon
} from "lucide-react";
import { branchBudgetRisk } from "@/agents/branchScoring";
import {
  assumptionsForNode,
  correctionOptionsFor,
  type AssumptionMutation,
  type PlanningAssumptionMap
} from "@/planning/state";
import type {
  BranchDimension,
  PlanNode,
  PlanningAssumption,
  PlanningAssumptionSource
} from "@/types/travel";

export type BranchTreeLabels = {
  root: string;
  liveTree: string;
  stages: Record<BranchDimension, string>;
  stagePrompts: Record<BranchDimension, string>;
  checkpoint: string;
  exploring: string;
  noBranches: string;
  moreOptions: string;
  moreOptionsPending: string;
  moreOptionsExhausted: string;
  selectedBranch: string;
  chooseBranch: string;
  routeFit: string;
  budgetRisk: string;
  logistics: string;
  paceLoad: string;
  tradeoff: string;
  assumptions: string;
  alternatives: string;
  whyThisChoice: string;
  decision: string;
  consequences: string;
  confidence: string;
  impact: string;
  provenance: Record<PlanningAssumptionSource, string>;
  confirmAssumption: string;
  confirmedAssumption: string;
  rejectAssumption: string;
  lockAssumption: string;
  unlockAssumption: string;
  correctAssumption: string;
  cancel: string;
  lockDecision: string;
  unlockDecision: string;
  decisionLocked: string;
  needsUpdate: string;
  moreAssumptions: string;
  cities: string;
  transfers: string;
  hotelChanges: string;
  nights: string;
  favor: string;
  unfavor: string;
  prune: string;
  restore: string;
  continueHere: string;
  committed: string;
  pruned: string;
  favored: string;
  candidate: string;
  from: string;
  scoreChange: string;
  agentNames: {
    route: string;
    budget: string;
    logistics: string;
    pace: string;
  };
};

export type BranchAnnotations = {
  fit: number;
  budgetRisk: "Low" | "Medium" | "High";
  logisticsDifficulty: "Low" | "Medium" | "High";
  pace: PlanNode["estimates"]["pace"];
  tradeoff: string;
};

type ScoreDelta = { from: number; to: number };

type BranchExplorerProps = {
  prompt: string;
  tree: PlanNode[];
  stages: readonly BranchDimension[];
  activeDimension: BranchDimension | null;
  selectedNodeId: string | null;
  favoredIds: string[];
  rules: string[];
  budgetSignals: string;
  scoreDeltas: Record<string, ScoreDelta>;
  assumptions: PlanningAssumptionMap;
  expanding: boolean;
  controlsDisabled: boolean;
  maxOptionsPerLevel: number;
  labels: BranchTreeLabels;
  onSelect: (node: PlanNode) => void;
  onFavor: (node: PlanNode) => void;
  onPrune: (node: PlanNode) => void;
  onRestore: (node: PlanNode) => void;
  onContinue: (node: PlanNode) => void;
  onGenerateMore: () => void;
};

type BranchInspectorProps = {
  node: PlanNode | null;
  alternatives: PlanNode[];
  assumptions: PlanningAssumptionMap;
  focusedAssumptionId: string | null;
  favored: boolean;
  rules: string[];
  budgetSignals: string;
  scoreDelta?: ScoreDelta;
  controlsDisabled: boolean;
  labels: BranchTreeLabels;
  onFavor: (node: PlanNode) => void;
  onPrune: (node: PlanNode) => void;
  onRestore: (node: PlanNode) => void;
  onContinue: (node: PlanNode) => void;
  onAssumptionChange: (assumptionId: string, mutation: AssumptionMutation) => void;
  onAssumptionViewed: (assumption: PlanningAssumption) => void;
  onToggleDecisionLock: (node: PlanNode) => void;
};

const riskTone = {
  Low: "branch-metric--good",
  Medium: "branch-metric--watch",
  High: "branch-metric--risk"
} as const;

type TreeEdge = {
  id: string;
  d: string;
  tone: "committed" | "pruned" | "candidate";
  endX: number;
  endY: number;
};

function computeTreeEdges(container: HTMLElement, tree: PlanNode[]): TreeEdge[] {
  const cardById = new Map<string, HTMLElement>();
  container.querySelectorAll<HTMLElement>("[data-node-id]").forEach((element) => {
    if (element.dataset.nodeId) cardById.set(element.dataset.nodeId, element);
  });
  const origin = container.getBoundingClientRect();
  const edges: TreeEdge[] = [];

  for (const node of tree) {
    const child = cardById.get(node.id);
    const parent = cardById.get(node.parentId ?? "root");
    if (!child || !parent) continue;
    const parentRect = parent.getBoundingClientRect();
    const childRect = child.getBoundingClientRect();
    const startX = parentRect.right - origin.left;
    const startY = parentRect.top + parentRect.height / 2 - origin.top;
    const endX = childRect.left - origin.left;
    const endY = childRect.top + Math.min(childRect.height / 2, 36) - origin.top;
    const bend = Math.max(18, (endX - startX) / 2);
    edges.push({
      id: node.id,
      d: `M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`,
      tone: node.status === "pinned" ? "committed" : node.status === "pruned" ? "pruned" : "candidate",
      endX,
      endY
    });
  }

  return edges;
}

function normalized(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ");
}

type BranchVisual = { tone: string; Icon: LucideIcon };

const branchVisualThemes: ReadonlyArray<BranchVisual & { keywords: readonly string[] }> = [
  { tone: "food", Icon: UtensilsCrossed, keywords: ["food", "culinary", "wine", "market", "cuisine", "taste", "gastro", "美食", "餐", "酒庄"] },
  { tone: "sea", Icon: WavesHorizontal, keywords: ["coast", "beach", "island", "sea", "seaside", "riviera", "amalfi", "sorrento", "cinque", "海", "岛"] },
  { tone: "nature", Icon: Mountain, keywords: ["lake", "alps", "mountain", "dolomit", "nature", "outdoor", "scenic", "garda", "hik", "湖", "山", "自然", "户外"] },
  { tone: "culture", Icon: Landmark, keywords: ["art", "museum", "history", "historic", "heritage", "culture", "architec", "iconic", "renaissance", "艺术", "历史", "文化", "博物馆"] },
  { tone: "calm", Icon: Sun, keywords: ["relax", "slow", "leisure", "immersion", "unhurried", "calm", "rest", "recovery", "放松", "慢", "悠闲"] },
  { tone: "active", Icon: Zap, keywords: ["fast", "packed", "highlight", "active", "energetic", "快", "紧凑", "精华"] },
  { tone: "transit", Icon: TrainFront, keywords: ["train", "rail", "transfer", "logistics", "hotel", "base", "hub", "point-to-point", "火车", "酒店", "住宿", "中转"] }
];

const branchVisualFallbacks: ReadonlyArray<BranchVisual> = [
  { tone: "route", Icon: Compass },
  { tone: "active", Icon: Gauge },
  { tone: "culture", Icon: Sparkles },
  { tone: "transit", Icon: Hotel }
];

function branchVisual(node: PlanNode): BranchVisual {
  if (node.level === 2) {
    if (node.estimates.pace === "Relaxed") return { tone: "calm", Icon: Sun };
    if (node.estimates.pace === "Packed") return { tone: "active", Icon: Zap };
    return { tone: "route", Icon: Gauge };
  }
  if (node.level === 4) {
    return { tone: "transit", Icon: node.estimates.moveCount <= 1 ? Hotel : TrainFront };
  }
  const text = normalized([node.title, node.summary, node.register, node.movementPattern, ...node.anchors].join(" "));
  const match = branchVisualThemes.find((theme) => theme.keywords.some((keyword) => text.includes(keyword)));
  return match ?? branchVisualFallbacks[Math.min(branchVisualFallbacks.length - 1, Math.max(0, node.level - 1))];
}

/*
 * Decorative thumbnails only: city photos come from the free, keyless Wikipedia
 * summary endpoint and fall back to the icon medallion when unavailable.
 */
const cityImageCache = new Map<string, Promise<string | null>>();

function cityImageUrl(city: string): Promise<string | null> {
  const key = city.trim();
  const cached = cityImageCache.get(key);
  if (cached) return cached;
  const request = fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(key)}`)
    .then((response) => (response.ok ? (response.json() as Promise<{ thumbnail?: { source?: unknown } }>) : null))
    .then((data) => (typeof data?.thumbnail?.source === "string" ? data.thumbnail.source : null))
    .catch(() => null);
  cityImageCache.set(key, request);
  return request;
}

function nodeThumbCity(node: PlanNode): string | null {
  if (node.cities.length === 0) return null;
  let hash = 0;
  for (let index = 0; index < node.id.length; index += 1) hash = (hash * 31 + node.id.charCodeAt(index)) | 0;
  return node.cities[Math.abs(hash) % node.cities.length]?.name ?? null;
}

function BranchThumb({ node }: { node: PlanNode }) {
  const visual = branchVisual(node);
  const city = nodeThumbCity(node);
  const [image, setImage] = useState<string | null>(null);

  useEffect(() => {
    if (!city) return;
    let cancelled = false;
    void cityImageUrl(city).then((url) => {
      if (!cancelled) setImage(url);
    });
    return () => {
      cancelled = true;
    };
  }, [city]);

  return (
    <i className={`tree-node__thumb tree-node__thumb--${visual.tone}`} aria-hidden="true">
      <visual.Icon className="size-5" />
      {image ? (
        <img src={image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImage(null)} />
      ) : null}
    </i>
  );
}

function includesAny(haystack: string, needles: string[]) {
  return needles.some((needle) => haystack.includes(needle));
}

export function committedPath(tree: PlanNode[]): PlanNode[] {
  const pinned = tree.filter((node) => node.status === "pinned").sort((a, b) => a.level - b.level);
  const path: PlanNode[] = [];

  for (const node of pinned) {
    const expectedParent = path[path.length - 1]?.id ?? null;
    if ((node.parentId ?? null) === expectedParent) {
      path.push(node);
    }
  }

  return path;
}

export function frontierNodes(tree: PlanNode[]): PlanNode[] {
  const committed = committedPath(tree);
  const parentId = committed[committed.length - 1]?.id ?? null;
  const level = committed.length + 1;
  return tree.filter((node) => node.level === level && (node.parentId ?? null) === parentId);
}

export function pinnedLeaf(tree: PlanNode[], stageCount = 4): PlanNode | null {
  const path = committedPath(tree);
  return path.length >= stageCount ? path[path.length - 1] : null;
}

export function branchFitScore(node: PlanNode, rules: string[], budgetSignals = ""): number {
  const text = normalized(
    [node.title, node.summary, node.register, node.movementPattern, ...node.anchors, ...node.cities.map((city) => city.name)].join(" ")
  );
  const signals = normalized(rules.join(" "));
  let score = 62 + Math.round(node.confidence * 30);

  const slower = includesAny(signals, ["slow", "relax", "fewer cities", "less rushed", "慢", "轻松"]);
  const fewerHotels = includesAny(signals, ["fewer hotel", "hotel change", "one base", "few moves", "少换酒店", "少换住处"]);
  const budget = includesAny(signals, ["cheap", "budget", "affordable", "less expensive", "省钱", "预算"]);
  const local = includesAny(signals, ["local", "less tourist", "authentic", "本地", "少游客"]);

  if (slower) score += node.estimates.pace === "Relaxed" ? 9 : node.estimates.pace === "Packed" ? -24 : 2;
  if (fewerHotels) score += node.estimates.moveCount <= 1 ? 10 : node.estimates.moveCount >= 3 ? -22 : 0;
  if (budget && branchBudgetRisk(node.estimates, node.durationDays, budgetSignals || signals) === "High") score -= 18;
  if (local && includesAny(text, ["local", "neighborhood", "texture", "market", "authentic"])) score += 8;

  rules.forEach((rule) => {
    const capitalizedPlaces = rule.match(/\b[A-Z][a-z]{3,}\b/g) ?? [];
    capitalizedPlaces.forEach((place) => {
      const token = normalized(place).trim();
      if (token && text.includes(token)) score += 8;
    });
  });

  return Math.max(18, Math.min(98, score));
}

export function annotationsForBranch(node: PlanNode, rules: string[], budgetSignals: string): BranchAnnotations {
  const logisticsDifficulty =
    node.estimates.moveCount >= 3 || node.estimates.transferHours >= 8
      ? "High"
      : node.estimates.moveCount >= 2 || node.estimates.transferHours >= 4
        ? "Medium"
        : "Low";
  const routeShape = node.cities.length <= 1 ? "a single base" : `${node.cities.length} bases`;
  const tradeoff =
    node.estimates.pace === "Packed"
      ? `${routeShape} creates more variety, with less recovery time between stops.`
      : node.estimates.moveCount <= 1
        ? `${routeShape} reduces hotel changes, with less geographic range.`
        : `${routeShape} balances regional range with ${node.estimates.moveCount} hotel changes.`;

  return {
    fit: branchFitScore(node, rules, budgetSignals),
    budgetRisk: branchBudgetRisk(node.estimates, node.durationDays, budgetSignals),
    logisticsDifficulty,
    pace: node.estimates.pace,
    tradeoff
  };
}

function stateLabel(node: PlanNode, favored: boolean, labels: BranchTreeLabels) {
  if (node.stale) return labels.needsUpdate;
  if (node.locked) return labels.decisionLocked;
  if (node.status === "pinned") return labels.committed;
  if (node.status === "pruned") return labels.pruned;
  if (favored) return labels.favored;
  return labels.candidate;
}

function BranchNodeCard({
  node,
  active,
  selected,
  favored,
  assumptions,
  rules,
  budgetSignals,
  scoreDelta,
  controlsDisabled,
  labels,
  onSelect,
  onFavor,
  onPrune,
  onRestore,
  onContinue
}: {
  node: PlanNode;
  active: boolean;
  selected: boolean;
  favored: boolean;
  assumptions: PlanningAssumptionMap;
  rules: string[];
  budgetSignals: string;
  scoreDelta?: ScoreDelta;
  controlsDisabled: boolean;
  labels: BranchTreeLabels;
  onSelect: (node: PlanNode) => void;
  onFavor: (node: PlanNode) => void;
  onPrune: (node: PlanNode) => void;
  onRestore: (node: PlanNode) => void;
  onContinue: (node: PlanNode) => void;
}) {
  const annotations = annotationsForBranch(node, rules, budgetSignals);
  const pruned = node.status === "pruned";
  const pinned = node.status === "pinned";
  const nodeAssumptions = assumptionsForNode(node, assumptions);

  return (
    <article
      data-node-id={node.id}
      role="treeitem"
      className={`tree-node ${selected ? "tree-node--selected" : ""} ${pinned ? "tree-node--pinned" : ""} ${
        pruned ? "tree-node--pruned" : ""
      } ${node.stale ? "tree-node--stale" : ""} ${node.locked ? "tree-node--locked" : ""} ${
        !active && !pinned ? "tree-node--inactive" : ""
      }`}
    >
      <button type="button" className="tree-node__body" onClick={() => onSelect(node)} aria-pressed={selected}>
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="tree-node__state">
            {pinned ? <Check className="size-3" /> : favored ? <Star className="size-3 fill-current" /> : null}
            {stateLabel(node, favored, labels)}
          </span>
          <span className="tree-node__score">{annotations.fit}%</span>
        </div>
        {pruned ? (
          <h3>{node.title}</h3>
        ) : (
          <>
            <div className="tree-node__lead">
              <BranchThumb node={node} />
              <div>
                <h3>{node.title}</h3>
                <p className="tree-node__summary">{node.summary}</p>
              </div>
            </div>
            <div className="tree-node__route">
              {node.cities.slice(0, 4).map((city, index) => (
                <span key={`${node.id}-${city.name}-${index}`}>
                  {index > 0 ? <ChevronRight className="size-3" /> : <MapPin className="size-3" />}
                  {city.name}
                </span>
              ))}
            </div>
            <div className="tree-node__metrics">
              <span className={riskTone[annotations.logisticsDifficulty]}>
                <Hotel className="size-3" /> {annotations.logisticsDifficulty}
              </span>
              <span className={node.estimates.pace === "Packed" ? "branch-metric--risk" : "branch-metric--neutral"}>
                <Gauge className="size-3" /> {node.estimates.pace}
              </span>
            </div>
            {nodeAssumptions.length > 0 ? (
              <div className="tree-node__assumptions" aria-label={labels.assumptions}>
                {nodeAssumptions.slice(0, 2).map((assumption) => (
                  <span
                    key={assumption.id}
                    className={
                      assumption.impact === "High" && assumption.confidence === "Low"
                        ? "assumption-chip assumption-chip--attention"
                        : "assumption-chip"
                    }
                  >
                    {assumption.locked ? <LockKeyhole className="size-3" /> : null}
                    {assumption.label}: {assumption.value}
                  </span>
                ))}
                {nodeAssumptions.length > 2 ? (
                  <span className="assumption-chip assumption-chip--more">
                    +{nodeAssumptions.length - 2} {labels.moreAssumptions}
                  </span>
                ) : null}
              </div>
            ) : null}
            {nodeAssumptions.length > 0 || node.consequences.length > 0 ? (
              <p className="tree-node__why">
                {labels.whyThisChoice} <ChevronRight className="size-3" />
              </p>
            ) : null}
            {scoreDelta && scoreDelta.from !== scoreDelta.to ? (
              <p className="tree-node__delta">
                <Sparkles className="size-3" /> {labels.scoreChange}: {scoreDelta.from} <ArrowRight className="size-3" /> {scoreDelta.to}
              </p>
            ) : null}
          </>
        )}
      </button>

      <div className="tree-node__actions">
        {pruned ? (
          <button
            type="button"
            title={labels.restore}
            aria-label={`${labels.restore}: ${node.title}`}
            disabled={controlsDisabled}
            onClick={() => onRestore(node)}
          >
            <RotateCcw className="size-4" />
          </button>
        ) : (
          <>
            <button
              type="button"
              title={favored ? labels.unfavor : labels.favor}
              aria-label={`${favored ? labels.unfavor : labels.favor}: ${node.title}`}
              aria-pressed={favored}
              disabled={controlsDisabled || pinned}
              onClick={() => onFavor(node)}
              className={favored ? "is-favored" : ""}
            >
              <Star className={`size-4 ${favored ? "fill-current" : ""}`} />
            </button>
            <button
              type="button"
              title={labels.prune}
              aria-label={`${labels.prune}: ${node.title}`}
              disabled={controlsDisabled || pinned || node.locked}
              onClick={() => onPrune(node)}
            >
              <Trash2 className="size-4" />
            </button>
            {active && !pinned ? (
              <button type="button" className="tree-node__continue" disabled={controlsDisabled} onClick={() => onContinue(node)}>
                {labels.continueHere}
                <ArrowRight className="size-4" />
              </button>
            ) : null}
          </>
        )}
      </div>
    </article>
  );
}

export function BranchExplorer({
  prompt,
  tree,
  stages,
  activeDimension,
  selectedNodeId,
  favoredIds,
  rules,
  budgetSignals,
  scoreDeltas,
  assumptions,
  expanding,
  controlsDisabled,
  maxOptionsPerLevel,
  labels,
  onSelect,
  onFavor,
  onPrune,
  onRestore,
  onContinue,
  onGenerateMore
}: BranchExplorerProps) {
  const committed = committedPath(tree);
  const activeParentId = committed[committed.length - 1]?.id ?? null;
  const parentById = new Map(tree.map((node) => [node.id, node]));
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState<TreeEdge[]>([]);

  useLayoutEffect(() => {
    const container = canvasRef.current;
    if (!container) return;
    const update = () => setEdges(computeTreeEdges(container, tree));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [tree, expanding, scoreDeltas]);

  return (
    <div
      className="planning-tree"
      aria-label={labels.liveTree}
      aria-busy={expanding}
      role="tree"
      ref={canvasRef}
    >
      <svg className="tree-connections" aria-hidden="true">
        {edges.map((edge) => (
          <path key={edge.id} className={`tree-connection tree-connection--${edge.tone}`} d={edge.d} />
        ))}
        {edges
          .filter((edge) => edge.tone === "committed")
          .map((edge) => (
            <g key={`${edge.id}-check`} className="tree-connection__check" transform={`translate(${edge.endX - 6} ${edge.endY})`}>
              <circle r="7" />
              <path d="M -2.8 0.2 L -0.8 2.2 L 3 -2.2" />
            </g>
          ))}
      </svg>
      <section className="tree-stage tree-stage--root">
        <div className="tree-stage__header">
          <span>00</span>
          <strong>{labels.root}</strong>
        </div>
        <div className="tree-root-node" data-node-id="root">
          <GitBranch className="size-5" />
          <p>{prompt}</p>
        </div>
      </section>

      {stages.map((stage, stageIndex) => {
        const level = stageIndex + 1;
        const nodes = tree.filter((node) => node.level === level);
        const isActive = activeDimension === stage;
        // Only the branches under the checkpoint being decided can be extended,
        // and only up to the cap that keeps a checkpoint readable.
        const activeSiblings = isActive
          ? nodes.filter((node) => (node.parentId ?? null) === activeParentId)
          : [];
        const canGenerateMore =
          isActive && !expanding && activeSiblings.length > 0 && activeSiblings.length < maxOptionsPerLevel;

        return (
          <section key={stage} className={`tree-stage ${isActive ? "tree-stage--active" : ""}`}>
            <div className="tree-stage__header">
              <span>{String(level).padStart(2, "0")}</span>
              <div>
                <strong>{labels.stages[stage]}</strong>
                <small>{labels.stagePrompts[stage]}</small>
              </div>
              {isActive ? <em>{expanding ? labels.exploring : labels.checkpoint}</em> : null}
            </div>

            <div className="tree-stage__nodes">
              {nodes.map((node) => {
                const parent = node.parentId ? parentById.get(node.parentId) : null;
                const onActiveFrontier = node.level === committed.length + 1 && (node.parentId ?? null) === activeParentId;
                return (
                  <div key={node.id} className="tree-node-wrap">
                    {parent && nodes.filter((item) => item.parentId === node.parentId)[0]?.id === node.id ? (
                      <p className="tree-node__parent">{labels.from} {parent.title}</p>
                    ) : null}
                    <BranchNodeCard
                      node={node}
                      active={onActiveFrontier}
                      selected={selectedNodeId === node.id}
                      favored={favoredIds.includes(node.id)}
                      assumptions={assumptions}
                      rules={rules}
                      budgetSignals={budgetSignals}
                      scoreDelta={scoreDeltas[node.id]}
                      controlsDisabled={controlsDisabled}
                      labels={labels}
                      onSelect={onSelect}
                      onFavor={onFavor}
                      onPrune={onPrune}
                      onRestore={onRestore}
                      onContinue={onContinue}
                    />
                  </div>
                );
              })}

              {isActive && expanding ? (
                <div className="space-y-2" aria-label={labels.exploring}>
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="tree-node-skeleton" />
                  ))}
                </div>
              ) : null}

              {canGenerateMore ? (
                <button
                  type="button"
                  className="tree-stage__more"
                  disabled={controlsDisabled}
                  onClick={onGenerateMore}
                >
                  <Sparkles className="size-3.5" />
                  {labels.moreOptions}
                </button>
              ) : null}

              {nodes.length === 0 && !(isActive && expanding) ? <p className="tree-stage__empty">{labels.noBranches}</p> : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AnnotationRow({ icon, label, value, agent, tone }: { icon: ReactNode; label: string; value: string; agent: string; tone?: string }) {
  return (
    <div className="annotation-row" title={agent}>
      <span className={tone}>{icon}</span>
      <div>
        <p>{label}</p>
        <small>{agent}</small>
      </div>
      <strong>{value}</strong>
    </div>
  );
}

function AssumptionControlCard({
  assumption,
  focused,
  controlsDisabled,
  labels,
  onChange,
  onViewed
}: {
  assumption: PlanningAssumption;
  focused: boolean;
  controlsDisabled: boolean;
  labels: BranchTreeLabels;
  onChange: (assumptionId: string, mutation: AssumptionMutation) => void;
  onViewed: (assumption: PlanningAssumption) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(assumption.value);
  const options = correctionOptionsFor(assumption);
  const rejected = assumption.status === "rejected";

  useEffect(() => setDraft(assumption.value), [assumption.value]);

  return (
    <article
      className={`planning-assumption ${focused ? "planning-assumption--focused" : ""} ${
        rejected ? "planning-assumption--rejected" : ""
      }`}
      onFocus={() => onViewed(assumption)}
    >
      <div className="planning-assumption__heading">
        <div>
          <strong>{assumption.label}</strong>
          <span>{labels.provenance[assumption.source]}</span>
        </div>
        <div className="planning-assumption__flags">
          <span>{assumption.confidence} {labels.confidence}</span>
          <span>{assumption.impact} {labels.impact}</span>
        </div>
      </div>
      <p className="planning-assumption__value">{assumption.value}</p>
      {assumption.consequences.length > 0 ? (
        <ul className="planning-assumption__effects">
          {assumption.consequences.slice(0, 3).map((consequence) => (
            <li key={consequence.id}>
              <ChevronRight className="size-3" />
              {consequence.label}
            </li>
          ))}
        </ul>
      ) : null}

      {editing && !rejected ? (
        <form
          className="planning-assumption__editor"
          onSubmit={(event) => {
            event.preventDefault();
            if (draft.trim() && draft.trim() !== assumption.value) {
              onChange(assumption.id, { type: "correct", value: draft.trim(), source: "user-edit" });
            }
            setEditing(false);
          }}
        >
          {options.length > 0 ? (
            <select
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              aria-label={`${labels.correctAssumption}: ${assumption.label}`}
            >
              {!options.includes(assumption.value) ? <option value={assumption.value}>{assumption.value}</option> : null}
              {options.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          ) : (
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              aria-label={`${labels.correctAssumption}: ${assumption.label}`}
            />
          )}
          <div>
            <button type="button" className="button-secondary" onClick={() => setEditing(false)}>
              {labels.cancel}
            </button>
            <button type="submit" className="button-primary" disabled={!draft.trim() || draft.trim() === assumption.value}>
              {labels.correctAssumption}
            </button>
          </div>
        </form>
      ) : (
        <div className="planning-assumption__actions">
          <button
            type="button"
            disabled={controlsDisabled || assumption.confirmed || rejected}
            onClick={() => onChange(assumption.id, { type: "confirm", source: "user-edit" })}
          >
            <Check className="size-3.5" />
            {assumption.confirmed ? labels.confirmedAssumption : labels.confirmAssumption}
          </button>
          <button type="button" disabled={controlsDisabled || rejected} onClick={() => setEditing(true)}>
            {labels.correctAssumption}
          </button>
          <button
            type="button"
            disabled={controlsDisabled || rejected}
            onClick={() => onChange(assumption.id, { type: "reject", source: "user-edit" })}
          >
            {labels.rejectAssumption}
          </button>
          <button
            type="button"
            disabled={controlsDisabled || rejected}
            aria-pressed={assumption.locked}
            onClick={() =>
              onChange(assumption.id, {
                type: "set-lock",
                locked: !assumption.locked,
                source: "user-edit"
              })
            }
          >
            {assumption.locked ? <UnlockKeyhole className="size-3.5" /> : <LockKeyhole className="size-3.5" />}
            {assumption.locked ? labels.unlockAssumption : labels.lockAssumption}
          </button>
        </div>
      )}
    </article>
  );
}

export function BranchInspector({
  node,
  alternatives,
  assumptions,
  focusedAssumptionId,
  favored,
  rules,
  budgetSignals,
  scoreDelta,
  controlsDisabled,
  labels,
  onFavor,
  onPrune,
  onRestore,
  onContinue,
  onAssumptionChange,
  onAssumptionViewed,
  onToggleDecisionLock
}: BranchInspectorProps) {
  if (!node) {
    return (
      <div className="branch-inspector__empty">
        <GitBranch className="size-5" />
        <h2>{labels.chooseBranch}</h2>
        <p>{labels.selectedBranch}</p>
      </div>
    );
  }

  const annotations = annotationsForBranch(node, rules, budgetSignals);
  const isPruned = node.status === "pruned";
  const isPinned = node.status === "pinned";
  const nodeAssumptions = assumptionsForNode(node, assumptions, true);

  return (
    <div className="branch-inspector">
      <div className="branch-inspector__heading">
        <BranchThumb node={node} />
        <span>{stateLabel(node, favored, labels)}</span>
        <h2>{node.title}</h2>
        <p>{node.summary}</p>
      </div>

      <div className="branch-inspector__annotations">
        <AnnotationRow
          icon={<GitBranch className="size-4" />}
          label={labels.routeFit}
          value={scoreDelta ? `${scoreDelta.from} -> ${annotations.fit}%` : `${annotations.fit}%`}
          agent={labels.agentNames.route}
          tone="annotation-icon--route"
        />
        <AnnotationRow
          icon={<CircleDollarSign className="size-4" />}
          label={labels.budgetRisk}
          value={annotations.budgetRisk}
          agent={labels.agentNames.budget}
          tone={annotations.budgetRisk === "High" ? "annotation-icon--risk" : "annotation-icon--budget"}
        />
        <AnnotationRow
          icon={<Hotel className="size-4" />}
          label={labels.logistics}
          value={annotations.logisticsDifficulty}
          agent={labels.agentNames.logistics}
          tone="annotation-icon--logistics"
        />
        <AnnotationRow
          icon={<Gauge className="size-4" />}
          label={labels.paceLoad}
          value={annotations.pace}
          agent={labels.agentNames.pace}
          tone={annotations.pace === "Packed" ? "annotation-icon--risk" : "annotation-icon--pace"}
        />
      </div>

      <section className="branch-inspector__section">
        <h3>{labels.cities}</h3>
        <div className="inspector-route">
          {node.cities.map((city, index) => (
            <span key={`${node.id}-inspector-${city.name}-${index}`}>
              {index > 0 ? <ChevronRight className="size-3" /> : null}
              {city.name} <small>{city.nights}{labels.nights}</small>
            </span>
          ))}
        </div>
        <p className="inspector-facts">
          {node.estimates.transferHours}h {labels.transfers} · {node.estimates.moveCount} {labels.hotelChanges}
        </p>
      </section>

      <details
        className="branch-inspector__why"
        open={Boolean(focusedAssumptionId || node.stale) || undefined}
        onToggle={(event) => {
          if (event.currentTarget.open && nodeAssumptions[0]) onAssumptionViewed(nodeAssumptions[0]);
        }}
      >
        <summary>
          <span>{labels.whyThisChoice}</span>
          <ChevronRight className="size-4" />
        </summary>
        <div className="branch-inspector__why-content">
          <section>
            <h3>{labels.decision}</h3>
            <strong>{node.title}</strong>
            <p>{node.summary}</p>
          </section>
          <section>
            <h3>{labels.tradeoff}</h3>
            <p>{annotations.tradeoff}</p>
          </section>
          {nodeAssumptions.length > 0 ? (
            <section>
              <h3>{labels.assumptions}</h3>
              <div className="planning-assumption-list">
                {nodeAssumptions.map((assumption) => (
                  <AssumptionControlCard
                    key={assumption.id}
                    assumption={assumption}
                    focused={focusedAssumptionId === assumption.id}
                    controlsDisabled={controlsDisabled}
                    labels={labels}
                    onChange={onAssumptionChange}
                    onViewed={onAssumptionViewed}
                  />
                ))}
              </div>
            </section>
          ) : null}
          {node.consequences.length > 0 ? (
            <section>
              <h3>{labels.consequences}</h3>
              <ul className="decision-consequences">
                {node.consequences.map((consequence) => (
                  <li key={consequence.id}>
                    <ChevronRight className="size-3.5" />
                    <span>{consequence.label}<small>{consequence.affectedArea}</small></span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {alternatives.length > 0 ? (
            <section>
              <h3>{labels.alternatives}</h3>
              <div className="decision-alternatives">
                {alternatives.slice(0, 3).map((alternative) => (
                  <span key={alternative.id}>{alternative.title}</span>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </details>

      <div className="branch-inspector__actions">
        {isPruned ? (
          <button type="button" className="button-secondary" disabled={controlsDisabled} onClick={() => onRestore(node)}>
            <RotateCcw className="size-4" /> {labels.restore}
          </button>
        ) : (
          <>
            <button type="button" className="button-secondary" disabled={controlsDisabled || isPinned} onClick={() => onFavor(node)}>
              <Star className={`size-4 ${favored ? "fill-current" : ""}`} /> {favored ? labels.unfavor : labels.favor}
            </button>
            <button type="button" className="button-danger" disabled={controlsDisabled || isPinned || node.locked} onClick={() => onPrune(node)}>
              <Trash2 className="size-4" /> {labels.prune}
            </button>
            {!isPinned ? (
              <button type="button" className="button-primary" disabled={controlsDisabled} onClick={() => onContinue(node)}>
                {labels.continueHere} <ArrowRight className="size-4" />
              </button>
            ) : null}
            {isPinned ? (
              <button
                type="button"
                className="button-secondary"
                disabled={controlsDisabled}
                aria-pressed={node.locked}
                onClick={() => onToggleDecisionLock(node)}
              >
                {node.locked ? <UnlockKeyhole className="size-4" /> : <LockKeyhole className="size-4" />}
                {node.locked ? labels.unlockDecision : labels.lockDecision}
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
