# Visible planning state

TripTree keeps its existing four-stage, flat branch tree:

1. route;
2. pace;
3. trip style;
4. logistics;
5. final itinerary generation after the path is committed.

The active workspace still lives in `src/app/page.tsx`, tree rendering remains in
`src/components/BranchExplorer.tsx`, `/api/expand` grows one candidate batch at
a time, and `/api/plan` realizes the committed leaf as a hard itinerary
skeleton.

## Implementation assessment

The repository already had the core interaction model: batch-visible growth,
meaningful structural branches, pause/resume with cancellation, branch
selection and pruning, checkpoint snapshots, local restoration, deterministic
branch annotations, and Zod-validated agent responses. It also had string
assumptions on each branch and a dormant, separate assumption-review interface.

The active branch workflow did not use that dormant interface. Mounting it
would have introduced a second assumptions dashboard and crowded the current
two-column workspace. The implementation therefore reuses the existing tree
and inspector instead.

The main duplicated state was:

- inline assumption strings on nodes;
- trip rules converted separately into learned and confirmed preferences;
- older global assumption, transport, accommodation, and cost-assumption
  structures;
- repeated full trip skeletons on every node.

The repeated skeleton is intentional and remains: the final planner needs a
self-contained committed leaf. Planning assumptions are now normalized and
referenced by ID.

## Final interaction model

- Each node references a central `PlanningAssumption` catalog through
  `assumptionIds`.
- A compact node shows at most two prioritized assumption chips plus a count.
- Selecting a node opens the existing inspector. “Why this choice?” expands
  the decision, assumptions, provenance, qualitative confidence, impact,
  concrete consequences, and sibling alternatives.
- Assumption lifecycle (`active`, `corrected`, `rejected`), confirmation, and
  locking are orthogonal. Locking never saves a long-term preference.
- Medium- and high-impact corrections or rejections open a deterministic
  counterfactual preview before mutation.
- Applying a disruptive change marks only linked nodes and their descendants
  stale. Unrelated and locked nodes are preserved. Active affected work is
  regenerated from the earliest invalidated stage.
- Checkpoints surface only high-impact, uncertain, corrected, or unresolved
  assumptions. They provide confirm, review, reject, and lock actions without
  becoming a questionnaire.
- A short-lived update banner shows the previous and current value, affected
  node count, preserved locks, and an undo action.
- Favor remains a soft preference and is now included in later branch-agent
  guidance. Prune remains branch rejection; assumption rejection remains a
  separate action.

The interface exposes structured, user-facing planning artifacts. It does not
display private chain of thought, hidden prompts, token traces, or raw model
deliberation.

## Data and API changes

`src/schemas/travel.ts` adds:

- qualitative planning confidence;
- user-facing assumption provenance;
- normalized planning assumptions;
- planning consequences;
- node assumption references;
- decision importance;
- decision locks;
- stale state and invalidation causes;
- assumptions in branch expansion requests and responses;
- response-level reference validation.

The branch agent now requests structured assumptions and consequences.
`/api/expand` canonicalizes equivalent assumptions by category, label, and
value, reuses existing IDs, merges affected-node references, and never lets a
later model response overwrite a user correction, rejection, confirmation, or
lock.

Active, non-rejected planning assumptions are adapted into the existing final
planner contract. Rejected assumptions are excluded from final planning and
budget signals.

## Persistence migration

Browser workspace storage moves from `trip-tree:workspace:v2` to
`trip-tree:workspace:v3`.

On first load:

- v3 is preferred;
- v2 is accepted as a fallback;
- every node is parsed through the current Zod schema to receive defaults;
- legacy inline assumptions are converted to normalized catalog records;
- dangling assumption references are removed;
- working states restore as paused;
- migrated state is written as v3 and the v2 key is removed.

Checkpoint snapshots now include the assumption catalog, favorites, selection,
rationale, itinerary, warnings, selected option, and view, so restoring an
earlier checkpoint cannot leave a later itinerary attached to it.

No server-side or database migration is required.

## Refined or deferred ideas

- Numeric confidence is retained only where older APIs need it. The planning
  UI uses Low, Medium, and High.
- Sibling tree nodes remain the alternatives model; no duplicate alternatives
  collection or parallel “trip universe” interface was added.
- The dormant full assumptions dashboard, automatic long-term memory,
  Pareto/frontier charts, voting, information-gain views, and optimization
  dashboards remain deferred.
- Candidate generation is still returned as a validated batch. Loading
  placeholders and live status remain visible, but true token- or node-level
  server streaming is not claimed.
- Free-text trip-rule repair still uses a category/stage heuristic because a
  free-text rule has no explicit dependency IDs. Assumption edits use the new
  dependency closure.
- Counterfactuals are deterministic summaries from explicit consequences and
  category mappings; they do not generate a second full itinerary.

## Automated validation

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
```

The state tests cover:

- assumption correction;
- assumption rejection;
- decision lock and unlock;
- affected-descendant-only invalidation;
- unrelated locked-branch preservation;
- deep snapshot restoration;
- v2 inline-assumption migration without dangling references;
- checkpoint assumption prioritization;
- checkpoint continuation decisions;
- deterministic counterfactual previews.

Agent parsing tests cover wrapped JSON, malformed JSON, schema-invalid output,
one successful repair retry, and a typed failure after two invalid responses.

## Manual test

1. Start a trip and let the route candidates appear.
2. Confirm that each compact branch shows no more than two assumption chips.
3. Select a branch and expand “Why this choice?”.
4. Confirm an assumption, then lock it. Verify these are shown as distinct
   states.
5. Correct a high-impact assumption. Check the preview before applying it.
6. Apply the change. Verify only linked nodes show “Needs update”, locked nodes
   remain, and regeneration restarts at the affected stage.
7. Use Undo and verify the previous tree and assumptions return.
8. Reject an assumption and verify it stays visible for audit but is no longer
   used.
9. Pause during generation, edit at the checkpoint, and resume.
10. Restore an older checkpoint and verify its assumptions, selection, and
    itinerary state restore together.
11. Commit all four decisions and build the itinerary. Verify corrected and
    locked assumptions influence it while rejected assumptions do not.
12. Repeat on a narrow viewport and with reduced motion enabled.

## Remaining limitations

- Candidate nodes arrive as complete batches rather than true streamed
  individual nodes.
- Checkpoints and study events are browser-local and not shared across devices.
- Upstream cancellation remains best effort after a provider accepts work.
- Free-text rules have heuristic dependencies; normalized assumptions have
  explicit dependencies.
- Prices, opening hours, availability, and transport schedules are not live
  inventory.
- Long-term preference saving is intentionally not automatic.
