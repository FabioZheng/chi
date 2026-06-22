"use client";

import { Loader2, SearchCheck, SendHorizontal, Sparkles } from "lucide-react";

type PromptStats = {
  assumptions: number;
  missing: number;
  highImpact: number;
  memory: number;
};

type PromptComposerProps = {
  prompt: string;
  onPromptChange: (value: string) => void;
  onAnalyze: () => void;
  onGenerate: () => void;
  analyzing: boolean;
  planning: boolean;
  canGenerate: boolean;
  stats: PromptStats;
  labels: {
    promptPlaceholder: string;
    analyze: string;
    generate: string;
    assumptionsInferred: string;
    missingPreferences: string;
    highImpactUnresolved: string;
    memoryApplied: string;
  };
};

export function PromptComposer({
  prompt,
  onPromptChange,
  onAnalyze,
  onGenerate,
  analyzing,
  planning,
  canGenerate,
  stats,
  labels
}: PromptComposerProps) {
  const chips = [
    { label: `${stats.assumptions} ${labels.assumptionsInferred}`, show: stats.assumptions > 0 },
    { label: `${stats.missing} ${labels.missingPreferences}`, show: stats.missing > 0 },
    { label: `${stats.highImpact} ${labels.highImpactUnresolved}`, show: stats.highImpact > 0 },
    { label: `${stats.memory} ${labels.memoryApplied}`, show: stats.memory > 0 }
  ].filter((chip) => chip.show);

  return (
    <section className="sticky bottom-3 z-20 mx-auto max-w-5xl rounded-full border border-slate-200/80 bg-white/92 p-2 shadow-[0_18px_50px_rgba(41,32,92,0.16)] backdrop-blur">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-full bg-slate-50 px-3 py-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <Sparkles className="size-5" />
          </div>
          <input
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !analyzing && !planning) {
                event.preventDefault();
                onAnalyze();
              }
            }}
            placeholder={labels.promptPlaceholder}
            className="h-9 min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
          />
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

        <div className="flex shrink-0 gap-2">
          <button
            onClick={onAnalyze}
            disabled={analyzing || planning || prompt.trim().length < 4}
            className="flex h-11 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            {analyzing ? <Loader2 className="size-4 animate-spin" /> : <SearchCheck className="size-4" />}
            {labels.analyze}
          </button>
          <button
            onClick={onGenerate}
            disabled={!canGenerate || analyzing || planning}
            className="flex h-11 min-w-12 items-center justify-center gap-2 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 px-4 text-sm font-bold text-white shadow-[0_12px_28px_rgba(99,68,255,0.32)] transition hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:from-indigo-200 disabled:to-violet-200 disabled:shadow-none"
          >
            {planning ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
            <span className="hidden sm:inline">{labels.generate}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
