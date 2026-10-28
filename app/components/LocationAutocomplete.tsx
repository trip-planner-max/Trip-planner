"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

export type PlaceSelection = {
  placeId: string;
  label: string;
  lat: number;
  lon: number;
};

type LocationAutocompleteProps = {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onSelect: (place: PlaceSelection) => void;
};

// Instant 0ms seed list for common searches (never restricts remote results)
const INSTANT_SEED_PLACES: Array<{ label: string; lat: number; lon: number }> = [
  { label: "Kharagpur, West Bengal, India", lat: 22.346, lon: 87.232 },
  { label: "Kolkata, West Bengal, India", lat: 22.5726, lon: 88.3639 },
  { label: "Visakhapatnam, Andhra Pradesh, India", lat: 17.6868, lon: 83.2185 },
  { label: "Goa, India", lat: 15.2993, lon: 74.124 },
  { label: "Manali, Himachal Pradesh, India", lat: 32.2432, lon: 77.1892 },
  { label: "Munnar, Kerala, India", lat: 10.0889, lon: 77.0595 },
  { label: "Hyderabad, Telangana, India", lat: 17.385, lon: 78.4867 },
  { label: "Bengaluru, Karnataka, India", lat: 12.9716, lon: 77.5946 },
  { label: "Chennai, Tamil Nadu, India", lat: 13.0827, lon: 80.2707 },
  { label: "Mumbai, Maharashtra, India", lat: 19.076, lon: 72.8777 },
  { label: "New Delhi, Delhi, India", lat: 28.6139, lon: 77.209 },
  { label: "Puri, Odisha, India", lat: 19.8135, lon: 85.8312 },
  { label: "Bhubaneswar, Odisha, India", lat: 20.2961, lon: 85.8245 },
  { label: "Darjeeling, West Bengal, India", lat: 27.041, lon: 88.2663 },
  { label: "Digha, West Bengal, India", lat: 21.6266, lon: 87.5074 },
  { label: "Araku Valley, Andhra Pradesh, India", lat: 18.3273, lon: 82.8775 },
  { label: "Tirupati, Andhra Pradesh, India", lat: 13.6288, lon: 79.4192 },
  { label: "Vijayawada, Andhra Pradesh, India", lat: 16.5062, lon: 80.648 },
];

const clientQueryCache = new Map<string, PlaceSelection[]>();

function getSeedMatches(query: string): PlaceSelection[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return INSTANT_SEED_PLACES.filter((item) => item.label.toLowerCase().includes(q))
    .slice(0, 3)
    .map((item) => ({
      placeId: `${item.lon},${item.lat}`,
      label: item.label,
      lat: item.lat,
      lon: item.lon,
    }));
}

function mergeUniquePlaces(existing: PlaceSelection[], incoming: PlaceSelection[], max = 12): PlaceSelection[] {
  const combined = [...existing];
  for (const item of incoming) {
    if (!Number.isFinite(item.lat) || !Number.isFinite(item.lon) || !item.label) continue;

    // Only skip if both the name AND coordinates (~1km) are virtually identical
    const isDuplicate = combined.some(
      (c) =>
        c.label.toLowerCase() === item.label.toLowerCase() ||
        (Math.abs(c.lat - item.lat) < 0.01 &&
          Math.abs(c.lon - item.lon) < 0.01 &&
          c.label.split(",")[0].trim().toLowerCase() === item.label.split(",")[0].trim().toLowerCase())
    );

    if (!isDuplicate) {
      combined.push(item);
    }
    if (combined.length >= max) break;
  }
  return combined;
}

/** Normalizes any API response shape into PlaceSelection[] */
export function normalizeResults(payload: any): PlaceSelection[] {
  if (!payload) return [];

  const rawList: any[] = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.results)
      ? payload.results
      : Array.isArray(payload.predictions)
        ? payload.predictions
        : Array.isArray(payload.features)
          ? payload.features
          : [];

  const normalized: PlaceSelection[] = [];

  for (const item of rawList) {
    let lat = Number(item.lat ?? item.latitude ?? item.geometry?.coordinates?.[1]);
    let lon = Number(item.lon ?? item.lng ?? item.longitude ?? item.geometry?.coordinates?.[0]);

    if ((!Number.isFinite(lat) || !Number.isFinite(lon)) && typeof item.placeId === "string") {
      const parts = item.placeId.split(",").map(Number);
      if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
        lon = parts[0];
        lat = parts[1];
      }
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    let label = String(item.label ?? item.description ?? item.display_name ?? "").trim();
    if (!label && item.properties) {
      const p = item.properties;
      label = [p.name, p.locality || p.district, p.city || p.town || p.county, p.state, p.country]
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(", ");
    } else if (!label && item.name) {
      label = [item.name, item.admin2, item.admin1, item.country]
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(", ");
    }

    if (!label) continue;

    normalized.push({
      placeId: `${lon},${lat}`,
      label,
      lat,
      lon,
    });
  }

  return mergeUniquePlaces([], normalized, 12);
}

// 1. Direct browser search: Open-Meteo (fast global cities, towns & villages)
async function searchOpenMeteoDirect(query: string, signal: AbortSignal): Promise<PlaceSelection[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    query
  )}&count=10&language=en&format=json`;
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const data = await res.json();
  const list: any[] = data.results || [];

  // Prioritize Indian locations first, but keep all global matches too
  list.sort((a, b) => (a.country_code === "IN" ? -1 : 1) - (b.country_code === "IN" ? -1 : 1));
  return normalizeResults(list);
}

// 2. Direct browser search: Photon OpenStreetMap (stations, streets, landmarks, towns, villages)
async function searchPhotonDirect(query: string, signal: AbortSignal): Promise<PlaceSelection[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(
    query
  )}&limit=10&lang=en&lat=20.5937&lon=78.9629`;
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const data = await res.json();
  return normalizeResults(data.features || []);
}

// 3. Direct browser search: Nominatim OpenStreetMap (deep coverage of Indian mandals, taluks, pincodes & localities)
async function searchNominatimDirect(query: string, signal: AbortSignal): Promise<PlaceSelection[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
    query
  )}&limit=8&accept-language=en`;
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const data = await res.json();
  return normalizeResults(data);
}

export default function LocationAutocomplete({
  label,
  value,
  placeholder = "Search any city, town, village, station...",
  onChange,
  onSelect,
}: LocationAutocompleteProps) {
  const inputId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<PlaceSelection[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 1) {
      setOptions([]);
      setLoading(false);
      return;
    }

    const cacheKey = query.toLowerCase();
    if (clientQueryCache.has(cacheKey)) {
      setOptions(clientQueryCache.get(cacheKey)!);
      setLoading(false);
      return;
    }

    // Show any seed matches immediately in 0ms while live search runs
    const initialSeeds = getSeedMatches(query);
    setOptions(initialSeeds);
    setActiveIndex(0);

    if (query.length < 2) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      let currentList = [...initialSeeds];

      const updateList = (incoming: PlaceSelection[]) => {
        if (controller.signal.aborted || incoming.length === 0) return;
        currentList = mergeUniquePlaces(currentList, incoming, 12);
        clientQueryCache.set(cacheKey, currentList);
        setOptions([...currentList]);
      };

      // Run all 3 global geocoders in parallel and stream results into the dropdown as each finishes
      await Promise.allSettled([
        searchOpenMeteoDirect(query, controller.signal).then(updateList),
        searchPhotonDirect(query, controller.signal).then(updateList),
        searchNominatimDirect(query, controller.signal).then(updateList),
      ]);

      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }, 100);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  function handleSelectOption(place: PlaceSelection) {
    onSelect(place);
    setOpen(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || options.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + options.length) % options.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const chosen = options[activeIndex] || options[0];
      if (chosen) handleSelectOption(chosen);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={inputId} className="block text-sm font-semibold">
        {label}
      </label>
      <div className="relative mt-2">
        <input
          id={inputId}
          type="text"
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => {
            if (value.trim().length > 0) setOpen(true);
          }}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onBlur={() => {
            window.setTimeout(() => {
              const q = value.trim().toLowerCase();
              if (!q || options.length === 0) return;
              const exact = options.find(
                (o) =>
                  o.label.toLowerCase() === q ||
                  o.label.split(",")[0].trim().toLowerCase() === q
              );
              if (exact && exact.label !== value) {
                onSelect(exact);
              }
            }, 150);
          }}
          onKeyDown={handleKeyDown}
          className="w-full rounded-xl border border-gray-200 bg-[#fcfcfa] px-4 py-3.5 text-sm font-normal focus:border-[#174b40]"
        />
        {loading && (
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">
            Searching...
          </span>
        )}
      </div>

      {open && options.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1.5 max-h-72 w-full overflow-y-auto rounded-2xl border border-gray-200 bg-white py-1.5 shadow-xl"
        >
          {options.map((place, idx) => (
            <li
              key={`${place.placeId}-${place.label}-${idx}`}
              role="option"
              aria-selected={idx === activeIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelectOption(place);
              }}
              onMouseEnter={() => setActiveIndex(idx)}
              className={`flex cursor-pointer items-center gap-2.5 px-4 py-2.5 text-sm transition ${
                idx === activeIndex
                  ? "bg-[#e9f1e9] font-semibold text-[#174b40]"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span className="text-xs text-[#397c65]">📍</span>
              <span className="truncate">{place.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}