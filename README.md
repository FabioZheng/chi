# TripTree

TripTree is a Next.js + TypeScript research prototype for checkpoint-based, branch-visible, interruptible travel planning.

Instead of generating a full itinerary in one opaque step, TripTree reveals one complete candidate batch at each structural decision. The traveler can compare route directions, pacing strategies, trip styles, and logistical approaches; mark or prune branches; pause generation; add a newly realized trip rule; and continue from browser-local planning state without restarting from the initial prompt.

For operating instructions, see [docs/USER_GUIDE.md](docs/USER_GUIDE.md). For the research framing and system model, see [docs/SCIENTIFIC_DOCUMENTATION.md](docs/SCIENTIFIC_DOCUMENTATION.md). For production setup, see [docs/VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md).
For the normalized assumption model, propagation rules, migration, and testing guide, see [docs/PLANNING_STATE.md](docs/PLANNING_STATE.md).

## Setup

Requirements: Node.js 24.x and pnpm 11.7.0.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Configuration

Create `.env` from `.env.example` and configure OpenRouter:

```bash
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=openai/gpt-4.1-mini
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_APP_NAME=TripTree
```

OpenAI is also supported when `LLM_PROVIDER=openai` and `OPENAI_API_KEY` are set. API routes call real providers; missing configuration surfaces as an error while preserving the current tree.

### Optional Google Routing

```bash
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

The key remains server-side. When routing is unavailable, the planner falls back to estimated route data.

## Product Model

The active branch sequence is:

1. **Route**: city combinations, geographic direction, and overall route shape.
2. **Pace**: night allocation, recovery time, and activity density.
3. **Trip style**: the experiences and register that anchor the trip.
4. **Logistics**: hotel changes, transfer strategy, and hub versus point-to-point movement.
5. **Itinerary**: a detailed plan generated only after the branch path is committed.

Each completed expansion creates a decision checkpoint. Candidate siblings remain visible after a branch is committed. The traveler can reopen an earlier checkpoint, restore a pruned branch, or apply a new trip rule such as “Include Bologna,” “slower pace,” or “fewer hotel changes.” The client heuristically selects an affected stage, computes score changes for the current tree, prunes clearly incompatible or downstream work, and requests a fresh candidate batch from that point.

Manual Pause aborts the active browser request, propagates cancellation through the server where possible, and snapshots the completed tree and trip rules. Resume starts a fresh request from that logical state. Final itinerary generation is interruptible too, although a provider may still finish work that it has already accepted.

## Branch Annotations

The branch inspector presents deterministic evaluator annotations rather than separate agent trees or four independent branch-time agent calls:

- route fit
- budget risk
- logistics difficulty
- pace load
- implicit assumptions
- the main trade-off

The Branch Explorer Agent proposes structurally distinct candidates and implicit assumptions. Deterministic scoring then derives the displayed fit, budget, logistics, pace, and trade-off labels from branch data and active trip rules.

## Project Structure

- `src/app/page.tsx`: workspace orchestration, checkpoint snapshots, pause/resume, steering, repair, and persistence.
- `src/components/BranchExplorer.tsx`: shared tree, branch controls, scoring annotations, and selected-branch inspector.
- `src/components/TripItinerary.tsx`: compact post-commit itinerary view.
- `src/app/api/expand/route.ts`: branch expansion endpoint.
- `src/app/api/plan/route.ts`: final itinerary generation and feasibility analysis.
- `src/agents/branchExplorerAgent.ts`: branch proposal prompt and provider call.
- `src/agents/branchScoring.ts`: deterministic transfer, budget, and pace estimates.
- `src/schemas/travel.ts`: Zod request and response contracts.
- `src/types/travel.ts`: TypeScript types inferred from Zod.

The older analyze/probe routes remain in the repository for study compatibility, but they are no longer part of the default user interface.

## Validation

```bash
pnpm typecheck
pnpm build
```

All LLM outputs are parsed through Zod. Invalid provider output fails the relevant request instead of being treated as trusted planning state.

## Deployment

The included `vercel.json` enables Fluid Compute and API request cancellation, and uses:

```bash
pnpm install --frozen-lockfile
pnpm build
```

Use Node.js 24.x with pnpm 11.7.0, and configure provider secrets in Vercel Project Settings. See [docs/VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md) for the complete checklist, function-duration notes, and environment-variable matrix.

## Limitations

- Branch expansion is batch-visible: placeholders are shown during a request, then the complete candidate batch appears. Nodes are not streamed progressively.
- Cancellation signals are propagated from the browser through server-side provider and routing calls, but cancellation remains best effort once an upstream service has accepted work.
- A checkpoint snapshot stores the tree, trip rules, active decision, label, and timestamp. It does not independently restore favorites, selection, score deltas, warnings, or a generated itinerary.
- Favor is a visual marker only; it does not change scoring or generation. **Continue here** is the commitment action.
- Branch evaluator names describe deterministic annotation roles; they are not independent specialist agents invoked for every candidate branch.
- Prices, schedules, opening hours, and inventory are not live-verified.
- Checkpoints are stored in browser `localStorage` and are not shared across devices.
- The prototype does not yet include authentication or multi-user collaboration.

## Future Work

- Stream candidate nodes progressively as agents produce them.
- Add server-side cancellation and durable cross-device checkpoint storage.
- Add live rail, lodging, price, and ticket availability sources.
- Add automated coverage for pause/resume, sibling switching, repair, and persistence.
