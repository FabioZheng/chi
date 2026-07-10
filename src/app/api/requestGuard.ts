import { NextResponse } from "next/server";

type Bucket = {
  count: number;
  resetAt: number;
};

const WINDOW_MS = 60_000;
const MAX_TRACKED_BUCKETS = 2_000;
const MAX_BODY_BYTES = 256_000;

const rateLimitStore = globalThis as typeof globalThis & {
  __tripTreeRateLimits?: Map<string, Bucket>;
};

function store() {
  if (!rateLimitStore.__tripTreeRateLimits) {
    rateLimitStore.__tripTreeRateLimits = new Map<string, Bucket>();
  }

  return rateLimitStore.__tripTreeRateLimits;
}

function clientAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "anonymous";
}

export function guardApiRequest(request: Request, namespace: string, requestsPerMinute: number) {
  const contentLength = Number(request.headers.get("content-length") || 0);

  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body is too large.", code: "PAYLOAD_TOO_LARGE" }, { status: 413 });
  }

  const now = Date.now();
  const buckets = store();

  if (buckets.size > MAX_TRACKED_BUCKETS) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
      }
    }

    while (buckets.size > MAX_TRACKED_BUCKETS) {
      const oldestKey = buckets.keys().next().value as string | undefined;
      if (!oldestKey) break;
      buckets.delete(oldestKey);
    }
  }

  const key = `${namespace}:${clientAddress(request)}`;
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }

  if (current.count >= requestsPerMinute) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    return NextResponse.json(
      { error: "Too many planning requests. Please wait before trying again.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  current.count += 1;
  return null;
}
