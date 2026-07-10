# TripTree User Guide

TripTree lets you steer a trip while it is being planned. The main workspace is one shared planning tree, not a sequence of hidden-preference forms and not a separate tree for every agent.

## Run The App

Install Node.js 24.x and pnpm 11.7.0, then run:

```bash
pnpm install
pnpm dev
```

Open `http://127.0.0.1:3000`.

The project uses real provider calls. Configure `.env` before starting:

```env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=openai/gpt-4.1-mini
```

For a hosted deployment, follow [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md).

## Start A Trip

Enter a rough idea such as:

```text
Italy for one week in October
```

Choose **Start branching**. TripTree shows placeholders while it generates, then reveals the complete route-candidate batch in the shared tree. Candidates are visible stage by stage, not streamed one node at a time. A short prompt is enough because uncertainty is handled through visible alternatives rather than a questionnaire.

## Read The Tree

The tree develops through four decisions:

1. **Route** compares city combinations and geographic directions.
2. **Pace** compares night allocation and recovery strategies.
3. **Trip style** compares the experiences that anchor the trip.
4. **Logistics** compares hotel changes and transfer strategies.

The dark node at the left is the original trip idea. Each following column is a planning decision. Committed nodes stay green, candidates remain available, favored nodes carry a star, and pruned nodes remain collapsed in the tree so the history is not lost.

Select any node to open its inspector. Four deterministic evaluator labels summarize the branch; they do not represent four independent agents running when the branch appears. The inspector shows:

- Route fit from confidence and active-rule compatibility.
- Budget risk from a heuristic daily budget reference.
- Logistics difficulty from transfer time and hotel changes.
- Pace load from city count, moves, and stay length.
- The branch’s implicit assumptions.
- The main trade-off created by choosing it.

The Branch Explorer Agent proposes candidate structures and their implicit assumptions. The other branch labels are reproducible calculations over that structured data.

## Control A Branch

- **Favor** adds a visual star only. It does not alter scoring, ranking, or later generation.
- **Prune** rejects a branch and its affected descendants.
- **Restore** returns a pruned branch to candidate status.
- **Continue here** commits that path and expands the next decision.

Candidate siblings remain visible after you continue. Choosing a different earlier sibling rewires the committed path and prevents conflicting branches from remaining committed at the same time.

## Checkpoints

Generation pauses automatically after each of the four stage batches is ready. That visible decision boundary is a checkpoint; the current prototype does not dynamically decide whether a particular batch is high impact.

The progress bar shows how many of the four structural decisions are committed. The history button in the header lists recent checkpoints. Selecting one restores its tree, trip rules, and active decision. A checkpoint does not separately restore favorites, the selected card, score deltas, warnings, or a generated itinerary.

There are no standalone **Hidden-Preference Checkpoints**, **Checkpoint Questions**, or **What we learned about you** screens. Preference information appears only as explicit trip rules and branch choices in the planning workspace.

## Pause And Resume

Choose **Pause** while branches or the final itinerary are being generated. TripTree preserves the last completed tree and stores a checkpoint snapshot. Because candidates arrive as a batch, a partial in-flight batch is not saved.

Choose **Resume** to start a fresh request from that logical state. Earlier committed decisions are supplied as context rather than regenerated, but an interrupted in-flight stage or itinerary request starts again.

The cancellation signal is propagated from the browser through TripTree’s server-side provider and routing calls. Cancellation is still best effort: an upstream service may finish work that it has already accepted.

## Steer From A Checkpoint

Use **Steer from here** when you realize something new, for example:

```text
Must include Bologna
Slower pace
Fewer hotel changes
Avoid the most expensive cities
```

Applying a rule:

1. Adds it to the editable **Trip rules** strip.
2. Heuristically selects the earliest affected decision.
3. Keeps unaffected earlier work.
4. Computes old and new heuristic scores for the current tree.
5. Prunes clearly incompatible candidates and later dependent work.
6. Requests a fresh candidate batch from that stage.

Score changes may remain visible on preserved branch cards; newly generated replacements receive their own scores. This is stage-local regeneration, not an in-place patch of every old branch. Remove a rule from the strip to reconsider the affected part of the tree without it.

## Build The Itinerary

After Route, Pace, Trip style, and Logistics are committed, choose **Build itinerary**.

The itinerary view contains:

- route overview
- total days, estimated cost, walking, and travel time
- a compact day-by-day timeline
- category cost estimates
- feasibility warnings

Choose **Adjust at checkpoint** to return to the tree. Add a rule or restore an earlier checkpoint, then rebuild from the repaired branch.

## Persistence And Reset

The active workspace, including the tree, trip rules, favorites, checkpoint history, and final itinerary, is stored in browser `localStorage`. Reloading restores the latest stable workspace state. A run that was active during reload is restored as paused. Storage is local to that browser and origin; it is not synchronized across devices.

Use the plus button in the header to begin a new trip and clear the current TripTree workspace.

## Errors

If a provider request fails, the error appears above the tree. Existing branches and checkpoints remain available. You can restore a checkpoint, change a trip rule, or resume the interrupted stage after fixing provider configuration.
