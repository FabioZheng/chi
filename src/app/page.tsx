"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { analyzePreferences, generateItinerary } from "@/api/client";
import {
  clearUserMemory,
  emptyMemory,
  loadUserMemory,
  mergePreferencesIntoMemory,
  saveUserMemory
} from "@/agents/memoryAgent";
import { ItineraryCanvas } from "@/components/ItineraryCanvas";
import { LeftRail } from "@/components/LeftRail";
import { PromptComposer } from "@/components/PromptComposer";
import { RightRail } from "@/components/RightRail";
import { TopBar } from "@/components/TopBar";
import { type Language, type ViewMode, uiText } from "@/i18n";
import type {
  AgentTrace,
  Assumption,
  AssumptionCritique,
  ConfirmedPreference,
  ConstraintWarning,
  Itinerary,
  MissingPreference,
  UserMemory
} from "@/types/travel";

const categoryLabels: Record<ConfirmedPreference["category"], string> = {
  budget: "Budget",
  pace: "Pace",
  food: "Food",
  transport: "Transport",
  walkingTolerance: "Walking tolerance",
  accommodationArea: "Accommodation area",
  interests: "Interests",
  nightlife: "Nightlife",
  touristyLocalStyle: "Touristy/local style",
  dates: "Dates",
  travelParty: "Travel party",
  accessibility: "Accessibility",
  other: "Other"
};

function runningTrace(agent: AgentTrace["agent"], summary: string): AgentTrace {
  return {
    agent,
    summary,
    status: "Running",
    count: 0,
    timestamp: new Date().toISOString()
  };
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [assumptions, setAssumptions] = useState<Assumption[]>([]);
  const [missingPreferences, setMissingPreferences] = useState<MissingPreference[]>([]);
  const [critiques, setCritiques] = useState<AssumptionCritique[]>([]);
  const [missingAnswers, setMissingAnswers] = useState<Record<string, string>>({});
  const [customPreferences, setCustomPreferences] = useState<ConfirmedPreference[]>([]);
  const [customCategory, setCustomCategory] = useState<ConfirmedPreference["category"]>("food");
  const [customValue, setCustomValue] = useState("");
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [warnings, setWarnings] = useState<ConstraintWarning[]>([]);
  const [trace, setTrace] = useState<AgentTrace[]>([]);
  const [memory, setMemory] = useState<UserMemory>(emptyMemory());
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ViewMode>("plan");
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    setMemory(loadUserMemory());
    const storedLanguage = window.localStorage.getItem("assumption-aware-agent-planner:language");
    if (storedLanguage === "en" || storedLanguage === "zh") {
      setLanguage(storedLanguage);
    }
  }, []);

  const labels = uiText[language];

  const confirmedPreferences = useMemo(() => {
    const fromAssumptions: ConfirmedPreference[] = assumptions
      .filter((assumption) => assumption.status !== "Rejected")
      .filter(
        (assumption) =>
          assumption.status === "Accepted" || assumption.status === "Edited" || assumption.source === "Memory"
      )
      .map((assumption) => ({
        id: assumption.id,
        category: assumption.category,
        label: assumption.label,
        value: assumption.value,
        source: assumption.source === "Memory" && assumption.status !== "Edited" ? "Memory" : "User"
      }));

    const fromMissing: ConfirmedPreference[] = missingPreferences.flatMap((preference) => {
      const value = missingAnswers[preference.id]?.trim();

      if (!value) {
        return [];
      }

      return [
        {
          id: `answer-${preference.id}`,
          category: preference.category,
          label: preference.question,
          value,
          source: "User"
        }
      ];
    });

    return [...fromAssumptions, ...fromMissing, ...customPreferences];
  }, [assumptions, customPreferences, missingAnswers, missingPreferences]);

  const promptStats = useMemo(
    () => ({
      assumptions: assumptions.length,
      missing: missingPreferences.filter((preference) => !missingAnswers[preference.id]?.trim()).length,
      highImpact: critiques.filter((critique) => {
        if (critique.impact !== "High") {
          return false;
        }

        const linked = assumptions.find((assumption) => assumption.id === critique.assumptionId);
        return !linked || linked.status === "Pending";
      }).length,
      memory: assumptions.filter((assumption) => assumption.source === "Memory").length
    }),
    [assumptions, critiques, missingAnswers, missingPreferences]
  );

  const canGenerate = assumptions.length > 0 && confirmedPreferences.length > 0;

  async function handleAnalyze() {
    setAnalyzing(true);
    setError(null);
    setItinerary(null);
    setWarnings([]);
    setSelectedOptionId(null);
    setTrace([
      runningTrace("Preference Agent", labels.analyzeRunning),
      runningTrace("Assumption Critic Agent", labels.criticRunning)
    ]);

    try {
      const result = await analyzePreferences({
        prompt,
        memory,
        language
      });

      setAssumptions(result.assumptions);
      setMissingPreferences(result.missingPreferences);
      setCritiques(result.critiques);
      setMissingAnswers({});
      setTrace(result.trace);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : labels.analyzeError);
      setTrace((current) =>
        current.map((entry) => ({
          ...entry,
          status: "Error"
        }))
      );
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleGenerate() {
    setPlanning(true);
    setError(null);
    setTrace((current) => [
      ...current,
      runningTrace("Planner Agent", labels.plannerRunning),
      runningTrace("Constraint Checker Agent", labels.checkerRunning)
    ]);

    try {
      const result = await generateItinerary({
        prompt,
        assumptions,
        confirmedPreferences,
        memory,
        language
      });

      setItinerary(result.itinerary);
      setWarnings(result.warnings);
      setSelectedOptionId(result.itinerary.selectedOptionId);
      setTrace((current) => [
        ...current.filter(
          (entry) => entry.agent !== "Planner Agent" && entry.agent !== "Constraint Checker Agent"
        ),
        ...result.trace
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : labels.planError);
      setTrace((current) =>
        current.map((entry) =>
          entry.agent === "Planner Agent" || entry.agent === "Constraint Checker Agent"
            ? { ...entry, status: "Error" }
            : entry
        )
      );
    } finally {
      setPlanning(false);
    }
  }

  function handleAssumptionStatusChange(id: string, status: Assumption["status"]) {
    setAssumptions((current) =>
      current.map((assumption) =>
        assumption.id === id
          ? {
              ...assumption,
              status
            }
          : assumption
      )
    );
  }

  function handleAssumptionValueChange(id: string, value: string) {
    setAssumptions((current) =>
      current.map((assumption) =>
        assumption.id === id
          ? {
              ...assumption,
              value,
              source: "User",
              confidence: 1,
              status: "Edited"
            }
          : assumption
      )
    );
  }

  function handleAddCustomPreference() {
    const value = customValue.trim();

    if (!value) {
      return;
    }

    setCustomPreferences((current) => [
      ...current,
      {
        id: `custom-${Date.now()}`,
        category: customCategory,
        label: categoryLabels[customCategory],
        value,
        source: "User"
      }
    ]);
    setCustomValue("");
  }

  function handleSaveMemory() {
    const updatedMemory = mergePreferencesIntoMemory(memory, confirmedPreferences);
    setMemory(updatedMemory);
    saveUserMemory(updatedMemory);
    setTrace((current) => [
      ...current,
      {
        agent: "Memory Agent",
        summary: `${labels.memoryStored} (${confirmedPreferences.length})`,
        status: "Complete",
        count: confirmedPreferences.length,
        timestamp: new Date().toISOString()
      }
    ]);
  }

  function handleClearMemory() {
    clearUserMemory();
    const cleared = emptyMemory();
    setMemory(cleared);
    setTrace((current) => [
      ...current,
      {
        agent: "Memory Agent",
        summary: labels.memoryCleared,
        status: "Complete",
        count: 0,
        timestamp: new Date().toISOString()
      }
    ]);
  }

  function handleLanguageChange(nextLanguage: Language) {
    setLanguage(nextLanguage);
    window.localStorage.setItem("assumption-aware-agent-planner:language", nextLanguage);
  }

  const showAssumptions = activeView === "plan" || activeView === "assumptions";
  const showCanvas = activeView === "plan" || activeView === "canvas";
  const gridClass =
    activeView === "plan"
      ? "xl:grid-cols-[360px_minmax(0,1fr)_360px]"
      : activeView === "assumptions"
        ? "xl:grid-cols-[minmax(380px,480px)_minmax(320px,1fr)]"
        : "xl:grid-cols-[minmax(0,1fr)_360px]";

  return (
    <main className="min-h-screen p-3 pb-28 text-slate-950 sm:p-4 sm:pb-28 lg:p-5 lg:pb-28">
      <TopBar
        memoryCount={memory.preferences.length}
        agentTrace={trace}
        activeView={activeView}
        language={language}
        labels={labels}
        onViewChange={setActiveView}
        onLanguageChange={handleLanguageChange}
      />

      <div className={`mt-4 grid gap-4 ${gridClass}`}>
        {showAssumptions ? (
          <LeftRail
            assumptions={assumptions}
            missingPreferences={missingPreferences}
            critiques={critiques}
            missingAnswers={missingAnswers}
            customPreferences={customPreferences}
            customCategory={customCategory}
            customValue={customValue}
            labels={labels}
            onAssumptionStatusChange={handleAssumptionStatusChange}
            onAssumptionValueChange={handleAssumptionValueChange}
            onMissingAnswerChange={(id, value) =>
              setMissingAnswers((current) => ({
                ...current,
                [id]: value
              }))
            }
            onCustomCategoryChange={setCustomCategory}
            onCustomValueChange={setCustomValue}
            onAddCustomPreference={handleAddCustomPreference}
            onRemoveCustomPreference={(id) =>
              setCustomPreferences((current) => current.filter((preference) => preference.id !== id))
            }
          />
        ) : null}

        {showCanvas ? (
          <section className="min-w-0 space-y-4">
          {error ? (
            <div className="flex items-start gap-3 rounded-[8px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-semibold">{labels.errorTitle}</p>
                <p className="mt-1 leading-5">{error}</p>
              </div>
            </div>
          ) : null}

          <ItineraryCanvas
            itinerary={itinerary}
            warnings={warnings}
            assumptions={assumptions}
            selectedOptionId={selectedOptionId}
            onSelectOption={setSelectedOptionId}
            planning={planning}
            labels={labels}
          />
        </section>
        ) : null}

        <RightRail
          prompt={prompt}
          assumptions={assumptions}
          critiques={critiques}
          itinerary={itinerary}
          warnings={warnings}
          trace={trace}
          memory={memory}
          analyzing={analyzing}
          planning={planning}
          onSaveMemory={handleSaveMemory}
          onClearMemory={handleClearMemory}
          labels={labels}
        />
      </div>

      <PromptComposer
        prompt={prompt}
        onPromptChange={setPrompt}
        onAnalyze={handleAnalyze}
        onGenerate={handleGenerate}
        analyzing={analyzing}
        planning={planning}
        canGenerate={canGenerate}
        stats={promptStats}
        labels={labels}
      />
    </main>
  );
}
