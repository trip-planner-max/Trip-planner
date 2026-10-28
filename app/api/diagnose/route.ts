// GET /api/diagnose
// Open http://localhost:3000/api/diagnose to test every outside service this app depends on,
// from the machine that runs the server. Each line says whether it worked, how long it took,
// and the exact network error if it did not.
// Delete this folder before you share the app publicly.

import { OSRM_URL, OVERPASS_URLS, PHOTON_URL, USER_AGENT } from "../_lib/osm";

type Check = { name: string; url: string; init?: RequestInit };

const checks: Check[] = [
  { name: "Photon (place search)", url: `${PHOTON_URL}/api/?q=kolkata&limit=1` },
  { name: "OSRM (routes)", url: `${OSRM_URL}/route/v1/driving/87.232,22.346;88.364,22.572?overview=false` },
  ...OVERPASS_URLS.map((url) => ({
    name: `Overpass (${new URL(url).host})`,
    url: url.replace(/interpreter$/, "status"),
  })),
  {
    name: "Wikipedia (backup places)",
    url: "https://en.wikipedia.org/w/api.php?action=query&generator=geosearch&ggscoord=22.5726%7C88.3639&ggsradius=10000&ggslimit=10&prop=description&format=json&formatversion=2",
  },
  { name: "OpenStreetMap map tiles", url: "https://tile.openstreetmap.org/5/22/13.png" },
];

async function run(check: Check) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(check.url, {
      ...check.init,
      cache: "no-store",
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
    });
    let extra = "";
    if (check.name.startsWith("Wikipedia")) {
      const data = (await response.json().catch(() => null)) as { query?: { pages?: unknown[] }; error?: { info?: string } } | null;
      extra = data?.error ? `API error: ${data.error.info}` : `${data?.query?.pages?.length ?? 0} nearby pages returned`;
    } else {
      await response.arrayBuffer().catch(() => null);
    }
    return { name: check.name, ok: response.ok, status: response.status, ms: Date.now() - started, note: extra || undefined };
  } catch (error) {
    const e = error as { name?: string; message?: string; cause?: { code?: string; message?: string } };
    return {
      name: check.name,
      ok: false,
      ms: Date.now() - started,
      error: e.name === "AbortError" ? "timed out after 12 s" : `${e.message ?? "failed"}${e.cause?.code ? ` (${e.cause.code})` : e.cause?.message ? ` (${e.cause.message})` : ""}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const results = await Promise.all(checks.map(run));
  return Response.json(
    { nodeVersion: process.version, results },
    { headers: { "Cache-Control": "no-store" } }
  );
}
