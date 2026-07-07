"use client";

import { useRef, useState } from "react";
import { Loader2, SendHorizontal, Sparkles } from "lucide-react";

type PromptStats = {
  assumptions: number;
  missing: number;
  highImpact: number;
  memory: number;
};

type PromptComposerProps = {
  prompt: string;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
  analyzing: boolean;
  planning: boolean;
  canGenerate: boolean;
  stats: PromptStats;
  labels: {
    promptPlaceholder: string;
    generate: string;
    assumptionsInferred: string;
    missingPreferences: string;
    highImpactUnresolved: string;
    memoryApplied: string;
    promptTooShort: string;
    examplesLabel: string;
    examples: readonly string[];
  };
};

export function PromptComposer({
  prompt,
  onPromptChange,
  onGenerate,
  analyzing,
  planning,
  canGenerate,
  stats,
  labels
}: PromptComposerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const chips = [
    { label: `${stats.assumptions} ${labels.assumptionsInferred}`, show: stats.assumptions > 0 },
    { label: `${stats.missing} ${labels.missingPreferences}`, show: stats.missing > 0 },
    { label: `${stats.highImpact} ${labels.highImpactUnresolved}`, show: stats.highImpact > 0 },
    { label: `${stats.memory} ${labels.memoryApplied}`, show: stats.memory > 0 }
  ].filter((chip) => chip.show);
  const hasPrompt = prompt.trim().length >= 4;
  const showExamples = prompt.trim().length === 0 && chips.length === 0 && !analyzing && !planning;

  function focusPrompt() {
    inputRef.current?.focus();
  }

  function chooseExample(example: string) {
    onPromptChange(example);
    setAttemptedSubmit(false);
    requestAnimationFrame(focusPrompt);
  }

  function submitGenerate() {
    setAttemptedSubmit(true);

    if (analyzing || planning) {
      return;
    }

    if (!hasPrompt) {
      focusPrompt();
      return;
    }

    onGenerate();
    setAttemptedSubmit(false);
  }

  return (
    <section className="pointer-events-auto fixed bottom-4 left-1/2 z-[1200] w-[calc(100%-1.5rem)] max-w-5xl -translate-x-1/2 rounded-[22px] border border-slate-200/80 bg-white/92 p-2 shadow-[0_24px_70px_rgba(41,32,92,0.22)] backdrop-blur">
      <form
        className="flex flex-col gap-2 md:flex-row md:items-center"
        onSubmit={(event) => {
          event.preventDefault();
          submitGenerate();
        }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-full bg-slate-50 px-3 py-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <Sparkles className="size-5" />
          </div>
          <input
            ref={inputRef}
            value={prompt}
            onChange={(event) => {
              onPromptChange(event.target.value);
              if (event.target.value.trim().length >= 4) {
                setAttemptedSubmit(false);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !analyzing && !planning) {
                event.preventDefault();
                submitGenerate();
              }
            }}
            placeholder={labels.promptPlaceholder}
            className="h-9 min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
          />
          {attemptedSubmit && !hasPrompt ? (
            <span className="hidden shrink-0 text-xs font-bold text-rose-600 md:inline">{labels.promptTooShort}</span>
          ) : null}
          <div className="hidden min-w-0 flex-wrap items-center gap-1 lg:flex">
            {chips.map((chip) => (
              <span
                key={chip.label}
                className="rounded-full border border-indigo-100 bg-white px-2 py-1 text-[11px] font-semibold text-indigo-700"
              >
                {chip.label}
              </span>
            ))}
          </div>
        </div>

        <div className="flex shrink-0">
          <button
            type="submit"
            disabled={analyzing || planning}
            data-testid="prompt-primary-button"
            title={labels.generate}
            aria-label={labels.generate}
            className={`pointer-events-auto flex size-11 items-center justify-center rounded-full text-white transition disabled:cursor-wait disabled:from-indigo-200 disabled:to-violet-200 disabled:shadow-none ${
              canGenerate
                ? "bg-gradient-to-br from-indigo-600 to-violet-600 shadow-[0_12px_28px_rgba(99,68,255,0.32)] hover:from-indigo-500 hover:to-violet-500"
                : "bg-gradient-to-br from-indigo-500 to-violet-500 shadow-[0_12px_28px_rgba(99,68,255,0.24)] hover:from-indigo-500 hover:to-violet-500"
            }`}
          >
            {analyzing || planning ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
          </button>
        </div>
        {attemptedSubmit && !hasPrompt ? (
          <p className="px-3 text-xs font-bold text-rose-600 md:hidden">{labels.promptTooShort}</p>
        ) : null}
      </form>
      {showExamples ? (
        <div className="flex flex-wrap items-center gap-1.5 px-3 pb-1 pt-2">
          <span className="mr-1 text-[11px] font-black uppercase text-slate-400">{labels.examplesLabel}</span>
          {labels.examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => chooseExample(example)}
              className="pointer-events-auto rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 transition hover:border-indigo-200 hover:bg-white"
            >
              {example}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
