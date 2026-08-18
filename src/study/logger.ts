import { conditionCode, type StudyCondition } from "@/study/condition";

export type StudyEventName =
  | "session_start"
  | "session_reset"
  | "prompt_submitted"
  | "detect_conflicts"
  | "conflicts_received"
  | "probe_answered"
  | "probe_skipped"
  | "probe_refined"
  | "learn_preferences"
  | "preferences_received"
  | "preference_edited"
  | "preference_control_changed"
  | "assumption_status_changed"
  | "assumption_refined"
  | "assumption_viewed"
  | "assumption_expanded"
  | "assumption_confirmed"
  | "assumption_corrected"
  | "assumption_rejected"
  | "assumption_locked"
  | "branch_expanded"
  | "more_branches_requested"
  | "more_branches_exhausted"
  | "branch_pinned"
  | "branch_pruned"
  | "branch_selected"
  | "branch_restored"
  | "branch_preference_changed"
  | "branch_redirected"
  | "branch_expand_aborted"
  | "decision_lock_changed"
  | "checkpoint_paused"
  | "checkpoint_continued"
  | "checkpoint_restored"
  | "counterfactual_preview_opened"
  | "regeneration_triggered"
  | "planning_state_restored"
  | "generate_requested"
  | "plan_refined"
  | "plan_received"
  | "plan_error"
  | "option_selected"
  | "section_opened"
  | "log_exported";

export type StudyEvent = {
  ts: string;
  participantId: string | null;
  condition: string;
  event: StudyEventName;
  objectId?: string;
  payload?: Record<string, unknown>;
};

const MAX_EVENTS = 5000;

function storageKey(condition: StudyCondition): string {
  return `assumption-aware-agent-planner:study-log:${condition.participantId ?? "anonymous"}`;
}

function readLog(condition: StudyCondition): StudyEvent[] {
  try {
    const raw = window.localStorage.getItem(storageKey(condition));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as StudyEvent[]) : [];
  } catch {
    return [];
  }
}

/**
 * Appends one event to the participant's local log. Append-only with
 * timestamps, unlike the mutable session snapshot: this is the record the
 * study measures (corrected assumptions, edits, timings) are computed from.
 */
export function logStudyEvent(
  condition: StudyCondition,
  event: StudyEventName,
  objectId?: string,
  payload?: Record<string, unknown>
): void {
  if (typeof window === "undefined") {
    return;
  }

  const entry: StudyEvent = {
    ts: new Date().toISOString(),
    participantId: condition.participantId,
    condition: conditionCode(condition),
    event,
    ...(objectId ? { objectId } : {}),
    ...(payload ? { payload } : {})
  };

  try {
    const log = readLog(condition);
    log.push(entry);
    window.localStorage.setItem(storageKey(condition), JSON.stringify(log.slice(-MAX_EVENTS)));
  } catch {
    // Logging must never break the planner UI.
  }
}

export function exportStudyLog(condition: StudyCondition): void {
  const log = readLog(condition);
  logStudyEvent(condition, "log_exported", undefined, { eventCount: log.length });
  const blob = new Blob(
    [
      JSON.stringify(
        {
          participantId: condition.participantId,
          condition: conditionCode(condition),
          exportedAt: new Date().toISOString(),
          events: log
        },
        null,
        2
      )
    ],
    { type: "application/json" }
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `study-log-${condition.participantId ?? "anonymous"}-${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function clearStudyLog(condition: StudyCondition): void {
  try {
    window.localStorage.removeItem(storageKey(condition));
  } catch {
    // ignore
  }
}
