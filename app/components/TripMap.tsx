"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapAttraction = {
  id?: string | number | null;
  name?: string | null;
  lat?: number | null;
  lon?: number | null;
  category?: string | null;
  osmUrl?: string | null;
  imageUrl?: string | null;
  wikipedia?: string | null;
  [key: string]: unknown;
};

type TripMapProps = {
  encodedPolyline?: string | [number, number][] | null;
  origin: string;
  destination: string;
  attractions?: MapAttraction[];
  originLat?: number | null;
  originLon?: number | null;
  destinationLat?: number | null;
  destinationLon?: number | null;
};

/** Fallback thumbnail photos by category if a place has no Wikipedia image */
function getFallbackPhoto(category: string, name: string): string {
  const c = `${category} ${name}`.toLowerCase();
  if (c.includes("temple") || c.includes("mandir") || c.includes("math") || c.includes("spiritual")) {
    return "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=240&q=80";
  }
  if (c.includes("mall") || c.includes("shopping") || c.includes("market")) {
    return "https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?auto=format&fit=crop&w=240&q=80";
  }
  if (c.includes("park") || c.includes("garden") || c.includes("zoo") || c.includes("nature")) {
    return "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=240&q=80";
  }
  if (c.includes("museum") || c.includes("science") || c.includes("planetarium")) {
    return "https://images.unsplash.com/photo-1566127444979-b3d2b654e3d7?auto=format&fit=crop&w=240&q=80";
  }
  return "https://images.unsplash.com/photo-1558431382-27e303142255?auto=format&fit=crop&w=240&q=80";
}

/** Decodes an OSRM encoded polyline string (auto-detecting 1e5 or 1e6 precision) */
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }

  if (points.length > 0 && (Math.abs(points[0][0]) > 90 || Math.abs(points[0][1]) > 180)) {
    return points.map(([la, lo]) => [la / 10, lo / 10]);
  }

  return points;
}

export default function TripMap({
  encodedPolyline,
  origin,
  destination,
  attractions = [],
  originLat,
  originLon,
  destinationLat,
  destinationLon,
}: TripMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const [mapStyle, setMapStyle] = useState<"roadmap" | "hybrid">("roadmap");
  const [focusMode, setFocusMode] = useState<"route" | "attractions">("route");
  const [wikiPhotos, setWikiPhotos] = useState<Record<string, string>>({});

  // Automatically fetch real Wikipedia thumbnail photos for places if not already attached
  useEffect(() => {
    const valid = attractions.filter((a) => a.name && !a.imageUrl);
    if (valid.length === 0) return;

    let cancelled = false;

    async function loadThumbnails() {
      const titles = valid
        .slice(0, 30)
        .map((a) => String(a.wikipedia || a.name).trim())
        .filter(Boolean);

      if (titles.length === 0) return;

      try {
        const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
          titles.join("|")
        )}&prop=pageimages&piprop=thumbnail&pithumbsize=240&redirects=1&format=json&formatversion=2&origin=*`;

        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();

        const mapByTitle: Record<string, string> = {};
        const redirects: Array<{ from: string; to: string }> = data.query?.redirects || [];
        const pages: Array<{ title: string; thumbnail?: { source: string } }> =
          data.query?.pages || [];

        for (const p of pages) {
          if (p.title && p.thumbnail?.source) {
            mapByTitle[p.title.toLowerCase()] = p.thumbnail.source;
          }
        }

        for (const r of redirects) {
          const targetImg = mapByTitle[r.to.toLowerCase()];
          if (targetImg) {
            mapByTitle[r.from.toLowerCase()] = targetImg;
          }
        }

        if (!cancelled) {
          setWikiPhotos((prev) => ({ ...prev, ...mapByTitle }));
        }
      } catch {
        // Fallback images will be used automatically
      }
    }

    void loadThumbnails();
    return () => {
      cancelled = true;
    };
  }, [attractions]);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [22.5726, 88.3639],
      zoom: 9,
      zoomControl: true,
    });

    const tileLayer = L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
      maxZoom: 20,
      attribution: "&copy; Google Maps",
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);

    mapRef.current = map;
    tileLayerRef.current = tileLayer;
    layerGroupRef.current = layerGroup;

    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  // Switch between Google Road Map and Google Satellite Hybrid
  useEffect(() => {
    if (!tileLayerRef.current) return;
    const url =
      mapStyle === "roadmap"
        ? "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
        : "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}";
    tileLayerRef.current.setUrl(url);
  }, [mapStyle]);

  // Draw route, START / FINISH pins, and Photo Pins (without numbers)
  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    let routeCoords: [number, number][] = [];
    if (typeof encodedPolyline === "string" && encodedPolyline.length > 0) {
      routeCoords = decodePolyline(encodedPolyline);
    } else if (Array.isArray(encodedPolyline)) {
      routeCoords = encodedPolyline;
    }

    if (
      routeCoords.length === 0 &&
      typeof originLat === "number" &&
      Number.isFinite(originLat) &&
      typeof originLon === "number" &&
      Number.isFinite(originLon) &&
      typeof destinationLat === "number" &&
      Number.isFinite(destinationLat) &&
      typeof destinationLon === "number" &&
      Number.isFinite(destinationLon)
    ) {
      routeCoords = [
        [originLat, originLon],
        [destinationLat, destinationLon],
      ];
    }

    // 1. Draw the driving route line
    if (routeCoords.length > 1) {
      L.polyline(routeCoords, {
        color: "#ffffff",
        weight: 9,
        opacity: 0.85,
      }).addTo(group);

      L.polyline(routeCoords, {
        color: "#1f6f5c",
        weight: 5,
        opacity: 0.95,
      }).addTo(group);
    }

    const startCoord =
      routeCoords[0] ??
      (typeof originLat === "number" &&
      Number.isFinite(originLat) &&
      typeof originLon === "number" &&
      Number.isFinite(originLon)
        ? ([originLat, originLon] as [number, number])
        : null);

    const endCoord =
      routeCoords[routeCoords.length - 1] ??
      (typeof destinationLat === "number" &&
      Number.isFinite(destinationLat) &&
      typeof destinationLon === "number" &&
      Number.isFinite(destinationLon)
        ? ([destinationLat, destinationLon] as [number, number])
        : null);

    // 2. Draw START marker
    if (startCoord) {
      const startIcon = L.divIcon({
        className: "trip-start-pin",
        html: `
          <div style="display:flex;align-items:center;gap:6px;">
            <div style="width:32px;height:32px;border-radius:9999px;background:#1f6f5c;border:3px solid #fff;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;box-shadow:0 3px 8px rgba(0,0,0,0.3);">
              ↗
            </div>
            <span style="background:#fff;color:#174b40;border:1.5px solid #1f6f5c;border-radius:9999px;padding:2px 10px;font-size:11px;font-weight:800;letter-spacing:0.06em;box-shadow:0 2px 6px rgba(0,0,0,0.15);white-space:nowrap;">
              START
            </span>
          </div>
        `,
        iconSize: [96, 34],
        iconAnchor: [16, 16],
      });

      L.marker(startCoord, { icon: startIcon })
        .addTo(group)
        .bindPopup(`<strong>Starting Point</strong><br/>${origin}`);
    }

    // 3. Draw FINISH marker
    if (endCoord) {
      const finishIcon = L.divIcon({
        className: "trip-finish-pin",
        html: `
          <div style="display:flex;align-items:center;gap:6px;">
            <div style="width:32px;height:32px;border-radius:9999px;background:#e06324;border:3px solid #fff;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;box-shadow:0 3px 8px rgba(0,0,0,0.3);">
              ⚑
            </div>
            <span style="background:#fff;color:#c24d14;border:1.5px solid #e06324;border-radius:9999px;padding:2px 10px;font-size:11px;font-weight:800;letter-spacing:0.06em;box-shadow:0 2px 6px rgba(0,0,0,0.15);white-space:nowrap;">
              FINISH
            </span>
          </div>
        `,
        iconSize: [100, 34],
        iconAnchor: [16, 16],
      });

      L.marker(endCoord, { icon: finishIcon })
        .addTo(group)
        .bindPopup(`<strong>Destination</strong><br/>${destination}`);
    }

    // 4. Plot circular thumbnail photo pins (no numbers) for discovered tourist attractions
    const validAttractions = attractions.filter(
      (a): a is MapAttraction & { lat: number; lon: number } =>
        typeof a.lat === "number" &&
        Number.isFinite(a.lat) &&
        typeof a.lon === "number" &&
        Number.isFinite(a.lon) &&
        a.lat !== 0 &&
        a.lon !== 0
    );

    validAttractions.forEach((place) => {
      const placeName = place.name || "Tourist Place";
      const placeCategory = place.category || "Tourist Attraction";
      const fallbackUrl = getFallbackPhoto(placeCategory, placeName);

      const lookupKey = String(place.wikipedia || placeName).trim().toLowerCase();
      const photoUrl =
        (typeof place.imageUrl === "string" && place.imageUrl) ||
        wikiPhotos[lookupKey] ||
        wikiPhotos[placeName.toLowerCase()] ||
        fallbackUrl;

      const pinIcon = L.divIcon({
        className: "trip-photo-pin",
        html: `
          <div style="position:relative;width:44px;height:50px;display:flex;flex-direction:column;align-items:center;cursor:pointer;">
            <div style="
              width:42px;
              height:42px;
              border-radius:9999px;
              border:3px solid #ffffff;
              background:#e9f1e9;
              box-shadow:0 3px 10px rgba(0,0,0,0.38);
              overflow:hidden;
              display:flex;
              align-items:center;
              justify-content:center;
            ">
              <img
                src="${photoUrl}"
                alt="${placeName.replace(/"/g, "&quot;")}"
                onerror="this.onerror=null;this.src='${fallbackUrl}';"
                style="width:100%;height:100%;object-fit:cover;display:block;"
              />
            </div>
            <div style="
              width:0;
              height:0;
              border-left:6px solid transparent;
              border-right:6px solid transparent;
              border-top:8px solid #ffffff;
              margin-top:-1px;
              filter:drop-shadow(0 2px 2px rgba(0,0,0,0.25));
            "></div>
          </div>
        `,
        iconSize: [44, 50],
        iconAnchor: [22, 48],
        popupAnchor: [0, -44],
      });

      const mapsHref =
        place.osmUrl ||
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          placeName
        )}+${place.lat},${place.lon}`;

      const marker = L.marker([place.lat, place.lon], { icon: pinIcon }).addTo(group);

      marker.bindTooltip(placeName, {
        direction: "top",
        offset: [0, -46],
        opacity: 0.95,
      });

      marker.bindPopup(
        `<div style="font-family:sans-serif;width:190px;line-height:1.4;">
          <div style="width:100%;height:105px;border-radius:8px;overflow:hidden;margin-bottom:8px;background:#e9f1e9;">
            <img
              src="${photoUrl}"
              alt="${placeName.replace(/"/g, "&quot;")}"
              onerror="this.onerror=null;this.src='${fallbackUrl}';"
              style="width:100%;height:100%;object-fit:cover;display:block;"
            />
          </div>
          <strong style="font-size:13px;color:#183b35;display:block;">${placeName}</strong>
          <span style="font-size:11px;color:#64748b;display:block;margin:2px 0 6px;">${placeCategory}</span>
          <a href="${mapsHref}" target="_blank" rel="noopener noreferrer" style="font-size:12px;color:#0f766e;font-weight:700;text-decoration:underline;">
            Open in Google Maps ↗
          </a>
        </div>`
      );
    });

    // 5. Fit map bounds based on selected focus mode
    if (focusMode === "attractions" && validAttractions.length > 0) {
      const attractionCoords = validAttractions.map(
        (a) => [a.lat, a.lon] as [number, number]
      );
      if (endCoord) attractionCoords.push(endCoord);
      map.fitBounds(L.latLngBounds(attractionCoords), { padding: [45, 45], maxZoom: 13 });
    } else if (routeCoords.length > 1) {
      map.fitBounds(L.latLngBounds(routeCoords), { padding: [40, 40] });
    } else if (endCoord) {
      map.setView(endCoord, 11);
    }
  }, [
    encodedPolyline,
    origin,
    destination,
    attractions,
    originLat,
    originLon,
    destinationLat,
    destinationLon,
    focusMode,
    wikiPhotos,
  ]);

  const attractionCount = attractions.filter(
    (a) =>
      typeof a.lat === "number" &&
      Number.isFinite(a.lat) &&
      typeof a.lon === "number" &&
      Number.isFinite(a.lon)
  ).length;

  return (
    <div className="overflow-hidden rounded-2xl border border-[#dce7dc] bg-white">
      {/* Top Green Route Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#1d6352] px-5 py-4 text-white">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/75">
            YOUR ROUTE
          </p>
          <h4 className="mt-0.5 text-lg font-extrabold">
            Start strong · End somewhere memorable
          </h4>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {attractionCount > 0 && (
            <button
              type="button"
              onClick={() =>
                setFocusMode((prev) => (prev === "route" ? "attractions" : "route"))
              }
              className="rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-white/25"
            >
              {focusMode === "route"
                ? `🔍 Zoom to ${attractionCount} Tourist Places`
                : "🛣️ Show Full Route"}
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              setMapStyle((prev) => (prev === "roadmap" ? "hybrid" : "roadmap"))
            }
            className="rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-white/25"
          >
            {mapStyle === "roadmap" ? "🛰️ Satellite View" : "🗺️ Road Map"}
          </button>

          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
            • START
          </span>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
            ⚑ FINISH
          </span>
        </div>
      </div>

      {/* Interactive Google-Tiled Map */}
      <div ref={containerRef} className="h-[420px] w-full bg-[#e9f1e9]" />

      {/* Bottom Starting Point & Destination Cards */}
      <div className="grid gap-3 bg-[#f7f8f5] p-4 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-xl bg-white p-3.5 shadow-xs">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e9f1e9] text-sm font-bold text-[#174b40]">
            ↗
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#1f6f5c]">
              STARTING POINT
            </p>
            <p className="truncate text-sm font-bold text-[#183b35]">{origin}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-white p-3.5 shadow-xs">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fff1e8] text-sm font-bold text-[#e06324]">
            ⚑
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#c24d14]">
              DESTINATION
            </p>
            <p className="truncate text-sm font-bold text-[#183b35]">{destination}</p>
          </div>
        </div>
      </div>
    </div>
  );
}