export const PHOTON_URL = process.env.PHOTON_URL || "https://photon.komoot.io";
export const OSRM_URL = process.env.OSRM_URL || "https://router.project-osrm.org";

export const OVERPASS_URLS = process.env.OVERPASS_URL
  ? [process.env.OVERPASS_URL]
  : [
      "https://overpass-api.de/api/interpreter",
      "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter",
    ];

export const USER_AGENT =
  process.env.APP_CONTACT_EMAIL
    ? `TripPlannerDemo/1.0 (${process.env.APP_CONTACT_EMAIL})`
    : "TripPlannerDemo/1.0 (contact: info@example.com)";

export function json(data: unknown, status = 200, maxAgeSeconds = 0) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (maxAgeSeconds > 0) {
    headers["Cache-Control"] = `public, max-age=${maxAgeSeconds}, s-maxage=${maxAgeSeconds}`;
  } else {
    headers["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate";
    headers["Pragma"] = "no-cache";
    headers["Expires"] = "0";
  }
  return new Response(JSON.stringify(data), { status, headers });
}

export function parseLonLat(value: unknown): [number, number] | null {
  if (typeof value !== "string") return null;
  const parts = value.split(",").map((v) => Number(v.trim()));
  if (parts.length !== 2) return null;
  const [lon, lat] = parts;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return [lon, lat];
}

export async function fetchJson<T>(url: string, init: RequestInit = {}, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        ...(init.headers || {}),
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}