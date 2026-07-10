import type { ReactNode } from "react";
import type { ImpactSchema, PreferenceSourceSchema } from "@/schemas/travel";
import type { z } from "zod";

type Impact = z.infer<typeof ImpactSchema>;
type PreferenceSource = z.infer<typeof PreferenceSourceSchema>;

type PanelProps = {
  title: string;
  eyebrow?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

const impactClasses: Record<Impact, string> = {
  High: "border-rose-200 bg-rose-50 text-rose-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-700",
  Low: "border-emerald-200 bg-emerald-50 text-emerald-700"
};

const sourceClasses: Record<PreferenceSource, string> = {
  Inferred: "border-orange-200 bg-orange-50 text-orange-700",
  Memory: "border-sky-200 bg-sky-50 text-sky-700",
  User: "border-emerald-200 bg-emerald-50 text-emerald-700"
};

export function Panel({ title, eyebrow, icon, actions, children, className = "" }: PanelProps) {
  return (
    <section
      className={`rounded-xl border border-slate-200/80 bg-white/86 shadow-[0_10px_30px_rgba(26,35,67,0.06)] backdrop-blur ${className}`}
    >
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {icon ? (
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
            {eyebrow ? <p className="text-[11px] font-semibold uppercase text-slate-400">{eyebrow}</p> : null}
            <h2 className="truncate text-sm font-semibold text-slate-950">{title}</h2>
          </div>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function ImpactBadge({ impact, labels }: { impact: Impact; labels?: Record<Impact, string> }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${impactClasses[impact]}`}>
      {labels?.[impact] || impact}
    </span>
  );
}

export function SourceBadge({ source, labels }: { source: PreferenceSource; labels?: Record<PreferenceSource, string> }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${sourceClasses[source]}`}>
      {labels?.[source] || source}
    </span>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-3 py-4 text-center">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {body ? <p className="mt-1 text-xs leading-5 text-slate-500">{body}</p> : null}
    </div>
  );
}

export function IconPill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex size-7 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 ${className}`}>
      {children}
    </span>
  );
}
