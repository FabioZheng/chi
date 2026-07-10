# TripTree: Branch-Visible, Checkpoint-Based, Interruptible Travel Planning

## Research and Implementation Documentation

**Document status:** implementation-grounded research specification
**System:** TripTree, a Next.js and TypeScript research prototype
**Scope:** the default branch-visible interface, its active server routes, retained legacy routes, and a proposed evaluation program
**Last implementation audit:** 10 July 2026

This document deliberately separates three kinds of statement:

- **Implemented** describes behavior directly present in the repository.
- **Interpretation** explains the research meaning of implemented behavior without asserting an empirical effect.
- **Proposed** describes future engineering or evaluation work that is not currently implemented.

This distinction is essential. TripTree is a functional research prototype, not evidence that branch-visible planning improves travel outcomes. Its effects on control, workload, preference discovery, trust, or plan quality remain hypotheses until they are tested.

## Abstract

Conventional conversational travel planners often treat itinerary generation as an opaque transaction: the traveler submits a prompt, waits for a complete plan, and only then discovers assumptions embedded in route choice, city allocation, pacing, accommodation changes, and activity density. Correcting those assumptions commonly requires a new prompt and an opaque regeneration.

TripTree investigates a different interaction model. The planner exposes a shared structural planning tree before producing a detailed itinerary. At four ordered decision stages—Route, Pace, Trip style, and Logistics—the system proposes candidate branches, pauses at a visible decision checkpoint, and allows the traveler to inspect, favor, prune, restore, or commit a branch. The traveler may also interrupt an active request, add a newly realized trip rule, and request repair from the earliest heuristically affected stage.

The implemented system is batch-visible rather than token-streaming: candidate nodes appear after each branch-generation request completes. Interruption aborts the client request and preserves previously visible state, but it does not preserve partial model output or guarantee cancellation at the upstream provider. Checkpoints are partial browser-local snapshots, and repair is a heuristic rewind-and-regenerate procedure rather than dependency-complete incremental recomputation.

The research contribution is therefore an inspectable interaction and state model for intervening before itinerary commitment. The system operationalizes a shift from “receive and correct a finished plan” toward “compare, interrupt, and steer an emerging structural plan.” This document formalizes that model, specifies the exact implemented algorithms, identifies active and dormant agents, and defines a rigorous evaluation program for generation controllability.

## 1. Research Motivation

Travel planning is a preference-construction problem as well as a preference-expression problem. A traveler may not know that Bologna is important until comparing alternative Italian routes, or may only recognize an aversion to hotel changes after seeing a fast multi-city branch beside a hub-based branch. Research on constructive choice argues that preferences can be assembled in response to the alternatives and task context rather than retrieved as fixed, complete values [4].

This creates a timing problem for generative planners. A full itinerary commits many high-impact variables before the user encounters the comparisons that make those variables meaningful. Reprompting after generation provides control, but only after substantial structure has already been selected and generated. It also obscures which work was retained, invalidated, or regenerated.

TripTree treats intermediate alternatives as an interaction surface. Its design draws on mixed-initiative interaction [1], human-AI interaction guidelines concerning visibility, correction, and user control [2], and interactive machine learning work in which user feedback modifies an evolving computational artifact [3]. These references motivate the design; they do not validate TripTree's specific interface.

### 1.1 Related planning and controllability research

TripTree is closest in interaction spirit to mixed-initiative planning systems that let people contrast alternatives and revise plans. RADAR-X, for example, couples user-specified foils with contrastive explanations and revised plan suggestions to elicit latent preferences [14]. TripTree differs by exposing a staged shared branch tree and by treating interruption and checkpoint repair as first-class controls; it does not yet provide RADAR-X-style formal contrastive explanations.

Plan-grounded LLM research studies conversations in which a model must follow a procedural plan while adapting to new user instructions [15]. TripTree uses a related separation between a structural skeleton and later natural-language realization, but its four-stage skeleton and repair policy are application-specific heuristics, not an implementation or evaluation of PlanLLM.

Recent controllability benchmarks show the importance of evaluating control at multiple behavioral granularities rather than treating steering as a single binary property [16]. Accordingly, the proposed TripTree evaluation separates target change, invariant preservation, repair locality, preference timing, and human workload. These measures are proposed adaptations for planning-state control; the current prototype has not been evaluated on SteerEval or SteerBench.

## 2. Research Questions

The central research question is:

> How can a generative travel planner expose meaningful intermediate alternatives and support interruption, steering, and localized repair before detailed itinerary commitment, while keeping cognitive and interaction costs acceptable?

The system supports five subordinate questions:

1. **Preference timing:** Does comparing structural branches help travelers articulate consequential preferences earlier?
2. **Controllability:** Can users reliably cause intended changes while preserving constraints they did not change?
3. **Repair locality:** How much previously developed planning state can be retained after a new rule?
4. **Legibility:** Do branch-level annotations improve decisions without producing false impressions of certainty or agent independence?
5. **Efficiency:** How do branch generation, checkpoint interaction, and repair affect time, model calls, tokens, and perceived workload relative to full-plan-and-reprompt interaction?

## 3. Contributions and Non-Claims

### 3.1 Implemented contributions

- One shared planning tree instead of a separate tree or status panel for each agent.
- Four ordered structural decision stages before detailed itinerary generation.
- Visible sibling alternatives with commit, favor, prune, and restore controls.
- Automatic decision snapshots after completed branch batches and manual snapshots on pause.
- Browser-side interruption using AbortController.
- Editable trip rules that trigger heuristic stage classification, rewind, rescoring, pruning, and branch regeneration.
- A committed structural skeleton passed to the final Planner Agent as a hard contract.
- Deterministic early estimates for transfer burden, budget band, pace, logistics difficulty, and rule fit.
- Structured provider outputs validated with Zod.
- A final feasibility pipeline that combines LLM review, deterministic checks, and optional Google route enrichment.

### 3.2 Explicit non-claims

TripTree does **not** currently implement:

- token-level or node-level progressive streaming;
- preservation of partial output from an interrupted provider response;
- guaranteed upstream provider cancellation;
- complete checkpoint restoration of every workspace field;
- semantic dependency tracking or provably minimal recomputation;
- true continuation inside an interrupted model call;
- live verification of fares, room inventory, tickets, schedules, or opening hours;
- independent branch-level Route Fit, Budget, Logistics, and Pace agents;
- server-backed, cross-device, or collaborative checkpoints;
- active research telemetry in the default interface;
- empirical evidence that the design improves outcomes.

## 4. System Overview

**Figure 1. Implemented end-to-end workflow**

~~~mermaid
flowchart LR
  U["Traveler prompt"] --> E["Branch expansion request"]
  E --> B["Branch Explorer Agent"]
  B --> V["Zod validation"]
  V --> S["Distinctness and deterministic estimates"]
  S --> C["Visible decision checkpoint"]
  C -->|Commit| N["Next structural stage"]
  N --> E
  C -->|Favor, prune, or restore| C
  C -->|Add trip rule| R["Heuristic rewind and repair"]
  R --> E
  C -->|Pause active request| P["Partial local checkpoint"]
  P -->|Resume| E
  C -->|Four stages committed| F["Final itinerary request"]
  F --> Q["Planning and feasibility pipeline"]
  Q --> I["Itinerary view"]
  I -->|Adjust at checkpoint| C
~~~

The branch sequence is fixed:

1. **Route** maps to the internal dimension **tripShape**.
2. **Pace** maps to **rhythm**.
3. **Trip style** maps to **anchors**.
4. **Logistics** maps to **logistics**.
5. **Itinerary** is generated only after a valid four-node committed path exists.

The fixed order reduces implementation complexity and gives each branch a complete inherited skeleton. It also constrains the research question: the current prototype studies intervention within one stage ordering, not arbitrary planning graphs.

## 5. Formal Planning Model

### 5.1 Ordered dimensions

Let the ordered structural dimensions be:

~~~text
D = [tripShape, rhythm, anchors, logistics]
~~~

Each dimension has level:

~~~text
level(tripShape) = 1
level(rhythm) = 2
level(anchors) = 3
level(logistics) = 4
~~~

### 5.2 Planning graph

At time t, the visible planning structure is a rooted directed graph:

~~~text
G_t = (V_t, E_t)
~~~

Each node v is a tuple:

~~~text
v = (
  id,
  parentId,
  level,
  dimension,
  title,
  summary,
  durationDays,
  movementPattern,
  register,
  anchors,
  cities,
  implicitAssumptions,
  revealedPreference,
  estimates,
  confidence,
  status,
  sourceAgent
)
~~~

The node status is one of:

~~~text
status(v) in {candidate, pinned, pruned}
~~~

The user-facing term **Committed** corresponds to the stored status **pinned**. Favoring is not a node status. It is a separate set of node identifiers.

An edge exists when a node names another visible node as its parent:

~~~text
(u, v) in E_t iff v.parentId = u.id
~~~

Although the interface displays the structure in stage columns, it retains parent identifiers and can contain nodes from historical, incompatible paths. The implementation is therefore a tree-shaped version history under normal generation, not a guarantee that every displayed node belongs to the current active path.

### 5.3 Full structural skeleton

Each generated node carries the complete structural state at that point:

~~~text
Skeleton(v) = (
  durationDays,
  ordered cities with nights,
  movementPattern,
  register,
  anchors
)
~~~

This denormalization is intentional. A later node can be passed directly to the final planner without replaying every earlier model response. It also means inherited fields may be restated by the Branch Explorer Agent at every level.

### 5.4 Committed-path invariant

Let P_t be the committed path. The implementation:

1. selects every pinned node;
2. sorts them by level;
3. starts with an empty path;
4. appends a node only if its parent is the last appended node, or null for the first node.

Thus:

~~~text
P_t = [p_1, ..., p_k]

p_1.parentId = null
p_i.parentId = p_(i-1).id for i > 1
level(p_i) = i
status(p_i) = pinned
~~~

Pinned nodes that do not form this chain are ignored by committed-path computation. User actions are designed to prevent such inconsistency, but the persisted workspace is not fully schema-validated on reload.

### 5.5 Active frontier

For a committed path of length k:

~~~text
activeLevel = k + 1
activeParent = id(p_k), or null when k = 0

Frontier(G_t) = {
  v in V_t :
  v.level = activeLevel
  and v.parentId = activeParent
}
~~~

Only frontier candidates receive a **Continue here** action. Historical nodes remain inspectable.

### 5.6 Workspace state

The implemented browser workspace is:

~~~text
W_t = (
  version,
  language,
  draftPrompt,
  sessionPrompt,
  tree,
  tripRules,
  favoredNodeIds,
  selectedNodeId,
  activeDimension,
  checkpointSnapshots,
  itinerary,
  warnings,
  selectedOptionId,
  view,
  generationStatus,
  activity
)
~~~

The generation status is:

~~~text
idle | generating | checkpoint | paused | repairing |
ready | planning | complete | error
~~~

Score deltas, current rationale, error text, and an unfinished steering draft exist in React state but are not included in the persisted workspace.

### 5.7 Checkpoint snapshot

An implemented checkpoint is a partial snapshot:

~~~text
C_i = (
  id,
  label,
  dimension,
  createdAt,
  tree,
  tripRules
)
~~~

At most eight snapshots are retained. When a ninth is added, the oldest is removed.

This is narrower than the full workspace. Restoring a checkpoint restores its tree, rules, and active dimension; selects a current frontier node when possible; clears score deltas; switches to tree view; and sets status to checkpoint or ready. It does not restore favorites, the prior selected node, rationale, itinerary, warnings, activity status, or view. Consequently, “checkpoint restoration” in this document means restoration of the stored structural scope, not exact restoration of the entire interface.

**Figure 2. Implemented workspace state machine**

~~~mermaid
stateDiagram-v2
  [*] --> Idle
  Idle --> Generating: "Submit prompt"
  Generating --> Checkpoint: "Branch batch completed"
  Generating --> Paused: "Pause and abort client request"
  Generating --> Error: "Provider or validation failure"
  Checkpoint --> Generating: "Commit branch"
  Checkpoint --> Repairing: "Add or remove trip rule"
  Checkpoint --> Checkpoint: "Favor, prune, or restore"
  Repairing --> Checkpoint: "Replacement frontier completed"
  Repairing --> Paused: "Pause and abort client request"
  Repairing --> Error: "Repair request failed"
  Checkpoint --> Ready: "Commit logistics branch"
  Ready --> Planning: "Build itinerary"
  Planning --> Complete: "Itinerary completed"
  Planning --> Paused: "Pause and abort client request"
  Planning --> Error: "Planning failed"
  Paused --> Checkpoint: "Resume when candidates already exist"
  Paused --> Generating: "Resume incomplete frontier"
  Paused --> Planning: "Resume with complete committed path"
  Complete --> Ready: "Adjust at checkpoint"
  Error --> Generating: "Retry branch request"
  Error --> Planning: "Retry final request"
  Checkpoint --> Checkpoint: "Restore stored snapshot"
  Ready --> Checkpoint: "Restore earlier snapshot"
~~~

## 6. Shared Tree Semantics

**Figure 3. Example shared tree and one valid committed path**

~~~mermaid
flowchart LR
  R["Trip idea"] --> A["Route A: candidate"]
  R --> B["Route B: committed"]
  R --> C["Route C: pruned"]
  B --> D["Pace A: committed"]
  B --> E["Pace B: candidate"]
  D --> F["Style A: committed"]
  D --> G["Style B: candidate"]
  F --> H["Logistics A: candidate"]
  F --> I["Logistics B: favored"]
  C -. "Historical branch remains visible" .-> X["Pruned descendant"]
~~~

### 6.1 Commit

When the traveler chooses **Continue here** on node v:

- v and all of its ancestors become pinned;
- pinned nodes not on that ancestor path become candidates;
- deeper nodes not descended from v become pruned;
- score deltas are cleared;
- if v is level four, the workspace becomes ready and stores a ready checkpoint;
- otherwise the next branch dimension is requested.

This operation changes structural commitment. It is the principal positive control action.

### 6.2 Favor

Favoring toggles membership in a browser-side set of node IDs.

Favoring does **not**:

- change a node’s stored status;
- affect branch fit;
- influence the Branch Explorer prompt;
- change automatic selection;
- commit the node;
- alter final itinerary generation.

It is a visual bookmark only. Research documents and study materials must not describe favoring as a preference-learning signal unless a later implementation actually consumes it.

### 6.3 Prune

Pruning is disabled for pinned nodes. Pruning a candidate:

- sets that node to pruned;
- sets every visible descendant to pruned;
- removes the selected node itself from favorites;
- leaves unrelated parts of the tree unchanged;
- selects another candidate on the active frontier when available.

Pruned nodes are retained as history. Exact pruned titles at the active parent are later sent as exclusions. The Branch Explorer prompt also asks the model to avoid close variants, but the server enforces only an exact lowercase-and-trimmed title exclusion.

### 6.4 Restore

Restoring changes only the selected pruned node back to candidate. Its descendants remain pruned. Restoration does not reinstate a previously committed path or automatically regenerate children.

### 6.5 Automatic selection

After a frontier is returned, the candidate with the highest deterministic branch-fit score is selected in the inspector. It is not committed automatically. The user remains responsible for commitment.

## 7. Branch Expansion

### 7.1 Request

The client sends:

- original session prompt;
- current dimension;
- current parent;
- valid committed path;
- exact titles of pruned siblings at that frontier;
- optional steering guidance;
- explicit rules and branch choices converted to learned-preference objects;
- empty legacy probe answers;
- null legacy memory;
- output language.

The expansion request has a 110-second browser timeout.

### 7.2 Branch Explorer Agent

The Branch Explorer Agent is an LLM call with temperature 0.5. Its prompt requests two to four structurally distinct candidates and instructs each candidate to carry the full skeleton.

The output schema accepts one to five candidates. The server returns at most four after filtering. Therefore, a valid implementation response can contain fewer than the two candidates requested by the prompt, especially after distinctness or exclusion filtering.

For Route, candidates should differ in city set, direction, register, or movement pattern. For later stages, the prompt asks the agent to retain earlier commitments while varying:

- night allocation and recovery shape for Pace;
- experience anchors for Trip style;
- hotel changes and transfer strategy for Logistics.

### 7.3 Structural validation

All provider output passes through a Zod schema. Preprocessors normalize common field variants, convert confidence to the zero-to-one interval, normalize coordinates, and provide selected fallbacks. This protects the client against malformed structure, but it does not establish factual correctness.

### 7.4 Route-level distinctness

Distinctness filtering runs only for Route. Let C_i be the lowercase trimmed city-name set of candidate i. For candidate i and an already accepted candidate j:

~~~text
Jaccard(C_i, C_j) =
  size(intersection(C_i, C_j)) /
  size(union(C_i, C_j))
~~~

Candidate i is accepted only if:

~~~text
Jaccard(C_i, C_j) <= 0.60
~~~

for every previously accepted candidate j.

The filter is greedy and order-dependent. Empty city sets fall back to exact title inequality. Deeper stages intentionally share city sets and are not filtered by this rule.

### 7.5 Node construction

For each retained candidate:

- a deterministic ID is formed from parent ID, dimension, title slug, and response index;
- parent ID and level are attached;
- duration is forced to the parent duration at deeper stages;
- deterministic estimates are computed;
- status is candidate;
- source agent is Branch Explorer Agent.

IDs are stable only relative to the same parent, title, ordering, and slug behavior. They are not global immutable content hashes.

**Figure 4. Branch expansion sequence**

~~~mermaid
sequenceDiagram
  actor U as Traveler
  participant UI as TripTree client
  participant API as Expand API
  participant LLM as Branch Explorer Agent
  participant Z as Zod schemas
  participant D as Deterministic scoring

  U->>UI: "Commit branch or start trip"
  UI->>API: "Prompt, path, rules, exclusions, dimension"
  API->>Z: "Validate request"
  Z-->>API: "Typed request"
  API->>LLM: "Request full-skeleton candidates"
  LLM-->>API: "JSON candidate batch"
  API->>Z: "Normalize and validate output"
  Z-->>API: "One to five candidates"
  API->>API: "Route Jaccard filter and exact-title exclusions"
  API->>D: "Compute estimates"
  D-->>API: "Transfer, budget, moves, pace"
  API-->>UI: "Zero to four nodes, rationale, trace"
  UI->>UI: "Replace non-pruned frontier and store checkpoint"
  UI-->>U: "Show complete candidate batch"
~~~

The response schema permits an empty node array after server filtering. The current UI would display an empty frontier rather than automatically recovering with a relaxed filter.

## 8. Deterministic Branch Evaluation

These calculations support immediate comparison. They are heuristics, not calibrated predictions.

### 8.1 Transfer distance

For two coordinates, the implementation uses the Haversine great-circle distance with Earth radius 6,371 km.

For a linear route:

~~~text
transferKm =
  sum of Haversine distance between consecutive located cities
~~~

For a movement pattern whose text contains a hub-like term:

~~~text
transferKm =
  sum over every spoke of
  2 × Haversine(first city, spoke city)
~~~

Cities without coordinates are omitted. When fewer than two located cities remain, transfer distance is zero.

### 8.2 Transfer time and move count

~~~text
transferHours = round_to_1_decimal(transferKm / 80)
moveCount = max(0, numberOfCities - 1)
~~~

The 80 km/h rate is a coarse mixed regional-travel assumption. It does not model waiting, airport access, rail schedules, traffic, or transfer reliability.

### 8.3 Budget cap

A lexical budget signal selects a daily reference cap:

| Signal | Daily cap |
|---|---:|
| luxury, premium, high-end, five-star | €400 |
| budget, cheap, low-cost, backpack, hostel, frugal, affordable | €90 |
| mid-range, moderate, comfortable | €180 |
| no recognized signal | €160 |

For a candidate of d days:

~~~text
baseCost = d × dailyCap
transferCost = moveCount × 35

budgetBandMin =
  round_to_nearest_10(0.70 × baseCost + transferCost)

budgetBandMax =
  round_to_nearest_10(1.25 × baseCost + 1.50 × transferCost)
~~~

This band is a comparison heuristic derived partly from the traveler’s own lexical budget category. It is not a market price estimate.

### 8.4 Budget risk

~~~text
perDayMidpoint =
  (budgetBandMin + budgetBandMax) /
  (2 × max(1, durationDays))
~~~

Risk is:

- High when per-day midpoint exceeds 130% of the cap;
- Medium when it exceeds the cap but not 130%;
- Low otherwise.

### 8.5 Pace

~~~text
movesPerDay = moveCount / max(1, durationDays)
shortestStay = minimum city nights
~~~

Pace is:

- Packed when moves per day exceed 0.45, or when at least three cities include a stay of one night or less;
- Relaxed when moves per day are below 0.20 and there are at most two cities;
- Balanced otherwise.

### 8.6 Logistics difficulty

The branch inspector classifies:

- High when move count is at least three or transfer hours are at least eight;
- Medium when move count is at least two or transfer hours are at least four;
- Low otherwise.

### 8.7 Route-fit score

Let c be the model-reported confidence. The base score is:

~~~text
baseFit = 62 + round(30 × c)
~~~

Rule adjustments are:

| Detected rule signal | Adjustment |
|---|---:|
| slower pace and Relaxed branch | +9 |
| slower pace and Balanced branch | +2 |
| slower pace and Packed branch | -24 |
| fewer hotels and at most one move | +10 |
| fewer hotels and at least three moves | -22 |
| budget signal and High budget risk | -18 |
| local-style signal and matching branch text | +8 |
| each capitalized place token present in branch text | +8 |

The result is clamped:

~~~text
fit = min(98, max(18, baseFit + adjustments))
~~~

Recognized signals are lexical and primarily English with selected Chinese phrases. Capitalized-place extraction uses a simple English-name pattern. The score is therefore language-sensitive, not probabilistically calibrated, and partly dependent on the Branch Explorer’s self-reported confidence.

### 8.8 Trade-off annotation

The inspector derives one English trade-off sentence:

- Packed branches emphasize variety at the cost of recovery;
- one-move-or-less branches emphasize fewer hotel changes at the cost of range;
- other branches describe a balance between range and hotel changes.

This annotation is deterministic and is currently not fully localized for Chinese output.

### 8.9 Agent-label qualification

The interface attributes these rows to Route Mobility Agent (route fit and logistics), Budget Manager Agent, and Pace Feasibility Agent. Those names also identify components in the final-plan pipeline, but the branch-time values are not outputs from independently invoked copies of those components. They are views over the formulas above, primarily in the BranchExplorer component and branch-scoring helpers.

This distinction matters for research on trust. Multiple labels could cause users to infer independent corroboration where none exists. Any evaluation must disclose or manipulate this attribution intentionally.

## 9. Checkpoints, Interruption, and Resume

### 9.1 Automatic checkpoint

After a complete branch batch is received:

- the frontier is inserted;
- the highest-fit node is selected for inspection;
- status becomes checkpoint;
- the agent rationale is shown;
- a snapshot of the resulting tree and active rules is added.

Generation is not paused inside a single model response. The checkpoint occurs between completed requests.

### 9.2 Manual pause

Pause is available while status is generating, repairing, or planning. It:

1. increments a request ID so late responses are ignored;
2. aborts the current browser AbortController;
3. sets status to paused;
4. adds a partial checkpoint of the currently visible tree and rules.

The visible state generally corresponds to the last completed batch. Partial candidate JSON is not available to the client.

### 9.3 Cancellation boundary

The client distinguishes a caller abort from a timeout:

- a caller abort raises an AbortError interpreted as a pause;
- branch expansion times out in the browser after 110 seconds;
- final planning times out in the browser after 270 seconds;
- each LLM-provider fetch has an independent 105-second server-side timeout.

The Next.js request signal is propagated through the active expansion and planning routes into LLM-provider fetches and Google geocoding and routing fetches. The Vercel configuration opts the App Router API functions into platform request cancellation. A user pause therefore aborts the browser request and requests cancellation of active downstream fetches. This is real cancellation propagation at the HTTP request layer, but it still does not prove that an upstream provider stops computation after accepting a request. No provider-specific cancellation acknowledgement, durable job ID, or resumable job is implemented.

### 9.4 Resume

Resume is conditional:

- if a complete four-node committed path exists, final itinerary generation starts again;
- if the active frontier already contains a candidate, status returns to checkpoint without a new request;
- otherwise a new branch expansion request starts from the visible tree.

Thus resume means “continue from the preserved visible planning state,” not “continue decoding the interrupted response.”

### 9.5 Reload recovery

The whole persisted workspace is stored in browser localStorage. On reload, a status that had been generating, repairing, or planning is converted to paused. No request is automatically reissued.

**Figure 5. Persistence and cancellation boundaries**

~~~mermaid
flowchart TB
  subgraph Browser["Browser"]
    W["React workspace"]
    L["localStorage workspace"]
    C["Checkpoint list with at most eight partial snapshots"]
    A["AbortController"]
  end
  subgraph Server["Vercel or Next.js server"]
    R["Dynamic API route"]
  end
  subgraph Provider["External provider"]
    M["OpenRouter or OpenAI request"]
  end

  W --> L
  W --> C
  W --> A
  A -. "Stops browser fetch" .-> R
  R -->|"Propagates request abort signal"| M
  A -. "No provider cancellation acknowledgement" .-> M
  L -->|"Reload active work as paused"| W
  C -->|"Restore tree, rules, and dimension only"| W
~~~

## 10. Steering and Repair

### 10.1 Explicit trip rules

A rule contains:

~~~text
(id, value, category, createdAt)
~~~

Rules are shown as editable chips and are passed to branch generation and final itinerary generation. Branch choices with a non-null revealed preference are also converted to learned-preference objects.

### 10.2 Lexical category classification

The client assigns rule categories using keyword patterns:

- budget terms → budget;
- slow, pace, rush, rest, relax → pace;
- food, restaurant, market, cuisine → food;
- train, car, flight, transport, transfer → transport;
- walk or mobility → walking tolerance;
- hotel, stay, base, accommodation → accommodation area;
- local, tourist, authentic → touristy/local style;
- museum, art, nature, beach, history, interest → interests;
- otherwise → other.

Selected Chinese keywords are included. The parser is not a semantic model and can misclassify negation, multi-intent rules, synonyms, names, or other languages.

### 10.3 Earliest affected stage

The requested zero-based rewind stage is:

| Rule class | Stage |
|---|---:|
| budget, include, must, city, cities, route | 0: Route |
| pace, walking tolerance | 1: Pace |
| food, interests, touristy/local style | 2: Trip style |
| transport, accommodation area | 3: Logistics |
| other | 2: Trip style |

The actual rewind is bounded by the currently committed path:

~~~text
actualStage = min(requestedStage, committedPathLength)
affectedLevel = actualStage + 1
~~~

If the requested stage has not yet been reached, repair operates at the current frontier. This can cause a pace rule entered at the initial Route checkpoint to regenerate Route rather than waiting for Pace.

### 10.4 Incompatibility rules

Among non-pruned siblings at the affected frontier, a node is marked incompatible when:

- the rule text mentions a city present among sibling candidates, but the node lacks that city;
- the rule asks for slow, relaxed, less rushed, or fewer cities and the node is Packed;
- the rule asks for fewer hotel changes, one base, or few moves and the node has at least three moves;
- the rule asks for cheap, budget, or less expensive and the node’s maximum band exceeds €230 per day.

If every sibling would be incompatible, the incompatible set is cleared. This conservative fallback prevents an automatic empty frontier.

### 10.5 Rewind transformation

At the affected level:

- incompatible siblings become pruned;
- a pinned compatible sibling becomes candidate.

At later levels:

- every non-pruned node becomes pruned.

At the affected level and later:

- every remaining pinned node becomes candidate.

Earlier committed ancestors are retained.

### 10.6 Rescoring

Before rewind, the client computes branch-fit scores under old rules. It then computes scores for nodes retained in the rewound tree under new rules and stores:

~~~text
delta(node) = (oldFit, newFit)
~~~

The score itself is the same heuristic defined in Section 8.7. A score change is evidence that the heuristic reacted to lexical signals, not independent evidence that the branch better satisfies the traveler.

### 10.7 Frontier replacement

The client immediately requests a new frontier using the rule text as overriding guidance. When the response returns, it:

- retains pruned nodes at the affected parent as history;
- removes every non-pruned node at that parent and level;
- inserts the newly returned nodes.

Therefore, compatible frontier candidates are not necessarily retained after repair. They are temporarily rescored, then replaced when the new batch arrives. Earlier ancestors and pruned historical nodes remain. Documentation must not describe this as full compatible-branch preservation.

Removing a rule uses the same mechanism with guidance stating that the previous rule should be reconsidered.

**Figure 6. Implemented repair algorithm**

~~~mermaid
flowchart TD
  A["New or removed trip rule"] --> B["Classify rule with lexical patterns"]
  B --> C["Bound requested stage by committed path length"]
  C --> D["Score visible nodes under old rules"]
  D --> E["Find non-pruned siblings at affected frontier"]
  E --> F["Apply conservative incompatibility heuristics"]
  F --> G{"Would every sibling be pruned?"}
  G -->|Yes| H["Clear automatic incompatibility set"]
  G -->|No| I["Keep incompatible set"]
  H --> J["Unpin affected and later nodes"]
  I --> J
  J --> K["Prune all later active nodes"]
  K --> L["Score retained tree under new rules"]
  L --> M["Clear final itinerary and warnings"]
  M --> N["Request replacement frontier with guidance"]
  N --> O["Keep pruned history and replace non-pruned frontier"]
  O --> P["Store new decision checkpoint"]
~~~

### 10.8 Repair locality

The implemented repair is localized in stage space:

- committed ancestors before the affected stage remain;
- affected and later commitments are invalidated;
- later visible work is marked pruned rather than deleted;
- a new batch starts at the affected frontier.

It is not dependency-complete incremental repair. There is no graph linking individual constraints to node fields or itinerary activities, no minimal-change optimizer, and no reuse of partial final itinerary text.

## 11. Final Itinerary Realization

### 11.1 Hard skeleton contract

After four stages are committed, the final leaf supplies:

- duration;
- exact city order;
- exact nights per city;
- movement pattern;
- register;
- anchors.

The Planner Agent prompt defines the skeleton as a hard contract. It requests exactly one itinerary option, prohibits adding, dropping, or reordering cities, and requires every anchor to appear as a scheduled activity.

### 11.2 Plan request

The client sends:

- original prompt plus each explicit rule as a new line;
- explicit rules and revealed branch choices as learned preferences;
- the same items as confirmed preferences;
- the committed skeleton;
- empty legacy conflicts, probe answers, assumptions, and structured assumptions;
- null memory;
- language.

### 11.3 Stage A: validation and planning

The Input Consistency Agent and Planner Agent run concurrently.

This is an important implementation detail. Input consistency is a response gate, not a compute gate. A blocking inconsistency causes a 422 response after both concurrent tasks have been started; planner computation may already have been consumed.

Because the default TripTree request contains a skeleton, the plan route always uses one Planner Agent call. The optional parallel comfort-forward and experience-forward planner mode applies only when no skeleton is supplied.

### 11.4 Stage B: route scaffold, enrichment, and semantic checking

The itinerary is first coordinate-sanitized and given a deterministic route scaffold.

Then, in parallel:

- Google geocoding and Routes enrichment attempts to replace estimates with verified geometry;
- the Constraint Checker Agent evaluates the scaffolded itinerary against confirmed preferences and feasibility risks.

The Constraint Checker sees the scaffolded itinerary before Google enrichment completes.

### 11.5 Stage C: deterministic analyses

Four functions run concurrently over the routed itinerary:

- Budget Manager Agent;
- Route Mobility Agent;
- Pace Feasibility Agent;
- Presentation Agent.

Warnings are merged by warning type and affected day. Deterministic warnings are ordered first, so they take precedence when an LLM warning has the same type and day.

### 11.6 Response use

The plan response contains:

- routed itinerary;
- merged warnings;
- memory status;
- a trace for seven named agents/evaluators;
- deterministic compact digests.

The default TripTree page currently consumes itinerary and warnings. It does not display the returned trace or digests.

**Figure 7. Final planning pipeline**

~~~mermaid
sequenceDiagram
  participant UI as TripTree client
  participant API as Plan API
  participant IC as Input Consistency Agent
  participant PL as Planner Agent
  participant RS as Route scaffold
  participant GM as Google enrichment
  participant CC as Constraint Checker Agent
  participant DA as Deterministic analyses

  UI->>API: "Prompt, rules, preferences, hard skeleton"
  par "Concurrent stage A"
    API->>IC: "Check hard contradictions"
    API->>PL: "Generate one skeleton-constrained itinerary"
  end
  IC-->>API: "Proceed or blocking issues"
  PL-->>API: "Structured itinerary"
  alt "Blocking issue"
    API-->>UI: "HTTP 422 after concurrent work"
  else "Can proceed"
    API->>RS: "Sanitize coordinates and derive route legs"
    par "Concurrent stage B"
      RS->>GM: "Geocode and verify route geometry"
      RS->>CC: "Check semantic feasibility"
    end
    GM-->>API: "Routed or fallback itinerary"
    CC-->>API: "LLM warnings"
    API->>DA: "Budget, mobility, pace, and digest calculations"
    DA-->>API: "Deterministic warnings and digests"
    API->>API: "Deduplicate warnings by type and day"
    API-->>UI: "Itinerary, warnings, trace, and digests"
  end
~~~

## 12. Route and Feasibility Algorithms

### 12.1 Coordinate sanitization

When an option contains at least three located activities:

1. compute the median latitude and median longitude;
2. compute every activity’s distance from that center;
3. compute the median distance spread;
4. set the outlier threshold to the greater of 800 km and four times the median spread;
5. discard coordinates beyond the threshold and mark them unavailable for re-geocoding.

This catches extreme hallucinated outliers but may retain plausible-looking wrong coordinates.

### 12.2 Route scaffold

If the model unexpectedly returned route segments, the scaffold preserves them. Otherwise it creates:

- a segment between every consecutive pair of activities within a day;
- a segment from the previous day’s last activity to the next day’s first activity.

Transport mode is selected by straight-line distance:

| Distance | Mode |
|---|---|
| over 250 km | flight or high-speed train |
| over 25 km | train |
| over 1.4 km | public transport |
| otherwise | walk |

Estimated minutes are:

~~~text
walk: max(5, round(distanceKm × 13))
flight: max(60, round(distanceKm × 0.12 + 90))
train: max(15, round(distanceKm × 0.8 + 20))
other: max(8, round(distanceKm × 5 + 8))
~~~

### 12.3 Google enrichment

With a server-side Google Maps key:

- unresolved named activities are geocoded;
- low-confidence or partial geocodes are rejected;
- the Routes API is called with walk, drive, or transit mode inferred from the scaffold text;
- returned distance, duration, and encoded polyline are marked Real with confidence 0.95.

Each Google geocoding or routing fetch has a 20-second bound in addition to the parent request's cancellation signal.

Without verified geometry:

- the scaffold estimate remains;
- provider is fallback_estimated;
- geometry is Estimated or Missing;
- confidence is reduced;
- a warning is attached.

Geocode and route results are cached in process memory. Serverless instances may not share or retain that cache.

### 12.4 Final budget analysis

The Budget Manager uses the selected itinerary option:

~~~text
perDayCost = totalOptionCost / numberOfDays
~~~

It compares this value to the same lexical daily cap used for branches. Medium or High risk produces one budget warning.

### 12.5 Final mobility analysis

For each day:

- walking above 8 km produces a warning;
- walking above 12 km is High impact, otherwise Medium;
- travel above 150 minutes produces a warning;
- travel above 240 minutes is High impact, otherwise Medium.

The agent summary also reports how many option-level route segments use Google Routes.

### 12.6 Final pace analysis

For a day:

~~~text
load =
  activityCount +
  0.6 × walkingKm +
  travelMinutes / 45
~~~

The day is:

- Packed when load exceeds 7, activity count is at least 6, or walking exceeds 9 km;
- Relaxed when load is below 3.5 and activity count is at most 3;
- Balanced otherwise.

A Packed day creates a warning. Six or more activities make its impact High; otherwise Medium.

### 12.7 Presentation digest

The Presentation Agent deterministically aggregates:

- total and per-day cost;
- budget risk;
- overall pace;
- walking total;
- longest option-level transfer;
- up to five largest cost categories;
- compact day rows.

Although this computation is active on the server, the current compact TripTree itinerary component derives its own visible summary and does not consume the digest.

## 13. Agent and Evaluator Inventory

The term **agent** is used in the code for both LLM calls and deterministic functions. The following taxonomy prevents false equivalence.

### 13.1 Active default-path components

| Component | Implementation class | Active stage | Role | Why included |
|---|---|---|---|---|
| Branch Explorer Agent | LLM, temperature 0.5 | Every branch frontier | Produces full-skeleton structural alternatives and a short rationale | Structural variation requires contextual language generation; a higher temperature encourages diversity |
| Branch route-fit annotation | Deterministic formula, attributed in the UI to Route Mobility Agent | Branch inspection | Shows lexical rule compatibility and score changes | Gives immediate, stable comparative feedback without another model call |
| Branch budget-risk annotation | Deterministic formula, attributed in the UI to Budget Manager Agent | Branch inspection | Shows budget risk from heuristic bands | Surfaces approximate cost implications before itinerary commitment |
| Branch logistics annotation | Deterministic thresholds, attributed in the UI to Route Mobility Agent | Branch inspection | Shows difficulty from moves and transfer hours | Makes hotel-change and transfer burden visible early |
| Branch pace annotation | Deterministic classification, attributed in the UI to Pace Feasibility Agent | Branch inspection | Shows Relaxed, Balanced, or Packed | Makes pace consequences comparable without another model call |
| Input Consistency Agent | LLM, temperature 0 | Final request | Detects hard geographic, date, budget, or transport contradictions | Language-sensitive contradictions are difficult to capture with fixed arithmetic alone |
| Planner Agent | LLM, temperature 0.35 | Final request | Realizes the hard skeleton as one detailed itinerary | Converts structural commitments into coherent day-level content |
| Constraint Checker Agent | LLM, temperature 0.15 | Final request | Flags semantic walking, travel, budget, booking, hours, and pacing risks | Complements fixed thresholds with contextual review |
| Route Mobility Agent | Deterministic scaffold, Google APIs, deterministic thresholds | Final request | Builds legs, verifies geometry where possible, and audits mobility | Separates route arithmetic and evidence from generative prose |
| Budget Manager Agent | Deterministic | Final request | Audits total and per-day cost | Provides reproducible numeric checks |
| Pace Feasibility Agent | Deterministic | Final request | Audits daily workload | Provides reproducible load thresholds |
| Presentation Agent | Deterministic | Final request | Produces compact digests | Keeps display aggregation stable and inexpensive |

### 13.2 Retained legacy or dormant components

| Component | Implementation class | Current status | Former or potential role |
|---|---|---|---|
| Conflict Detector Agent | LLM | Reachable through legacy analyze API, not default UI | Detects hidden trade-offs and decides whether a question checkpoint is needed |
| Preference Probe Agent | LLM | Reachable through legacy probe API, not default UI | Converts answered probe options into learned preferences |
| Assumption Critic Agent | LLM | Called by legacy probe API only | Critiques assumptions produced by the old elicitation workflow |
| Preference Agent | LLM | Source retained but not called by active routes | Produces broad explicit, inferred, missing, and memory-derived preferences |
| Memory Agent | Browser-local deterministic helper | Not used by default TripTree flow | Stores accepted preferences across sessions |

The legacy analyze and probe routes remain deployable. Their presence should not be interpreted as participation in the new default workflow.

**Figure 8. Agent taxonomy and data flow**

~~~mermaid
flowchart TB
  subgraph ActiveLLM["Active LLM agents"]
    BE["Branch Explorer"]
    IC["Input Consistency"]
    PL["Planner"]
    CC["Constraint Checker"]
  end
  subgraph BranchEval["Branch-time deterministic evaluators"]
    RF["Route fit formula"]
    BR["Budget risk formula"]
    LG["Logistics thresholds"]
    PC["Pace classifier"]
  end
  subgraph FinalEval["Final deterministic evaluators"]
    RM["Route Mobility"]
    BM["Budget Manager"]
    PF["Pace Feasibility"]
    PR["Presentation"]
  end
  subgraph External["External evidence"]
    GM["Google Geocoding and Routes"]
  end
  subgraph Legacy["Legacy or dormant"]
    CD["Conflict Detector"]
    PP["Preference Probe"]
    AC["Assumption Critic"]
    PA["Preference Agent"]
    MA["Memory Agent"]
  end

  BE --> RF
  BE --> BR
  BE --> LG
  BE --> PC
  RF --> PL
  BR --> PL
  LG --> PL
  PC --> PL
  IC --> PL
  PL --> CC
  PL --> RM
  GM --> RM
  PL --> BM
  PL --> PF
  PL --> PR
~~~

## 14. Data Contracts and Provider Boundary

### 14.1 Shared schemas

Zod schemas define:

- branch dimensions, candidates, estimates, nodes, expansion requests, and expansion responses;
- planning skeletons, planning requests, itineraries, warnings, traces, and digests;
- retained legacy preference, conflict, assumption, probe, and memory data.

TypeScript types are inferred from these schemas rather than maintained independently.

**Figure 9. Core implemented data model**

~~~mermaid
classDiagram
  class Workspace {
    version
    sessionPrompt
    tree
    rules
    favoredIds
    activeDimension
    checkpoints
    itinerary
    status
  }
  class CheckpointSnapshot {
    id
    label
    dimension
    createdAt
    tree
    rules
  }
  class PlanNode {
    id
    parentId
    level
    dimension
    skeleton fields
    estimates
    confidence
    status
  }
  class TripRule {
    id
    value
    category
    createdAt
  }
  class BranchEstimates {
    transferKm
    transferHours
    moveCount
    budgetBand
    pace
  }
  class Itinerary {
    destination
    durationDays
    options
    selectedOptionId
  }

  Workspace "1" o-- "*" PlanNode
  Workspace "1" o-- "*" TripRule
  Workspace "1" o-- "*" CheckpointSnapshot
  Workspace "1" o-- "0..1" Itinerary
  CheckpointSnapshot "*" o-- "*" PlanNode
  CheckpointSnapshot "*" o-- "*" TripRule
  PlanNode "1" *-- "1" BranchEstimates
  PlanNode "0..*" --> "0..1" PlanNode : "parent"
~~~

### 14.2 LLM provider abstraction

The provider layer supports:

- OpenRouter chat completions;
- OpenAI chat completions.

It requests one JSON object, asks the provider for JSON response format, rejects unsupported message shapes, attempts one bounded extraction of text between the first and last braces, and validates the result through the requested Zod schema.

The system prompt explicitly prohibits raw chain-of-thought and requests concise rationales and summaries only. The interface should be described as exposing decisions, artifacts, annotations, and short explanations—not hidden model reasoning.

### 14.3 Error classes

Provider calls classify:

- configuration failure;
- provider failure;
- JSON parse failure;
- schema validation failure.

API routes return configuration errors as server errors, provider or output errors as upstream-style errors, request schema errors as 400 responses, and hard input-consistency failures as 422 responses.

### 14.4 Structural versus factual validity

Schema validation establishes that output has an accepted shape. It does not establish:

- that a place exists;
- that coordinates are correct;
- that opening hours or prices are current;
- that a transfer is available;
- that a route is safe or accessible;
- that a generated activity can be booked.

Google routing improves geometric evidence only where it succeeds. It does not verify the complete itinerary.

## 15. Architecture and Deployment Boundary

The implementation uses:

- Next.js App Router;
- React and TypeScript;
- Tailwind CSS;
- Zod;
- lucide-react;
- browser localStorage;
- Node.js API routes marked dynamic;
- optional OpenRouter or OpenAI;
- optional server-side Google Maps Platform APIs.

The active client endpoints are:

| Endpoint | Purpose | Timeout |
|---|---|---:|
| POST /api/expand | Generate one candidate frontier | 110 seconds in browser; 105 seconds per LLM-provider call |
| POST /api/plan | Generate and check final itinerary | 270 seconds in browser; 105 seconds per LLM-provider call |

Retained endpoints:

| Endpoint | Status |
|---|---|
| POST /api/analyze | Legacy hidden-conflict analysis |
| POST /api/probe | Legacy preference probing |

The Vercel configuration selects the Next.js framework, frozen pnpm installation, and production build. Server-side provider keys must be configured as Vercel environment variables. The active TripTree interface does not require a browser-exposed Google Maps key because it does not render the earlier interactive map.

No authentication, authorization, user database, queue, durable job store, or server-side checkpoint store is implemented. Every API route does use a request guard with bounded request schemas, a declared-body-size check, and a per-IP in-memory request bucket. That limiter is best effort and local to a warm serverless instance; it is not a durable or globally consistent security boundary.

## 16. Research Hypotheses

These hypotheses are **proposed** and untested.

| ID | Hypothesis | Directional prediction | Primary operational outcome |
|---|---|---|---|
| H1 | Branch visibility supports earlier articulation of consequential preferences | More material preferences expressed before final generation | Pre-commit articulation rate |
| H2 | Localized steering reduces root-level regeneration | Fewer full restarts and fewer regenerated stages | Root restart count and reuse ratio |
| H3 | Interruption and restoration improve perceived control | Higher control rating and recovery confidence | Post-task control scale |
| H4 | Branch annotations improve structural choices | Higher independently rated branch-choice fit | Blinded branch-choice quality |
| H5 | Annotation density has a workload trade-off | Better decision quality but potentially higher workload | Quality and NASA-TLX interaction |
| H6 | Diverse route candidates elicit more distinct preferences | More nonredundant rules or branch reversals | Preference diversity and route-set diversity |
| H7 | Repair preserves unaffected intent without reducing quality | Higher invariant preservation with noninferior constraint satisfaction | Independent repair fidelity |
| H8 | Branch breadth has a nonlinear effect | Moderate breadth outperforms very low or high breadth | Quality, time, and workload curve |
| H9 | Visible change explanations improve causal understanding | Better prediction of what a new rule will change | Counterfactual comprehension score |
| H10 | True progressive visibility, once implemented, reduces idle waiting but may increase interruption | Lower perceived wait; potentially more interventions | Wait rating and interruption rate |

H10 must not be tested with the current batch-visible implementation and labeled “streaming.”

## 17. Evaluation Design

### 17.1 Proposed conditions

A defensible initial study should compare:

1. **Opaque baseline:** generate a complete itinerary and revise through reprompting.
2. **Visible-tree condition:** show structural branches and checkpoints, but omit rule-triggered repair.
3. **Full-control condition:** show branches, interruption, rules, and repair.
4. **Annotation ablation:** within visible conditions, show versus hide evaluator annotations.

An alternative factorial design crosses:

- branch visibility: low versus high;
- intervention control: low versus high.

The repository contains a parser for such a two-by-two condition code, but the active TripTree page does not import or enforce it. It cannot be used as an implemented study manipulation until wiring and manipulation checks are added.

**Figure 10. Proposed experimental workflow**

~~~mermaid
flowchart LR
  P["Consent and background survey"] --> R["Random assignment"]
  R --> A["Opaque baseline"]
  R --> B["Visible tree"]
  R --> C["Full control"]
  A --> T["Counterbalanced standardized tasks"]
  B --> T
  C --> T
  T --> O["Participant-authored trip"]
  O --> Q["Control, workload, trust, and usability measures"]
  Q --> E["Blinded expert assessment"]
  E --> X["Exit interview and preference reconstruction"]
~~~

### 17.2 Assignment and tasks

For the primary interface comparison, between-subject assignment is preferable because exposure to a branch-visible interface may teach a planning strategy that contaminates later baseline use. Each participant can still complete repeated tasks nested within condition.

Use:

- standardized scenarios with controlled hidden constraints;
- multiple destinations and durations;
- one participant-authored realistic trip;
- counterbalanced task order;
- a fixed model and prompt version for the confirmatory study;
- a separate ecological replication with live model behavior.

### 17.3 Ground truth

Travel preference “ground truth” is inherently imperfect because preferences may be constructed during comparison. Use three complementary targets:

- scenario-authored hard constraints for standardized tasks;
- participant confirmations recorded during interaction;
- a structured exit reconstruction asking which realized preferences were genuinely consequential.

Do not treat the exit interview alone as a timeless latent truth.

## 18. Metrics and Operational Definitions

### 18.1 Preference timing

Let P* be the set of material preferences established by scenario truth or post-task adjudication. Let P_pre be those expressed through a rule or committed branch before final itinerary generation.

~~~text
PreCommitArticulationRate =
  size(P_pre intersection P*) / max(1, size(P*))
~~~

For preference p:

~~~text
NormalizedDiscoveryLatency(p) =
  (timeFirstExpressed(p) - timePromptSubmitted) /
  (timeTaskAccepted - timePromptSubmitted)
~~~

Also report:

- number of preferences first expressed after seeing a full itinerary;
- number of post-plan correction requests;
- number and category of rule additions;
- branch-choice reversals.

### 18.2 Controllability

For each intervention, independently identify:

- targeted properties that should change;
- invariant properties that should not change;
- hard constraints that must remain satisfied.

~~~text
TargetChangeRate =
  satisfiedTargetChanges / requestedTargetChanges

InvariantPreservationRate =
  preservedInvariants / specifiedInvariants

SteeringSuccess =
  TargetChangeRate × InvariantPreservationRate
~~~

The independent evaluator must not reuse TripTree’s own branch-fit formula, because that would make evaluation circular.

### 18.3 Repair locality

Let A be the set of committed ancestors before the affected stage, V_before the visible node set before repair, and V_after the visible node set after repair.

~~~text
AncestorPreservation =
  unchangedAncestors / max(1, size(A))

VisibleReuseRatio =
  unchangedContentNodes / max(1, size(V_before))

InvalidationFraction =
  newlyPrunedOrReplacedNodes / max(1, size(V_before))

RegeneratedStageCount =
  number of branch-generation calls after intervention
~~~

Because IDs depend on response titles and indices, unchanged content should be compared using normalized structural content, not ID alone.

### 18.4 Checkpoint and interruption

Measure:

- pause-to-visible-paused latency;
- number of visible nodes lost after pause;
- number of committed ancestors lost;
- resume-to-next-action latency;
- task success after recovery;
- exact restoration fidelity within the checkpoint’s declared field scope;
- whole-workspace restoration fidelity as a separate measure.

The last two must not be conflated: the current checkpoint intentionally stores only a subset.

### 18.5 Branch diversity

For Route candidates:

~~~text
CityDiversity(i, j) =
  1 - Jaccard(citySet_i, citySet_j)
~~~

Report average pairwise city diversity and the proportion of candidate pairs above a preregistered threshold. Add independent distances for:

- city ordering;
- nights allocation;
- movement pattern;
- register;
- anchors;
- move count;
- estimated pace.

This avoids overstating diversity when city sets differ but the practical trip remains similar.

### 18.6 Decision quality and feasibility

Use blinded raters and structured rubrics for:

- satisfaction of hard constraints;
- fit to confirmed preferences;
- route coherence;
- realistic night allocation;
- pace feasibility;
- mobility burden;
- cost plausibility;
- booking and opening-hour caution;
- degree of unsupported factual assertion.

Inter-rater reliability and adjudication procedures must be reported.

### 18.7 Human factors

Recommended outcomes include:

- perceived control;
- perceived transparency;
- decision confidence;
- calibrated trust;
- subjective workload with NASA-TLX [7];
- usability with the System Usability Scale, interpreted using empirical benchmarks [8];
- task completion time;
- abandonment;
- qualitative critical incidents.

Trust should not be treated as “higher is always better.” Appropriate reliance and calibration are the relevant goals [6].

### 18.8 System efficiency

Record per request:

- wall-clock latency;
- provider model and version;
- input and output tokens when available;
- monetary cost;
- success, timeout, user abort, or error;
- branch count before and after filtering;
- generated, retained, pruned, restored, and replaced nodes;
- Google geocoding and routing success;
- cache status where observable.

## 19. Instrumentation Requirements

The repository contains an append-only local study logger and event names for branch operations, but the active TripTree interface does not call it. A research deployment must add consent-aware instrumentation before claiming behavioral measurements.

### 19.1 Required event families

- session start, consent, condition, and reset;
- prompt submitted;
- expansion requested, completed, filtered, timed out, failed, or aborted;
- checkpoint created and restored;
- node selected, favored, unfavored, pruned, restored, and committed;
- rule added, removed, classified, and repaired;
- rewind stage requested and actual;
- score before and after;
- frontier node retained, pruned, replaced, or generated;
- pause clicked and paused state displayed;
- resume clicked and request type chosen;
- final itinerary requested, received, failed, or aborted;
- itinerary adjustment and acceptance;
- study-scale completion and task exit.

### 19.2 Event payload

Every event should contain:

- pseudonymous participant and session IDs;
- condition and task IDs;
- UTC timestamp and monotonic elapsed time;
- workspace schema version;
- model, prompt, and evaluator versions;
- object IDs plus normalized structural hashes;
- preceding and resulting status;
- checkpoint ID;
- affected stage;
- request ID and parent request ID;
- consent-compatible cost and latency metadata.

### 19.3 Data integrity

Use append-only server receipt for confirmatory studies, with:

- idempotent event IDs;
- client and server timestamps;
- ordered sequence numbers;
- explicit offline buffering;
- export and deletion procedures;
- validation against a versioned event schema.

Browser-only localStorage logs are useful for prototyping but vulnerable to loss, manual modification, storage limits, and device changes.

## 20. Statistical Analysis Plan

This section is **proposed**.

### 20.1 Preregistration

Before data collection:

- designate one primary outcome;
- define exclusions and missing-data handling;
- freeze interface, prompts, model, and analysis code;
- preregister hypotheses, contrasts, and stopping rule;
- distinguish confirmatory from exploratory analyses.

### 20.2 Models

Use models appropriate to repeated tasks:

- logistic mixed-effects models for binary constraint satisfaction;
- beta-binomial or binomial mixed models for articulation and preservation rates;
- negative-binomial mixed models for counts such as restarts and interventions;
- accelerated-failure-time or Cox mixed models for time to acceptable plan;
- linear or robust mixed models for approximately continuous workload and control scores;
- ordinal mixed models for ordinal ratings.

Include participant and task random effects. If prompts or model runs are sampled, include them as additional grouping factors. Random-effects structure should follow the design rather than be selected only for significance [9].

### 20.3 Reporting

Report:

- effect estimates;
- 95% confidence intervals;
- standardized effects where interpretable;
- raw distributions;
- model diagnostics;
- attrition and failure rates;
- sensitivity analyses;
- multiplicity control for secondary outcomes, such as Benjamini-Hochberg false-discovery-rate control [10].

### 20.4 Power

Do not choose sample size from a generic convention. Run a pilot to estimate:

- between-participant variance;
- task variance;
- expected event rates;
- plausible smallest effect of interest;
- timeout and attrition rates.

Then use simulation-based power analysis for the planned mixed model.

## 21. Threats to Validity

### 21.1 Construct validity

- Branch fit is a lexical heuristic, not measured preference utility.
- Model confidence is self-reported and uncalibrated.
- Favor is only a bookmark and cannot be treated as a learned preference.
- Pruning may reflect curiosity management rather than rejection.
- A rule may be exploratory rather than a stable preference.
- “Control” can mean perceived agency, successful intervention, invariant preservation, or low effort; these require separate measures.
- “Transparency” can mean visible alternatives, provenance, explanation, or factual evidence; TripTree mainly provides the first two.
- Preferences may be constructed during the task, weakening simple latent-ground-truth assumptions.

### 21.2 Internal validity

- Provider stochasticity can confound interface condition.
- Network latency and provider failure can affect control and workload ratings.
- The consistency agent and planner run concurrently, so a validation failure does not avoid planner computation.
- Learning and novelty effects can differ between first and later tasks.
- Participants with more travel experience may use branches differently.
- The fixed stage order can privilege certain intervention types.
- Model or provider updates can change behavior during a study.
- In-memory Google caches may create run-order effects.

### 21.3 External validity

- A travel-planning prototype may not generalize to medical, legal, financial, or software-generation control.
- Hypothetical trip tasks may not reproduce the stakes of purchasing a real trip.
- English and Chinese lexical rules do not cover other languages or dialects.
- Destination knowledge and infrastructure quality vary substantially.
- The current interface may behave differently on mobile devices, assistive technology, or slow connections.
- Users planning for families, disabilities, visas, safety, or complex group negotiation are underrepresented by simple scenarios.

### 21.4 Statistical conclusion validity

- Repeated measures are clustered by participant and task.
- Time, token, cost, and intervention counts may be heavy-tailed.
- Timeouts and abandonment create informative missingness.
- Many plausible secondary metrics create multiplicity risk.
- Small studies may be underpowered for visibility-by-control interactions.

### 21.5 Implementation validity

- Candidate visibility is batch-based, not progressive.
- Pause cannot preserve partial provider output.
- Checkpoints are partial and limited to eight.
- Restoring a checkpoint can leave a later itinerary accessible.
- Compatible frontier nodes are replaced after repair.
- Repair uses keyword rules rather than semantic dependencies.
- Route distinctness is city-set-based and only applied at the first stage.
- An empty post-filter frontier is permitted.
- Branch annotation labels can imply independent agents where there are only shared formulas.
- The active UI does not emit study events.
- Final returned traces and digests are not displayed.

### 21.6 Ecological and temporal validity

- Costs, schedules, and availability become stale.
- A plan judged plausible today may be infeasible at travel time.
- Google route success does not verify ticket or venue availability.
- Provider behavior and model knowledge can change without repository changes.

## 22. Ethics, Privacy, and Responsible Use

### 22.1 Data sensitivity

Travel prompts may reveal:

- future location and dates;
- home or origin;
- budget;
- disability or mobility needs;
- family composition;
- dietary or religious requirements;
- safety concerns.

The active workspace stores prompts, rules, branches, checkpoints, and itineraries unencrypted in browser localStorage. LLM-bound content is sent to the configured provider, and place or coordinate data may be sent to Google. A deployment must provide a clear privacy notice and align retention with provider terms.

### 22.2 Research consent

A study must:

- obtain informed consent before telemetry;
- identify external processors;
- avoid collecting unnecessary identifiers;
- use pseudonymous participant IDs;
- separate compensation records from interaction data;
- permit withdrawal and deletion;
- specify retention and access controls;
- review the protocol through the applicable ethics process.

### 22.3 Misleading certainty

Agent names, percentages, and risk labels may appear authoritative. The interface and study materials should disclose:

- which outputs are LLM-generated;
- which are deterministic heuristics;
- whether evidence is live, estimated, or missing;
- that route fit is not a probability;
- that multiple branch labels do not imply independent expert agreement.

Automation research warns that level and presentation of automation influence reliance [5]. Trust should be calibrated to evidence rather than maximized [6].

### 22.4 Safety and accessibility

TripTree should not be the sole basis for bookings, visa compliance, health decisions, accessibility planning, or safety-critical travel. Future evaluation must include travelers with mobility, sensory, cognitive, and language-access needs. Generated plans should make uncertainty and verification tasks explicit.

### 22.5 Explanation boundary

The system requests concise rationales and structured assumptions while explicitly excluding private chain-of-thought. This is appropriate: useful control depends on inspectable decisions, inputs, outputs, provenance, and counterfactual consequences, not disclosure of hidden internal reasoning. Explanatory debugging research suggests that actionable explanations can support user correction when they expose a model that users can test and revise [11].

## 23. Reproducibility

### 23.1 Required run manifest

Every experimental run should record:

- repository commit;
- workspace schema version;
- Node.js version;
- pnpm version;
- lockfile hash;
- Next.js and React versions resolved by the lockfile;
- provider and exact model identifier;
- agent prompt versions;
- temperatures;
- timeout values;
- relevant environment flags;
- Google API availability;
- task and condition;
- browser, operating system, viewport, locale, and timezone.

### 23.2 Implemented model settings

| Agent | Temperature |
|---|---:|
| Branch Explorer | 0.50 |
| Input Consistency | 0.00 |
| Planner | 0.35 |
| Constraint Checker | 0.15 |
| Legacy Conflict Detector | 0.25 |
| Legacy Preference Probe | 0.20 |
| Legacy Assumption Critic | 0.15 |

Deterministic evaluators make no model call.

### 23.3 Provider configuration

OpenRouter is the default provider when none is explicitly selected. OpenAI is supported when configured. Provider model names are environment-controlled, so repository commit alone is insufficient for reproduction.

The code does not request or store a provider random seed. Exact text replay is therefore not guaranteed, even with identical prompts and temperatures.

### 23.4 Build and verification

The repository defines:

~~~bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm start
~~~

A research release should additionally archive:

- validated branch and plan JSON;
- request/response latency;
- provider token metadata;
- screenshots at defined viewports;
- exact evaluation fixtures;
- automated state-transition test results.

The current repository has no automated test suite. Type checking and production build do not verify pause/resume, checkpoint restoration, repair locality, or user-event semantics.

### 23.5 Recommended deterministic test fixtures

Add fixtures for:

- committed-path invariants;
- descendant pruning;
- restore semantics;
- favor non-influence;
- route Jaccard filtering;
- all branch-scoring thresholds;
- rule classification in supported languages;
- requested versus actual rewind stage;
- all-incompatible fallback;
- frontier replacement;
- maximum checkpoint retention;
- reload-to-paused conversion;
- warning precedence;
- route fallback without Google;
- schema normalization and rejection.

## 24. Prioritized Future Work

All items in this section are **proposed**.

### Priority 0: research validity

1. **Wire consent-aware event telemetry.** The current logger is not connected to TripTree.
2. **Version every computational artifact.** Record prompts, model IDs, evaluator versions, tree versions, structural hashes, and request lineage.
3. **Make checkpoint scope explicit and complete.** Either snapshot the whole workspace or clearly distinguish structural checkpoints from full session restore points.
4. **Create an independent controllability evaluator.** Score requested changes and preserved invariants without reusing the system’s own fit heuristic.
5. **Rename or disclose branch evaluator labels.** Avoid implying four independent agents unless separate processes are implemented.
6. **Add automated transition and property tests.**
7. **Freeze reproducible model conditions for confirmatory studies.**

### Priority 1: generation controllability

1. **Progressive frontier streaming.** Use server-sent events or a resumable event protocol so completed nodes can appear independently.
2. **Durable jobs and acknowledged cancellation.** Extend the implemented HTTP abort-signal propagation with server job IDs, cancellation acknowledgement, and provider-native cancellation where supported.
3. **Semantic constraint parsing.** Replace keyword-only stage classification with a typed constraint representation supporting negation, scope, priority, and language.
4. **Dependency and provenance graph.** Link rules to node fields, branches, and itinerary activities so invalidation can be computed rather than guessed.
5. **Minimal-change repair objective.** Optimize target satisfaction while penalizing unnecessary changes to unaffected structure.
6. **Preserve compatible frontier nodes.** Re-score them in place and add repaired variants with explicit version edges rather than replacing them silently.
7. **Before-and-after diffs.** Show what changed, what remained invariant, and which rule caused each change.
8. **Hard versus soft controls.** Let travelers mark non-negotiable constraints separately from preferences and weights.
9. **Branch merge and fork.** Support combining compatible features from siblings and creating named planning versions.

**Figure 11. Proposed controllability architecture**

~~~mermaid
flowchart LR
  U["User intervention"] --> CP["Typed constraint parser"]
  CP --> DG["Constraint dependency graph"]
  DG --> IA["Impact analysis"]
  IA --> MR["Minimal repair planner"]
  MR --> VS["Versioned shared tree"]
  VS --> DF["Causal before-and-after diff"]
  DF --> U
  MR --> SJ["Durable generation job"]
  SJ --> ST["Progressive node stream"]
  ST --> VS
  U -->|Cancel| SJ
~~~

### Priority 2: adaptive checkpoints

The current system pauses after every fixed structural batch. A future checkpoint policy should estimate:

~~~text
CheckpointValue =
  expected downstream loss avoided × uncertainty × reversibility cost
  - interaction burden
~~~

Candidate factors:

- predicted divergence among branches;
- uncertainty in high-impact constraints;
- downstream generation cost;
- cost of repairing later;
- user interruption history;
- current workload;
- branch dominance or near-equivalence.

This would operationalize the mixed-initiative question of when the system should ask for control rather than merely where it can.

### Priority 3: search quality and diversity

1. Represent branch selection as a multi-objective Pareto problem over fit, cost, transfers, pace, novelty, accessibility, and robustness.
2. Use diversity-aware selection such as determinantal point processes [12] rather than a single city-set Jaccard threshold.
3. Evaluate tree search or Monte Carlo tree search for selective expansion [13].
4. Add route-order, allocation, style, and logistics diversity metrics.
5. Expose branch breadth controls and an overload-aware default.
6. Let specialist evaluators disagree visibly, with evidence and calibrated confidence.

### Priority 4: travel truth and usefulness

1. Integrate live rail, flight, lodging, fare, ticket, and opening-hour sources.
2. Distinguish quoted live evidence from model estimates.
3. Add accessibility-aware routing and venue data.
4. Add visa, border, weather, disruption, and safety verification with appropriate authoritative sources.
5. Support export, sharing, collaboration, and cross-device checkpoints.
6. Add privacy-preserving accounts and encrypted server persistence.
7. Improve mobile, keyboard, screen-reader, localization, and low-bandwidth behavior.

### Priority 5: longitudinal research

1. Follow travelers from planning through booking and travel.
2. Compare anticipated versus experienced pace, cost, and logistics.
3. Study whether steering behavior changes across repeated trips.
4. Measure preference stability without assuming all change is inconsistency.
5. Examine group planning, negotiation, and shared control.

## 25. Research Roadmap

**Figure 12. Proposed staged research program**

~~~mermaid
flowchart LR
  A["Phase 1: instrument and test state semantics"] --> B["Phase 2: controlled interface study"]
  B --> C["Phase 3: annotation and repair ablations"]
  C --> D["Phase 4: progressive streaming and durable cancellation"]
  D --> E["Phase 5: live-data field deployment"]
  E --> F["Phase 6: longitudinal booking and travel outcomes"]
~~~

Phase 1 should precede claims about user behavior. Phase 2 should test the implemented batch-visible system. Streaming, adaptive checkpoints, semantic repair, or live travel truth should each be evaluated as separate interventions rather than folded into one changing prototype.

## 26. Conclusion

TripTree implements a concrete interaction model for intervening before a detailed travel plan is committed. A traveler sees a shared structural tree, compares candidate routes and planning strategies, commits one coherent path, interrupts requests, adds rules, and requests repair from a heuristically chosen stage. The final itinerary is constrained by the committed skeleton and checked by a combination of model-based and deterministic components.

The implementation also has clear boundaries. Branches appear in completed batches. Pause does not preserve partial model output. Checkpoints restore only part of the workspace. Repair prunes and regenerates a stage rather than performing dependency-complete incremental recomputation. Favoring is a bookmark. Several branch “agents” are labels over shared deterministic formulas. Study infrastructure is present but not active.

These limitations do not negate the research direction; they define it precisely. The next scientific step is not to assume that visibility and control help, but to instrument the system, operationalize controllability independently, compare it against appropriate baselines, and measure both benefits and costs. The central empirical question remains whether exposing structural alternatives at the moment of commitment helps people shape generation earlier, with less unnecessary regeneration and without unacceptable cognitive burden.

## References

1. Horvitz, E. (1999). Principles of mixed-initiative user interfaces. *Proceedings of CHI 1999*, 159–166. [https://doi.org/10.1145/302979.303030](https://doi.org/10.1145/302979.303030)
2. Amershi, S., Weld, D., Vorvoreanu, M., et al. (2019). Guidelines for Human-AI Interaction. *Proceedings of CHI 2019*, Article 3. [https://doi.org/10.1145/3290605.3300233](https://doi.org/10.1145/3290605.3300233)
3. Amershi, S., Cakmak, M., Knox, W. B., and Kulesza, T. (2014). Power to the People: The Role of Humans in Interactive Machine Learning. *AI Magazine, 35*(4), 105–120. [https://doi.org/10.1609/aimag.v35i4.2513](https://doi.org/10.1609/aimag.v35i4.2513)
4. Bettman, J. R., Luce, M. F., and Payne, J. W. (1998). Constructive Consumer Choice Processes. *Journal of Consumer Research, 25*(3), 187–217. [https://doi.org/10.1086/209535](https://doi.org/10.1086/209535)
5. Parasuraman, R., Sheridan, T. B., and Wickens, C. D. (2000). A Model for Types and Levels of Human Interaction with Automation. *IEEE Transactions on Systems, Man, and Cybernetics—Part A, 30*(3), 286–297. [https://doi.org/10.1109/3468.844354](https://doi.org/10.1109/3468.844354)
6. Lee, J. D., and See, K. A. (2004). Trust in Automation: Designing for Appropriate Reliance. *Human Factors, 46*(1), 50–80. [https://doi.org/10.1518/hfes.46.1.50_30392](https://doi.org/10.1518/hfes.46.1.50_30392)
7. Hart, S. G. (2006). NASA-Task Load Index: 20 Years Later. *Proceedings of the Human Factors and Ergonomics Society Annual Meeting, 50*(9), 904–908. [https://doi.org/10.1177/154193120605000909](https://doi.org/10.1177/154193120605000909)
8. Bangor, A., Kortum, P. T., and Miller, J. T. (2008). An Empirical Evaluation of the System Usability Scale. *International Journal of Human-Computer Interaction, 24*(6), 574–594. [https://doi.org/10.1080/10447310802205776](https://doi.org/10.1080/10447310802205776)
9. Barr, D. J., Levy, R., Scheepers, C., and Tily, H. J. (2013). Random Effects Structure for Confirmatory Hypothesis Testing: Keep It Maximal. *Journal of Memory and Language, 68*(3), 255–278. [https://doi.org/10.1016/j.jml.2012.11.001](https://doi.org/10.1016/j.jml.2012.11.001)
10. Benjamini, Y., and Hochberg, Y. (1995). Controlling the False Discovery Rate: A Practical and Powerful Approach to Multiple Testing. *Journal of the Royal Statistical Society: Series B, 57*(1), 289–300. [https://doi.org/10.1111/j.2517-6161.1995.tb02031.x](https://doi.org/10.1111/j.2517-6161.1995.tb02031.x)
11. Kulesza, T., Burnett, M., Wong, W.-K., and Stumpf, S. (2015). Principles of Explanatory Debugging to Personalize Interactive Machine Learning. *Proceedings of IUI 2015*, 126–137. [https://doi.org/10.1145/2678025.2701399](https://doi.org/10.1145/2678025.2701399)
12. Kulesza, A., and Taskar, B. (2012). Determinantal Point Processes for Machine Learning. *Foundations and Trends in Machine Learning, 5*(2–3), 123–286. [https://doi.org/10.1561/2200000044](https://doi.org/10.1561/2200000044)
13. Browne, C. B., Powley, E., Whitehouse, D., et al. (2012). A Survey of Monte Carlo Tree Search Methods. *IEEE Transactions on Computational Intelligence and AI in Games, 4*(1), 1-43. [https://doi.org/10.1109/TCIAIG.2012.2186810](https://doi.org/10.1109/TCIAIG.2012.2186810)
14. Valmeekam, K., Sreedharan, S., Sengupta, S., and Kambhampati, S. (2022). RADAR-X: An Interactive Mixed Initiative Planning Interface Pairing Contrastive Explanations and Revised Plan Suggestions. *Proceedings of ICAPS 2022, 32*(1), 508-517. [https://doi.org/10.1609/icaps.v32i1.19837](https://doi.org/10.1609/icaps.v32i1.19837)
15. Gloria-Silva, D., Ferreira, R., Tavares, D., Semedo, D., and Magalhaes, J. (2024). Plan-Grounded Large Language Models for Dual Goal Conversational Settings. *Proceedings of EACL 2024*, 1271-1292. [https://doi.org/10.18653/v1/2024.eacl-long.77](https://doi.org/10.18653/v1/2024.eacl-long.77)
16. Xu, Z., Xu, K., Xu, H., et al. (2026). How Controllable Are Large Language Models? A Unified Evaluation across Behavioral Granularities. *Proceedings of ACL 2026*, 31269-31299. [https://doi.org/10.18653/v1/2026.acl-long.1443](https://doi.org/10.18653/v1/2026.acl-long.1443)
