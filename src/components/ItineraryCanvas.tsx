"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bed,
  Bus,
  CalendarDays,
  Crosshair,
  Euro,
  Footprints,
  Layers,
  MapPin,
  Minus,
  Navigation2,
  Plus,
  Route,
  ShieldCheck,
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
};

type MapView = "all" | number;

type PositionedPlace = MapPlace & {
  sequence: number;
  x: number;
  y: number;
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

type MapDrag = {
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
};

type Tile = {
  key: string;
  x: number;
  y: number;
  tileX: number;
  tileY: number;
  zoom: number;
};

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

function derivePlaces(option: ItineraryOption): MapPlace[] {
  if (option.mapPlaces.length > 0) {
    return option.mapPlaces;
  }

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

function routeSegmentsForView(option: ItineraryOption, view: MapView) {
  const segments = [...option.routeSegments, ...option.days.flatMap((day) => day.routeSegments)];

  if (view === "all") {
    return segments;
  }

  return segments.filter((segment) => segment.dayNumber === null || segment.dayNumber === view);
}

function dayColor(dayNumber: number | null | undefined) {
  if (!dayNumber) {
    return "#64748b";
  }

  return DAY_COLORS[(dayNumber - 1) % DAY_COLORS.length];
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

function fitCamera(places: Array<MapPlace & { sequence: number }>): MapCamera {
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
  places: Array<MapPlace & { sequence: number }>,
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

function visibleTiles(camera: MapCamera, adjustment: MapAdjustment): Tile[] {
  const zoom = clamp(camera.zoom + adjustment.zoomDelta, MIN_ZOOM, MAX_ZOOM);
  const center = coordinatesToWorld({ lat: camera.centerLat, lng: camera.centerLng }, zoom);
  const topLeft = {
    x: center.x - MAP_WIDTH / 2 - adjustment.offsetX,
    y: center.y - MAP_HEIGHT / 2 - adjustment.offsetY
  };
  const tileCount = 2 ** zoom;
  const startX = Math.floor(topLeft.x / MAP_TILE_SIZE) - 1;
  const endX = Math.floor((topLeft.x + MAP_WIDTH) / MAP_TILE_SIZE) + 1;
  const startY = Math.max(0, Math.floor(topLeft.y / MAP_TILE_SIZE) - 1);
  const endY = Math.min(tileCount - 1, Math.floor((topLeft.y + MAP_HEIGHT) / MAP_TILE_SIZE) + 1);
  const tiles: Tile[] = [];

  for (let tileX = startX; tileX <= endX; tileX += 1) {
    for (let tileY = startY; tileY <= endY; tileY += 1) {
      const wrappedX = ((tileX % tileCount) + tileCount) % tileCount;

      tiles.push({
        key: `${zoom}-${tileX}-${tileY}`,
        x: tileX * MAP_TILE_SIZE - topLeft.x,
        y: tileY * MAP_TILE_SIZE - topLeft.y,
        tileX: wrappedX,
        tileY,
        zoom
      });
    }
  }

  return tiles;
}

function tileUrl(tile: Tile) {
  return `https://a.basemaps.cartocdn.com/rastertiles/voyager/${tile.zoom}/${tile.tileX}/${tile.tileY}.png`;
}

function routePath(from: PositionedPlace, to: PositionedPlace, index: number) {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const bend = index % 2 === 0 ? 0.12 : -0.12;
  const controlX = midX - dy * bend;
  const controlY = midY + dx * bend;

  if (distance < 12) {
    return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  }

  return `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`;
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

function fallbackRouteSegments(places: PositionedPlace[], labels: UIText): RouteSegment[] {
  return places.slice(1).map((place, index) => ({
    id: `fallback-${places[index].id}-${place.id}`,
    dayNumber: place.dayNumber,
    fromPlaceId: places[index].id,
    toPlaceId: place.id,
    transportMode: labels.noRouteSegments,
    estimatedTravelTimeMinutes: 0,
    distanceKm: 0,
    notes: labels.noRouteSegments
  }));
}

function LiveBaseMap({
  labels,
  planning = false,
  overlayTitle,
  overlayBody,
  camera = { centerLat: 20, centerLng: 0, zoom: 2 }
}: {
  labels: UIText;
  planning?: boolean;
  overlayTitle?: string;
  overlayBody?: string;
  camera?: MapCamera;
}) {
  const [adjustment, setAdjustment] = useState<MapAdjustment>({ zoomDelta: 0, offsetX: 0, offsetY: 0 });
  const [drag, setDrag] = useState<MapDrag | null>(null);
  const tiles = visibleTiles(camera, adjustment);

  function changeZoom(delta: number) {
    setAdjustment((current) => ({
      ...current,
      zoomDelta: clamp(current.zoomDelta + delta, MIN_ZOOM - camera.zoom, MAX_ZOOM - camera.zoom)
    }));
  }

  function resetMap() {
    setAdjustment({ zoomDelta: 0, offsetX: 0, offsetY: 0 });
  }

  return (
    <div
      className="relative h-[520px] min-h-[420px] touch-none overflow-hidden bg-[#eef2ed] lg:h-[620px]"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setDrag({
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          offsetX: adjustment.offsetX,
          offsetY: adjustment.offsetY
        });
      }}
      onPointerMove={(event) => {
        if (!drag || drag.pointerId !== event.pointerId) {
          return;
        }

        setAdjustment((current) => ({
          ...current,
          offsetX: drag.offsetX + event.clientX - drag.startX,
          offsetY: drag.offsetY + event.clientY - drag.startY
        }));
      }}
      onPointerUp={() => setDrag(null)}
      onPointerCancel={() => setDrag(null)}
      onWheel={(event) => {
        event.preventDefault();
        changeZoom(event.deltaY > 0 ? -1 : 1);
      }}
    >
      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full select-none"
        aria-label={labels.mapTitle}
      >
        <defs>
          <pattern id="live-base-map-roads" width="92" height="92" patternUnits="userSpaceOnUse">
            <rect width="92" height="92" fill="#eef2ed" />
            <path d="M -12 72 C 20 48 48 48 104 12" fill="none" stroke="#d1d8ce" strokeWidth="7" />
            <path d="M -12 72 C 20 48 48 48 104 12" fill="none" stroke="#ffffff" strokeWidth="4" />
            <path d="M 18 -10 C 38 30 44 56 98 102" fill="none" stroke="#d8ded5" strokeWidth="5" />
          </pattern>
        </defs>
        <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#live-base-map-roads)" />
        {tiles.map((tile) => (
          <image
            key={tile.key}
            href={tileUrl(tile)}
            x={tile.x}
            y={tile.y}
            width={MAP_TILE_SIZE}
            height={MAP_TILE_SIZE}
            opacity="0.98"
          />
        ))}
      </svg>

      {overlayTitle ? (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 w-[min(420px,calc(100%-48px))] -translate-x-1/2 -translate-y-1/2 rounded-[8px] border border-slate-200 bg-white/94 p-5 text-center shadow-[0_22px_70px_rgba(26,35,67,0.18)] backdrop-blur">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-600">
            {planning ? <Timer className="size-7" /> : <Sparkles className="size-7" />}
          </div>
          <h3 className="mt-3 text-xl font-black text-slate-950">{overlayTitle}</h3>
          {overlayBody ? <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-6 text-slate-500">{overlayBody}</p> : null}
        </div>
      ) : null}

      <div className="absolute left-4 top-4 z-20 rounded-[8px] border border-slate-200 bg-white/94 px-3 py-2 text-xs font-black text-slate-700 shadow-sm backdrop-blur">
        <span className="inline-flex items-center gap-2">
          <Navigation2 className="size-4 text-indigo-600" />
          {labels.fullTrip}
        </span>
      </div>

      <div
        className="absolute right-4 top-4 z-20 overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => changeZoom(1)}
          className="flex size-10 items-center justify-center border-b border-slate-200 text-slate-700 hover:bg-slate-50"
          title={labels.zoomIn}
        >
          <Plus className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => changeZoom(-1)}
          className="flex size-10 items-center justify-center border-b border-slate-200 text-slate-700 hover:bg-slate-50"
          title={labels.zoomOut}
        >
          <Minus className="size-5" />
        </button>
        <button
          type="button"
          onClick={resetMap}
          className="flex size-10 items-center justify-center text-slate-700 hover:bg-slate-50"
          title={labels.resetMap}
        >
          <Crosshair className="size-5" />
        </button>
      </div>

      <div className="absolute bottom-4 left-4 z-20 rounded-[8px] border border-slate-200 bg-white/92 px-3 py-2 text-[11px] font-bold text-slate-500 shadow-sm backdrop-blur">
        {labels.dragToPan} - {labels.wheelToZoom}
      </div>
      <div className="absolute bottom-4 right-4 z-20 rounded-[8px] border border-slate-200 bg-white/92 px-3 py-2 text-[10px] font-bold text-slate-400 shadow-sm backdrop-blur">
        {labels.mapDataAttribution}
      </div>
    </div>
  );
}

function EmptyCanvas({ planning, labels }: { planning: boolean; labels: UIText }) {
  return (
    <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-[0_22px_70px_rgba(26,35,67,0.1)]">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-black uppercase text-indigo-600">
            <MapPin className="size-3.5" />
            {labels.mapEyebrow}
          </p>
          <h2 className="mt-1 truncate text-2xl font-black text-slate-950">{labels.mapTitle}</h2>
          <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-500">{labels.emptyCanvasBody}</p>
        </div>
        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-3 text-xs font-black text-slate-600"
          title={labels.mapLayers}
        >
          <Layers className="size-4" />
          {labels.mapLayers}
        </button>
      </div>

      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="border-b border-slate-100 xl:border-b-0 xl:border-r">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">
              <span className="size-2 rounded-full bg-indigo-600" />
              {labels.fullTrip}
            </span>
            {[1, 2, 3].map((dayNumber) => (
              <span
                key={dayNumber}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500"
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: dayColor(dayNumber) }} />
                {formatDay(labels, dayNumber)}
              </span>
            ))}
          </div>

          <LiveBaseMap
            labels={labels}
            planning={planning}
            overlayTitle={planning ? labels.emptyCanvasPlanningTitle : labels.emptyCanvasReadyTitle}
            overlayBody={labels.emptyCanvasBody}
          />
        </div>

        <aside className="space-y-4 bg-slate-50/70 p-4">
          <div className="rounded-[8px] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-black uppercase text-slate-400">{labels.selected}</p>
            <h3 className="mt-1 text-lg font-black text-slate-950">{labels.emptyCanvasItinerary}</h3>
            <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{labels.emptyCanvasBody}</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[labels.emptyCanvasAssumptions, labels.emptyCanvasCheckpoint, labels.emptyCanvasItinerary].map((label, index) => (
                <div key={label} className="rounded-[8px] bg-slate-50 p-2 text-center">
                  {index === 1 ? (
                    <ShieldCheck className="mx-auto size-4 text-orange-500" />
                  ) : (
                    <CalendarDays className="mx-auto size-4 text-slate-500" />
                  )}
                  <p className="mt-1 truncate text-[10px] font-bold text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[8px] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-black text-slate-950">{labels.mapGuide}</p>
            <div className="mt-3 space-y-2 text-xs font-semibold leading-5 text-slate-500">
              <p>{labels.clickMarkers}</p>
              <p>{labels.dragToPan}</p>
              <p>{labels.wheelToZoom}</p>
            </div>
          </div>
        </aside>
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
    <article className="min-w-[286px] rounded-[8px] border border-blue-200 bg-white p-3 shadow-[0_20px_48px_rgba(26,35,67,0.1)]">
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
  const places = useMemo(
    () => derivePlaces(selectedOption).map((place, sequence) => ({ ...place, sequence })),
    [selectedOption]
  );
  const viewPlaces = places.filter((place) => view === "all" || place.dayNumber === view);
  const baseCamera = fitCamera(viewPlaces);
  const positionedPlaces = projectPlaces(viewPlaces, baseCamera, { zoomDelta: 0, offsetX: 0, offsetY: 0 });
  const unavailablePlaces = viewPlaces.filter((place) => !place.coordinates);
  const positionedById = buildPositionedLookup(positionedPlaces);
  const structuredSegments = routeSegmentsForView(selectedOption, view).filter(
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
            {routeSegments.map((segment) => {
              const from = positionedById.get(segment.fromPlaceId);
              const to = positionedById.get(segment.toPlaceId);

              if (!from || !to) {
                return null;
              }

              return (
                <g key={segment.id}>
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
          {routeSegments.slice(0, 6).map((segment) => {
            const from = positionedById.get(segment.fromPlaceId);
            const to = positionedById.get(segment.toPlaceId);

            return (
              <div key={segment.id} className="rounded-[8px] border border-slate-200 bg-white p-2 text-xs font-semibold text-slate-600">
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
  onSelectOption,
  labels
}: {
  itinerary: Itinerary;
  selectedOption: ItineraryOption;
  warnings: ConstraintWarning[];
  onSelectOption: (id: string) => void;
  labels: UIText;
}) {
  const [view, setView] = useState<MapView>("all");
  const [adjustment, setAdjustment] = useState<MapAdjustment>({ zoomDelta: 0, offsetX: 0, offsetY: 0 });
  const [drag, setDrag] = useState<MapDrag | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const dayNumbers = selectedOption.days.map((day) => day.dayNumber);
  const places = useMemo(
    () => derivePlaces(selectedOption).map((place, sequence) => ({ ...place, sequence })),
    [selectedOption]
  );
  const viewPlaces = places.filter((place) => view === "all" || place.dayNumber === view);
  const viewPlacesKey = viewPlaces.map((place) => place.id).join("|");
  const baseCamera = useMemo(() => fitCamera(viewPlaces), [viewPlacesKey]);
  const positionedPlaces = projectPlaces(viewPlaces, baseCamera, adjustment);
  const unavailablePlaces = viewPlaces.filter((place) => !place.coordinates);
  const positionedById = buildPositionedLookup(positionedPlaces);
  const structuredSegments = routeSegmentsForView(selectedOption, view).filter(
    (segment) => positionedById.has(segment.fromPlaceId) && positionedById.has(segment.toPlaceId)
  );
  const routeSegments = structuredSegments.length > 0 ? structuredSegments : fallbackRouteSegments(positionedPlaces, labels);
  const activeDays = selectedOption.days.filter((day) => view === "all" || day.dayNumber === view);
  const tiles = visibleTiles(baseCamera, adjustment);
  const selectedPlace = positionedPlaces.find((place) => place.id === selectedPlaceId) || positionedPlaces[0] || null;
  const totalWalkingKm = activeDays.reduce((sum, day) => sum + day.totalWalkingKm, 0);
  const totalTravelMinutes =
    routeSegments.reduce((sum, segment) => sum + segment.estimatedTravelTimeMinutes, 0) ||
    activeDays.reduce((sum, day) => sum + day.totalTravelTimeMinutes, 0);
  const totalDistanceKm = routeSegments.reduce((sum, segment) => sum + segment.distanceKm, 0);
  const relevantWarnings = warnings.filter((warning) => view === "all" || !warning.affectedDay || warning.affectedDay === view);

  useEffect(() => {
    setAdjustment({ zoomDelta: 0, offsetX: 0, offsetY: 0 });
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

  function changeZoom(delta: number) {
    setAdjustment((current) => ({
      ...current,
      zoomDelta: clamp(current.zoomDelta + delta, MIN_ZOOM - baseCamera.zoom, MAX_ZOOM - baseCamera.zoom)
    }));
  }

  function resetMap() {
    setAdjustment({ zoomDelta: 0, offsetX: 0, offsetY: 0 });
  }

  return (
    <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-[0_22px_70px_rgba(26,35,67,0.1)]">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-black uppercase text-indigo-600">
            <MapPin className="size-3.5" />
            {labels.mapEyebrow}
          </p>
          <h2 className="mt-1 truncate text-2xl font-black text-slate-950">{labels.mapTitle}</h2>
          <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-500">{selectedOption.fitSummary}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {itinerary.options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelectOption(option.id)}
              className={`rounded-[8px] border px-3 py-2 text-xs font-black transition ${
                option.id === selectedOption.id
                  ? "border-violet-300 bg-violet-600 text-white shadow-[0_12px_30px_rgba(124,58,237,0.25)]"
                  : "border-slate-200 bg-white text-slate-600 hover:border-violet-200"
              }`}
            >
              {option.title}
            </button>
          ))}
          <button
            type="button"
            className="flex h-9 items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-3 text-xs font-black text-slate-600"
            title={labels.mapLayers}
          >
            <Layers className="size-4" />
            {labels.mapLayers}
          </button>
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="border-b border-slate-100 xl:border-b-0 xl:border-r">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <button
              type="button"
              onClick={() => setView("all")}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${
                view === "all" ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              <span className="size-2 rounded-full bg-slate-500" />
              {labels.fullTrip}
            </button>
            {dayNumbers.map((dayNumber) => (
              <button
                key={dayNumber}
                type="button"
                onClick={() => setView(dayNumber)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${
                  view === dayNumber
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: dayColor(dayNumber) }} />
                {formatDay(labels, dayNumber)}
              </button>
            ))}
          </div>

          {positionedPlaces.length === 0 ? (
            <LiveBaseMap
              labels={labels}
              overlayTitle={labels.locationsUnavailableTitle}
              overlayBody={labels.locationsUnavailableBody}
              camera={baseCamera}
            />
          ) : (
            <div
              className="relative h-[520px] min-h-[420px] touch-none overflow-hidden bg-[#eef2ed] lg:h-[620px]"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                setDrag({
                  pointerId: event.pointerId,
                  startX: event.clientX,
                  startY: event.clientY,
                  offsetX: adjustment.offsetX,
                  offsetY: adjustment.offsetY
                });
              }}
              onPointerMove={(event) => {
                if (!drag || drag.pointerId !== event.pointerId) {
                  return;
                }

                setAdjustment((current) => ({
                  ...current,
                  offsetX: drag.offsetX + event.clientX - drag.startX,
                  offsetY: drag.offsetY + event.clientY - drag.startY
                }));
              }}
              onPointerUp={() => setDrag(null)}
              onPointerCancel={() => setDrag(null)}
              onWheel={(event) => {
                event.preventDefault();
                changeZoom(event.deltaY > 0 ? -1 : 1);
              }}
            >
              <svg
                viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full select-none"
                aria-label={labels.mapTitle}
              >
                <defs>
                  <pattern id="map-fallback-roads" width="92" height="92" patternUnits="userSpaceOnUse">
                    <rect width="92" height="92" fill="#eef2ed" />
                    <path d="M -12 72 C 20 48 48 48 104 12" fill="none" stroke="#d1d8ce" strokeWidth="7" />
                    <path d="M -12 72 C 20 48 48 48 104 12" fill="none" stroke="#ffffff" strokeWidth="4" />
                    <path d="M 18 -10 C 38 30 44 56 98 102" fill="none" stroke="#d8ded5" strokeWidth="5" />
                  </pattern>
                  <filter id="route-shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#0f172a" floodOpacity="0.2" />
                  </filter>
                </defs>
                <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#map-fallback-roads)" />
                {tiles.map((tile) => (
                  <image
                    key={tile.key}
                    href={tileUrl(tile)}
                    x={tile.x}
                    y={tile.y}
                    width={MAP_TILE_SIZE}
                    height={MAP_TILE_SIZE}
                    opacity="0.98"
                  />
                ))}
                {routeSegments.map((segment, index) => {
                  const from = positionedById.get(segment.fromPlaceId);
                  const to = positionedById.get(segment.toPlaceId);

                  if (!from || !to) {
                    return null;
                  }

                  const color = dayColor(segment.dayNumber ?? from.dayNumber);
                  const path = routePath(from, to, index);

                  return (
                    <g key={segment.id}>
                      <path d={path} fill="none" stroke="#ffffff" strokeWidth="11" strokeLinecap="round" filter="url(#route-shadow)" />
                      <path
                        d={path}
                        fill="none"
                        stroke={color}
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeDasharray={segment.distanceKm === 0 ? "10 10" : undefined}
                      />
                    </g>
                  );
                })}
              </svg>

              <div className="pointer-events-none absolute inset-0">
                {positionedPlaces.map((place, index) => {
                  const selected = selectedPlace?.id === place.id;
                  const color = dayColor(place.dayNumber);

                  return (
                    <button
                      key={place.id}
                      type="button"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => setSelectedPlaceId(place.id)}
                      className={`pointer-events-auto absolute z-20 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 bg-white text-xs font-black shadow-[0_8px_24px_rgba(15,23,42,0.26)] transition ${
                        selected ? "scale-110 ring-4 ring-white" : "hover:scale-105"
                      }`}
                      style={{
                        left: `${(place.x / MAP_WIDTH) * 100}%`,
                        top: `${(place.y / MAP_HEIGHT) * 100}%`,
                        borderColor: color,
                        color
                      }}
                      title={`${place.title} - ${place.location}`}
                    >
                      {index + 1}
                    </button>
                  );
                })}

                {selectedPlace ? (
                  <div
                    className="pointer-events-auto absolute z-30 w-[240px] rounded-[8px] bg-slate-950/92 p-3 text-white shadow-[0_18px_44px_rgba(15,23,42,0.32)]"
                    style={{
                      left: `${(selectedPlace.x / MAP_WIDTH) * 100}%`,
                      top: `${(selectedPlace.y / MAP_HEIGHT) * 100}%`,
                      transform: "translate(-50%, calc(-100% - 22px))"
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
                        style={{ backgroundColor: dayColor(selectedPlace.dayNumber) }}
                      >
                        {selectedPlace.sequence + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">{selectedPlace.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs font-semibold text-white/70">{selectedPlace.location}</p>
                        <p className="mt-2 text-[11px] font-bold text-white/55">
                          {selectedPlace.dayNumber ? formatDay(labels, selectedPlace.dayNumber) : labels.fullTrip} -{" "}
                          {selectedPlace.locationStatus === "Unavailable" ? labels.locationUnavailable : selectedPlace.locationStatus}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="absolute left-4 top-4 z-20 rounded-[8px] border border-slate-200 bg-white/94 px-3 py-2 text-xs font-black text-slate-700 shadow-sm backdrop-blur">
                <span className="inline-flex items-center gap-2">
                  <Navigation2 className="size-4 text-indigo-600" />
                  {view === "all" ? labels.fullTrip : typeof view === "number" ? formatDay(labels, view) : labels.fullTrip}
                </span>
              </div>

              <div
                className="absolute right-4 top-4 z-20 overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => changeZoom(1)}
                  className="flex size-10 items-center justify-center border-b border-slate-200 text-slate-700 hover:bg-slate-50"
                  title={labels.zoomIn}
                >
                  <Plus className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => changeZoom(-1)}
                  className="flex size-10 items-center justify-center border-b border-slate-200 text-slate-700 hover:bg-slate-50"
                  title={labels.zoomOut}
                >
                  <Minus className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={resetMap}
                  className="flex size-10 items-center justify-center text-slate-700 hover:bg-slate-50"
                  title={labels.resetMap}
                >
                  <Crosshair className="size-5" />
                </button>
              </div>

              <div className="absolute bottom-4 left-4 z-20 rounded-[8px] border border-slate-200 bg-white/92 px-3 py-2 text-[11px] font-bold text-slate-500 shadow-sm backdrop-blur">
                {labels.dragToPan} - {labels.wheelToZoom}
              </div>
              <div className="absolute bottom-4 right-4 z-20 rounded-[8px] border border-slate-200 bg-white/88 px-2 py-1 text-[10px] font-bold text-slate-500 shadow-sm backdrop-blur">
                {labels.mapDataAttribution}
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-4 bg-slate-50/70 p-4">
          <div className="rounded-[8px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase text-slate-400">{labels.selected}</p>
                <h3 className="mt-1 line-clamp-2 text-lg font-black text-slate-950">{selectedOption.title}</h3>
              </div>
              <span className="shrink-0 rounded-full bg-violet-50 px-2 py-1 text-[11px] font-bold text-violet-700">
                {itinerary.currency} {selectedOption.estimatedTotalCostEur}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-[8px] bg-slate-50 p-2 text-center">
                <CalendarDays className="mx-auto size-4 text-slate-500" />
                <p className="mt-1 text-xs font-black text-slate-900">{activeDays.length}</p>
                <p className="text-[10px] font-bold text-slate-400">{labels.dayPlan}</p>
              </div>
              <div className="rounded-[8px] bg-slate-50 p-2 text-center">
                <MapPin className="mx-auto size-4 text-slate-500" />
                <p className="mt-1 text-xs font-black text-slate-900">{positionedPlaces.length}</p>
                <p className="text-[10px] font-bold text-slate-400">{labels.keyPlaces}</p>
              </div>
              <div className="rounded-[8px] bg-slate-50 p-2 text-center">
                <Timer className="mx-auto size-4 text-slate-500" />
                <p className="mt-1 text-xs font-black text-slate-900">{formatMinutes(totalTravelMinutes, labels)}</p>
                <p className="text-[10px] font-bold text-slate-400">{labels.travel}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-[8px] border border-slate-100 bg-white p-2">
                <p className="text-[10px] font-black uppercase text-slate-400">{labels.walk}</p>
                <p className="text-sm font-black text-slate-900">{totalWalkingKm.toFixed(1)} km</p>
              </div>
              <div className="rounded-[8px] border border-slate-100 bg-white p-2">
                <p className="text-[10px] font-black uppercase text-slate-400">{labels.routeOverview}</p>
                <p className="text-sm font-black text-slate-900">{totalDistanceKm.toFixed(1)} km</p>
              </div>
            </div>
          </div>

          <div className="rounded-[8px] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-black text-slate-950">{labels.routeOverview}</p>
            {routeSegments.length === 0 ? (
              <p className="mt-2 text-xs font-semibold text-slate-500">{labels.noRouteSegments}</p>
            ) : (
              <div className="mt-3 space-y-2">
                {routeSegments.slice(0, 5).map((segment) => {
                  const from = positionedById.get(segment.fromPlaceId);
                  const to = positionedById.get(segment.toPlaceId);

                  return (
                    <div key={segment.id} className="rounded-[8px] border border-slate-100 bg-slate-50 p-2 text-xs font-semibold text-slate-600">
                      <div className="flex items-center gap-2 font-black text-slate-800">
                        <Bus className="size-3.5 text-indigo-600" />
                        <span className="truncate">
                          {from?.title || segment.fromPlaceId} - {to?.title || segment.toPlaceId}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2">
                        {segment.transportMode} - {formatMinutes(segment.estimatedTravelTimeMinutes, labels)}
                        {segment.notes ? ` - ${segment.notes}` : ""}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {selectedOption.preferenceInfluences.length > 0 ? (
            <div className="rounded-[8px] border border-violet-100 bg-violet-50/70 p-4 shadow-sm">
              <p className="text-sm font-black text-violet-950">{labels.learnedPreferenceInfluence}</p>
              <div className="mt-3 space-y-2">
                {selectedOption.preferenceInfluences.slice(0, 3).map((item) => (
                  <div key={item.preferenceId} className="rounded-[8px] bg-white/80 p-2 text-xs font-semibold text-violet-900">
                    <p className="font-black">{item.preference}</p>
                    <p className="mt-1 leading-5 opacity-75">{item.influence}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {unavailablePlaces.length > 0 || relevantWarnings.length > 0 ? (
            <div className="rounded-[8px] border border-amber-100 bg-amber-50 p-4 shadow-sm">
              <p className="text-sm font-black text-amber-900">{labels.partialLocationWarning}</p>
              {unavailablePlaces.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {unavailablePlaces.slice(0, 8).map((place) => (
                    <span key={place.id} className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-amber-700">
                      {place.title}
                    </span>
                  ))}
                </div>
              ) : null}
              {relevantWarnings.slice(0, 2).map((warning) => (
                <p key={warning.id} className="mt-2 text-xs font-semibold leading-5 text-amber-800">
                  {warning.message}
                </p>
              ))}
            </div>
          ) : null}

          <div className="rounded-[8px] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-black text-slate-950">{labels.mapGuide}</p>
            <div className="mt-3 space-y-2 text-xs font-semibold leading-5 text-slate-500">
              <p>{labels.clickMarkers}</p>
              <p>{labels.dragToPan}</p>
              <p>{labels.wheelToZoom}</p>
            </div>
          </div>
        </aside>
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
  labels
}: ItineraryCanvasProps) {
  if (!itinerary) {
    return (
      <div className="space-y-4">
        <EmptyCanvas planning={planning} labels={labels} />
        <ConstraintWarnings warnings={warnings} labels={labels} />
      </div>
    );
  }

  const selectedOption =
    itinerary.options.find((option) => option.id === selectedOptionId) ||
    itinerary.options.find((option) => option.id === itinerary.selectedOptionId) ||
    itinerary.options[0];

  return (
    <div className="space-y-4">
      <ItineraryMap
        itinerary={itinerary}
        selectedOption={selectedOption}
        warnings={warnings}
        onSelectOption={onSelectOption}
        labels={labels}
      />

      <Panel title={labels.planningCanvas} eyebrow={labels.plannerJsonEyebrow} icon={<Route className="size-4" />}>
        <div className="canvas-grid relative overflow-hidden rounded-[8px] border border-slate-200 bg-white/78 p-4">
          <div className="pointer-events-none absolute left-12 right-12 top-[310px] hidden border-t border-dashed border-blue-300 xl:block" />
          <OptionHeader itinerary={itinerary} selectedOption={selectedOption} onSelectOption={onSelectOption} labels={labels} />
          <InfluenceLayer assumptions={assumptions} labels={labels} />

          <div className="mt-4 flex gap-4 overflow-x-auto px-1 pb-2 planner-scrollbar">
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
