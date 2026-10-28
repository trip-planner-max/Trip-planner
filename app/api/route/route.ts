import { NextRequest } from "next/server";
import { OSRM_URL, json, parseLonLat } from "../_lib/osm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type OSRMRoute = {
  distance: number;
  duration: number;
  geometry?: string;
};

type OSRMResponse = {
  code?: string;
  message?: string;
  routes?: OSRMRoute[];
};

function formatDuration(seconds: number): string {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${totalMinutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

export async function POST(request: NextRequest) {
  let body: {
    originPlaceId?: unknown;
    destinationPlaceId?: unknown;
    transport?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  const origin = parseLonLat(body.originPlaceId);
  const destination = parseLonLat(body.destinationPlaceId);

  if (!origin || !destination) {
    return json(
      {
        error:
          "Please select both a starting location and a destination from the location suggestions.",
      },
      400
    );
  }

  const [originLon, originLat] = origin;
  const [destinationLon, destinationLat] = destination;

  const url =
    `${OSRM_URL}/route/v1/driving/` +
    `${originLon},${originLat};${destinationLon},${destinationLat}` +
    "?overview=full&geometries=polyline&steps=false";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });

    const responseText = await response.text();
    let data: OSRMResponse;

    try {
      data = JSON.parse(responseText) as OSRMResponse;
    } catch {
      return json(
        { error: "The routing service returned an unreadable response. Please try again." },
        502
      );
    }

    if (!response.ok) {
      return json(
        { error: `The routing service returned HTTP ${response.status}. Please try again later.` },
        502
      );
    }

    const route = data.routes?.[0];

    if (data.code !== "Ok" || !route) {
      return json(
        {
          error:
            data.message ||
            "No driving route was found for these locations. Try selecting nearby, specific locations.",
        },
        422
      );
    }

    if (
      !Number.isFinite(route.distance) ||
      route.distance <= 0 ||
      !Number.isFinite(route.duration) ||
      route.duration < 0
    ) {
      return json({ error: "The routing service returned invalid distance or duration data." }, 502);
    }

    const distanceKm = route.distance / 1000;

    return json({
      distanceMeters: route.distance,
      distanceKm,
      distanceText: `${distanceKm.toLocaleString("en-IN", {
        maximumFractionDigits: 1,
      })} km`,
      durationSeconds: route.duration,
      durationText: formatDuration(route.duration),
      encodedPolyline: route.geometry ?? "",
      source: "OSRM",
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "The route lookup timed out. Please try again."
        : "Could not contact the routing service. Please try again.";
    return json({ error: message }, 502);
  } finally {
    clearTimeout(timeout);
  }
}
