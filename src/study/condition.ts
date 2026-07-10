export type StudyCondition = {
  /** Whether the session was launched with explicit study parameters. */
  active: boolean;
  participantId: string | null;
  /** high = agent reasoning, evidence, and confidence are shown. */
  visibility: "high" | "low";
  /** high = assumptions and preferences are editable before planning. */
  controllability: "high" | "low";
  /** Unlocks experimenter-only panels (evaluation signals, log export). */
  experimenter: boolean;
};

export function defaultStudyCondition(): StudyCondition {
  return {
    active: false,
    participantId: null,
    visibility: "high",
    controllability: "high",
    experimenter: false
  };
}

/**
 * Parses `?pid=P07&cond=VC` style parameters. The condition code is two
 * letters: V/v toggles visibility, C/c toggles controllability, giving the
 * four 2x2 cells (VC, Vc, vC, vc). `exp=1` marks an experimenter session.
 */
export function parseStudyCondition(search: string): StudyCondition {
  const params = new URLSearchParams(search);
  const participantId = params.get("pid");
  const cond = params.get("cond") ?? "";
  const experimenter = params.get("exp") === "1";
  const hasCondition = /^[Vv][Cc]$/.test(cond);

  if (!participantId && !hasCondition && !experimenter) {
    return defaultStudyCondition();
  }

  return {
    active: Boolean(participantId || hasCondition),
    participantId,
    visibility: hasCondition && cond[0] === "v" ? "low" : "high",
    controllability: hasCondition && cond[1] === "c" ? "low" : "high",
    experimenter
  };
}

export function conditionCode(condition: StudyCondition): string {
  return `${condition.visibility === "high" ? "V" : "v"}${condition.controllability === "high" ? "C" : "c"}`;
}
