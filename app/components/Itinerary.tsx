"use client";

import { useEffect, useMemo, useState } from "react";

type Admission = { status: "free-tagged" | "fee-may-apply" | "unknown"; note: string; amountINR?: number };
export type TouristPlace = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  category: string;
  admission: Admission;
  osmUrl: string;
  openingHours?: string;
  website?: string;
  wikipedia?: string;
  legDistanceKm?: number;
  legDurationMinutes?: number;
};

type Props = {
  destination: string;
  durationDays: number;
  startDate: string;
  selectedPlaces?: string[];
  otherPlace?: string;
  overnightStay?: boolean;
  totalBudget?: number;
  travellers?: number;
  destinationLat?: number;
  destinationLon?: number;
  onAttractionsLoaded?: (places: TouristPlace[]) => void;
};

const NO_INTERESTS: string[] = [];

function formatDate(startDate: string, offset: number) {
  if (!startDate) return "";
  const date = new Date(`${startDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + offset);
  return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function matchesInterest(place: TouristPlace, interests: string[]) {
  if (!interests.length || interests.includes("All places")) return true;
  const category = `${place.category} ${place.name}`.toLowerCase();
  return interests.some((interest) => {
    switch (interest) {
      case "Nature and viewpoints": return /nature|viewpoint|waterfall|park|garden|peak|cave|lake|scenic/i.test(category);
      case "Beaches and lakes": return /beach|lake|waterfall|dam|water/i.test(category);
      case "Historic places": return /historic|heritage|fort|palace|museum|monument|ruin|church/i.test(category);
      case "Temples and culture": return /worship|temple|mosque|church|monastery|cultural|museum|heritage/i.test(category);
      case "Markets and shopping": return /market|shopping|mall|bazaar/i.test(category);
      case "Museums and landmarks": return /museum|monument|memorial|gallery|landmark|attraction|tower|heritage/i.test(category);
      case "Food spots": return /restaurant|cafe|food|market|bazaar|street/i.test(category);
      case "Adventure activities": return /adventure|trek|hiking|camp|sport|rafting|zip|peak|cave|waterfall/i.test(category);
      case "Parks and gardens": return /park|garden|zoo|botanical|nature_reserve/i.test(category);
      case "Other": return false;
      default: return true;
    }
  });
}

type DayPart = "morning" | "midday" | "evening";

/** A practical preference, not a claim about official opening times. */
function bestDayPart(place: TouristPlace): DayPart {
  const text = `${place.category} ${place.name}`.toLowerCase();
  if (/sunrise|tiger hill|sunrise point|dawn/.test(text)) return "morning";
  if (/museum|gallery|palace|market|bazaar|shopping|mall|science|planetarium|aquarium|indoor/.test(text)) return "midday";
  if (/sunset|beach|waterfront|riverfront|riverside|ghat|promenade|marina/.test(text)) return "evening";
  if (/viewpoint|lake|dam|bridge/.test(text)) return "evening";
  return "morning";
}

const DAY_PART_HINT: Record<DayPart, string> = {
  morning: "Suggested for the cooler morning hours. Confirm local conditions before travelling.",
  midday: "Scheduled for the middle of the day because it is generally an indoor or shaded attraction.",
  evening: "Suggested for late afternoon or sunset light. Check the local sunset time for your travel date.",
};

function clockLabel(totalMinutes: number) {
  const safe = Math.max(6 * 60, Math.min(22 * 60, totalMinutes));
  const hour = Math.floor(safe / 60);
  const minute = safe % 60;
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

function minutesFromHHMM(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]); const minute = Number(match[2]);
  if (hour > 24 || minute > 59) return null;
  return hour * 60 + minute;
}

/**
 * Understands common OSM opening_hours forms only. Complex seasonal/holiday rules are
 * shown to the user for verification rather than guessed.
 */
function simpleOpeningWindow(raw?: string, dateText?: string): { open: number; close: number } | null {
  if (!raw) return null;
  const value = raw.trim();
  if (/^24\/7$/.test(value)) return { open: 0, close: 24 * 60 };
  const day = dateText ? new Date(`${dateText}T12:00:00`).getDay() : new Date().getDay();
  const dayCode = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][day];
  const rules = value.split(";").map((x) => x.trim()).filter(Boolean);
  for (const rule of rules) {
    const dayMatch = rule.match(/^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?\s+(.+)$/);
    let timePart = rule;
    if (dayMatch) {
      const days = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
      const from = days.indexOf(dayMatch[1]); const to = days.indexOf(dayMatch[2] || dayMatch[1]); const today = days.indexOf(dayCode);
      const applies = from <= to ? today >= from && today <= to : today >= from || today <= to;
      if (!applies) continue;
      timePart = dayMatch[3];
    } else if (/^(Mo|Tu|We|Th|Fr|Sa|Su)/.test(rule)) {
      continue; // complex or unsupported weekday syntax
    }
    if (/^(off|closed)$/i.test(timePart)) return null;
    const match = timePart.match(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/);
    if (match) {
      const open = minutesFromHHMM(match[1]); const close = minutesFromHHMM(match[2]);
      if (open !== null && close !== null && close > open) return { open, close };
    }
  }
  return null;
}

function visitDurationMinutes(place: TouristPlace) {
  const text = `${place.category} ${place.name}`.toLowerCase();
  if (/museum|palace|zoo|aquarium|theme park|large garden/.test(text)) return 100;
  if (/beach|lake|waterfall|sanctuary|nature reserve|park|garden/.test(text)) return 90;
  if (/viewpoint|peak|bridge|monument|memorial|temple|church|mosque|ghat/.test(text)) return 50;
  if (/market|bazaar|shopping/.test(text)) return 75;
  return 70;
}

function googleMapsSearch(name: string, destination: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${destination}`)}`;
}

export default function Itinerary({
  destination,
  durationDays,
  startDate,
  selectedPlaces = NO_INTERESTS,
  otherPlace = "",
  overnightStay = true,
  totalBudget = 0,
  travellers = 1,
  destinationLat,
  destinationLon,
  onAttractionsLoaded,
}: Props) {
  const days = Math.max(1, Math.min(14, Math.floor(durationDays) || 1));
  const [activeDay, setActiveDay] = useState(1);
  const [places, setPlaces] = useState<TouristPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [routeOrderAvailable, setRouteOrderAvailable] = useState(false);
  const [dataSource, setDataSource] = useState("OpenStreetMap");
  const interestsKey = selectedPlaces.join(",");

  useEffect(() => {
    if (!destination.trim()) return;
    const controller = new AbortController();
    async function loadAttractions() {
      setLoading(true);
      setError("");
      setPlaces([]);
      setRouteOrderAvailable(false);
      const params = new URLSearchParams({ destination: destination.trim() });
      if (typeof destinationLat === "number" && Number.isFinite(destinationLat)) params.set("lat", String(destinationLat));
      if (typeof destinationLon === "number" && Number.isFinite(destinationLon)) params.set("lon", String(destinationLon));
      if (interestsKey) params.set("interests", interestsKey);
      params.set("budgetPerPersonPerDay", String(totalBudget > 0 ? totalBudget / Math.max(1, travellers) / days : 0));
      try {
        const response = await fetch(`/api/attractions?${params.toString()}`, { signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) throw new Error([payload.error || "Tourist places are temporarily unavailable.", payload.detail ? `Reason: ${payload.detail}` : ""].filter(Boolean).join(" "));
        const next = Array.isArray(payload.results) ? payload.results as TouristPlace[] : [];
        setPlaces(next);
        setRouteOrderAvailable(Boolean(payload.routeOrderAvailable));
        setDataSource(typeof payload.source === "string" ? payload.source : "OpenStreetMap");
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Could not load real tourist places.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadAttractions();
    return () => controller.abort();
  }, [destination, destinationLat, destinationLon, interestsKey, totalBudget, travellers, days]);

  const filteredPlaces = useMemo(() => {
    const matching = places.filter((place) => matchesInterest(place, selectedPlaces));
    return matching.length ? matching : places;
  }, [places, selectedPlaces]);

  const budgetPerPersonPerDay = totalBudget > 0 ? totalBudget / Math.max(1, travellers) / days : 0;
  const scheduledPlaces = useMemo(
  () => filteredPlaces.slice(0, Math.min(12, Math.max(4, days * 3))),
  [filteredPlaces, days]
);

  useEffect(() => {
    onAttractionsLoaded?.(scheduledPlaces);
  }, [scheduledPlaces, onAttractionsLoaded]);

  useEffect(() => {
    setActiveDay((current) => Math.min(current, days));
  }, [days]);
  const placesPerDay = Math.max(1, Math.ceil(scheduledPlaces.length / days));
  const todaysPlaces = scheduledPlaces.slice((activeDay - 1) * placesPerDay, activeDay * placesPerDay);
  const customPlaces = otherPlace.split(/[\n,;]/).map((item) => item.trim()).filter(Boolean);
  const dailyGroupBudget = totalBudget > 0 ? totalBudget / days : 0;
  const freeTaggedCount = scheduledPlaces.filter((place) => place.admission?.status === "free-tagged").length;

  const timeline = useMemo(() => {
    const items: { time: string; title: string; detail: string; type: string; href?: string }[] = [
      { time: "8:00 AM", title: `Breakfast around ${destination}`, detail: "Choose a nearby eatery after checking its current hours and reviews.", type: "FOOD" },
    ];
    // Keep the exact order returned by the API. /api/attractions attaches each leg's
    // OSRM duration to the corresponding next stop; re-sorting by attraction type would
    // make those leg times describe the wrong journey.
    const dayPlaces = todaysPlaces.map((place) => ({ place, part: bestDayPart(place) }));

    let cursor = 8 * 60 + 45;
    let lunchAdded = false;
    for (const [placeIndex, { place, part }] of dayPlaces.entries()) {
      // The first stop also has a real centre-to-stop OSRM leg when routing is available.
      // If a leg is missing, say so in the detail below rather than inventing a duration.
      if (!lunchAdded && cursor >= 12 * 60) {
        items.push({ time: clockLabel(cursor), title: "Lunch break", detail: "Pause for lunch. Choose a nearby place and verify its current hours, menu prices and reviews.", type: "FOOD" });
        cursor += 45;
        lunchAdded = true;
      }
      const travelMinutes = Math.max(0, Number(place.legDurationMinutes) || 0);
      let start = cursor + travelMinutes;
      const duration = visitDurationMinutes(place);
      const window = simpleOpeningWindow(place.openingHours, startDate ? (() => {
        const d = new Date(`${startDate}T12:00:00`); d.setDate(d.getDate() + activeDay - 1); return d.toISOString().slice(0, 10);
      })() : undefined);
      let hoursNote = "";
      if (place.openingHours && window) {
        if (start < window.open) start = window.open;
        if (start + duration > window.close) {
          if (window.open + duration <= window.close) start = window.open;
          else hoursNote = ` The mapped hours (${place.openingHours}) may not allow enough time for this visit; verify before going.`;
        }
        hoursNote = ` Mapped opening hours: ${place.openingHours}.` + hoursNote;
      } else if (place.openingHours) {
        hoursNote = ` Listed hours: ${place.openingHours}. This format could not be safely checked for the selected date, so verify with the official source.`;
      } else {
        hoursNote = " Opening hours were not available in the mapped data; check the official source before travelling.";
      }
      const leg = travelMinutes > 0
        ? ` Allow about ${travelMinutes} min by road ${activeDay === 1 && placeIndex === 0 ? "from the destination centre to the first stop" : "from the previous suggested point in the route sequence"}${place.legDistanceKm ? ` (${place.legDistanceKm} km)` : ""}.`
        : placeIndex > 0 ? " Add extra transfer time; a road duration was not returned for this leg." : " Allow time to reach the first stop; a road duration was not returned.";
      items.push({
        time: clockLabel(start), title: place.name,
        detail: `${place.category}. ${DAY_PART_HINT[part]} Planned visit: about ${duration} minutes.${leg}${hoursNote} ${place.admission?.note || "Check entry fees before travelling."}`,
        type: "VISIT", href: place.osmUrl,
      });
      cursor = start + duration;
    }

    if (dayPlaces.length && !lunchAdded) {
      items.push({ time: clockLabel(Math.max(cursor, 12 * 60 + 30)), title: "Lunch break", detail: "Pause for lunch. Choose a nearby place and verify its current hours, menu prices and reviews.", type: "FOOD" });
      lunchAdded = true;
    }
    if (dayPlaces.length && cursor < 15 * 60) {
      items.push({ time: "3:00 PM", title: "Rest or flexible time", detail: "Use this buffer for queues, weather, unexpected delays or an optional nearby stop.", type: "BREAK" });
    }
    const staysTonight = activeDay < days || (days === 1 && overnightStay);
    const eveningTime = Math.max(staysTonight ? 19 * 60 : 18 * 60, cursor);
    items.push(staysTonight
      ? { time: clockLabel(eveningTime), title: `Dinner in ${destination}`, detail: "Choose a nearby restaurant after checking current hours and reviews. Keep return transport in mind.", type: "EVENING" }
      : { time: clockLabel(eveningTime), title: "Start your return journey", detail: "Confirm your actual departure time and keep a buffer for reaching the station, bus stop or pickup point.", type: "RETURN" });
    const parse = (value: string) => { const [clock, period] = value.split(" "); const [h, m] = clock.split(":").map(Number); let hour = h % 12; if (period === "PM") hour += 12; return hour * 60 + m; };
    return items.sort((a, b) => parse(a.time) - parse(b.time));
  }, [destination, todaysPlaces, overnightStay, activeDay, days, startDate]);

  return (
    <section className="mt-8 rounded-3xl border border-[#e3e9df] bg-white p-5 shadow-sm sm:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c9824b]">LIVE PLACE DISCOVERY</p>
          <h2 className="mt-2 text-2xl font-extrabold text-[#174b40] sm:text-3xl">Real places to visit in {destination}</h2>
          <p className="mt-2 text-sm text-gray-600">Real mapped places are scheduled using daylight preferences, estimated visit durations, available road times and any simple opening-hours data found. Missing or complex hours are clearly flagged for verification.</p>
        </div>
        <span className="w-fit rounded-full bg-[#eaf2e8] px-4 py-2 text-sm font-semibold text-[#174b40]">{days} {days === 1 ? "day" : "days"}</span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-[#f5f7f2] p-4"><p className="text-xs text-gray-500">Places found</p><p className="mt-1 text-2xl font-black text-[#174b40]">{loading ? "…" : places.length}</p></div>
        <div className="rounded-2xl bg-[#f5f7f2] p-4"><p className="text-xs text-gray-500">Tagged as free</p><p className="mt-1 text-2xl font-black text-[#174b40]">{loading ? "…" : freeTaggedCount}</p></div>
        <div className="rounded-2xl bg-[#f5f7f2] p-4"><p className="text-xs text-gray-500">Daily group budget</p><p className="mt-1 text-2xl font-black text-[#174b40]">{dailyGroupBudget ? `₹${Math.round(dailyGroupBudget).toLocaleString("en-IN")}` : "Not set"}</p><p className="mt-1 text-xs text-gray-500">{budgetPerPersonPerDay > 0 && budgetPerPersonPerDay <= 900 ? "Low daily allowance: choose tagged-free places first where practical" : "Verify entry fees before confirming paid attractions"}</p></div>
      </div>

      {selectedPlaces.length > 0 && <p className="mt-4 rounded-xl bg-[#f7f8f4] p-3 text-sm text-gray-700">Your interests: {selectedPlaces.filter((item) => item !== "Other").join(", ") || "All mapped places"}{customPlaces.length ? ` · Custom requests: ${customPlaces.join(", ")}` : ""}</p>}
      <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
        {Array.from({ length: days }, (_, index) => {
          const day = index + 1; const selected = activeDay === day;
          return <button key={day} type="button" onClick={() => setActiveDay(day)} aria-pressed={selected} className={`min-w-24 rounded-xl border px-4 py-3 text-left transition ${selected ? "border-[#174b40] bg-[#174b40] text-white" : "border-gray-200 bg-white text-[#174b40] hover:bg-[#f2f6f0]"}`}><span className="block text-xs opacity-80">DAY</span><span className="mt-1 block font-bold">{day}</span>{formatDate(startDate, day - 1) && <span className="mt-1 block text-xs opacity-80">{formatDate(startDate, day - 1)}</span>}</button>;
        })}
      </div>

      {loading && <p role="status" className="mt-5 rounded-xl bg-[#f7f8f4] p-4 text-sm text-gray-600">Searching for named tourist places and checking available road routes…</p>}
      {error && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Tourist-place search unavailable.</strong> {error}<p className="mt-2">No generic attractions have been inserted. Try again or choose a more specific city/town.</p></div>}
      {!loading && !error && places.length === 0 && <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">No named tourist places were returned for this area. Try specifying a nearby city, district, or landmark. The app will not invent attractions.</p>}

      {!loading && todaysPlaces.length > 0 && <>
        <p className="mt-4 text-xs text-gray-500">{routeOrderAvailable ? "Stop order uses available OSRM road durations as a nearest-next heuristic; this is not a proof of a globally optimal route." : "Road route order is unavailable right now; listed places are approximate suggestions, not a route-optimised sequence."}</p>
        <div className="mt-3 space-y-3">
          {timeline.map((activity) => <div key={`${activeDay}-${activity.time}-${activity.title}`} className="grid grid-cols-[76px_minmax(0,1fr)] gap-3 sm:grid-cols-[92px_minmax(0,1fr)] sm:gap-4">
            <div className="pt-4 text-right text-xs font-bold text-[#174b40] sm:text-sm">{activity.time}</div>
            <div className={`min-w-0 rounded-2xl p-4 ${activity.type === "VISIT" ? "border border-[#dbe7d7] bg-[#f4f8f1]" : "bg-[#f8f8f5]"}`}>
              <span className="text-[10px] font-bold tracking-[0.15em] text-[#c9824b]">{activity.type}</span>
              <h3 className="mt-1 font-bold text-[#174b40]">{activity.title}</h3>
              <p className="mt-1 text-sm leading-6 text-gray-600">{activity.detail}</p>
              {activity.href && <a className="mt-2 inline-block text-sm font-semibold text-[#176b58] underline underline-offset-2" href={activity.href} target="_blank" rel="noreferrer">Open place details ↗</a>}
            </div>
          </div>)}
        </div>
      </>}

      {!loading && !error && places.length > 0 && todaysPlaces.length === 0 && <p className="mt-5 rounded-xl bg-[#f7f8f4] p-4 text-sm text-gray-600">All {scheduledPlaces.length} mapped places are already scheduled on earlier days. Use this day for rest, local food or one of the places listed below.</p>}

      {customPlaces.length > 0 && <div className="mt-5 rounded-2xl border border-dashed border-[#cfdcce] p-4"><h3 className="font-bold text-[#174b40]">Your custom place requests</h3><p className="mt-1 text-sm text-gray-600">These were entered manually, so their exact coordinates and travel time must be verified before they can be inserted into the road sequence.</p><div className="mt-3 flex flex-wrap gap-2">{customPlaces.map((place) => <a key={place} href={googleMapsSearch(place, destination)} target="_blank" rel="noreferrer" className="rounded-full border border-[#cfdcce] bg-white px-3 py-2 text-sm font-semibold text-[#174b40] hover:bg-[#f2f6f0]">{place} ↗</a>)}</div></div>}

      {!loading && places.length > 0 && <div className="mt-5">
        <h3 className="font-bold text-[#174b40]">More real places found</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {filteredPlaces.slice(0, 10).map((place) => <article key={place.id} className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 p-3">
            <div className="min-w-0"><h4 className="font-semibold text-[#174b40]">{place.name}</h4><p className="text-xs text-gray-500">{place.category}</p><p className="mt-1 text-xs text-gray-600">{place.admission?.status === "free-tagged" ? "Tagged free (verify locally)" : place.admission?.status === "fee-may-apply" ? "Fee may apply" : "Entry fee not listed"}</p></div>
            <a href={place.osmUrl} target="_blank" rel="noreferrer" aria-label={`Open details for ${place.name}`} className="shrink-0 text-sm font-semibold text-[#176b58] underline">Map ↗</a>
          </article>)}
        </div>
      </div>}
      <p className="mt-5 text-xs leading-5 text-gray-500">Data: {dataSource === "Wikipedia" ? <a href="https://en.wikipedia.org/wiki/Wikipedia:Text_of_the_Creative_Commons_Attribution-ShareAlike_4.0_International_License" target="_blank" rel="noreferrer" className="underline">Wikipedia (CC BY-SA)</a> : <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">© OpenStreetMap contributors</a>}. Map coverage and opening-hours data can be incomplete or outdated. Time-of-day suitability is a planning heuristic, not a guarantee; verify official hours, seasonal closures, weather and sunset time before travelling.</p>
    </section>
  );
}
