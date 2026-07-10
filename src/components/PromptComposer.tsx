"use client";

import { useRef, useState } from "react";
import { Loader2, SendHorizontal, Sparkles } from "lucide-react";

export type PromptStatusChipItem = {
  id: string;
  title: string;
  detail?: string;
  status?: string;
  onSelect?: () => void;
};

export type PromptStatusChip = {
  id: string;
  label: string;
  title: string;
  items: PromptStatusChipItem[];
  emptyText: string;
  clickHint: string;
  onClick: () => void;
};

type PromptComposerProps = {
  prompt: string;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
  analyzing: boolean;
  planning: boolean;
  canGenerate: boolean;
  chips: PromptStatusChip[];
  labels: {
    promptPlaceholder: string;
    generate: string;
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
  chips,
  labels
}: PromptComposerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const visibleChips = chips.filter((chip) => chip.items.length > 0);
  const hasPrompt = prompt.trim().length >= 4;
  const showExamples = prompt.trim().length === 0 && visibleChips.length === 0 && !analyzing && !planning;

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
    <section className="pointer-events-auto fixed bottom-4 left-1/2 z-[1200] w-[calc(100%-1.5rem)] max-w-5xl -translate-x-1/2 rounded-2xl border border-slate-200/80 bg-white/92 p-2 shadow-[0_24px_70px_rgba(41,32,92,0.22)] backdrop-blur">
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
          <div className="hidden min-w-0 flex-wrap items-center gap-1 md:flex">
            {visibleChips.map((chip) => (
              <StatusChip key={chip.id} chip={chip} />
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

function StatusChip({ chip }: { chip: PromptStatusChip }) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={chip.onClick}
        className="rounded-full border border-indigo-100 bg-white px-2 py-1 text-[11px] font-semibold text-indigo-700 transition hover:border-indigo-200 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-200"
      >
        {chip.label}
      </button>
      <div className="pointer-events-none invisible absolute bottom-full left-1/2 z-[1300] mb-2 w-80 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-left opacity-0 shadow-[0_18px_52px_rgba(15,23,42,0.22)] transition group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100">
        <div className="absolute -bottom-2 left-1/2 size-4 -translate-x-1/2 rotate-45 border-b border-r border-slate-200 bg-white" />
        <p className="text-[11px] font-black uppercase text-indigo-600">{chip.title}</p>
        <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto pr-1 planner-scrollbar">
          {chip.items.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-2 text-xs font-semibold text-slate-500">{chip.emptyText}</p>
          ) : (
            chip.items.map((item) => {
              const content = (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-xs font-black text-slate-900">{item.title}</p>
                    {item.status ? (
                      <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-black text-slate-500">
                        {item.status}
                      </span>
                    ) : null}
                  </div>
                  {item.detail ? <p className="mt-1 line-clamp-3 text-[11px] font-semibold leading-4 text-slate-500">{item.detail}</p> : null}
                </>
              );

              return item.onSelect ? (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onSelect}
                  className="w-full rounded-xl border border-slate-100 bg-white p-2 text-left transition hover:border-indigo-200 hover:bg-indigo-50"
                >
                  {content}
                </button>
              ) : (
                <div key={item.id} className="rounded-xl border border-slate-100 bg-white p-2">
                  {content}
                </div>
              );
            })
          )}
        </div>
        <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] font-bold text-slate-400">{chip.clickHint}</p>
      </div>
    </div>
  );
}
