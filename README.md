# Assumption-Aware Agent Planner

A React + TypeScript prototype for travel planning that exposes assumptions before generating an itinerary. Users enter short prompts such as "Plan a 3-day trip to Rome", run preference analysis, confirm or edit inferred assumptions, then generate a feasibility-checked itinerary.

For full operating instructions, workflow details, and agent explanations, see [docs/USER_GUIDE.md](docs/USER_GUIDE.md).

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## `.env` Instructions

Copy `.env.example` to `.env` and add one provider key:

```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4.1-mini
```

Or use OpenRouter:

```bash
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=openai/gpt-4.1-mini
```

The API routes intentionally call real LLM providers. There is no silent mock fallback; missing keys surface as route errors in the UI.

## Project Overview

- `src/app/page.tsx`: dashboard flow and client state.
- `src/app/api/analyze/route.ts`: runs Preference Agent and Assumption Critic Agent.
- `src/app/api/plan/route.ts`: runs Planner Agent and Constraint Checker Agent.
- `src/agents/`: provider calls, prompts, and localStorage memory helpers.
- `src/schemas/`: Zod schemas for every agent request and output.
- `src/types/`: shared TypeScript types inferred from Zod.
- `src/components/`: three-column dashboard UI.

## Agents

- Preference Agent: detects inferred, missing, and memory-derived preferences across budget, pace, food, transport, walking tolerance, accommodation area, interests, nightlife, and touristy/local style.
- Assumption Critic Agent: flags risky assumptions, explains why they matter, and assigns Low, Medium, or High impact.
- Planner Agent: generates day-by-day itinerary options from confirmed preferences and memory.
- Constraint Checker Agent: checks walking load, travel time, budget mismatch, booking risks, opening-hour risks, and pacing issues.
- Memory Agent: stores confirmed preferences in `localStorage` and reuses them in future prompts with clear Memory labels.

## Validation

All LLM outputs are requested as JSON objects and parsed through Zod before the UI receives them. Invalid JSON or schema mismatches fail the route instead of being displayed as trusted planning data.

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
