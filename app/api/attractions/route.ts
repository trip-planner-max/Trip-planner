import { NextRequest } from "next/server";
import { OSRM_URL, PHOTON_URL, fetchJson, json } from "../_lib/osm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type OpenTripMapPlace = {
  xid: string;
  name: string;
  dist?: number;
  rate?: number;
  wikidata?: string;
  kinds?: string;
  point?: { lat: number; lon: number };
};

type WikiSearchPage = {
  pageid: number;
  title: string;
  index?: number;
  length?: number;
  description?: string;
  coordinates?: Array<{ lat: number; lon: number }>;
  thumbnail?: { source: string; width: number; height: number };
};

type Attraction = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  category: string;
  admission: { status: "free-tagged" | "fee-may-apply" | "unknown"; note: string; amountINR?: number };
  osmUrl: string;
  imageUrl?: string;
  openingHours?: string;
  website?: string;
  wikipedia?: string;
  legDistanceKm?: number;
  legDurationMinutes?: number;
};

type BucketType = "temple" | "monument" | "museum" | "park" | "mall";

type ScoredCandidate = {
  attraction: Attraction;
  score: number;
  bucket: BucketType;
};

// Strictly blocks any railway lines, tracks, highways, roads, stations, schools, colleges, or hospitals
const JUNK_NAME_REGEX =
  /\b(line|lines|railway|rail|train|track|corridor|station|junction|metro|expressway|highway|flyover|overpass|underpass|bypass|viaduct|culvert|canal|barrages?|hospital|medical|college|university|school|clinic|hygiene|medicine|faculty|institute|institution|vidyalaya|mahavidyalaya|shiksha|prangan|academy|seminary|department|ministry|secretariat|court|jail|prison|police|cemetery|graveyard|crematorium|bus stand|depot|airport|airstrip|headquarters|chamber of commerce|consulate|embassy|constituency|district|ward|division|corporation|municipality|panchayat|tehsil|taluk|hostel|dormitory|apartments|housing|geography of|history of|economy of|list of|template|category|old mission church|st\.?\s*james|st\.?\s*john|holy rosary|armenian church|kirk|chapel|parish|gaudiya mission|bamondas|lascar|jubilee bridge|cenotaph)\b/i;

const JUNK_DESC_REGEX =
  /\b(railway line|rail line|main line|train line|railway station|metro station|rapid transit|highway|hospital|medical college|university|school|constituency|municipality|administrative|district|neighborhood|neighbourhood|suburb)\b/i;

// Matches Hindu temples & major spiritual centers
const HINDU_TEMPLE_REGEX =
  /\b(temple|mandir|math|kalibari|dakshineswar|belur|kalighat|iskcon|birla\s*(mandir|temple)|kali\s*(temple|mandir)|shiva|vishnu|krishna|tarapith|tarakeswar|jyotirlinga|shakti|hanuman|ganesh|durga|jagannath|balaji|venkateswara|ramakrishna\s*math|ashram|gurudwara|pareshnath|jain\s*temple)\b/i;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function classifyPlace(
  kinds: string,
  name: string,
  description = ""
): { category: string; bucket: BucketType } | null {
  // Normalize dashes (en-dash, em-dash, hyphen) to standard spaces before regex testing
  const normalizedName = name.replace(/[\u2010-\u2015-]/g, " ");
  const normalizedDesc = description.replace(/[\u2010-\u2015-]/g, " ");

  if (JUNK_NAME_REGEX.test(normalizedName) || JUNK_DESC_REGEX.test(normalizedDesc)) {
    return null;
  }

  const combined = `${normalizedName} ${normalizedDesc} ${kinds}`.toLowerCase();

  // 1. Shopping & Malls
  if (
    /\b(mall|shopping centre|shopping center|city centre|new market|acropolis|mani square|quest|south city|forum)\b/.test(
      combined
    ) ||
    kinds.includes("malls")
  ) {
    return { category: "Shopping & Mall", bucket: "mall" };
  }

  // 2. Iconic Monuments override (e.g., Victoria Memorial)
  if (/\b(Victoria Memorial)\b/i.test(normalizedName)) {
    return { category: "Monument & Heritage", bucket: "monument" };
  }

  // 3. Museums, Science & Planetariums (checked before temples so Birla Museum stays in Museum)
  if (
    kinds.includes("museums") ||
    /\b(museum|science city|planetarium|technological|gallery|thakur bari|tagore\s*house|science centre)\b/.test(
      combined
    )
  ) {
    return { category: "Museum & Science", bucket: "museum" };
  }

  // 4. Hindu Temples & Major Spiritual Landmarks
  if (
    HINDU_TEMPLE_REGEX.test(combined) ||
    kinds.includes("hindu_temples") ||
    /\b(st\.?\s*paul'?s\s*cathedral|nakhoda\s*mosque|buddhist\s*pagoda)\b/.test(combined)
  ) {
    return { category: "Temple & Spiritual", bucket: "temple" };
  }

  // 5. Parks, Zoos, Beaches, Gardens & Theme Parks
  if (
    kinds.includes("gardens_and_parks") ||
    kinds.includes("amusements") ||
    kinds.includes("nature_reserves") ||
    kinds.includes("zoos") ||
    kinds.includes("beaches") ||
    /\b(eco park|nicco park|park|garden|botanical|zoo|zoological|maidan|sarobar|lake|beach|waterfall|falls|sanctuary|aquatica|wet o wild)\b/.test(
      combined
    )
  ) {
    return { category: "Park & Nature", bucket: "park" };
  }

  // 6. Monuments, Palaces, Forts & Famous Named Bridges (NO generic OpenTripMap "bridges" kind!)
  if (
    kinds.includes("monuments_and_memorials") ||
    kinds.includes("fortifications") ||
    kinds.includes("palaces") ||
    kinds.includes("castles") ||
    /\b(memorial|monument|palace|fort|castle|howrah bridge|rabindra setu|vidyasagar setu|prinsep ghat|ghat|rajbari|shaheed minar|eden gardens)\b/.test(
      combined
    )
  ) {
    return { category: "Monument & Heritage", bucket: "monument" };
  }

  return null;
}

// Resolve city/district name cleanly so Wikipedia search works for any location
async function resolveCityName(lat: number, lon: number): Promise<string> {
  try {
    const rev = await fetchJson<{
      features?: Array<{
        properties?: { city?: string; town?: string; county?: string; state_district?: string; name?: string };
      }>;
    }>(`${PHOTON_URL}/reverse?lon=${lon}&lat=${lat}`, {}, 4000);
    const p = rev.features?.[0]?.properties;
    const candidate = p?.city || p?.town || p?.county || p?.state_district || p?.name || "";
    if (candidate && !JUNK_NAME_REGEX.test(candidate)) {
      return candidate;
    }
  } catch {
    // Fall through
  }
  return "";
}

// 1. Primary Source: Wikipedia Geosearch + City Landmark Search (with Thumbnail Photos)
async function fetchWikipediaLandmarks(lat: number, lon: number): Promise<ScoredCandidate[]> {
  const cityName = await resolveCityName(lat, lon);

  const urls: string[] = [
    // Direct coordinate geosearch around destination
    `https://en.wikipedia.org/w/api.php?action=query&generator=geosearch&ggscoord=${lat}%7C${lon}&ggsradius=10000&ggslimit=50&prop=coordinates%7Cdescription%7Cinfo%7Cpageimages&piprop=thumbnail&pithumbsize=240&pilimit=max&colimit=max&format=json&formatversion=2`,
  ];

  if (cityName) {
    const q = `${cityName} (temple OR mandir OR math OR memorial OR monument OR museum OR park OR zoo OR garden OR palace OR fort OR mall OR beach)`;
    urls.push(
      `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        q
      )}&gsrlimit=50&prop=coordinates%7Cdescription%7Cinfo%7Cpageimages&piprop=thumbnail&pithumbsize=240&pilimit=max&colimit=max&format=json&formatversion=2`
    );
  }

  const settled = await Promise.allSettled(
    urls.map((u) => fetchJson<{ query?: { pages?: WikiSearchPage[] } }>(u, {}, 9000))
  );

  const candidates: ScoredCandidate[] = [];

  for (const res of settled) {
    if (res.status !== "fulfilled" || !res.value.query?.pages) continue;

    for (const page of res.value.query.pages) {
      const coord = page.coordinates?.[0];
      if (!coord || !Number.isFinite(coord.lat) || !Number.isFinite(coord.lon)) continue;

      const distKm = haversineKm(lat, lon, coord.lat, coord.lon);
      if (distKm > 50) continue;

      const cleanTitle = page.title.replace(/\s*\([^)]*\)\s*$/, "").trim();
      const classified = classifyPlace("", cleanTitle, page.description || "");
      if (!classified) continue;

      const articleBytes = page.length || 0;
      if (articleBytes > 0 && articleBytes < 1500) continue;

      const lengthBonus = Math.min(300, Math.round(articleBytes / 120));
      const rankBonus = Math.max(0, 50 - (page.index || 25)) * 2;
      let score = 300 + lengthBonus + rankBonus;

      if (classified.bucket === "temple" && HINDU_TEMPLE_REGEX.test(`${cleanTitle} ${page.description || ""}`)) {
        score += 80;
      }

      candidates.push({
        bucket: classified.bucket,
        score,
        attraction: {
          id: `wiki-${page.pageid}`,
          name: cleanTitle,
          lat: coord.lat,
          lon: coord.lon,
          category: classified.category,
          admission: { status: "unknown" as const, note: "Check entry fees locally." },
          osmUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanTitle)}+${coord.lat},${coord.lon}`,
          wikipedia: page.title,
          imageUrl: page.thumbnail?.source,
        },
      });
    }
  }

  return candidates;
}

// 2. Supplemental Source: OpenTripMap across 50km (NO "bridges" category!)
async function fetchOpenTripMapCandidates(lat: number, lon: number): Promise<ScoredCandidate[]> {
  const apiKey = "5ae2e3f221c38a28845f05b6dc0e9bf84c5e0ae32c6f006ce1d664f6";
  const base = "https://api.opentripmap.com/0.1/en/places/radius";

  // Notice "bridges" is completely removed from kinds so railway lines/viaducts are never fetched
  const urls = [
    `${base}?radius=50000&lon=${lon}&lat=${lat}&kinds=hindu_temples,monasteries,religion&rate=2&limit=200&format=json&apikey=${apiKey}`,
    `${base}?radius=50000&lon=${lon}&lat=${lat}&kinds=monuments_and_memorials,fortifications,palaces,castles&rate=2&limit=200&format=json&apikey=${apiKey}`,
    `${base}?radius=50000&lon=${lon}&lat=${lat}&kinds=museums,zoos,aquariums&rate=1&limit=150&format=json&apikey=${apiKey}`,
    `${base}?radius=50000&lon=${lon}&lat=${lat}&kinds=gardens_and_parks,amusements,nature_reserves,beaches&rate=2&limit=200&format=json&apikey=${apiKey}`,
    `${base}?radius=35000&lon=${lon}&lat=${lat}&kinds=malls&rate=1&limit=100&format=json&apikey=${apiKey}`,
  ];

  const settled = await Promise.allSettled(
    urls.map((u) => fetchJson<OpenTripMapPlace[]>(u, {}, 9000))
  );

  const candidates: ScoredCandidate[] = [];

  for (const res of settled) {
    if (res.status !== "fulfilled" || !Array.isArray(res.value)) continue;

    for (const place of res.value) {
      const rawName = (place.name || "").trim();
      if (!rawName || !place.point) continue;

      const cleanName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
      const classified = classifyPlace(place.kinds || "", cleanName);
      if (!classified) continue;

      const rate = place.rate || 1;
      let score = rate === 7 ? 210 : rate === 3 ? 190 : rate === 6 ? 170 : rate === 2 ? 150 : 120;

      if (place.wikidata) score += 20;
      if (classified.bucket === "temple" && HINDU_TEMPLE_REGEX.test(cleanName)) {
        score += 60;
      }

      candidates.push({
        bucket: classified.bucket,
        score,
        attraction: {
          id: `otm-${place.xid}`,
          name: cleanName,
          lat: place.point.lat,
          lon: place.point.lon,
          category: classified.category,
          admission: { status: "unknown" as const, note: "Check entry fees locally." },
          osmUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanName)}+${place.point.lat},${place.point.lon}`,
        },
      });
    }
  }

  return candidates;
}

// 3. Deduplicate and interleave in ROUND-ROBIN order so Day 1-3 get a mix of all categories
function selectBalancedTopAttractions(allCandidates: ScoredCandidate[], maxTotal = 30): Attraction[] {
  const sorted = [...allCandidates].sort((a, b) => b.score - a.score);

  const seenNames = new Set<string>();
  const deduped: ScoredCandidate[] = [];

  for (const item of sorted) {
    const normName = item.attraction.name
      .toLowerCase()
      .replace(/\b(kolkata|calcutta|new town|howrah|india|the|hall|gardens?)\b/g, "")
      .replace(/[^a-z0-9]/g, "");

    if (!normName || seenNames.has(normName)) continue;

    const isNearDuplicate = deduped.some(
      (existing) =>
        haversineKm(
          existing.attraction.lat,
          existing.attraction.lon,
          item.attraction.lat,
          item.attraction.lon
        ) < 0.3
    );
    if (isNearDuplicate) continue;

    seenNames.add(normName);
    deduped.push(item);
  }

  const bucketLists: Record<BucketType, Attraction[]> = {
    monument: [],
    temple: [],
    museum: [],
    park: [],
    mall: [],
  };

  for (const item of deduped) {
    if (bucketLists[item.bucket].length < 8) {
      bucketLists[item.bucket].push(item.attraction);
    }
  }

  // Interleave in round-robin order: Monument -> Temple -> Museum -> Park -> Mall
  const order: BucketType[] = ["monument", "temple", "museum", "park", "mall"];
  const selected: Attraction[] = [];
  const usedIds = new Set<string>();

  for (let round = 0; round < 8; round++) {
    for (const bucket of order) {
      const candidate = bucketLists[bucket][round];
      if (candidate && !usedIds.has(candidate.id)) {
        selected.push(candidate);
        usedIds.add(candidate.id);
        if (selected.length >= maxTotal) return selected;
      }
    }
  }

  for (const item of deduped) {
    if (selected.length >= maxTotal) break;
    if (!usedIds.has(item.attraction.id)) {
      selected.push(item.attraction);
      usedIds.add(item.attraction.id);
    }
  }

  return selected;
}

// 4. Attach sequential driving times and distances in PARALLEL using OSRM
async function attachTravelLegs(places: Attraction[], centerLat: number, centerLon: number) {
  const tasks = places.map(async (cur, idx) => {
    const prev = idx === 0 ? { lat: centerLat, lon: centerLon } : places[idx - 1];
    try {
      const url = `${OSRM_URL}/route/v1/driving/${prev.lon},${prev.lat};${cur.lon},${cur.lat}?overview=false`;
      const res = await fetchJson<{ routes?: Array<{ distance: number; duration: number }> }>(url, {}, 4500);
      if (res.routes?.[0]) {
        cur.legDistanceKm = Math.round((res.routes[0].distance / 1000) * 10) / 10;
        cur.legDurationMinutes = Math.max(5, Math.round(res.routes[0].duration / 60));
      }
    } catch {
      // OSRM failures are handled gracefully by the frontend
    }
  });

  await Promise.allSettled(tasks);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return json({ error: "Valid latitude and longitude coordinates are required." }, 400, 0);
  }

  try {
    const [wikiRes, otmRes] = await Promise.allSettled([
      fetchWikipediaLandmarks(lat, lon),
      fetchOpenTripMapCandidates(lat, lon),
    ]);

    const allCandidates: ScoredCandidate[] = [];
    if (wikiRes.status === "fulfilled") allCandidates.push(...wikiRes.value);
    if (otmRes.status === "fulfilled") allCandidates.push(...otmRes.value);

    const selectedPlaces = selectBalancedTopAttractions(allCandidates, 30);

    if (selectedPlaces.length === 0) {
      return json(
        {
          error: "Tourist places are temporarily unavailable.",
          detail: "No matching landmarks found within 50km.",
        },
        502,
        0
      );
    }

    await attachTravelLegs(selectedPlaces, lat, lon);

    return json(
      {
        results: selectedPlaces,
        routeOrderAvailable: true,
        source: "Wikipedia Famous Landmarks & OpenTripMap (50km)",
      },
      200,
      0
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return json(
      {
        error: "Tourist places are temporarily unavailable.",
        detail,
      },
      502,
      0
    );
  }
}