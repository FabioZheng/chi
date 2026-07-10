"use client";

import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronRight,
  CircleDollarSign,
  GitBranch,
  Gauge,
  Hotel,
  MapPin,
  RotateCcw,
  Sparkles,
  Star,
  Trash2
} from "lucide-react";
import { branchBudgetRisk } from "@/agents/branchScoring";
import type { BranchDimension, PlanNode } from "@/types/travel";

export type BranchTreeLabels = {
  root: string;
  liveTree: string;
  stages: Record<BranchDimension, string>;
  stagePrompts: Record<BranchDimension, string>;
  checkpoint: string;
  exploring: string;
  noBranches: string;
  selectedBranch: string;
  chooseBranch: string;
  routeFit: string;
  budgetRisk: string;
  logistics: string;
  paceLoad: string;
  tradeoff: string;
  assumptions: string;
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
  expanding: boolean;
  controlsDisabled: boolean;
  labels: BranchTreeLabels;
  onSelect: (node: PlanNode) => void;
  onFavor: (node: PlanNode) => void;
  onPrune: (node: PlanNode) => void;
  onRestore: (node: PlanNode) => void;
  onContinue: (node: PlanNode) => void;
};

type BranchInspectorProps = {
  node: PlanNode | null;
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
};

const riskTone = {
  Low: "branch-metric--good",
  Medium: "branch-metric--watch",
  High: "branch-metric--risk"
} as const;

function normalized(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ");
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

  return (
    <article
      className={`tree-node ${selected ? "tree-node--selected" : ""} ${pinned ? "tree-node--pinned" : ""} ${
        pruned ? "tree-node--pruned" : ""
      } ${!active && !pinned ? "tree-node--inactive" : ""}`}
    >
      <button type="button" className="tree-node__body" onClick={() => onSelect(node)} aria-pressed={selected}>
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="tree-node__state">
            {pinned ? <Check className="size-3" /> : favored ? <Star className="size-3 fill-current" /> : null}
            {stateLabel(node, favored, labels)}
          </span>
          <span className="tree-node__score">{annotations.fit}%</span>
        </div>
        <h3>{node.title}</h3>
        {pruned ? null : (
          <>
            <p className="tree-node__summary">{node.summary}</p>
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
          <button type="button" title={labels.restore} disabled={controlsDisabled} onClick={() => onRestore(node)}>
            <RotateCcw className="size-4" />
          </button>
        ) : (
          <>
            <button
              type="button"
              title={favored ? labels.unfavor : labels.favor}
              aria-pressed={favored}
              disabled={controlsDisabled || pinned}
              onClick={() => onFavor(node)}
              className={favored ? "is-favored" : ""}
            >
              <Star className={`size-4 ${favored ? "fill-current" : ""}`} />
            </button>
            <button type="button" title={labels.prune} disabled={controlsDisabled || pinned} onClick={() => onPrune(node)}>
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
  expanding,
  controlsDisabled,
  labels,
  onSelect,
  onFavor,
  onPrune,
  onRestore,
  onContinue
}: BranchExplorerProps) {
  const committed = committedPath(tree);
  const activeParentId = committed[committed.length - 1]?.id ?? null;
  const parentById = new Map(tree.map((node) => [node.id, node]));

  return (
    <div className="planning-tree" aria-label={labels.liveTree}>
      <section className="tree-stage tree-stage--root">
        <div className="tree-stage__header">
          <span>00</span>
          <strong>{labels.root}</strong>
        </div>
        <div className="tree-root-node">
          <GitBranch className="size-5" />
          <p>{prompt}</p>
        </div>
      </section>

      {stages.map((stage, stageIndex) => {
        const level = stageIndex + 1;
        const nodes = tree.filter((node) => node.level === level);
        const isActive = activeDimension === stage;

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

export function BranchInspector({
  node,
  favored,
  rules,
  budgetSignals,
  scoreDelta,
  controlsDisabled,
  labels,
  onFavor,
  onPrune,
  onRestore,
  onContinue
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

  return (
    <div className="branch-inspector">
      <div className="branch-inspector__heading">
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

      <section className="branch-inspector__section">
        <h3>{labels.tradeoff}</h3>
        <p>{annotations.tradeoff}</p>
      </section>

      {node.implicitAssumptions.length > 0 ? (
        <section className="branch-inspector__section">
          <h3>{labels.assumptions}</h3>
          <ul>
            {node.implicitAssumptions.slice(0, 4).map((assumption) => (
              <li key={assumption}>
                <AlertTriangle className="size-3.5" />
                {assumption}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
            <button type="button" className="button-danger" disabled={controlsDisabled || isPinned} onClick={() => onPrune(node)}>
              <Trash2 className="size-4" /> {labels.prune}
            </button>
            {!isPinned ? (
              <button type="button" className="button-primary" disabled={controlsDisabled} onClick={() => onContinue(node)}>
                {labels.continueHere} <ArrowRight className="size-4" />
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
