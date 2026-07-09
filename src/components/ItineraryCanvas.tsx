"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bed,
  Bus,
  CalendarDays,
  ChevronDown,
  Euro,
  Footprints,
  MapPin,
  Navigation2,
  Route,
  Sparkles,
  Tickets,
  Timer,
  WalletCards
} from "lucide-react";
import { EmptyState, ImpactBadge, Panel } from "@/components/Panel";
import type { UIText } from "@/i18n";
import type {
  Activity,
  Assumption,
  ConstraintWarning,
  CostBreakdownItem,
  Itinerary,
  ItineraryDay,
  ItineraryOption,
  MapPlace,
  RouteSegment
} from "@/types/travel";

type ItineraryCanvasProps = {
  itinerary: Itinerary | null;
  warnings: ConstraintWarning[];
  assumptions: Assumption[];
  selectedOptionId: string | null;
  onSelectOption: (id: string) => void;
  planning: boolean;
  labels: UIText;
  mode?: "map" | "review";
  onOpenReview?: (dayNumber?: number | null) => void;
};

type MapView = "all" | number;

type DisplayPlace = MapPlace & {
  sequence: number;
  orderInDay: number;
  markerLabel: string;
  kind: "poi" | "base";
  activity: Activity | null;
  isAssumedBase: boolean;
  dayTitle: string | null;
};

type PositionedPlace = DisplayPlace & {
  x: number;
  y: number;
};

type DisplayRouteSegment = RouteSegment & {
  isSynthetic: boolean;
};

type MapCamera = {
  centerLat: number;
  centerLng: number;
  zoom: number;
};

type MapAdjustment = {
  zoomDelta: number;
  offsetX: number;
  offsetY: number;
};

type LeafletModule = typeof import("leaflet");
type LeafletMapInstance = import("leaflet").Map;
type LeafletLayerGroup = import("leaflet").LayerGroup;
type LeafletImport = LeafletModule & { default?: LeafletModule };

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 600;
const MAP_TILE_SIZE = 256;
const MIN_ZOOM = 2;
const MAX_ZOOM = 16;
const MAP_PADDING = 130;

const DAY_COLORS = ["#2563eb", "#f59e0b", "#7c3aed", "#10b981", "#ef4444", "#0ea5e9"];

function formatDay(labels: UIText, dayNumber: number) {
  return labels.daySuffix ? `${labels.day}${dayNumber}${labels.daySuffix}` : `${labels.day} ${dayNumber}`;
}

function formatMinutes(value: number, labels: UIText) {
  return `${Math.round(value)} ${labels.minutes}`;
}

function activityTone(index: number) {
  const tones = [
    "from-blue-100 to-indigo-100 text-blue-800",
    "from-orange-100 to-amber-100 text-orange-800",
    "from-emerald-100 to-teal-100 text-emerald-800",
    "from-rose-100 to-pink-100 text-rose-800",
    "from-violet-100 to-fuchsia-100 text-violet-800"
  ];

  return tones[index % tones.length];
}

function influenceTone(status: Assumption["status"]) {
  if (status === "Accepted" || status === "Edited") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "Rejected") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-orange-200 bg-orange-50 text-orange-700";
}

function linkedAssumptions(activity: Activity, assumptions: Assumption[]) {
  const haystack = `${activity.title} ${activity.description} ${activity.preferenceFit}`.toLowerCase();
  return assumptions
    .filter((assumption) => {
      const label = assumption.label.toLowerCase();
      const category = assumption.category.toLowerCase();
      const value = assumption.value.toLowerCase();
      return (
        haystack.includes(label) ||
        haystack.includes(category) ||
        value.split(/[,\s]+/).some((part) => part.length > 4 && haystack.includes(part))
      );
    })
    .slice(0, 2);
}

function normalizedPlaceText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function placeStableKey(place: Pick<MapPlace, "title" | "location">) {
  return `${normalizedPlaceText(place.title)}|${normalizedPlaceText(place.location)}`;
}

function activityPlaces(option: ItineraryOption): MapPlace[] {
  return option.days.flatMap((day) =>
    day.activities.map((activity) => ({
      id: `day-${day.dayNumber}-${activity.id}`,
      dayNumber: day.dayNumber,
      title: activity.title,
      location: activity.location,
      coordinates: activity.coordinates,
      locationStatus: activity.locationStatus,
      sourceActivityId: activity.id,
      unavailableReason: activity.locationUnavailableReason
    }))
  );
}

function derivePlaces(option: ItineraryOption): MapPlace[] {
  const derivedActivityPlaces = activityPlaces(option);

  if (option.mapPlaces.length === 0) {
    return derivedActivityPlaces;
  }

  const activityById = new Map<string, MapPlace>();
  const activityByStableKey = new Map<string, MapPlace>();

  derivedActivityPlaces.forEach((place) => {
    if (place.sourceActivityId) {
      activityById.set(place.sourceActivityId, place);
    }

    activityById.set(place.id, place);
    activityByStableKey.set(placeStableKey(place), place);
  });

  const consumedActivityIds = new Set<string>();
  const mergedPlaces = option.mapPlaces.map((place) => {
    const activityMatch =
      (place.sourceActivityId ? activityById.get(place.sourceActivityId) : null) ||
      activityById.get(place.id) ||
      activityByStableKey.get(placeStableKey(place));
    const coordinates = place.coordinates ?? activityMatch?.coordinates ?? null;

    if (activityMatch?.sourceActivityId) {
      consumedActivityIds.add(activityMatch.sourceActivityId);
    }

    consumedActivityIds.add(activityMatch?.id ?? "");

    return {
      ...place,
      dayNumber: place.dayNumber ?? activityMatch?.dayNumber ?? null,
      coordinates,
      locationStatus: coordinates ? (place.coordinates ? place.locationStatus : activityMatch?.locationStatus ?? "Approximate") : place.locationStatus,
      sourceActivityId: place.sourceActivityId ?? activityMatch?.sourceActivityId ?? null,
      unavailableReason: coordinates ? null : place.unavailableReason ?? activityMatch?.unavailableReason ?? labelsUnavailableReason(activityMatch)
    };
  });
  const mergedIds = new Set(mergedPlaces.map((place) => place.id));
  const mergedStableKeys = new Set(mergedPlaces.map((place) => `${place.dayNumber ?? "all"}|${placeStableKey(place)}`));
  const supplementalActivityPlaces = derivedActivityPlaces.filter((place) => {
    const sourceId = place.sourceActivityId ?? place.id;
    return !mergedIds.has(place.id) && !consumedActivityIds.has(sourceId) && !mergedStableKeys.has(`${place.dayNumber ?? "all"}|${placeStableKey(place)}`);
  });

  return [...mergedPlaces, ...supplementalActivityPlaces];
}

function activityLookup(option: ItineraryOption) {
  const lookup = new Map<string, { activity: Activity; day: ItineraryDay; order: number }>();

  option.days.forEach((day) => {
    day.activities.forEach((activity, index) => {
      lookup.set(activity.id, { activity, day, order: index + 1 });
    });
  });

  return lookup;
}

function averageCoordinates(places: Array<Pick<MapPlace, "coordinates">>) {
  const located = places.filter((place) => place.coordinates);

  if (located.length === 0) {
    return null;
  }

  return {
    lat: located.reduce((sum, place) => sum + (place.coordinates?.lat ?? 0), 0) / located.length,
    lng: located.reduce((sum, place) => sum + (place.coordinates?.lng ?? 0), 0) / located.length
  };
}

function buildDisplayPlaces(option: ItineraryOption, labels: UIText): DisplayPlace[] {
  const rawPlaces = derivePlaces(option);
  const activities = activityLookup(option);
  const consumedOrder = new Map<number, number>();

  const orderedPlaces = rawPlaces
    .map((place, sequence) => {
      const activityMatch = place.sourceActivityId ? activities.get(place.sourceActivityId) : activities.get(place.id);
      const dayNumber = place.dayNumber ?? activityMatch?.day.dayNumber ?? null;
      const orderInDay = activityMatch?.order ?? 0;

      return {
        place,
        sequence,
        dayNumber,
        orderInDay
      };
    })
    .sort((a, b) => {
      const dayA = a.dayNumber ?? 999;
      const dayB = b.dayNumber ?? 999;

      if (dayA !== dayB) {
        return dayA - dayB;
      }

      if (a.orderInDay !== b.orderInDay) {
        return a.orderInDay - b.orderInDay;
      }

      return a.sequence - b.sequence;
    });

  const displayPlaces: DisplayPlace[] = orderedPlaces.map(({ place }, sequence) => {
    const activityMatch = place.sourceActivityId ? activities.get(place.sourceActivityId) : activities.get(place.id);
    const dayNumber = place.dayNumber ?? activityMatch?.day.dayNumber ?? null;
    const nextOrder = dayNumber ? (consumedOrder.get(dayNumber) || 0) + 1 : sequence + 1;

    if (dayNumber) {
      consumedOrder.set(dayNumber, nextOrder);
    }

    return {
      ...place,
      dayNumber,
      sequence,
      orderInDay: activityMatch?.order || nextOrder,
      markerLabel: String(activityMatch?.order || nextOrder),
      kind: "poi",
      activity: activityMatch?.activity || null,
      isAssumedBase: false,
      dayTitle: activityMatch?.day.title || null
    };
  });

  const basePlaces = option.days.map((day, index) => {
    const dayPlaces = displayPlaces.filter((place) => place.dayNumber === day.dayNumber && place.coordinates);
    const coordinates = averageCoordinates(dayPlaces);
    const area = day.accommodation?.area || primaryDayLocation(day, displayPlaces);
    const baseTitle = day.accommodation ? labels.hotelBase : labels.assumedBaseArea;
    const isAssumedBase = !day.accommodation || day.accommodation.status !== "Accepted";

    return {
      id: `base-day-${day.dayNumber}`,
      dayNumber: day.dayNumber,
      title: baseTitle,
      location: area,
      coordinates,
      locationStatus: coordinates ? "Approximate" as const : "Unavailable" as const,
      sourceActivityId: null,
      unavailableReason: coordinates ? null : labels.routeMissingReason,
      sequence: displayPlaces.length + index,
      orderInDay: 0,
      markerLabel: "B",
      kind: "base" as const,
      activity: null,
      isAssumedBase,
      dayTitle: day.title
    };
  });

  return [...displayPlaces, ...basePlaces];
}

function labelsUnavailableReason(place: MapPlace | undefined) {
  return place?.unavailableReason ?? "Coordinates unavailable.";
}

function sequencedPlacesForView(
  places: DisplayPlace[],
  option: ItineraryOption,
  view: MapView
) {
  if (view === "all") {
    return places;
  }

  const dayPlaces = places.filter((place) => place.dayNumber === view);

  if (dayPlaces.some((place) => place.coordinates)) {
    return dayPlaces;
  }

  const routePlaceIds = new Set<string>();
  routeSegmentsForView(option, view).forEach((segment) => {
    routePlaceIds.add(segment.fromPlaceId);
    routePlaceIds.add(segment.toPlaceId);
  });
  const referencedSharedPlaces = places.filter(
    (place) =>
      place.dayNumber === null &&
      place.coordinates &&
      (routePlaceIds.has(place.id) || Boolean(place.sourceActivityId && routePlaceIds.has(place.sourceActivityId)))
  );
  const sharedPlaces = referencedSharedPlaces.length > 0 ? referencedSharedPlaces : places.filter((place) => place.dayNumber === null && place.coordinates);
  const clonedSharedPlaces = sharedPlaces.map((place) => ({
    ...place,
    dayNumber: view
  }));

  return [...dayPlaces, ...clonedSharedPlaces];
}

function mapPlacesKey(places: DisplayPlace[]) {
  return places
    .map((place) => `${place.id}:${place.dayNumber ?? "all"}:${place.coordinates?.lat ?? "x"}:${place.coordinates?.lng ?? "x"}`)
    .join("|");
}

function routeSegmentLooseKey(segment: RouteSegment) {
  return [
    segment.fromPlaceId,
    segment.toPlaceId,
    segment.transportMode.toLowerCase(),
    Math.round(segment.estimatedTravelTimeMinutes),
    segment.distanceKm.toFixed(2),
    segment.notes.toLowerCase()
  ].join("|");
}

function routeSegmentRenderKey(segment: RouteSegment, index: number) {
  return `${segment.id}-${segment.dayNumber ?? "all"}-${segment.fromPlaceId}-${segment.toPlaceId}-${index}`;
}

function routeStatusLabel(labels: UIText, status: RouteSegment["routeStatus"]) {
  if (status === "Real") {
    return labels.routeReal;
  }

  if (status === "Missing") {
    return labels.routeMissing;
  }

  return labels.routeEstimated;
}

function routeStatusTone(status: RouteSegment["routeStatus"]) {
  if (status === "Real") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "Missing") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function haversineDistanceKm(
  from: { lat: number; lng: number } | null | undefined,
  to: { lat: number; lng: number } | null | undefined
) {
  if (!from || !to) {
    return 0;
  }

  const radiusKm = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateTravelMinutes(mode: string, distanceKm: number) {
  const normalizedMode = mode.toLowerCase();

  if (distanceKm <= 0) {
    return 0;
  }

  if (normalizedMode.includes("walk")) {
    return Math.max(5, Math.round(distanceKm * 13));
  }

  if (normalizedMode.includes("train") || normalizedMode.includes("metro") || normalizedMode.includes("public") || normalizedMode.includes("bus")) {
    return Math.max(8, Math.round(distanceKm * 5 + 8));
  }

  if (normalizedMode.includes("flight") || normalizedMode.includes("air")) {
    return Math.max(60, Math.round(distanceKm * 0.12 + 90));
  }

  return Math.max(8, Math.round(distanceKm * 4 + 6));
}

function routeDistance(segment: RouteSegment, from?: DisplayPlace, to?: DisplayPlace) {
  return segment.distanceKm || segment.distanceMeters / 1000 || haversineDistanceKm(from?.coordinates, to?.coordinates);
}

function isVerifiedRouteGeometry(segment: RouteSegment) {
  return segment.provider === "google_routes" && segment.geometryStatus === "Real" && Boolean(segment.encodedPolyline);
}

function routeGeometryStatus(segment: RouteSegment): RouteSegment["routeStatus"] {
  if (isVerifiedRouteGeometry(segment)) {
    return "Real";
  }

  return segment.routeStatus === "Missing" || segment.geometryStatus === "Missing" ? "Missing" : "Estimated";
}

function decodeGooglePolyline(encoded: string): [number, number][] {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates: [number, number][] = [];

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coordinates.push([lat / 1e5, lng / 1e5]);
  }

  return coordinates;
}

type TripTimelineItem = {
  id: string;
  startDay: number;
  endDay: number;
  title: string;
  placeId: string | null;
};

function primaryDayLocation(day: ItineraryDay, places: DisplayPlace[]) {
  const dayPlaces = places.filter((place) => place.dayNumber === day.dayNumber);
  const firstLocatedPlace = dayPlaces.find((place) => place.coordinates) || dayPlaces[0];
  const firstActivity = day.activities[0];

  return (
    day.accommodation?.area ||
    firstLocatedPlace?.location ||
    firstLocatedPlace?.title ||
    firstActivity?.location ||
    day.title
  );
}

function buildTripTimelineItems(option: ItineraryOption, places: DisplayPlace[]): TripTimelineItem[] {
  const items: TripTimelineItem[] = [];

  option.days.forEach((day) => {
    const title = primaryDayLocation(day, places);
    const dayPlace = places.find((place) => place.dayNumber === day.dayNumber && place.coordinates) || null;
    const current = items[items.length - 1];

    if (current && current.title === title && current.endDay === day.dayNumber - 1) {
      current.endDay = day.dayNumber;
      current.placeId = current.placeId || dayPlace?.id || null;
      return;
    }

    items.push({
      id: `timeline-${day.dayNumber}-${normalizedPlaceText(title) || "day"}`,
      startDay: day.dayNumber,
      endDay: day.dayNumber,
      title,
      placeId: dayPlace?.id || null
    });
  });

  return items;
}

function dayRangeLabel(labels: UIText, startDay: number, endDay: number) {
  if (startDay === endDay) {
    return formatDay(labels, startDay);
  }

  return labels.daySuffix
    ? `${labels.day}${startDay}-${endDay}${labels.daySuffix}`
    : `${labels.day} ${startDay}-${endDay}`;
}

function selectedPlaceHighlights(selectedOption: ItineraryOption, selectedPlace: MapPlace | null) {
  if (!selectedPlace?.dayNumber) {
    return selectedOption.days[0]?.activities.slice(0, 3) || [];
  }

  const day = selectedOption.days.find((item) => item.dayNumber === selectedPlace.dayNumber);
  if (!day) {
    return [];
  }

  const stableLocation = normalizedPlaceText(selectedPlace.location);
  const related = day.activities.filter((activity) => {
    const matchesSource = selectedPlace.sourceActivityId && selectedPlace.sourceActivityId === activity.id;
    const matchesLocation = stableLocation && normalizedPlaceText(activity.location) === stableLocation;
    return matchesSource || matchesLocation;
  });

  return (related.length > 0 ? related : day.activities).slice(0, 3);
}

function routeTransportModes(routeSegments: DisplayRouteSegment[], labels: UIText) {
  const modes = new Map<string, { label: string; color: string; dashArray?: string }>();
  const seedModes = [
    labels.walk,
    labels.taxiCar,
    labels.publicTransport,
    labels.train,
    labels.flight,
    labels.routeEstimated
  ];

  seedModes.forEach((label) => {
    const key = label.trim().toLowerCase();
    if (!key || modes.has(key)) {
      return;
    }

    modes.set(key, {
      label,
      ...routeVisualStyle(label, "#64748b", label === labels.routeEstimated ? "Estimated" : "Real")
    });
  });

  routeSegments.forEach((segment) => {
    const key = segment.transportMode.trim().toLowerCase();
    if (!key || modes.has(key)) {
      return;
    }

    modes.set(key, {
      label: segment.transportMode,
      ...routeVisualStyle(segment.transportMode, dayColor(segment.dayNumber), routeGeometryStatus(segment))
    });
  });

  return Array.from(modes.values()).slice(0, 7);
}

function dedupeRouteSegments(segments: RouteSegment[]) {
  const exactKeys = new Set<string>();
  const looseKeys = new Set<string>();
  const idEndpointKeys = new Set<string>();
  const deduped: RouteSegment[] = [];

  segments.forEach((segment) => {
    const looseKey = routeSegmentLooseKey(segment);
    const exactKey = `${segment.dayNumber ?? "all"}|${looseKey}`;
    const idEndpointKey = `${segment.dayNumber ?? "all"}|${segment.id}|${segment.fromPlaceId}|${segment.toPlaceId}`;

    if (exactKeys.has(exactKey)) {
      return;
    }

    if (idEndpointKeys.has(idEndpointKey)) {
      return;
    }

    if (segment.dayNumber === null && looseKeys.has(looseKey)) {
      return;
    }

    exactKeys.add(exactKey);
    looseKeys.add(looseKey);
    idEndpointKeys.add(idEndpointKey);
    deduped.push(segment);
  });

  return deduped;
}

function routeSegmentsForView(option: ItineraryOption, view: MapView) {
  const daySegments = option.days.flatMap((day) =>
    day.routeSegments.map((segment) => ({
      ...segment,
      dayNumber: day.dayNumber
    }))
  );

  if (view === "all") {
    return dedupeRouteSegments([...daySegments, ...option.routeSegments]);
  }

  return dedupeRouteSegments([
    ...daySegments.filter((segment) => segment.dayNumber === view),
    ...option.routeSegments.filter((segment) => segment.dayNumber === view)
  ]);
}

function resolvePlace(lookup: Map<string, DisplayPlace>, placeId: string) {
  return lookup.get(placeId) || null;
}

function displayPlaceLookup(places: DisplayPlace[]) {
  const lookup = new Map<string, DisplayPlace>();

  places.forEach((place) => {
    lookup.set(place.id, place);
    if (place.sourceActivityId) {
      lookup.set(place.sourceActivityId, place);
    }
  });

  return lookup;
}

function routeEndpointKey(segment: RouteSegment, lookup: Map<string, DisplayPlace>) {
  const from = resolvePlace(lookup, segment.fromPlaceId);
  const to = resolvePlace(lookup, segment.toPlaceId);

  return `${segment.dayNumber ?? "all"}|${from?.id || segment.fromPlaceId}|${to?.id || segment.toPlaceId}`;
}

function activeAssumptionText(assumptions: Assumption[]) {
  return assumptions
    .filter((assumption) => assumption.status !== "Rejected")
    .map((assumption) => `${assumption.category} ${assumption.label} ${assumption.value}`)
    .join(" ")
    .toLowerCase();
}

function chooseSyntheticTransportMode(distanceKm: number, assumptions: Assumption[], labels: UIText) {
  const text = activeAssumptionText(assumptions);

  if (distanceKm > 250) {
    return text.includes("train") || text.includes("rail") ? labels.train : labels.flight;
  }

  if (text.includes("budget") || text.includes("cheap") || text.includes("low-cost") || text.includes("public")) {
    return labels.publicTransport;
  }

  if (text.includes("comfort") || text.includes("convenien") || text.includes("minimal walking") || text.includes("taxi")) {
    return labels.taxiCar;
  }

  if (distanceKm > 25) {
    return labels.train;
  }

  if (distanceKm <= 1.2) {
    return labels.walk;
  }

  return labels.publicTransport;
}

function relatedRoutePreference(assumptions: Assumption[]) {
  const transportRelated = assumptions.find(
    (assumption) =>
      assumption.status !== "Rejected" &&
      ["transport", "walkingTolerance", "budget", "pace"].includes(assumption.category)
  );

  return transportRelated?.value || null;
}

function syntheticRouteSegment({
  from,
  to,
  dayNumber,
  purpose,
  assumptions,
  labels
}: {
  from: DisplayPlace;
  to: DisplayPlace;
  dayNumber: number | null;
  purpose: string;
  assumptions: Assumption[];
  labels: UIText;
}): DisplayRouteSegment {
  const distanceKm = haversineDistanceKm(from.coordinates, to.coordinates);
  const routeStatus: RouteSegment["routeStatus"] = from.coordinates && to.coordinates ? "Estimated" : "Missing";
  const transportMode = routeStatus === "Missing" ? labels.routeMissing : chooseSyntheticTransportMode(distanceKm, assumptions, labels);

  return {
    id: `estimated-${dayNumber ?? "all"}-${from.id}-${to.id}`,
    dayNumber,
    fromPlaceId: from.id,
    toPlaceId: to.id,
    fromStopId: from.id,
    toStopId: to.id,
    fromCoordinates: from.coordinates,
    toCoordinates: to.coordinates,
    transportMode,
    estimatedTravelTimeMinutes: estimateTravelMinutes(transportMode, distanceKm),
    durationSeconds: estimateTravelMinutes(transportMode, distanceKm) * 60,
    distanceKm,
    distanceMeters: Math.round(distanceKm * 1000),
    encodedPolyline: null,
    provider: "fallback_estimated",
    geometryStatus: routeStatus,
    confidence: routeStatus === "Estimated" ? 0.45 : 0.1,
    routeStatus,
    reason: routeStatus === "Estimated" ? `${labels.routeEstimatedReason} ${labels.activePreferenceRouteReason}` : labels.routeMissingReason,
    relatedPreference: relatedRoutePreference(assumptions),
    notes: purpose,
    warnings: [routeStatus === "Estimated" ? labels.routeEstimatedReason : labels.routeMissingReason],
    isSynthetic: true
  };
}

function normalizeRouteSegment(segment: RouteSegment): DisplayRouteSegment {
  return {
    ...segment,
    confidence: typeof segment.confidence === "number" ? segment.confidence : 0.55,
    routeStatus: routeGeometryStatus(segment),
    geometryStatus: routeGeometryStatus(segment),
    provider: isVerifiedRouteGeometry(segment) ? "google_routes" : "fallback_estimated",
    reason: segment.reason || segment.notes,
    relatedPreference: segment.relatedPreference ?? null,
    isSynthetic: false
  };
}

function routeLegExists(
  existingKeys: Set<string>,
  lookup: Map<string, DisplayPlace>,
  from: DisplayPlace,
  to: DisplayPlace,
  dayNumber: number | null
) {
  const key = `${dayNumber ?? "all"}|${from.id}|${to.id}`;
  const reverseKey = `${dayNumber ?? "all"}|${to.id}|${from.id}`;

  if (existingKeys.has(key) || existingKeys.has(reverseKey)) {
    return true;
  }

  return Array.from(existingKeys).some((item) => {
    const [, fromId, toId] = item.split("|");
    const resolvedFrom = resolvePlace(lookup, fromId);
    const resolvedTo = resolvePlace(lookup, toId);
    return resolvedFrom?.id === from.id && resolvedTo?.id === to.id;
  });
}

function buildContinuousRouteSegments(
  option: ItineraryOption,
  places: DisplayPlace[],
  view: MapView,
  assumptions: Assumption[],
  labels: UIText
) {
  const lookup = displayPlaceLookup(places);
  const structuredSegments = routeSegmentsForView(option, view).map(normalizeRouteSegment);
  const existingKeys = new Set(structuredSegments.map((segment) => routeEndpointKey(segment, lookup)));
  const expectedSegments: DisplayRouteSegment[] = [];
  const activeDays = option.days.filter((day) => view === "all" || day.dayNumber === view);

  activeDays.forEach((day) => {
    const dayPlaces = places
      .filter((place) => place.dayNumber === day.dayNumber && place.kind === "poi")
      .sort((a, b) => a.orderInDay - b.orderInDay || a.sequence - b.sequence);
    const base = places.find((place) => place.id === `base-day-${day.dayNumber}`);

    if (base && dayPlaces[0] && !routeLegExists(existingKeys, lookup, base, dayPlaces[0], day.dayNumber)) {
      expectedSegments.push(
        syntheticRouteSegment({
          from: base,
          to: dayPlaces[0],
          dayNumber: day.dayNumber,
          purpose: `${labels.hotelBase} - ${formatDay(labels, day.dayNumber)} ${labels.stopOrder} 1`,
          assumptions,
          labels
        })
      );
    }

    dayPlaces.slice(1).forEach((place, index) => {
      const from = dayPlaces[index];
      if (!routeLegExists(existingKeys, lookup, from, place, day.dayNumber)) {
        expectedSegments.push(
          syntheticRouteSegment({
            from,
            to: place,
            dayNumber: day.dayNumber,
            purpose: `${formatDay(labels, day.dayNumber)} ${labels.stopOrder} ${index + 1} - ${index + 2}`,
            assumptions,
            labels
          })
        );
      }
    });

    const last = dayPlaces[dayPlaces.length - 1];
    if (base && last && !routeLegExists(existingKeys, lookup, last, base, day.dayNumber)) {
      expectedSegments.push(
        syntheticRouteSegment({
          from: last,
          to: base,
          dayNumber: day.dayNumber,
          purpose: `${formatDay(labels, day.dayNumber)} ${labels.stopOrder} ${dayPlaces.length} - ${labels.hotelBase}`,
          assumptions,
          labels
        })
      );
    }
  });

  if (view === "all") {
    option.days.slice(1).forEach((day, index) => {
      const previousDay = option.days[index];
      const previousBase = places.find((place) => place.id === `base-day-${previousDay.dayNumber}`);
      const nextBase = places.find((place) => place.id === `base-day-${day.dayNumber}`);

      if (
        previousBase &&
        nextBase &&
        normalizedPlaceText(previousBase.location) !== normalizedPlaceText(nextBase.location) &&
        !routeLegExists(existingKeys, lookup, previousBase, nextBase, day.dayNumber)
      ) {
        expectedSegments.push(
          syntheticRouteSegment({
            from: previousBase,
            to: nextBase,
            dayNumber: day.dayNumber,
            purpose: `${formatDay(labels, previousDay.dayNumber)} - ${formatDay(labels, day.dayNumber)} ${labels.baseChanges}`,
            assumptions,
            labels
          })
        );
      }
    });
  }

  return dedupeRouteSegments([...structuredSegments, ...expectedSegments]).map((segment) => ({
    ...segment,
    isSynthetic: "isSynthetic" in segment ? Boolean(segment.isSynthetic) : false
  }));
}

function dayColor(dayNumber: number | null | undefined) {
  if (!dayNumber) {
    return "#64748b";
  }

  return DAY_COLORS[(dayNumber - 1) % DAY_COLORS.length];
}

function routeVisualStyle(transportMode: string, fallbackColor: string, routeStatus: RouteSegment["routeStatus"] = "Real") {
  const mode = transportMode.toLowerCase();
  const estimatedDash = routeStatus === "Estimated" || routeStatus === "Missing" ? "7 7" : undefined;

  if (mode.includes("train") || mode.includes("rail")) {
    return { color: "#dc2626", dashArray: estimatedDash };
  }

  if (mode.includes("taxi") || mode.includes("car") || mode.includes("drive") || mode.includes("private")) {
    return { color: "#334155", dashArray: estimatedDash };
  }

  if (mode.includes("bus") || mode.includes("metro") || mode.includes("public") || mode.includes("transit")) {
    return { color: "#f97316", dashArray: estimatedDash };
  }

  if (mode.includes("ferry") || mode.includes("boat")) {
    return { color: "#0284c7", dashArray: "10 8" };
  }

  if (mode.includes("flight") || mode.includes("plane") || mode.includes("air")) {
    return { color: "#7c3aed", dashArray: "4 8" };
  }

  if (mode.includes("walk")) {
    return { color: "#2563eb", dashArray: "3 7" };
  }

  return { color: fallbackColor, dashArray: estimatedDash };
}

function routeBearingDegrees(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
) {
  return (Math.atan2(to.lat - from.lat, to.lng - from.lng) * 180) / Math.PI;
}

function routePopupHtml(segment: DisplayRouteSegment, from: DisplayPlace, to: DisplayPlace, labels: UIText) {
  const status = routeGeometryStatus(segment);
  const statusClass = status.toLowerCase();
  const distance = segment.distanceKm || haversineDistanceKm(from.coordinates, to.coordinates);
  const warning =
    status === "Real"
      ? ""
      : `<p class="itinerary-popup-warning">${escapeHtml(
          [...(segment.warnings || []), labels.uncertainTransportAssumption].filter(Boolean).slice(0, 2).join(" ")
        )}</p>`;

  return `
    <div class="itinerary-popup">
      <p class="itinerary-popup-eyebrow">${escapeHtml(routeStatusLabel(labels, status))}</p>
      <h3>${escapeHtml(labels.from)} ${escapeHtml(from.title)} ${escapeHtml(labels.to).toLowerCase()} ${escapeHtml(to.title)}</h3>
      <div class="itinerary-popup-grid">
        <span>${escapeHtml(labels.mode)}<strong>${escapeHtml(segment.transportMode)}</strong></span>
        <span>${escapeHtml(labels.travelTime)}<strong>${escapeHtml(formatMinutes(segment.estimatedTravelTimeMinutes, labels))}</strong></span>
        <span>${escapeHtml(labels.totalDistance)}<strong>${distance.toFixed(1)} km</strong></span>
        <span>${escapeHtml(labels.routeConfidence)}<strong>${Math.round(segment.confidence * 100)}%</strong></span>
        <span>${escapeHtml(labels.routeProvider)}<strong>${escapeHtml(segment.provider)}</strong></span>
        <span>${escapeHtml(labels.routeGeometryStatus)}<strong>${escapeHtml(routeStatusLabel(labels, status))}</strong></span>
      </div>
      <p><strong>${escapeHtml(labels.routeChoiceReason)}:</strong> ${escapeHtml(segment.reason || segment.notes)}</p>
      ${segment.relatedPreference ? `<p><strong>${escapeHtml(labels.relatedPreference)}:</strong> ${escapeHtml(segment.relatedPreference)}</p>` : ""}
      <span class="itinerary-popup-status ${statusClass}">${escapeHtml(routeStatusLabel(labels, status))}</span>
      ${warning}
      <button type="button" data-open-review-day="${segment.dayNumber ?? ""}">${escapeHtml(labels.fixIssues)}</button>
    </div>
  `;
}

function placePopupHtml(place: DisplayPlace, labels: UIText) {
  const dayLabel = place.dayNumber ? `${formatDay(labels, place.dayNumber)} - ${labels.stopOrder} ${place.markerLabel}` : labels.fullTrip;
  const riskLine = place.activity
    ? `${labels.warningTypeLabels.bookingRisk}: ${labels.impactLabels[place.activity.bookingRisk]} · ${labels.warningTypeLabels.openingHoursRisk}: ${labels.impactLabels[place.activity.openingHoursRisk]}`
    : place.isAssumedBase
      ? labels.assumedBaseArea
      : labels.hotelBase;

  return `
    <div class="itinerary-popup">
      <p class="itinerary-popup-eyebrow">${escapeHtml(dayLabel)}</p>
      <h3>${escapeHtml(place.title)}</h3>
      <p>${escapeHtml(place.activity?.description || place.location)}</p>
      <div class="itinerary-popup-grid">
        <span>${escapeHtml(labels.plannedActivity)}<strong>${escapeHtml(place.activity?.title || place.title)}</strong></span>
        <span>${escapeHtml(labels.estimate)}<strong>${escapeHtml(place.activity?.time || place.locationStatus)}</strong></span>
      </div>
      <p>${escapeHtml(riskLine)}</p>
      <button type="button" data-open-review-day="${place.dayNumber ?? ""}">${escapeHtml(labels.openInReviewPlanning)}</button>
    </div>
  `;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function worldSize(zoom: number) {
  return MAP_TILE_SIZE * 2 ** zoom;
}

function coordinatesToWorld(coordinates: { lat: number; lng: number }, zoom: number) {
  const size = worldSize(zoom);
  const safeLat = clamp(coordinates.lat, -85.05112878, 85.05112878);
  const sinLat = Math.sin((safeLat * Math.PI) / 180);

  return {
    x: ((coordinates.lng + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * size
  };
}

function fitCamera(places: DisplayPlace[]): MapCamera {
  const available = places.filter((place) => place.coordinates);

  if (available.length === 0) {
    return {
      centerLat: 0,
      centerLng: 0,
      zoom: 2
    };
  }

  const lats = available.map((place) => place.coordinates?.lat ?? 0);
  const lngs = available.map((place) => place.coordinates?.lng ?? 0);
  let minLat = Math.min(...lats);
  let maxLat = Math.max(...lats);
  let minLng = Math.min(...lngs);
  let maxLng = Math.max(...lngs);

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  if (available.length === 1) {
    return {
      centerLat,
      centerLng,
      zoom: 13
    };
  }

  for (let zoom = MAX_ZOOM; zoom >= MIN_ZOOM; zoom -= 1) {
    const topLeft = coordinatesToWorld({ lat: maxLat, lng: minLng }, zoom);
    const bottomRight = coordinatesToWorld({ lat: minLat, lng: maxLng }, zoom);
    const width = Math.abs(bottomRight.x - topLeft.x);
    const height = Math.abs(bottomRight.y - topLeft.y);

    if (width <= MAP_WIDTH - MAP_PADDING * 2 && height <= MAP_HEIGHT - MAP_PADDING * 2) {
      return {
        centerLat,
        centerLng,
        zoom
      };
    }
  }

  return {
    centerLat,
    centerLng,
    zoom: MIN_ZOOM
  };
}

function projectPlaces(
  places: DisplayPlace[],
  camera: MapCamera,
  adjustment: MapAdjustment
): PositionedPlace[] {
  const zoom = clamp(camera.zoom + adjustment.zoomDelta, MIN_ZOOM, MAX_ZOOM);
  const center = coordinatesToWorld({ lat: camera.centerLat, lng: camera.centerLng }, zoom);

  return places
    .filter((place) => place.coordinates)
    .map((place) => {
      const coordinates = place.coordinates!;
      const projected = coordinatesToWorld(coordinates, zoom);

      return {
        ...place,
        x: MAP_WIDTH / 2 + projected.x - center.x + adjustment.offsetX,
        y: MAP_HEIGHT / 2 + projected.y - center.y + adjustment.offsetY
      };
    });
}

function buildPositionedLookup(places: PositionedPlace[]) {
  const lookup = new Map<string, PositionedPlace>();

  places.forEach((place) => {
    lookup.set(place.id, place);
    if (place.sourceActivityId) {
      lookup.set(place.sourceActivityId, place);
    }
  });

  return lookup;
}

function fallbackRouteSegments(places: PositionedPlace[], labels: UIText): DisplayRouteSegment[] {
  return places.slice(1).map((place, index) => {
    const from = places[index];
    const distanceKm = haversineDistanceKm(from.coordinates, place.coordinates);
    const status: RouteSegment["routeStatus"] = distanceKm > 0 ? "Estimated" : "Missing";

    return {
      id: `fallback-${from.id}-${place.id}`,
      dayNumber: place.dayNumber,
      fromPlaceId: from.id,
      toPlaceId: place.id,
      fromStopId: from.id,
      toStopId: place.id,
      fromCoordinates: from.coordinates,
      toCoordinates: place.coordinates,
      transportMode: labels.routeEstimated,
      estimatedTravelTimeMinutes: estimateTravelMinutes(labels.publicTransport, distanceKm),
      durationSeconds: estimateTravelMinutes(labels.publicTransport, distanceKm) * 60,
      distanceKm,
      distanceMeters: Math.round(distanceKm * 1000),
      encodedPolyline: null,
      provider: "fallback_estimated",
      geometryStatus: status,
      confidence: status === "Estimated" ? 0.35 : 0.1,
      routeStatus: status,
      reason: status === "Estimated" ? labels.routeEstimatedReason : labels.routeMissingReason,
      relatedPreference: null,
      notes: labels.noRouteSegments,
      warnings: [status === "Estimated" ? labels.routeEstimatedReason : labels.routeMissingReason],
      isSynthetic: true
    };
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeLeafletModule(module: LeafletImport): LeafletModule {
  return module.default ?? module;
}

function LeafletRouteMap({
  labels,
  places,
  routeSegments,
  selectedPlaceId,
  onSelectPlace,
  viewLabel,
  planning = false,
  overlayTitle,
  overlayBody,
  className = "",
  showChrome = true,
  onOpenReview
}: {
  labels: UIText;
  places: DisplayPlace[];
  routeSegments: DisplayRouteSegment[];
  selectedPlaceId?: string | null;
  onSelectPlace?: (id: string) => void;
  viewLabel: string;
  planning?: boolean;
  overlayTitle?: string;
  overlayBody?: string;
  className?: string;
  showChrome?: boolean;
  onOpenReview?: (dayNumber?: number | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMapInstance | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const markerLayerRef = useRef<LeafletLayerGroup | null>(null);
  const routeLayerRef = useRef<LeafletLayerGroup | null>(null);
  const [mapReady, setMapReady] = useState(0);
  const availablePlaces = useMemo(() => places.filter((place) => place.coordinates), [places]);
  const placesKey = places
    .map((place) => `${place.id}:${place.coordinates?.lat ?? "x"}:${place.coordinates?.lng ?? "x"}:${place.dayNumber ?? "all"}`)
    .join("|");
  const routeKey = routeSegments
    .map(
      (segment) =>
        `${segment.id}:${segment.fromPlaceId}:${segment.toPlaceId}:${segment.dayNumber ?? "all"}:${routeGeometryStatus(segment)}:${segment.confidence}:${segment.encodedPolyline ?? ""}`
    )
    .join("|");

  useEffect(() => {
    let cancelled = false;

    async function createMap() {
      const leaflet = normalizeLeafletModule(await import("leaflet"));

      if (cancelled || !containerRef.current || mapRef.current) {
        return;
      }

      leafletRef.current = leaflet;
      const map = leaflet.map(containerRef.current, {
        attributionControl: false,
        preferCanvas: true,
        scrollWheelZoom: true,
        zoomControl: false
      });

      leaflet
        .tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png", {
          attribution: labels.mapDataAttribution,
          maxZoom: 19,
          subdomains: "abcd"
        })
        .addTo(map);
      leaflet.control.zoom({ position: "topright" }).addTo(map);
      leaflet.control.attribution({ position: "bottomright", prefix: false }).addTo(map);

      routeLayerRef.current = leaflet.layerGroup().addTo(map);
      markerLayerRef.current = leaflet.layerGroup().addTo(map);
      mapRef.current = map;
      map.setView([20, 0], 2);
      setMapReady((current) => current + 1);

      window.setTimeout(() => map.invalidateSize(), 80);
    }

    void createMap();

    return () => {
      cancelled = true;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerLayerRef.current = null;
        routeLayerRef.current = null;
      }
    };
  }, [labels.mapDataAttribution]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !onOpenReview) {
      return;
    }

    const handlePopupOpen = (event: { popup: { getElement: () => HTMLElement | undefined } }) => {
      const element = event.popup.getElement()?.querySelector<HTMLElement>("[data-open-review-day]");

      if (!element) {
        return;
      }

      element.onclick = () => {
        const rawDay = element.dataset.openReviewDay;
        const dayNumber = rawDay ? Number(rawDay) : null;
        onOpenReview(Number.isFinite(dayNumber) && dayNumber ? dayNumber : null);
      };
    };

    map.on("popupopen", handlePopupOpen);

    return () => {
      map.off("popupopen", handlePopupOpen);
    };
  }, [mapReady, onOpenReview]);

  useEffect(() => {
    const leaflet = leafletRef.current;
    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;
    const routeLayer = routeLayerRef.current;

    if (!leaflet || !map || !markerLayer || !routeLayer || mapReady === 0) {
      return;
    }

    markerLayer.clearLayers();
    routeLayer.clearLayers();

    const placeLookup = new Map<string, DisplayPlace>();

    availablePlaces.forEach((place) => {
      placeLookup.set(place.id, place);
      if (place.sourceActivityId) {
        placeLookup.set(place.sourceActivityId, place);
      }
    });

    routeSegments.forEach((segment, index) => {
      const from = placeLookup.get(segment.fromPlaceId);
      const to = placeLookup.get(segment.toPlaceId);

      if (!from?.coordinates || !to?.coordinates) {
        return;
      }

      const status = routeGeometryStatus(segment);
      const decodedCoordinates = isVerifiedRouteGeometry(segment) && segment.encodedPolyline ? decodeGooglePolyline(segment.encodedPolyline) : [];
      const coordinates = decodedCoordinates.length >= 2 ? decodedCoordinates : [[from.coordinates.lat, from.coordinates.lng], [to.coordinates.lat, to.coordinates.lng]] as [number, number][];
      const visualStyle = routeVisualStyle(segment.transportMode, dayColor(segment.dayNumber ?? from.dayNumber), status);
      const midpoint: [number, number] = [
        coordinates[Math.floor(coordinates.length / 2)]?.[0] ?? (from.coordinates.lat + to.coordinates.lat) / 2,
        coordinates[Math.floor(coordinates.length / 2)]?.[1] ?? (from.coordinates.lng + to.coordinates.lng) / 2
      ];
      const arrowFrom = coordinates[Math.max(0, Math.floor(coordinates.length / 2) - 1)] || [from.coordinates.lat, from.coordinates.lng];
      const arrowTo = coordinates[Math.min(coordinates.length - 1, Math.floor(coordinates.length / 2) + 1)] || [to.coordinates.lat, to.coordinates.lng];
      const routeAngle = routeBearingDegrees({ lat: arrowFrom[0], lng: arrowFrom[1] }, { lat: arrowTo[0], lng: arrowTo[1] });

      leaflet
        .polyline(coordinates, {
          color: "#ffffff",
          opacity: 0.78,
          weight: 12,
          lineCap: "round",
          lineJoin: "round"
        })
        .addTo(routeLayer);

      const routeLine = leaflet
        .polyline(coordinates, {
          color: visualStyle.color,
          dashArray: status !== "Real" || segment.distanceKm === 0 ? "7 7" : visualStyle.dashArray,
          opacity: 0.92,
          weight: status === "Missing" ? 4 : 6,
          lineCap: "round",
          lineJoin: "round"
        });

      routeLine.bindPopup(routePopupHtml(segment, from, to, labels), {
        className: "itinerary-leaflet-popup",
        maxWidth: 300
      });
      routeLine.addTo(routeLayer);

      leaflet
        .marker(midpoint, {
          interactive: false,
          icon: leaflet.divIcon({
            className: "itinerary-route-arrow-shell",
            html: `<div class="itinerary-route-arrow" style="--route-color:${visualStyle.color}; --route-angle:${routeAngle}deg"></div>`,
            iconAnchor: [8, 8],
            iconSize: [16, 16]
          })
        })
        .addTo(routeLayer);

      if (status !== "Real") {
        leaflet
          .marker(midpoint, {
            interactive: false,
            icon: leaflet.divIcon({
              className: "itinerary-route-warning-shell",
              html: `<div class="itinerary-route-warning">!</div>`,
              iconAnchor: [10, 10],
              iconSize: [20, 20]
            })
          })
          .addTo(routeLayer);
      }
    });

    availablePlaces.forEach((place) => {
      if (!place.coordinates) {
        return;
      }

      const selected = selectedPlaceId === place.id;
      const color = dayColor(place.dayNumber);
      const icon = leaflet.divIcon({
        className: "itinerary-leaflet-marker-shell",
        html: `<div class="itinerary-leaflet-marker ${place.kind === "base" ? "is-base" : ""} ${place.isAssumedBase ? "is-assumed" : ""} ${
          selected ? "is-selected" : ""
        }" style="--marker-color:${color}" title="${escapeHtml(
          place.title
        )}"><span class="itinerary-marker-number">${escapeHtml(place.markerLabel)}</span></div><div class="itinerary-leaflet-marker-label">${escapeHtml(
          place.title
        )}</div>`,
        iconAnchor: [22, 22],
        iconSize: [44, 58]
      });

      const marker = leaflet
        .marker([place.coordinates.lat, place.coordinates.lng], {
          icon,
          title: `${place.title} - ${place.location}`
        })
        .on("click", () => onSelectPlace?.(place.id));

      marker.bindPopup(placePopupHtml(place, labels), {
        className: "itinerary-leaflet-popup",
        maxWidth: 300
      });
      marker.addTo(markerLayer);
    });

    if (availablePlaces.length === 0) {
      map.setView([20, 0], 2);
    } else if (availablePlaces.length === 1) {
      const coordinates = availablePlaces[0].coordinates!;
      map.flyTo([coordinates.lat, coordinates.lng], 13, { duration: 0.55 });
    } else {
      const bounds = leaflet.latLngBounds(
        availablePlaces.map((place) => [place.coordinates!.lat, place.coordinates!.lng] as [number, number])
      );
      map.flyToBounds(bounds, { maxZoom: 13, padding: [72, 72], duration: 0.65 });
    }

    window.setTimeout(() => map.invalidateSize(), 40);
  }, [availablePlaces, mapReady, onSelectPlace, placesKey, routeKey, routeSegments, selectedPlaceId]);

  return (
    <div className={`relative h-[520px] min-h-[420px] overflow-hidden bg-[#d9ecf2] lg:h-[620px] ${className}`}>
      <div ref={containerRef} className="leaflet-itinerary-map absolute inset-0" aria-label={labels.mapTitle} />

      {overlayTitle ? (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[450] w-[min(420px,calc(100%-48px))] -translate-x-1/2 -translate-y-1/2 rounded-[8px] border border-slate-200 bg-white/94 p-5 text-center shadow-[0_22px_70px_rgba(26,35,67,0.18)] backdrop-blur">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-600">
            {planning ? <Timer className="size-7" /> : <Sparkles className="size-7" />}
          </div>
          <h3 className="mt-3 text-xl font-black text-slate-950">{overlayTitle}</h3>
          {overlayBody ? <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-6 text-slate-500">{overlayBody}</p> : null}
        </div>
      ) : null}

      {showChrome ? (
        <div className="absolute left-4 top-4 z-[450] rounded-[8px] border border-slate-200 bg-white/94 px-3 py-2 text-xs font-black text-slate-700 shadow-sm backdrop-blur">
          <span className="inline-flex items-center gap-2">
            <Navigation2 className="size-4 text-indigo-600" />
            {viewLabel}
          </span>
        </div>
      ) : null}

      {showChrome ? (
        <div className="absolute bottom-4 left-4 z-[450] rounded-[8px] border border-slate-200 bg-white/92 px-3 py-2 text-[11px] font-bold text-slate-500 shadow-sm backdrop-blur">
          {labels.dragToPan} - {labels.wheelToZoom}
        </div>
      ) : null}
    </div>
  );
}

function LiveBaseMap({
  labels,
  planning = false,
  overlayTitle,
  overlayBody
}: {
  labels: UIText;
  planning?: boolean;
  overlayTitle?: string;
  overlayBody?: string;
}) {
  return (
    <LeafletRouteMap
      labels={labels}
      places={[]}
      routeSegments={[]}
      selectedPlaceId={null}
      viewLabel={labels.fullTrip}
      planning={planning}
      overlayTitle={overlayTitle}
      overlayBody={overlayBody}
    />
  );
}

function EmptyCanvas({ planning, labels }: { planning: boolean; labels: UIText }) {
  return (
    <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-[0_22px_70px_rgba(26,35,67,0.1)]">
      <div className="relative">
        <LiveBaseMap
          labels={labels}
          planning={planning}
          overlayTitle={planning ? labels.emptyCanvasPlanningTitle : labels.emptyCanvasReadyTitle}
          overlayBody={labels.emptyCanvasBody}
        />
        <div className="absolute left-4 top-4 z-[900] rounded-[8px] border border-slate-200 bg-white/94 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.14)] backdrop-blur">
          <p className="flex items-center gap-2 text-xs font-black uppercase text-indigo-600">
            <MapPin className="size-3.5" />
            {labels.mapEyebrow}
          </p>
          <h2 className="mt-1 text-xl font-black text-slate-950">{labels.mapTitle}</h2>
          <p className="mt-1 max-w-sm text-sm font-semibold leading-6 text-slate-500">{labels.emptyCanvasBody}</p>
        </div>
        <div className="absolute bottom-4 left-4 z-[900] rounded-[8px] border border-slate-200 bg-white/92 px-3 py-2 text-[11px] font-bold text-slate-500 shadow-sm backdrop-blur">
          {labels.dragToPan} - {labels.wheelToZoom}
        </div>
      </div>
    </section>
  );
}

function ActivityRow({
  activity,
  index,
  assumptions,
  labels
}: {
  activity: Activity;
  index: number;
  assumptions: Assumption[];
  labels: UIText;
}) {
  const links = linkedAssumptions(activity, assumptions);

  return (
    <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 rounded-[8px] border border-slate-100 bg-white p-2 shadow-sm">
      <div
        className={`flex size-11 items-center justify-center rounded-[8px] bg-gradient-to-br text-sm font-black ${activityTone(
          index
        )}`}
        title={activity.imageHint}
      >
        {activity.title.slice(0, 1)}
      </div>
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-950">{activity.title}</p>
            <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] font-semibold text-blue-900/65">
              <MapPin className="size-3 shrink-0" />
              {activity.location}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-800">
            {activity.time}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{activity.description}</p>
        <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-4 text-indigo-700">{activity.preferenceFit}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-600">
            <Euro className="size-3" />
            {activity.estimatedCostEur}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-600">
            <Footprints className="size-3" />
            {activity.walkingKm.toFixed(1)} km
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-600">
            <Timer className="size-3" />
            {formatMinutes(activity.travelTimeMinutes, labels)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-600">
            <Tickets className="size-3" />
            {labels.impactLabels[activity.bookingRisk]}
          </span>
          {links.map((assumption) => (
            <span
              key={assumption.id}
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${influenceTone(
                assumption.status
              )}`}
            >
              {labels.categoryLabels[assumption.category] || assumption.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function DayCard({ day, assumptions, labels }: { day: ItineraryDay; assumptions: Assumption[]; labels: UIText }) {
  return (
    <article
      id={`day-plan-${day.dayNumber}`}
      className="scroll-mt-28 rounded-[8px] border border-blue-200 bg-white p-3 shadow-[0_20px_48px_rgba(26,35,67,0.1)]"
    >
      <div className="rounded-[8px] border border-blue-100 bg-gradient-to-br from-white to-blue-50 px-3 py-3 text-center">
        <div className="mx-auto flex size-8 items-center justify-center rounded-[8px] bg-white text-blue-700 shadow-sm">
          <CalendarDays className="size-4" />
        </div>
        <h3 className="mt-2 text-lg font-black text-slate-950">{formatDay(labels, day.dayNumber)}</h3>
        <p className="truncate text-xs font-bold text-blue-800">{day.title}</p>
      </div>

      <p className="mt-3 text-xs font-semibold leading-5 text-slate-600">{day.theme}</p>

      {day.accommodation ? (
        <div className="mt-3 rounded-[8px] border border-sky-100 bg-sky-50/70 p-2">
          <div className="flex items-center gap-2 text-xs font-black text-sky-800">
            <Bed className="size-3.5" />
            {labels.accommodation}
          </div>
          <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-4 text-sky-700">
            {day.accommodation.area} · {day.accommodation.accommodationStyle}
          </p>
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        {day.activities.map((activity, index) => (
          <ActivityRow key={activity.id} activity={activity} index={index} assumptions={assumptions} labels={labels} />
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-[8px] bg-slate-50 p-2 text-center">
          <p className="text-[10px] font-bold uppercase text-slate-400">{labels.walk}</p>
          <p className="text-xs font-black text-slate-800">{day.totalWalkingKm.toFixed(1)} km</p>
        </div>
        <div className="rounded-[8px] bg-slate-50 p-2 text-center">
          <p className="text-[10px] font-bold uppercase text-slate-400">{labels.travel}</p>
          <p className="text-xs font-black text-slate-800">{formatMinutes(day.totalTravelTimeMinutes, labels)}</p>
        </div>
        <div className="rounded-[8px] bg-slate-50 p-2 text-center">
          <p className="text-[10px] font-bold uppercase text-slate-400">{labels.cost}</p>
          <p className="text-xs font-black text-slate-800">EUR {day.estimatedCostEur}</p>
        </div>
      </div>

      {day.costBreakdown.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {day.costBreakdown.slice(0, 4).map((item) => (
            <span key={item.id} className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
              {labels.costCategoryLabels[item.category]}: EUR {item.amountEur}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-3 rounded-[8px] border border-violet-100 bg-violet-50/70 p-3">
        <p className="text-xs font-bold text-violet-800">{labels.pacingNote}</p>
        <p className="mt-1 text-xs leading-5 text-violet-700">{day.pacingNote}</p>
      </div>
    </article>
  );
}

function OptionHeader({
  itinerary,
  selectedOption,
  onSelectOption,
  labels
}: {
  itinerary: Itinerary;
  selectedOption: ItineraryOption;
  onSelectOption: (id: string) => void;
  labels: UIText;
}) {
  return (
    <div className="relative rounded-[8px] border border-slate-200 bg-white p-4 shadow-[0_18px_50px_rgba(26,35,67,0.09)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-gradient-to-br from-orange-100 via-blue-100 to-violet-100 text-4xl font-black text-indigo-700 shadow-inner">
            {itinerary.destination.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-3xl font-black text-slate-950">{itinerary.destination}</h2>
              <span className="rounded-full bg-violet-50 px-3 py-1 text-[11px] font-bold text-violet-700">
                {itinerary.durationDays} {labels.dayPlan}
              </span>
            </div>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-blue-900/65">{itinerary.summary}</p>
          </div>
        </div>
        <div className="grid min-w-[190px] grid-cols-2 gap-2 rounded-[8px] border border-slate-100 bg-slate-50 p-2">
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400">{labels.selected}</p>
            <p className="truncate text-sm font-black text-slate-800">{selectedOption.title}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400">{labels.estimate}</p>
            <p className="text-sm font-black text-slate-800">
              {itinerary.currency} {selectedOption.estimatedTotalCostEur}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 lg:grid-cols-2">
        {itinerary.options.map((option, index) => (
          <button
            key={option.id}
            onClick={() => onSelectOption(option.id)}
            className={`rounded-[8px] border px-3 py-3 text-left transition ${
              option.id === selectedOption.id
                ? "border-orange-300 bg-orange-50 text-orange-900 shadow-sm"
                : "border-slate-200 bg-white text-slate-700 hover:border-violet-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-white text-sm font-black shadow-sm">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-black">{option.title}</p>
                <p className="line-clamp-2 text-xs font-semibold leading-5 opacity-75">{option.fitSummary}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function InfluenceLayer({ assumptions, labels }: { assumptions: Assumption[]; labels: UIText }) {
  if (assumptions.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
      {assumptions.map((assumption) => (
        <span
          key={assumption.id}
          className={`inline-flex items-center gap-1 rounded-[8px] border px-3 py-2 text-xs font-black ${influenceTone(
            assumption.status
          )}`}
        >
          <span>{labels.categoryLabels[assumption.category] || assumption.label}</span>
          <span className="font-semibold opacity-70">{Math.round(assumption.confidence * 100)}%</span>
        </span>
      ))}
    </div>
  );
}

function LegacyItineraryMap({ selectedOption, labels }: { selectedOption: ItineraryOption; labels: UIText }) {
  const [view, setView] = useState<MapView>("all");
  const dayNumbers = selectedOption.days.map((day) => day.dayNumber);
  const places = useMemo(() => buildDisplayPlaces(selectedOption, labels), [selectedOption, labels]);
  const viewPlaces = sequencedPlacesForView(places, selectedOption, view);
  const baseCamera = fitCamera(viewPlaces);
  const positionedPlaces = projectPlaces(viewPlaces, baseCamera, { zoomDelta: 0, offsetX: 0, offsetY: 0 });
  const unavailablePlaces = viewPlaces.filter((place) => !place.coordinates);
  const positionedById = buildPositionedLookup(positionedPlaces);
  const structuredSegments = buildContinuousRouteSegments(selectedOption, viewPlaces, view, [], labels).filter(
    (segment) => positionedById.has(segment.fromPlaceId) && positionedById.has(segment.toPlaceId)
  );
  const routeSegments = structuredSegments.length > 0 ? structuredSegments : fallbackRouteSegments(positionedPlaces, labels);

  return (
    <Panel title={labels.mapTitle} eyebrow={labels.mapEyebrow} icon={<MapPin className="size-4" />}>
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setView("all")}
          className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
            view === "all" ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600"
          }`}
        >
          {labels.fullTrip}
        </button>
        {dayNumbers.map((dayNumber) => (
          <button
            key={dayNumber}
            type="button"
            onClick={() => setView(dayNumber)}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
              view === dayNumber
                ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            {formatDay(labels, dayNumber)}
          </button>
        ))}
      </div>

      {positionedPlaces.length === 0 ? (
        <EmptyState title={labels.locationsUnavailableTitle} body={labels.locationsUnavailableBody} />
      ) : (
        <div className="overflow-hidden rounded-[8px] border border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2">
            <div className="flex items-center gap-2 text-xs font-black text-slate-600">
              <Route className="size-3.5 text-indigo-600" />
              {labels.approximateMap}
            </div>
            <span className="text-[11px] font-bold text-slate-400">
              {view === "all" ? labels.fullTrip : typeof view === "number" ? formatDay(labels, view) : labels.fullTrip}
            </span>
          </div>
          <svg viewBox="0 0 640 330" className="block h-[330px] w-full bg-white">
            <defs>
              <pattern id="map-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#e2e8f0" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="640" height="330" fill="url(#map-grid)" />
            {routeSegments.map((segment, index) => {
              const from = positionedById.get(segment.fromPlaceId);
              const to = positionedById.get(segment.toPlaceId);

              if (!from || !to) {
                return null;
              }

              return (
                <g key={routeSegmentRenderKey(segment, index)}>
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke="#4f46e5"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={segment.distanceKm === 0 ? "6 6" : undefined}
                  />
                  <circle cx={(from.x + to.x) / 2} cy={(from.y + to.y) / 2} r="3" fill="#f97316" />
                </g>
              );
            })}
            {positionedPlaces.map((place, index) => (
              <g key={place.id}>
                <circle cx={place.x} cy={place.y} r="14" fill="#ffffff" stroke="#f97316" strokeWidth="3" />
                <circle cx={place.x} cy={place.y} r="7" fill="#4f46e5" />
                <text
                  x={place.x}
                  y={place.y + 4}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="9"
                  fontWeight="700"
                >
                  {index + 1}
                </text>
                <text
                  x={Math.min(590, Math.max(50, place.x))}
                  y={place.y > 280 ? place.y - 22 : place.y + 28}
                  textAnchor="middle"
                  fill="#0f172a"
                  fontSize="11"
                  fontWeight="700"
                >
                  {place.title.slice(0, 24)}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}

      {unavailablePlaces.length > 0 ? (
        <div className="mt-3 rounded-[8px] border border-amber-100 bg-amber-50 p-3">
          <p className="text-xs font-black text-amber-800">{labels.partialLocationWarning}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {unavailablePlaces.slice(0, 8).map((place) => (
              <span key={place.id} className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-amber-700">
                {place.title}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {routeSegments.length > 0 ? (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {routeSegments.slice(0, 6).map((segment, index) => {
            const from = positionedById.get(segment.fromPlaceId);
            const to = positionedById.get(segment.toPlaceId);

            return (
              <div key={routeSegmentRenderKey(segment, index)} className="rounded-[8px] border border-slate-200 bg-white p-2 text-xs font-semibold text-slate-600">
                <div className="flex items-center gap-2 font-black text-slate-800">
                  <Bus className="size-3.5 text-indigo-600" />
                  <span className="truncate">
                    {from?.title || segment.fromPlaceId} - {to?.title || segment.toPlaceId}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2">
                  {segment.transportMode} · {formatMinutes(segment.estimatedTravelTimeMinutes, labels)}
                  {segment.notes ? ` · ${segment.notes}` : ""}
                </p>
              </div>
            );
          })}
        </div>
      ) : null}
    </Panel>
  );
}

function ItineraryMap({
  itinerary,
  selectedOption,
  warnings,
  assumptions,
  onSelectOption,
  labels,
  onOpenReview
}: {
  itinerary: Itinerary;
  selectedOption: ItineraryOption;
  warnings: ConstraintWarning[];
  assumptions: Assumption[];
  onSelectOption: (id: string) => void;
  labels: UIText;
  onOpenReview?: (dayNumber?: number | null) => void;
}) {
  const [view, setView] = useState<MapView>("all");
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [routeReasonExpanded, setRouteReasonExpanded] = useState(false);
  const [attentionExpanded, setAttentionExpanded] = useState(false);
  const dayNumbers = selectedOption.days.map((day) => day.dayNumber);
  const places = useMemo(() => buildDisplayPlaces(selectedOption, labels), [selectedOption, labels]);
  const viewPlaces = sequencedPlacesForView(places, selectedOption, view);
  const viewPlacesKey = mapPlacesKey(viewPlaces);
  const baseCamera = useMemo(() => fitCamera(viewPlaces), [viewPlacesKey]);
  const positionedPlaces = projectPlaces(viewPlaces, baseCamera, { zoomDelta: 0, offsetX: 0, offsetY: 0 });
  const unavailablePlaces = viewPlaces.filter((place) => !place.coordinates);
  const positionedById = buildPositionedLookup(positionedPlaces);
  const continuousSegments = buildContinuousRouteSegments(selectedOption, viewPlaces, view, assumptions, labels);
  const drawableSegments = continuousSegments.filter(
    (segment) => positionedById.has(segment.fromPlaceId) && positionedById.has(segment.toPlaceId)
  );
  const routeSegments = drawableSegments.length > 0 ? drawableSegments : fallbackRouteSegments(positionedPlaces, labels);
  const allRouteSegments = continuousSegments.length > 0 ? continuousSegments : routeSegments;
  const activeDays = selectedOption.days.filter((day) => view === "all" || day.dayNumber === view);
  const selectedPlace = positionedPlaces.find((place) => place.id === selectedPlaceId) || positionedPlaces[0] || null;
  const totalWalkingKm = activeDays.reduce((sum, day) => sum + day.totalWalkingKm, 0);
  const totalTravelMinutes =
    allRouteSegments.reduce((sum, segment) => sum + segment.estimatedTravelTimeMinutes, 0) ||
    activeDays.reduce((sum, day) => sum + day.totalTravelTimeMinutes, 0);
  const totalDistanceKm = allRouteSegments.reduce((sum, segment) => {
    const from = positionedById.get(segment.fromPlaceId);
    const to = positionedById.get(segment.toPlaceId);
    return sum + routeDistance(segment, from, to);
  }, 0);
  const relevantWarnings = warnings.filter((warning) => view === "all" || !warning.affectedDay || warning.affectedDay === view);
  const estimatedSegmentCount = allRouteSegments.filter((segment) => routeGeometryStatus(segment) === "Estimated").length;
  const missingRouteCount = allRouteSegments.filter((segment) => routeGeometryStatus(segment) === "Missing").length;
  const verifiedRouteCount = allRouteSegments.filter((segment) => routeGeometryStatus(segment) === "Real").length;
  const longestTransfer = allRouteSegments.reduce(
    (longest, segment) => Math.max(longest, segment.estimatedTravelTimeMinutes),
    0
  );
  const baseChanges = selectedOption.days.slice(1).filter((day, index) => {
    const previous = selectedOption.days[index];
    const previousArea = previous.accommodation?.area || "";
    const nextArea = day.accommodation?.area || "";
    return day.accommodation?.changeFromPreviousNight || (previousArea && nextArea && normalizedPlaceText(previousArea) !== normalizedPlaceText(nextArea));
  }).length;
  const openIssueCount = relevantWarnings.length + unavailablePlaces.length + missingRouteCount;
  const timelineItems = buildTripTimelineItems(selectedOption, places);
  const selectedDay = selectedPlace?.dayNumber
    ? selectedOption.days.find((day) => day.dayNumber === selectedPlace.dayNumber) || null
    : null;
  const selectedHighlights = selectedPlaceHighlights(selectedOption, selectedPlace);
  const selectedTimelineItem = selectedPlace?.dayNumber
    ? timelineItems.find((item) => selectedPlace.dayNumber && item.startDay <= selectedPlace.dayNumber && item.endDay >= selectedPlace.dayNumber)
    : null;
  const transportModes = routeTransportModes(allRouteSegments, labels);
  const routeInfluences = selectedOption.preferenceInfluences.slice(0, 3);
  const routeQualityLabel =
    allRouteSegments.length > 0 && verifiedRouteCount === allRouteSegments.length
      ? labels.allRoutesVerified
      : missingRouteCount > 0
        ? `${missingRouteCount} ${labels.missingCoordinatesStatus}`
        : `${estimatedSegmentCount} ${labels.estimatedRoutesStatus}`;

  useEffect(() => {
    setSelectedPlaceId(null);
  }, [selectedOption.id, view]);

  useEffect(() => {
    setSelectedPlaceId((current) => {
      if (current && viewPlaces.some((place) => place.id === current)) {
        return current;
      }

      return viewPlaces.find((place) => place.coordinates)?.id || null;
    });
  }, [viewPlacesKey]);

  function handleTimelineSelect(item: TripTimelineItem) {
    setView(item.startDay);
    window.setTimeout(() => {
      setSelectedPlaceId(item.placeId || viewPlaces.find((place) => place.dayNumber === item.startDay && place.coordinates)?.id || null);
    }, 0);
  }

  return (
    <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-[0_22px_70px_rgba(26,35,67,0.12)]">
      <div className="relative">
        <LeafletRouteMap
          labels={labels}
          places={viewPlaces}
          routeSegments={routeSegments}
          selectedPlaceId={selectedPlaceId}
          onSelectPlace={setSelectedPlaceId}
          viewLabel={view === "all" ? labels.fullTrip : typeof view === "number" ? formatDay(labels, view) : labels.fullTrip}
          overlayTitle={positionedPlaces.length === 0 ? labels.locationsUnavailableTitle : undefined}
          overlayBody={positionedPlaces.length === 0 ? labels.locationsUnavailableBody : undefined}
          className="h-[calc(100vh-180px)] min-h-[680px] lg:h-[calc(100vh-170px)]"
          showChrome={false}
          onOpenReview={onOpenReview}
        />

        <div className="absolute left-4 top-4 z-[900] flex max-w-[calc(100%-32px)] flex-col gap-2 md:left-5 md:top-5">
          <div className="flex w-fit max-w-full items-center gap-2 rounded-[8px] border border-slate-200 bg-white/94 p-2 shadow-[0_18px_48px_rgba(15,23,42,0.14)] backdrop-blur">
            <div className="min-w-0 px-2">
              <p className="text-[11px] font-black uppercase text-indigo-600">{labels.mapEyebrow}</p>
              <h2 className="truncate text-base font-black text-slate-950 sm:text-lg">{itinerary.destination}</h2>
            </div>
            {itinerary.options.length > 1 ? (
              <select
                value={selectedOption.id}
                onChange={(event) => onSelectOption(event.target.value)}
                className="h-9 max-w-[210px] rounded-[8px] border border-slate-200 bg-white px-2 text-xs font-black text-slate-700 outline-none"
              >
                {itinerary.options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.title}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setView("all")}
              className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-black shadow-sm backdrop-blur ${
                view === "all" ? "border-indigo-300 bg-indigo-600 text-white" : "border-slate-200 bg-white/92 text-slate-700"
              }`}
            >
              <span className="size-2 rounded-full bg-current opacity-80" />
              {labels.fullTrip}
            </button>
            {dayNumbers.map((dayNumber) => (
              <button
                key={dayNumber}
                type="button"
                onClick={() => setView(dayNumber)}
                className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-black shadow-sm backdrop-blur ${
                  view === dayNumber ? "border-indigo-300 bg-indigo-600 text-white" : "border-slate-200 bg-white/92 text-slate-700"
                }`}
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: dayColor(dayNumber) }} />
                {formatDay(labels, dayNumber)}
              </button>
            ))}
          </div>
        </div>

        <div className="absolute right-4 top-4 z-[900] hidden max-w-[520px] flex-wrap justify-end gap-2 lg:flex">
          {[
            { label: labels.tripDuration, value: `${itinerary.durationDays} ${labels.dayPlan}`, icon: CalendarDays },
            { label: labels.totalDistance, value: `${totalDistanceKm.toFixed(1)} km`, icon: Route },
            { label: labels.travelTime, value: formatMinutes(totalTravelMinutes, labels), icon: Timer },
            { label: labels.walk, value: `${totalWalkingKm.toFixed(1)} km`, icon: Footprints }
          ].map((metric) => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.label}
                className="min-w-[118px] rounded-[8px] border border-slate-200 bg-white/94 px-3 py-2 shadow-[0_14px_38px_rgba(15,23,42,0.12)] backdrop-blur"
              >
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-400">
                  <Icon className="size-3.5" />
                  {metric.label}
                </p>
                <p className="mt-1 text-xs font-black text-slate-950">{metric.value}</p>
              </div>
            );
          })}
        </div>

        <div className="absolute left-4 top-[112px] z-[900] hidden rounded-full border border-slate-200 bg-white/94 px-3 py-2 text-xs font-semibold text-slate-700 shadow-[0_14px_38px_rgba(15,23,42,0.12)] backdrop-blur md:left-5 lg:block">
          <span className={`mr-2 inline-block size-2 rounded-full ${estimatedSegmentCount === 0 && missingRouteCount === 0 ? "bg-emerald-500" : "bg-amber-500"}`} />
          {routeQualityLabel}
        </div>

        <div className="absolute right-4 top-28 z-[900] hidden w-[300px] rounded-[8px] border border-slate-200 bg-white/94 p-3 shadow-[0_16px_44px_rgba(15,23,42,0.12)] backdrop-blur xl:block">
          <p className="text-[11px] font-black uppercase text-slate-400">{labels.routeSummary}</p>
          <div className="mt-3 space-y-2">
            {[
              { label: labels.longestTransfer, value: formatMinutes(longestTransfer, labels), icon: Bus },
              { label: labels.baseChanges, value: String(baseChanges), icon: Bed },
              { label: labels.estimatedSegments, value: String(estimatedSegmentCount), icon: Route },
              { label: labels.openIssues, value: String(openIssueCount), icon: AlertTriangle }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center justify-between gap-3 text-xs font-bold text-slate-600">
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <Icon className="size-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  <span className={item.label === labels.openIssues && openIssueCount > 0 ? "font-black text-rose-600" : "font-black text-slate-950"}>
                    {item.value}
                  </span>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => onOpenReview?.(null)}
            className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-[8px] border border-indigo-200 bg-indigo-50 text-xs font-black text-indigo-700 transition hover:bg-indigo-100"
          >
            {labels.fixIssues}
          </button>
        </div>

        {transportModes.length > 0 ? (
          <div className="absolute right-4 top-[330px] z-[900] hidden rounded-[8px] border border-slate-200 bg-white/94 p-3 shadow-[0_16px_44px_rgba(15,23,42,0.12)] backdrop-blur xl:block">
            <p className="text-[11px] font-black uppercase text-slate-400">{labels.transportLegend}</p>
            <div className="mt-2 space-y-2">
              {transportModes.map((mode) => (
                <div key={mode.label} className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <span
                    className="h-0.5 w-8 rounded-full"
                    style={{
                      backgroundColor: mode.color,
                      borderTop: mode.dashArray ? `2px dashed ${mode.color}` : undefined
                    }}
                  />
                  <span className="max-w-28 truncate">{mode.label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {selectedPlace ? (
          <div className="absolute left-4 top-[150px] z-[900] w-[min(340px,calc(100%-32px))] rounded-[8px] border border-slate-200 bg-white/96 p-4 shadow-[0_22px_70px_rgba(15,23,42,0.2)] backdrop-blur md:left-5 md:top-[150px]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase text-indigo-600">
                  {selectedTimelineItem ? dayRangeLabel(labels, selectedTimelineItem.startDay, selectedTimelineItem.endDay) : selectedDay ? formatDay(labels, selectedDay.dayNumber) : labels.fullTrip}
                </p>
                <h3 className="mt-1 line-clamp-2 text-xl font-black text-slate-950">{selectedPlace.title}</h3>
                <p className="mt-1 truncate text-xs font-bold text-slate-500">{selectedPlace.location}</p>
              </div>
              <div className="flex size-12 shrink-0 items-center justify-center rounded-[8px] border-2 bg-gradient-to-br from-orange-100 via-blue-100 to-violet-100 text-sm font-black text-slate-800 shadow-inner" style={{ borderColor: dayColor(selectedPlace.dayNumber) }}>
                {selectedPlace.markerLabel}
              </div>
            </div>
            <p className="mt-3 line-clamp-3 text-sm font-semibold leading-6 text-slate-600">
              {selectedDay?.theme || selectedOption.fitSummary}
            </p>
            {selectedHighlights.length > 0 ? (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="text-[11px] font-black uppercase text-slate-400">{labels.highlights}</p>
                <div className="mt-2 space-y-1.5">
                  {selectedHighlights.map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-600">
                      <span className="truncate">{activity.title}</span>
                      <span className="shrink-0 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-black text-slate-500">{activity.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => onOpenReview?.(selectedPlace.dayNumber)}
              className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-[8px] border border-indigo-200 bg-indigo-50 text-sm font-black text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100"
            >
              {labels.openInReviewPlanning}
            </button>
          </div>
        ) : null}

        {unavailablePlaces.length > 0 || relevantWarnings.length > 0 || estimatedSegmentCount > 0 ? (
          <div className="absolute bottom-28 right-4 z-[900] hidden w-[min(320px,calc(100%-32px))] rounded-[8px] border border-amber-200 bg-amber-50/95 p-3 text-xs font-semibold leading-5 text-amber-900 shadow-[0_16px_44px_rgba(15,23,42,0.12)] backdrop-blur lg:block">
            <button
              type="button"
              onClick={() => setAttentionExpanded((current) => !current)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <span>
                <span className="block font-black uppercase text-amber-700">{labels.attentionNeeded}</span>
                <span className="mt-1 block text-[11px] text-amber-800">
                  {openIssueCount} {labels.openIssues} · {estimatedSegmentCount} {labels.estimatedSegments}
                </span>
              </span>
              <ChevronDown className={`size-4 shrink-0 transition ${attentionExpanded ? "rotate-180" : ""}`} />
            </button>
            {attentionExpanded ? (
              <>
                <div className="mt-2 max-h-36 space-y-2 overflow-y-auto pr-1">
                  {unavailablePlaces.length > 0 ? <p>{labels.missingCoordinates}</p> : null}
                  {estimatedSegmentCount > 0 ? <p>{labels.uncertainTransportAssumption}</p> : null}
                  {relevantWarnings.slice(0, 2).map((warning) => (
                    <p key={warning.id}>{warning.message}</p>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => onOpenReview?.(null)}
                  className="mt-3 text-xs font-black text-indigo-700"
                >
                  {labels.viewAllIssues}
                </button>
              </>
            ) : null}
          </div>
        ) : null}

        <div className="absolute bottom-28 left-4 z-[900] hidden w-[min(320px,calc(100%-32px))] rounded-[8px] border border-slate-200 bg-white/94 p-3 shadow-[0_16px_44px_rgba(15,23,42,0.12)] backdrop-blur lg:block">
          <button
            type="button"
            onClick={() => setRouteReasonExpanded((current) => !current)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <span>
              <span className="block text-[11px] font-black uppercase text-indigo-600">{labels.whyThisRoute}</span>
              <span className="mt-1 line-clamp-1 block text-xs font-semibold text-slate-600">
                {routeInfluences[0]?.influence || selectedOption.fitSummary}
              </span>
            </span>
            <ChevronDown className={`size-4 shrink-0 text-slate-400 transition ${routeReasonExpanded ? "rotate-180" : ""}`} />
          </button>
          {routeReasonExpanded ? (
            <>
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">
                {routeInfluences[0]?.influence || selectedOption.fitSummary}
              </p>
              <div className="mt-3 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto pr-1">
                {routeInfluences.map((influence) => (
                  <span key={influence.preferenceId} className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700">
                    {influence.preference}
                  </span>
                ))}
                {routeInfluences.length === 0
                  ? assumptions
                      .filter((assumption) => assumption.status !== "Rejected")
                      .slice(0, 3)
                      .map((assumption) => (
                        <span key={assumption.id} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-600">
                          {assumption.label}
                        </span>
                      ))
                  : null}
              </div>
              <button
                type="button"
                onClick={() => onOpenReview?.(null)}
                className="mt-4 text-xs font-black text-indigo-700"
              >
                {labels.fixIssues}
              </button>
            </>
          ) : null}
        </div>

        <div className="absolute inset-x-0 bottom-0 z-[900] border-t border-white/70 bg-white/92 px-3 py-3 shadow-[0_-18px_44px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="mx-auto flex max-w-[1180px] items-center gap-2">
            <p className="hidden min-w-fit px-2 text-[11px] font-black uppercase text-slate-400 md:block">{labels.tripTimeline}</p>
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 planner-scrollbar">
              {timelineItems.map((item) => {
                const active = view !== "all" && typeof view === "number" && view >= item.startDay && view <= item.endDay;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleTimelineSelect(item)}
                    className={`min-w-[170px] rounded-[8px] border px-4 py-2 text-left transition ${
                      active
                        ? "border-emerald-400 bg-emerald-50 text-emerald-900 shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200"
                    }`}
                  >
                    <p className="text-xs font-black text-indigo-700">{dayRangeLabel(labels, item.startDay, item.endDay)}</p>
                    <p className="mt-1 truncate text-sm font-black">{item.title}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CostBreakdownPanel({
  selectedOption,
  currency,
  labels
}: {
  selectedOption: ItineraryOption;
  currency: string;
  labels: UIText;
}) {
  const dayItems = selectedOption.days.flatMap((day) => day.costBreakdown);
  const costItems = selectedOption.costBreakdown.length > 0 ? selectedOption.costBreakdown : aggregateCosts(dayItems);

  return (
    <Panel title={labels.costBreakdownTitle} eyebrow={labels.costBreakdownEyebrow} icon={<WalletCards className="size-4" />}>
      {costItems.length === 0 ? (
        <EmptyState title={labels.noCostBreakdownTitle} body={labels.noCostBreakdownBody} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {costItems.map((item) => (
            <div key={item.id} className="rounded-[8px] border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-950">
                    {labels.costCategoryLabels[item.category] || item.label}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{item.basis}</p>
                </div>
                {item.isRoughEstimate ? (
                  <span className="shrink-0 rounded-full border border-amber-100 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">
                    {labels.roughEstimate}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-[8px] bg-slate-50 p-2">
                  <p className="text-[10px] font-black uppercase text-slate-400">{labels.total}</p>
                  <p className="text-xs font-black text-slate-800">
                    {currency} {item.totalEur ?? item.amountEur}
                  </p>
                </div>
                <div className="rounded-[8px] bg-slate-50 p-2">
                  <p className="text-[10px] font-black uppercase text-slate-400">{labels.perDay}</p>
                  <p className="text-xs font-black text-slate-800">
                    {currency} {item.perDayEur ?? Math.round(item.amountEur / Math.max(1, selectedOption.days.length))}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function aggregateCosts(items: CostBreakdownItem[]): CostBreakdownItem[] {
  const grouped = new Map<CostBreakdownItem["category"], CostBreakdownItem[]>();

  items.forEach((item) => {
    grouped.set(item.category, [...(grouped.get(item.category) || []), item]);
  });

  return Array.from(grouped.entries()).map(([category, categoryItems]) => {
    const amountEur = categoryItems.reduce((sum, item) => sum + item.amountEur, 0);

    return {
      id: `aggregate-${category}`,
      category,
      label: categoryItems[0]?.label || category,
      amountEur,
      totalEur: amountEur,
      perDayEur: null,
      basis: categoryItems.map((item) => item.basis).filter(Boolean).slice(0, 2).join(" "),
      isRoughEstimate: categoryItems.some((item) => item.isRoughEstimate)
    };
  });
}

function ConstraintWarnings({ warnings, labels }: { warnings: ConstraintWarning[]; labels: UIText }) {
  return (
    <Panel title={labels.constraintWarnings} eyebrow={`${warnings.length} ${labels.flagged}`} icon={<AlertTriangle className="size-4" />}>
      {warnings.length === 0 ? (
        <EmptyState title={labels.noWarningsTitle} body={labels.noWarningsBody} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {warnings.map((warning) => (
            <div key={warning.id} className="rounded-[8px] border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-950">{labels.warningTypeLabels[warning.type]}</p>
                  <p className="mt-1 text-xs font-bold text-slate-400">
                    {warning.affectedDay ? formatDay(labels, warning.affectedDay) : labels.wholePlan}
                  </p>
                </div>
                <ImpactBadge impact={warning.impact} labels={labels.impactLabels} />
              </div>
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">{warning.message}</p>
              <div className="mt-3 rounded-[8px] bg-slate-50 p-2">
                <p className="text-[10px] font-black uppercase text-slate-400">{labels.recommendation}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-700">{warning.recommendation}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function RecommendationPanels({
  selectedOption,
  warnings,
  labels
}: {
  selectedOption: ItineraryOption;
  warnings: ConstraintWarning[];
  labels: UIText;
}) {
  const alternatives = selectedOption.days.flatMap((day) =>
    day.alternatives.map((alternative) => ({
      ...alternative,
      dayNumber: day.dayNumber
    }))
  );
  const panels = [
    ...alternatives.slice(0, 3).map((alternative) => ({
      id: alternative.id,
      title: alternative.title,
      eyebrow: `${formatDay(labels, alternative.dayNumber)} ${labels.dayAlternative}`,
      body: alternative.tradeoff,
      foot: alternative.bestFor,
      tone: "border-orange-100 bg-orange-50/55"
    })),
    ...warnings.slice(0, 2).map((warning) => ({
      id: warning.id,
      title: labels.warningTypeLabels[warning.type],
      eyebrow: warning.affectedDay
        ? `${formatDay(labels, warning.affectedDay)} ${labels.dayFeasibility}`
        : labels.planFeasibility,
      body: warning.message,
      foot: warning.recommendation,
      tone: "border-rose-100 bg-rose-50/55"
    }))
  ];

  if (panels.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {panels.slice(0, 4).map((panel) => (
        <div key={panel.id} className={`rounded-[8px] border p-3 shadow-sm ${panel.tone}`}>
          <p className="text-[11px] font-black uppercase text-blue-900/45">{panel.eyebrow}</p>
          <h3 className="mt-1 truncate text-sm font-black text-slate-950">{panel.title}</h3>
          <p className="mt-2 line-clamp-3 text-xs font-semibold leading-5 text-slate-600">{panel.body}</p>
          <p className="mt-2 line-clamp-2 text-[11px] font-bold leading-4 text-blue-900/70">{panel.foot}</p>
        </div>
      ))}
    </div>
  );
}

export function ItineraryCanvas({
  itinerary,
  warnings,
  assumptions,
  selectedOptionId,
  onSelectOption,
  planning,
  labels,
  mode = "map",
  onOpenReview
}: ItineraryCanvasProps) {
  if (!itinerary) {
    if (mode === "review") {
      return <ConstraintWarnings warnings={warnings} labels={labels} />;
    }

    return (
      <div className="space-y-4">
        <EmptyCanvas planning={planning} labels={labels} />
      </div>
    );
  }

  const selectedOption =
    itinerary.options.find((option) => option.id === selectedOptionId) ||
    itinerary.options.find((option) => option.id === itinerary.selectedOptionId) ||
    itinerary.options[0];

  if (mode === "map") {
    return (
      <ItineraryMap
        itinerary={itinerary}
        selectedOption={selectedOption}
        warnings={warnings}
        assumptions={assumptions}
        onSelectOption={onSelectOption}
        labels={labels}
        onOpenReview={onOpenReview}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Panel title={labels.reviewPlanningWorkspace} eyebrow={labels.reviewPlanningEyebrow} icon={<Route className="size-4" />}>
        <div className="canvas-grid relative overflow-hidden rounded-[8px] border border-slate-200 bg-white/78 p-4">
          <OptionHeader itinerary={itinerary} selectedOption={selectedOption} onSelectOption={onSelectOption} labels={labels} />
          <InfluenceLayer assumptions={assumptions} labels={labels} />

          <div className="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {selectedOption.days.map((day) => (
              <DayCard key={day.dayNumber} day={day} assumptions={assumptions} labels={labels} />
            ))}
          </div>

          <div className="mt-4 flex justify-center text-center text-[11px] font-bold text-blue-900/45">
            {labels.canvasInfluenceNote}
          </div>
        </div>
      </Panel>

      <CostBreakdownPanel selectedOption={selectedOption} currency={itinerary.currency} labels={labels} />
      <RecommendationPanels selectedOption={selectedOption} warnings={warnings} labels={labels} />
      <ConstraintWarnings warnings={warnings} labels={labels} />
    </div>
  );
}
