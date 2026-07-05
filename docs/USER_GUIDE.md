# Assumption-Aware Agent Planner User Guide

This guide explains how to run and use the Assumption-Aware Agent Planner, how assumptions are inferred, and how each backend agent contributes to the workflow.

## 1. What This Prototype Does

The planner is a travel-planning interface designed to avoid one common failure mode of AI travel agents: silently making hidden assumptions.

Instead of immediately producing an itinerary, the app follows this sequence:

1. You enter a short travel prompt.
2. The Preference Agent identifies explicit, inferred, missing, and memory-derived preferences.
3. The Assumption Critic Agent flags risky assumptions and missing details.
4. You confirm, edit, reject, or answer preferences.
5. The Planner Agent generates itinerary options from confirmed preferences.
6. The Constraint Checker Agent reviews feasibility.
7. The Memory Agent can save confirmed preferences in browser `localStorage`.

The UI is a visualization layer for real backend LLM calls. It does not use static sample itinerary content.

## 2. Setup And Run

Install dependencies:

```bash
pnpm install
```

Create `.env` and configure OpenRouter.

```env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=openai/gpt-4.1-mini
```

OpenAI remains available only if you explicitly set `LLM_PROVIDER=openai` and provide an `OPENAI_API_KEY`.

Run the app:

```bash
pnpm dev
```

Open:

```text
http://127.0.0.1:3000
```

If the page loads but agent calls fail, check that `.env` contains `OPENROUTER_API_KEY` and `LLM_PROVIDER=openrouter`.

### Vercel Deployment

Deploy the repository as a Next.js project on Vercel. The project includes `vercel.json` with:

```bash
pnpm install --frozen-lockfile
pnpm build
```

Set these Vercel environment variables:

```env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=openai/gpt-4.1-mini
OPENROUTER_SITE_URL=https://your-vercel-domain.vercel.app
OPENROUTER_APP_NAME=Assumption-Aware Agent Planner
```

Keep local secrets in `.env`; commit only `.env.example`.

## 3. Main Interface

### Top Bar

The top bar contains:

- App title and subtitle.
- View switcher:
  - `Plan View`: full three-column dashboard.
  - `Assumptions`: focuses on assumptions, missing preferences, and backend process state.
  - `Canvas View`: focuses on the itinerary canvas and backend process state.
- Language selector:
  - `English`
  - `中文`
- Agent icons generated from the active backend workflow.

Changing the language updates the interface text and sends the selected language to backend agents. When `中文` is selected, agents are instructed to return user-facing text in Simplified Chinese while keeping JSON keys and enum values stable.

### Bottom Prompt Bar

Use the bottom prompt bar to enter travel prompts such as:

```text
Plan a 4-day food and history trip to Kyoto.
```

Buttons:

- `Analyze`: runs the Preference Agent and Assumption Critic Agent.
- `Generate`: runs the Planner Agent and Constraint Checker Agent after preferences are available.

The chips beside the prompt summarize current backend state:

- number of inferred assumptions
- number of missing preferences
- number of high-impact unresolved items
- number of memory-derived preferences applied

## 4. Recommended Workflow

1. Enter a short travel prompt.
2. Click `Analyze`.
3. Review inferred assumptions in the left column.
4. Review missing preferences and answer important gaps.
5. Use the checkpoint card to resolve the highest-impact unresolved item.
6. Confirm assumptions you agree with.
7. Edit incorrect assumptions directly in the assumption rows.
8. Reject assumptions that should not be used.
9. Click `Generate`.
10. Review itinerary options in the canvas.
11. Review feasibility warnings.
12. Save confirmed preferences to memory if you want future prompts to reuse them.

## 5. How Assumptions Are Inferred

The Preference Agent receives:

- the user prompt
- saved local memory, if any
- a list of required preference categories
- a strict JSON output schema
- the selected UI language

It separates preference information into several classes.

### Explicit Preferences

These are directly stated by the user.

Example prompt:

```text
Plan a relaxed 3-day trip to Lisbon with local food.
```

Explicit preferences may include:

- destination: Lisbon
- duration: 3 days
- pace: relaxed
- food interest: local food

### Inferred Preferences

These are likely preferences derived from the prompt, but not directly guaranteed.

Example:

```text
Plan a honeymoon in Paris.
```

Possible inferred preferences:

- romantic pacing
- scenic dining
- central accommodation
- higher comfort expectations

The UI marks these as inferred or needs-check depending on risk.

### Missing Preferences

These are important details that the prompt does not provide.

Common missing preferences:

- budget
- walking tolerance
- transport style
- accommodation area
- dietary restrictions
- nightlife preference
- touristy vs local style
- accessibility needs

Missing preferences appear as selectable options or text inputs, depending on what the backend returns.

### Memory-Derived Preferences

If you saved preferences earlier, the Memory Agent stores them in `localStorage`.

Future prompts can reuse them. Memory-derived assumptions are labeled as memory-based so users can distinguish saved preferences from new inferences.

## 6. Impact Levels

The Assumption Critic Agent assigns impact levels:

- `Low`: minor wording or small preference fit issue.
- `Medium`: could change several activity choices, timing, or comfort.
- `High`: could change itinerary structure, budget, accessibility, walking load, booking needs, or core experience.

High-impact unresolved items are surfaced in the checkpoint card so users address them before planning.

## 7. Agent Roles

### Preference Agent

Purpose:

- detects explicit preferences
- infers likely preferences
- identifies missing preferences
- labels memory-derived preferences

Output includes:

- `assumptions`
- `missingPreferences`
- `memoryDerivedPreferenceIds`
- short summary

The agent does not generate an itinerary.

### Assumption Critic Agent

Purpose:

- reviews assumptions and missing preferences
- flags risky or high-impact items
- explains why each risk matters
- recommends a user-facing confirmation question

Output includes:

- `critiques`
- impact level
- reason
- suggested resolution

The critic does not generate an itinerary.

### Planner Agent

Purpose:

- generates itinerary options only after confirmed preferences exist
- uses accepted assumptions, user edits, missing-preference answers, and memory
- creates day-by-day itinerary JSON

Output includes:

- destination
- duration
- itinerary options
- itinerary days
- activities
- alternatives
- cost, walking, transit, pacing, booking-risk, and opening-hour-risk fields

The UI renders however many days the backend returns.

### Constraint Checker Agent

Purpose:

- checks the generated itinerary for feasibility issues
- flags walking load, travel time, budget mismatch, booking risk, opening-hour risk, and pacing problems

Output includes:

- warnings
- affected day
- impact
- recommendation

This agent reviews the plan but does not rewrite it.

### Memory Agent

Purpose:

- stores confirmed preferences in browser `localStorage`
- reuses saved preferences in later prompts
- clearly labels memory-derived preferences

Memory is local to the current browser and device.

## 8. What The Views Show

### Plan View

Shows the complete workflow:

- left assumption and checkpoint controls
- center itinerary canvas
- right backend timeline and memory/explanation panels

### Assumptions View

Focuses on:

- inferred assumptions
- missing preferences
- high-impact checkpoint
- backend process visibility

Use this view when you want to inspect and correct assumptions before planning.

### Canvas View

Focuses on:

- itinerary options
- day cards
- activity cards
- influence badges
- alternatives
- constraint warnings

Use this view after generating an itinerary.

## 9. Language Support

Use the top language selector to switch between English and Chinese.

When Chinese is selected:

- UI labels switch to Chinese.
- API requests include `language: "zh"`.
- agents are instructed to write user-facing fields in Simplified Chinese.
- schema keys and enum values stay in English for validation stability.

This means fields like `category`, `impact`, and `status` remain stable internally, while visible descriptions, questions, rationales, summaries, and itinerary text can be Chinese.

## 10. Data Validation

All LLM outputs are structured JSON and validated with Zod.

The app validates:

- assumptions
- missing preferences
- critiques
- itineraries
- days
- activities
- alternatives
- warnings
- agent traces
- memory

The schema normalizes common provider variations. For example:

- lowercase risk values can be normalized to `Low`, `Medium`, or `High`
- `optionId` can be normalized to `id`
- `estimatedCostEUR` can be normalized to `estimatedCostEur`
- `Confirmed` can be normalized into the app's checkpoint-oriented status model

The app no longer rejects valid agent outputs only because arrays are longer than expected. It validates item shape instead of imposing brittle UI-sized caps.

## 11. Troubleshooting

### Agent call failed because of missing API key

Check `.env`.

For OpenRouter:

```env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=your_key_here
```

For OpenAI, only if explicitly opting back in:

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=your_key_here
```

Restart the dev server after changing `.env`.

### The generated plan looks too generic

Add or confirm more preferences:

- budget
- pace
- accommodation area
- walking tolerance
- food preferences
- transport style
- must-see interests

Then generate again.

### Chinese content is mixed with English

Some internal labels, ids, schema keys, and enum values intentionally stay in English for validation. User-facing summaries, questions, rationales, itinerary text, and warning descriptions should follow the selected language.

### Memory seems stale

Use the Memory Panel trash button to clear local memory, then analyze again.

## 12. Limitations

- The app does not live-check ticket inventory, transit disruptions, or current opening hours.
- Costs and walking distances are estimates from the LLM, not verified external data.
- Memory is local to browser `localStorage`.
- There is no authentication or server-side user profile.
- JSON mode improves structure but does not guarantee factual correctness.

## 13. Good Demo Prompts

English:

```text
Plan a 3-day trip to Seoul for food, markets, and modern design. Keep walking moderate.
```

```text
Plan a 5-day family trip to Barcelona. We like architecture and beaches but need a relaxed pace.
```

Chinese:

```text
帮我规划一个京都两日游，重点是寺庙和当地美食，节奏不要太赶。
```

```text
帮我规划一个东京三日游，预算中等，喜欢动漫、咖啡馆和夜景。
```

