import type { Itinerary, ItineraryOption, MapPlace, RouteSegment } from "@/types/travel";

type Coordinates = { lat: number; lng: number };

type GeocodeResult = {
  coordinates: Coordinates | null;
  locationStatus: MapPlace["locationStatus"];
  warning: string | null;
};

type RouteResult = {
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline: string | null;
  provider: RouteSegment["provider"];
  geometryStatus: RouteSegment["geometryStatus"];
  confidence: number;
  warnings: string[];
};

const geocodeCache = new Map<string, GeocodeResult>();
const routeCache = new Map<string, RouteResult>();
const GOOGLE_REQUEST_TIMEOUT_MS = 20_000;

function boundedSignal(parent?: AbortSignal) {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(parent?.reason);
  const timeout = setTimeout(() => controller.abort("google-timeout"), GOOGLE_REQUEST_TIMEOUT_MS);

  if (parent?.aborted) {
    abortFromParent();
  } else {
    parent?.addEventListener("abort", abortFromParent, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeout);
      parent?.removeEventListener("abort", abortFromParent);
    }
  };
}

async function fetchJson<T>(input: URL | string, init: RequestInit, parent?: AbortSignal) {
  const request = boundedSignal(parent);

  try {
    const response = await fetch(input, { ...init, signal: request.signal });
    const payload = (await response.json()) as T;
    return { response, payload };
  } finally {
    request.cleanup();
  }
}

function googleMapsKey() {
  return (process.env.GOOGLE_MAPS_API_KEY || "").trim();
}

function normalizedKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function cacheKey(parts: Array<string | number | null | undefined>) {
  return parts.map((part) => normalizedKey(String(part ?? ""))).join("|");
}

function placeQuery(place: MapPlace, destination: string) {
  const parts = [place.title, place.location, destination].filter(Boolean);
  return Array.from(new Set(parts)).join(", ");
}

function routeModeForGoogle(mode: string): "WALK" | "DRIVE" | "TRANSIT" {
  const normalized = mode.toLowerCase();

  if (normalized.includes("walk")) {
    return "WALK";
  }

  if (
    normalized.includes("public") ||
    normalized.includes("transit") ||
    normalized.includes("metro") ||
    normalized.includes("train") ||
    normalized.includes("rail") ||
    normalized.includes("bus")
  ) {
    return "TRANSIT";
  }

  return "DRIVE";
}

function parseDurationSeconds(value: unknown) {
  if (typeof value === "string") {
    const match = value.match(/^(\d+(?:\.\d+)?)s$/);
    return match ? Number(match[1]) : 0;
  }

  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

async function geocodePlace(
  place: MapPlace,
  destination: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<GeocodeResult> {
  if (place.coordinates) {
    return {
      coordinates: place.coordinates,
      locationStatus: place.locationStatus,
      warning: place.locationStatus === "Approximate" ? "Coordinate is approximate." : null
    };
  }

  const query = placeQuery(place, destination);
  const key = cacheKey([query]);
  const cached = geocodeCache.get(key);

  if (cached) {
    return cached;
  }

  if (!apiKey) {
    const result = {
      coordinates: null,
      locationStatus: "Unavailable" as const,
      warning: "Google Maps API key is not configured."
    };
    geocodeCache.set(key, result);
    return result;
  }

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", query);
    url.searchParams.set("key", apiKey);

    const { payload } = await fetchJson<{
      status?: string;
      results?: Array<{
        partial_match?: boolean;
        formatted_address?: string;
        geometry?: {
          location?: { lat?: number; lng?: number };
          location_type?: string;
        };
      }>;
      error_message?: string;
    }>(url, {}, signal);

    const first = payload.results?.[0];
    const location = first?.geometry?.location;
    const locationType = first?.geometry?.location_type || "";
    const hasCoordinates = typeof location?.lat === "number" && typeof location.lng === "number";
    const lowConfidence = Boolean(first?.partial_match) || locationType === "APPROXIMATE";

    const result: GeocodeResult =
      payload.status !== "OK" || !hasCoordinates || lowConfidence
        ? {
            coordinates: null,
            locationStatus: "Unavailable",
            warning: lowConfidence
              ? "Needs coordinate confirmation; Google geocoding returned an ambiguous or low-confidence match."
              : payload.error_message || `Google geocoding failed with status ${payload.status || "UNKNOWN"}.`
          }
        : {
            coordinates: { lat: location.lat!, lng: location.lng! },
            locationStatus: locationType === "ROOFTOP" ? "Exact" : "Approximate",
            warning: locationType === "ROOFTOP" ? null : "Coordinate is approximate."
          };

    geocodeCache.set(key, result);
    return result;
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }

    const result = {
      coordinates: null,
      locationStatus: "Unavailable" as const,
      warning: error instanceof Error ? error.message : "Google geocoding failed."
    };
    geocodeCache.set(key, result);
    return result;
  }
}

async function computeRoute(input: {
  from: Coordinates;
  to: Coordinates;
  mode: string;
  apiKey: string;
  signal?: AbortSignal;
}): Promise<RouteResult> {
  const googleMode = routeModeForGoogle(input.mode);
  const key = cacheKey([
    input.from.lat.toFixed(6),
    input.from.lng.toFixed(6),
    input.to.lat.toFixed(6),
    input.to.lng.toFixed(6),
    googleMode
  ]);
  const cached = routeCache.get(key);

  if (cached) {
    return cached;
  }

  if (!input.apiKey) {
    const result = {
      distanceMeters: 0,
      durationSeconds: 0,
      encodedPolyline: null,
      provider: "fallback_estimated" as const,
      geometryStatus: "Estimated" as const,
      confidence: 0.35,
      warnings: ["Google Maps API key is not configured; using estimated dashed route."]
    };
    routeCache.set(key, result);
    return result;
  }

  try {
    const { response, payload } = await fetchJson<{
      routes?: Array<{
        duration?: string;
        distanceMeters?: number;
        polyline?: { encodedPolyline?: string };
      }>;
      error?: { message?: string };
    }>(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": input.apiKey,
          "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline"
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: input.from.lat, longitude: input.from.lng } } },
          destination: { location: { latLng: { latitude: input.to.lat, longitude: input.to.lng } } },
          travelMode: googleMode,
          polylineQuality: "HIGH_QUALITY",
          computeAlternativeRoutes: false
        })
      },
      input.signal
    );
    const route = payload.routes?.[0];
    const encodedPolyline = route?.polyline?.encodedPolyline || null;

    const result: RouteResult =
      response.ok && route && encodedPolyline
        ? {
            distanceMeters: route.distanceMeters || 0,
            durationSeconds: parseDurationSeconds(route.duration),
            encodedPolyline,
            provider: "google_routes",
            geometryStatus: "Real",
            confidence: 0.95,
            warnings: []
          }
        : {
            distanceMeters: 0,
            durationSeconds: 0,
            encodedPolyline: null,
            provider: "fallback_estimated",
            geometryStatus: "Estimated",
            confidence: 0.35,
            warnings: [payload.error?.message || "Google Routes did not return route geometry; using estimated dashed route."]
          };

    routeCache.set(key, result);
    return result;
  } catch (error) {
    if (input.signal?.aborted) {
      throw error;
    }

    const result = {
      distanceMeters: 0,
      durationSeconds: 0,
      encodedPolyline: null,
      provider: "fallback_estimated" as const,
      geometryStatus: "Estimated" as const,
      confidence: 0.35,
      warnings: [error instanceof Error ? error.message : "Google Routes failed; using estimated dashed route."]
    };
    routeCache.set(key, result);
    return result;
  }
}

function withRouteFallback(segment: RouteSegment, warning: string): RouteSegment {
  return {
    ...segment,
    provider: "fallback_estimated",
    geometryStatus: segment.routeStatus === "Missing" ? "Missing" : "Estimated",
    routeStatus: segment.routeStatus === "Missing" ? "Missing" : "Estimated",
    encodedPolyline: null,
    confidence: Math.min(segment.confidence, segment.routeStatus === "Missing" ? 0.1 : 0.35),
    warnings: Array.from(new Set([...(segment.warnings || []), warning]))
  };
}

async function enrichPlaces(places: MapPlace[], destination: string, apiKey: string, signal?: AbortSignal) {
  return Promise.all(
    places.map(async (place) => {
      const result = await geocodePlace(place, destination, apiKey, signal);

      return {
        ...place,
        coordinates: result.coordinates,
        locationStatus: result.locationStatus,
        unavailableReason: result.coordinates ? null : result.warning || place.unavailableReason || "Coordinates unavailable."
      };
    })
  );
}

async function enrichSegments(
  segments: RouteSegment[],
  lookup: Map<string, MapPlace>,
  apiKey: string,
  signal?: AbortSignal
) {
  return Promise.all(
    segments.map(async (segment) => {
      const from = lookup.get(segment.fromPlaceId) || lookup.get(segment.fromStopId);
      const to = lookup.get(segment.toPlaceId) || lookup.get(segment.toStopId);

      if (!from?.coordinates || !to?.coordinates) {
        return withRouteFallback(segment, "Missing coordinates; route cannot be verified.");
      }

      const route = await computeRoute({
        from: from.coordinates,
        to: to.coordinates,
        mode: segment.transportMode,
        apiKey,
        signal
      });

      if (route.geometryStatus !== "Real") {
        return {
          ...withRouteFallback(segment, route.warnings[0] || "Route geometry is estimated."),
          fromCoordinates: from.coordinates,
          toCoordinates: to.coordinates
        };
      }

      return {
        ...segment,
        fromStopId: segment.fromStopId || segment.fromPlaceId,
        toStopId: segment.toStopId || segment.toPlaceId,
        fromCoordinates: from.coordinates,
        toCoordinates: to.coordinates,
        estimatedTravelTimeMinutes: Math.round(route.durationSeconds / 60),
        durationSeconds: route.durationSeconds,
        distanceKm: Number((route.distanceMeters / 1000).toFixed(2)),
        distanceMeters: route.distanceMeters,
        encodedPolyline: route.encodedPolyline,
        provider: route.provider,
        geometryStatus: route.geometryStatus,
        routeStatus: route.geometryStatus,
        confidence: route.confidence,
        warnings: route.warnings
      };
    })
  );
}

function buildPlaceLookup(places: MapPlace[]) {
  const lookup = new Map<string, MapPlace>();

  places.forEach((place) => {
    lookup.set(place.id, place);
    if (place.sourceActivityId) {
      lookup.set(place.sourceActivityId, place);
      if (place.dayNumber) {
        lookup.set(`day-${place.dayNumber}-${place.sourceActivityId}`, place);
      }
    }
    if (place.dayNumber) {
      lookup.set(`day-${place.dayNumber}-${place.id}`, place);
    }
  });

  return lookup;
}

async function enrichOption(
  option: ItineraryOption,
  destination: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<ItineraryOption> {
  const mapPlaces = await enrichPlaces(option.mapPlaces, destination, apiKey, signal);
  const days = await Promise.all(
    option.days.map(async (day) => ({
      ...day,
      activities: await Promise.all(
        day.activities.map(async (activity) => {
          if (activity.coordinates) {
            return activity;
          }

          const pseudoPlace: MapPlace = {
            id: activity.id,
            dayNumber: day.dayNumber,
            title: activity.title,
            location: activity.location,
            coordinates: activity.coordinates,
            locationStatus: activity.locationStatus,
            sourceActivityId: activity.id,
            unavailableReason: activity.locationUnavailableReason
          };
          const geocoded = await geocodePlace(pseudoPlace, destination, apiKey, signal);

          return {
            ...activity,
            coordinates: geocoded.coordinates,
            locationStatus: geocoded.locationStatus,
            locationUnavailableReason: geocoded.coordinates ? null : geocoded.warning || activity.locationUnavailableReason
          };
        })
      ),
      routeSegments: day.routeSegments
    }))
  );
  const activityPlaces: MapPlace[] = days.flatMap((day) =>
    day.activities.map((activity) => ({
      id: activity.id,
      dayNumber: day.dayNumber,
      title: activity.title,
      location: activity.location,
      coordinates: activity.coordinates,
      locationStatus: activity.locationStatus,
      sourceActivityId: activity.id,
      unavailableReason: activity.locationUnavailableReason
    }))
  );
  const lookup = buildPlaceLookup([...mapPlaces, ...activityPlaces]);
  const routeSegments = await enrichSegments(option.routeSegments, lookup, apiKey, signal);
  const routedDays = await Promise.all(
    days.map(async (day) => ({
      ...day,
      routeSegments: await enrichSegments(day.routeSegments, lookup, apiKey, signal)
    }))
  );

  return {
    ...option,
    mapPlaces,
    routeSegments,
    days: routedDays
  };
}

export async function enrichItineraryWithGoogleRoutes(itinerary: Itinerary, signal?: AbortSignal): Promise<Itinerary> {
  const apiKey = googleMapsKey();
  const options = await Promise.all(
    itinerary.options.map((option) => enrichOption(option, itinerary.destination, apiKey, signal))
  );

  return {
    ...itinerary,
    options
  };
}
