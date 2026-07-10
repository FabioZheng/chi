import type { Activity, Itinerary, ItineraryOption, RouteSegment } from "@/types/travel";

/**
 * Route scaffold — deterministic half of the Route Mobility Agent. The Planner
 * LLM no longer spends output tokens on mapPlaces/routeSegments; instead the
 * scaffold derives the leg structure from the planned activities (consecutive
 * stops within a day, plus day-to-day transitions), and the Google Routes
 * enrichment then replaces estimates with verified geometry where possible.
 */

type Coordinates = { lat: number; lng: number };

function haversineKm(from: Coordinates | null, to: Coordinates | null): number {
  if (!from || !to) {
    return 0;
  }

  const radiusKm = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function modeForDistance(distanceKm: number, language: "en" | "zh"): { mode: string; reason: string } {
  if (distanceKm > 250) {
    return {
      mode: language === "zh" ? "飞机或高铁" : "flight or high-speed train",
      reason: language === "zh" ? "远距离城市间移动。" : "Long inter-city distance."
    };
  }

  if (distanceKm > 25) {
    return {
      mode: language === "zh" ? "火车" : "train",
      reason: language === "zh" ? "中距离城市间移动。" : "Medium inter-city distance."
    };
  }

  if (distanceKm > 1.4) {
    return {
      mode: language === "zh" ? "公共交通" : "public transport",
      reason: language === "zh" ? "市内跨区移动。" : "Cross-town hop within the city."
    };
  }

  return {
    mode: language === "zh" ? "步行" : "walk",
    reason: language === "zh" ? "短距离，步行可达。" : "Short distance, walkable."
  };
}

function estimateMinutes(mode: string, distanceKm: number): number {
  if (distanceKm <= 0) {
    return 0;
  }

  if (/walk|步行/.test(mode)) {
    return Math.max(5, Math.round(distanceKm * 13));
  }

  if (/flight|air|飞机/.test(mode)) {
    return Math.max(60, Math.round(distanceKm * 0.12 + 90));
  }

  if (/train|火车|高铁/.test(mode)) {
    return Math.max(15, Math.round(distanceKm * 0.8 + 20));
  }

  return Math.max(8, Math.round(distanceKm * 5 + 8));
}

function scaffoldSegment(
  from: Activity,
  to: Activity,
  dayNumber: number,
  purpose: string,
  language: "en" | "zh"
): RouteSegment {
  const distanceKm = haversineKm(from.coordinates, to.coordinates);
  const { mode, reason } = modeForDistance(distanceKm, language);
  const minutes = estimateMinutes(mode, distanceKm);

  return {
    id: `scaffold-${dayNumber}-${from.id}-${to.id}`,
    dayNumber,
    fromPlaceId: from.id,
    toPlaceId: to.id,
    fromStopId: from.id,
    toStopId: to.id,
    fromCoordinates: from.coordinates,
    toCoordinates: to.coordinates,
    transportMode: mode,
    estimatedTravelTimeMinutes: minutes,
    durationSeconds: minutes * 60,
    distanceKm: Number(distanceKm.toFixed(2)),
    distanceMeters: Math.round(distanceKm * 1000),
    encodedPolyline: null,
    provider: "fallback_estimated",
    geometryStatus: "Estimated",
    confidence: from.coordinates && to.coordinates ? 0.5 : 0.2,
    routeStatus: "Estimated",
    reason,
    relatedPreference: null,
    notes: purpose,
    warnings: []
  };
}

function scaffoldOption(option: ItineraryOption, language: "en" | "zh"): ItineraryOption {
  // Respect any segments the model still produced.
  if (option.routeSegments.length > 0 || option.days.some((day) => day.routeSegments.length > 0)) {
    return option;
  }

  const segments: RouteSegment[] = [];

  option.days.forEach((day, dayIndex) => {
    day.activities.slice(1).forEach((activity, index) => {
      segments.push(
        scaffoldSegment(
          day.activities[index],
          activity,
          day.dayNumber,
          language === "zh" ? `第 ${day.dayNumber} 天 第 ${index + 1}-${index + 2} 站` : `Day ${day.dayNumber} stop ${index + 1}-${index + 2}`,
          language
        )
      );
    });

    // Day-to-day transition: last stop of the previous day to the first of this one.
    const previousDay = option.days[dayIndex - 1];
    const previousLast = previousDay?.activities[previousDay.activities.length - 1];
    const first = day.activities[0];

    if (previousDay && previousLast && first) {
      segments.push(
        scaffoldSegment(
          previousLast,
          first,
          day.dayNumber,
          language === "zh"
            ? `第 ${previousDay.dayNumber} 天 → 第 ${day.dayNumber} 天`
            : `Day ${previousDay.dayNumber} → Day ${day.dayNumber}`,
          language
        )
      );
    }
  });

  return { ...option, routeSegments: segments };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function sanitizeOptionCoordinates(option: ItineraryOption, language: "en" | "zh"): ItineraryOption {
  const located = option.days.flatMap((day) => day.activities).filter((activity) => activity.coordinates);

  if (located.length < 3) {
    return option;
  }

  const center: Coordinates = {
    lat: median(located.map((activity) => activity.coordinates!.lat)),
    lng: median(located.map((activity) => activity.coordinates!.lng))
  };
  const distances = located.map((activity) => haversineKm(activity.coordinates, center));
  const spreadKm = median(distances);
  // Generous: legitimate multi-country trips have a large spread; hallucinated
  // outliers (e.g. a Milan trip stop landing in the Gulf of Guinea) do not.
  const thresholdKm = Math.max(800, spreadKm * 4);

  const sanitizeActivity = (activity: Activity): Activity => {
    if (!activity.coordinates || haversineKm(activity.coordinates, center) <= thresholdKm) {
      return activity;
    }

    return {
      ...activity,
      coordinates: null,
      locationStatus: "Unavailable",
      locationUnavailableReason:
        language === "zh" ? "模型返回的坐标明显异常，已丢弃并等待重新地理编码。" : "Model-provided coordinates were implausible and were discarded for re-geocoding."
    };
  };

  return {
    ...option,
    days: option.days.map((day) => ({
      ...day,
      activities: day.activities.map(sanitizeActivity)
    }))
  };
}

/**
 * Drops implausible activity coordinates (near-(0,0) placeholders are already
 * rejected at the schema layer; this catches other hallucinated outliers far
 * from the trip's median center) so Google geocoding re-resolves them by name.
 */
export function sanitizeItineraryCoordinates(itinerary: Itinerary, language: "en" | "zh"): Itinerary {
  return {
    ...itinerary,
    options: itinerary.options.map((option) => sanitizeOptionCoordinates(option, language))
  };
}

export function buildRouteScaffold(itinerary: Itinerary, language: "en" | "zh"): Itinerary {
  return {
    ...itinerary,
    options: itinerary.options.map((option) => scaffoldOption(option, language))
  };
}
