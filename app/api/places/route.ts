import { NextRequest } from "next/server";
import { PHOTON_URL, USER_AGENT, fetchJson, json } from "../_lib/osm";

type PlaceResult = {
  placeId: string;
  label: string;
  lat: number;
  lon: number;
};

const memoryCache = new Map<string, PlaceResult[]>();

async function fetchOpenMeteoPlaces(query: string): Promise<PlaceResult[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    query
  )}&count=10&language=en&format=json`;

  const data = await fetchJson<{ results?: any[] }>(url, {}, 5000);
  const list = data.results || [];

  return list.map((item) => {
    const label = [item.name, item.admin2, item.admin1, item.country]
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(", ");

    return {
      placeId: `${item.longitude},${item.latitude}`,
      label,
      lat: Number(item.latitude),
      lon: Number(item.longitude),
    };
  });
}

async function fetchPhotonPlaces(query: string): Promise<PlaceResult[]> {
  const url = `${PHOTON_URL}/api/?q=${encodeURIComponent(
    query
  )}&limit=10&lang=en&lat=20.5937&lon=78.9629`;

  const data = await fetchJson<{ features?: any[] }>(url, {}, 5000);
  const features = data.features || [];

  return features
    .map((f) => {
      const coords = f.geometry?.coordinates;
      const p = f.properties || {};
      if (!Array.isArray(coords) || coords.length < 2) return null;

      const lon = Number(coords[0]);
      const lat = Number(coords[1]);
      const label = [p.name, p.locality || p.district, p.city || p.town || p.county, p.state, p.country]
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(", ");

      if (!label) return null;

      return {
        placeId: `${lon},${lat}`,
        label,
        lat,
        lon,
      };
    })
    .filter((x): x is PlaceResult => x !== null);
}

async function fetchNominatimPlaces(query: string): Promise<PlaceResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
    query
  )}&limit=8&accept-language=en`;

  const data = await fetchJson<any[]>(
    url,
    { headers: { "User-Agent": USER_AGENT } },
    5000
  );

  return (data || [])
    .map((item) => {
      const lat = Number(item.lat);
      const lon = Number(item.lon);
      const label = String(item.display_name || "").trim();
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !label) return null;
      return {
        placeId: `${lon},${lat}`,
        label,
        lat,
        lon,
      };
    })
    .filter((x): x is PlaceResult => x !== null);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawInput = (searchParams.get("input") || searchParams.get("q") || "").trim();

  if (rawInput.length < 2) {
    return json({ results: [] }, 200, 3600);
  }

  const cacheKey = rawInput.toLowerCase();
  if (memoryCache.has(cacheKey)) {
    return json({ results: memoryCache.get(cacheKey)! }, 200, 3600);
  }

  const settled = await Promise.allSettled([
    fetchOpenMeteoPlaces(rawInput),
    fetchPhotonPlaces(rawInput),
    fetchNominatimPlaces(rawInput),
  ]);

  const combined: PlaceResult[] = [];
  for (const res of settled) {
    if (res.status === "fulfilled") {
      for (const item of res.value) {
        const exists = combined.some(
          (c) =>
            c.label.toLowerCase() === item.label.toLowerCase() ||
            (Math.abs(c.lat - item.lat) < 0.01 && Math.abs(c.lon - item.lon) < 0.01)
        );
        if (!exists) combined.push(item);
      }
    }
  }

  if (combined.length > 0) {
    memoryCache.set(cacheKey, combined.slice(0, 12));
  }

  return json({ results: combined.slice(0, 12) }, 200, 3600);
}