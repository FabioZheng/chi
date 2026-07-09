# Assumption-Aware Agent Planner

A Next.js + TypeScript research prototype for ambiguity-first travel planning. The app is designed for short, casual prompts such as "Italy for one week", "somewhere warm", or "cheap trip to Europe". Instead of starting with a static preference form, it detects hidden planning trade-offs, asks lightweight checkpoint questions, learns a controllable preference profile, reviews assumptions, validates input consistency, then generates a map-based itinerary.

For full operating instructions, workflow details, and agent explanations, see [docs/USER_GUIDE.md](docs/USER_GUIDE.md). For a scientific paper-style explanation of the research workflow and innovation points, see [docs/SCIENTIFIC_DOCUMENTATION.md](docs/SCIENTIFIC_DOCUMENTATION.md). For the earlier abstract document, see `docs/hidden_preference_elicitation_project_abstract.docx`.

## Setup

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## `.env` Instructions

Copy `.env.example` to `.env`, then fill in the keys you need. `.env` is the single local configuration file for this prototype and is ignored by git.

Configure `.env` with OpenRouter:

```bash
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=openai/gpt-4.1-mini
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_APP_NAME=Assumption-Aware Agent Planner
```

OpenAI remains available only if you explicitly set `LLM_PROVIDER=openai` and provide an `OPENAI_API_KEY`.

The API routes intentionally call real LLM providers. There is no silent mock fallback; missing keys surface as route errors in the UI.

### Optional Google Maps Routing

For verified map routing, paste a temporary Google Maps Platform key into `.env`:

```bash
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

The server uses Google Geocoding API and Routes API when this key is present. Keep the key server-side; the app does not need a `NEXT_PUBLIC_` Google key for routing. If routing fails or coordinates are uncertain, the map shows dashed estimated segments instead of solid real routes. Do not commit `.env`; it is ignored by git.

## Deploying On Vercel

Vercel can deploy this repository as a standard Next.js app. The included `vercel.json` keeps the install/build commands explicit:

```bash
pnpm install --frozen-lockfile
pnpm build
```

Set these environment variables in Vercel Project Settings:

```bash
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=openai/gpt-4.1-mini
OPENROUTER_SITE_URL=https://your-vercel-domain.vercel.app
OPENROUTER_APP_NAME=Assumption-Aware Agent Planner
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

Do not commit `.env`; use `.env.example` as the safe template.

Recommended Vercel settings:

- Framework preset: Next.js
- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm build`
- Output directory: leave empty/default for Next.js
- Node.js version: 20 or newer

## Project Overview

- `src/app/page.tsx`: dashboard flow and client state.
- `src/app/api/analyze/route.ts`: runs hidden-preference conflict detection and checkpoint analysis.
- `src/app/api/probe/route.ts`: converts checkpoint answers into learned preferences and structured assumptions.
- `src/app/api/plan/route.ts`: runs input consistency validation, itinerary generation, and feasibility checking.
- `src/agents/`: provider calls, prompts, and localStorage memory helpers.
- `src/schemas/`: Zod schemas for every agent request and output.
- `src/types/`: shared TypeScript types inferred from Zod.
- `src/components/`: three-column dashboard UI.

## Agents

- Conflict Detector Agent: identifies latent conflicts, hidden preferences, checkpoint need, checkpoint stage, assumption risk, expected plan impact, and interaction cost.
- Preference Probe Agent: turns answered checkpoint options into learned preferences, transport assumptions, accommodation assumptions, and cost assumptions.
- Assumption Critic Agent: flags risky assumptions and explains why they matter before final planning.
- Input Consistency Agent: blocks incoherent planning input, such as a Europe trip with Tokyo marked as a required city.
- Planner Agent: generates itinerary options, map places, route segments, cost breakdowns, accommodation details, and preference influence explanations.
- Constraint Checker Agent: checks walking load, travel time, budget mismatch, booking risks, opening-hour risks, and pacing issues.
- Memory Agent: stores confirmed preferences in `localStorage` and reuses them across prompts unless the user starts a new session.

## Current Workflow

1. The user enters a short travel idea.
2. The backend detects hidden trade-offs and decides whether a checkpoint is needed.
3. The UI asks targeted preference probes instead of showing a full static form.
4. The learned preference profile can be edited, locked, ignored, or reprioritized.
5. Assumptions about transport, accommodation, and cost are reviewed before planning.
6. Input consistency is checked before itinerary generation.
7. The planner returns structured itinerary options with map places, route lines, costs, and preference influences.
8. The feasibility checker flags risks and warnings.

## Validation

All LLM outputs are requested as JSON objects and parsed through Zod before the UI receives them. Invalid JSON or schema mismatches fail the route instead of being displayed as trusted planning data. The `/api/plan` route also runs an input consistency gate before calling the itinerary planner.

## Limitations

- Opening hours, prices, ticket inventory, and transit conditions are not live-verified.
- localStorage memory is browser-local and not shared across devices.
- Provider JSON mode improves structure but does not guarantee factual correctness.
- The prototype does not include authentication, persistence beyond localStorage, or collaborative planning.

## Future Work

- Add live place, ticketing, and transit APIs for stronger feasibility checks.
- Add streaming agent progress while preserving concise trace summaries.
- Add preference conflict resolution when memory disagrees with the current prompt.
- Add exportable itineraries and shareable planning sessions.
