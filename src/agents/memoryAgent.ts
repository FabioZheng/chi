import type { Assumption, ConfirmedPreference, UserMemory } from "@/types/travel";

export const MEMORY_STORAGE_KEY = "assumption-aware-agent-planner:memory";

export function emptyMemory(): UserMemory {
  return {
    preferences: [],
    lastUpdated: new Date().toISOString(),
    tripCount: 0
  };
}

export function loadUserMemory(): UserMemory {
  if (typeof window === "undefined") {
    return emptyMemory();
  }

  const raw = window.localStorage.getItem(MEMORY_STORAGE_KEY);

  if (!raw) {
    return emptyMemory();
  }

  try {
    return JSON.parse(raw) as UserMemory;
  } catch {
    return emptyMemory();
  }
}

export function saveUserMemory(memory: UserMemory) {
  window.localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memory));
}

export function clearUserMemory() {
  window.localStorage.removeItem(MEMORY_STORAGE_KEY);
}

export function preferencesFromAssumptions(assumptions: Assumption[]): ConfirmedPreference[] {
  return assumptions
    .filter((assumption) => assumption.status === "Accepted" || assumption.status === "Edited")
    .map((assumption) => ({
      id: assumption.id,
      category: assumption.category,
      label: assumption.label,
      value: assumption.value,
      source: assumption.source === "Memory" ? "Memory" : "User"
    }));
}

export function mergePreferencesIntoMemory(
  memory: UserMemory,
  preferences: ConfirmedPreference[]
): UserMemory {
  const now = new Date().toISOString();
  const existing = new Map(memory.preferences.map((preference) => [preference.category, preference]));

  preferences.forEach((preference) => {
    if (!preference.value.trim()) {
      return;
    }

    existing.set(preference.category, {
      id: preference.id,
      category: preference.category,
      label: preference.label,
      value: preference.value.trim(),
      source: "User",
      updatedAt: now
    });
  });

  return {
    preferences: Array.from(existing.values()),
    lastUpdated: now,
    tripCount: memory.tripCount + 1
  };
}
