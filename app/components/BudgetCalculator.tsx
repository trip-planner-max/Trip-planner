"use client";

import { useEffect, useMemo, useState } from "react";
import type { TouristPlace } from "./Itinerary";

export type BudgetCalculatorProps = {
  travellers: number;
  durationDays: number;
  budget: number;
  accommodation: string;
  overnightStay: boolean;
  destination: string;
  origin: string;
  transportPreference: string;
  routeDistanceKm?: number | null;
  attractions?: TouristPlace[];
  checkInDate?: string;
  destinationLat?: number | null;
  destinationLon?: number | null;
};

type IntercityMode = "train_3ac" | "train_sleeper" | "bus_ac" | "car_drive" | "bike_ride";

function defaultStayRate(accommodation: string): { rate: number; perPersonBed: boolean } {
  const norm = accommodation.toLowerCase();
  if (norm.includes("hostel")) return { rate: 650, perPersonBed: true };
  if (norm.includes("budget")) return { rate: 1300, perPersonBed: false };
  if (norm.includes("homestay")) return { rate: 1800, perPersonBed: false };
  if (norm.includes("luxury")) return { rate: 5500, perPersonBed: false };
  return { rate: 2400, perPersonBed: false }; // Comfortable hotel
}

function defaultIntercityMode(pref: string): IntercityMode {
  const norm = pref.toLowerCase();
  if (norm.includes("train")) return "train_3ac";
  if (norm.includes("bus")) return "bus_ac";
  if (norm.includes("driving")) return "car_drive";
  if (norm.includes("cycling") || norm.includes("walking")) return "bike_ride";
  return "train_3ac";
}

function estimateIntercityRoundTrip(
  mode: IntercityMode,
  oneWayKm: number,
  travellers: number
): { total: number; formula: string } {
  const dist = Math.max(40, Math.round(oneWayKm));
  const roundTripKm = dist * 2;

  switch (mode) {
    case "train_sleeper": {
      const oneWayPerPerson = Math.max(160, Math.round(110 + dist * 0.65));
      const roundTripPerPerson = oneWayPerPerson * 2;
      return {
        total: roundTripPerPerson * travellers,
        formula: `Sleeper Class (~${roundTripKm} km round-trip): ₹${roundTripPerPerson.toLocaleString("en-IN")}/person × ${travellers}`,
      };
    }
    case "train_3ac": {
      const oneWayPerPerson = Math.max(420, Math.round(260 + dist * 1.65));
      const roundTripPerPerson = oneWayPerPerson * 2;
      return {
        total: roundTripPerPerson * travellers,
        formula: `3AC Train (~${roundTripKm} km round-trip): ₹${roundTripPerPerson.toLocaleString("en-IN")}/person × ${travellers}`,
      };
    }
    case "bus_ac": {
      const oneWayPerPerson = Math.max(300, Math.round(180 + dist * 1.85));
      const roundTripPerPerson = oneWayPerPerson * 2;
      return {
        total: roundTripPerPerson * travellers,
        formula: `AC Volvo / Seater Bus (~${roundTripKm} km round-trip): ₹${roundTripPerPerson.toLocaleString("en-IN")}/person × ${travellers}`,
      };
    }
    case "car_drive": {
      const carsNeeded = Math.max(1, Math.ceil(travellers / 4));
      const fuelAndTollPerKm = 9.5; // ~14 km/L petrol + highway fastag tolls
      const perCarCost = Math.round(roundTripKm * fuelAndTollPerKm);
      return {
        total: perCarCost * carsNeeded,
        formula: `${carsNeeded} car(s) × ${roundTripKm} km round-trip × ₹9.5/km (fuel + highway tolls)`,
      };
    }
    case "bike_ride": {
      const bikesNeeded = Math.max(1, Math.ceil(travellers / 2));
      const fuelPerKm = 2.8; // ~40 km/L two-wheeler fuel + maintenance
      const perBikeCost = Math.round(roundTripKm * fuelPerKm);
      return {
        total: perBikeCost * bikesNeeded,
        formula: `${bikesNeeded} bike(s) × ${roundTripKm} km round-trip × ₹2.8/km fuel`,
      };
    }
  }
}

function estimateAttractionTicketsPerPerson(attractions: TouristPlace[], durationDays: number): {
  perPerson: number;
  paidCount: number;
  freeCount: number;
} {
  const maxStops = Math.min(attractions.length, Math.max(4, durationDays * 3));
  const plannedStops = attractions.slice(0, maxStops);

  if (plannedStops.length === 0) {
    return { perPerson: durationDays * 120, paidCount: durationDays * 2, freeCount: durationDays };
  }

  let totalPerPerson = 0;
  let paidCount = 0;
  let freeCount = 0;

  for (const place of plannedStops) {
    const text = `${place.name || ""} ${place.category || ""}`.toLowerCase();
    if (typeof place.admission?.amountINR === "number" && place.admission.amountINR > 0) {
      totalPerPerson += place.admission.amountINR;
      paidCount++;
    } else if (/\b(science city|aquatica|nicco park|wonderla|water park|theme park)\b/.test(text)) {
      totalPerPerson += 250;
      paidCount++;
    } else if (/\b(museum|planetarium|zoo|zoological|botanical|palace|thakur bari)\b/.test(text)) {
      totalPerPerson += 80;
      paidCount++;
    } else if (/\b(memorial|monument|fort|castle|eco park|garden|park)\b/.test(text)) {
      totalPerPerson += 40;
      paidCount++;
    } else {
      // Temples, ghats, bridges, malls generally have free entry
      freeCount++;
    }
  }

  return {
    perPerson: Math.max(100, totalPerPerson),
    paidCount,
    freeCount,
  };
}

function formatINR(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

export default function BudgetCalculator({
  travellers,
  durationDays,
  budget,
  accommodation,
  overnightStay,
  destination,
  origin,
  transportPreference,
  routeDistanceKm,
  attractions = [],
}: BudgetCalculatorProps) {
  const safeTravellers = Math.max(1, travellers);
  const safeDays = Math.max(1, durationDays);
  const nights = overnightStay ? Math.max(1, safeDays - 1) : 0;
  const effectiveDistanceKm = routeDistanceKm && routeDistanceKm > 0 ? routeDistanceKm : 135;

  const stayDefaults = useMemo(() => defaultStayRate(accommodation), [accommodation]);
  const ticketDefaults = useMemo(
    () => estimateAttractionTicketsPerPerson(attractions, safeDays),
    [attractions, safeDays]
  );

  // Editable parameters
  const [intercityMode, setIntercityMode] = useState<IntercityMode>(() =>
    defaultIntercityMode(transportPreference)
  );
  const [customIntercityTotal, setCustomIntercityTotal] = useState<string>("");
  const [roomRatePerNight, setRoomRatePerNight] = useState<number>(stayDefaults.rate);
  const [foodPerPersonDay, setFoodPerPersonDay] = useState<number>(650);
  const [localTransportPerDay, setLocalTransportPerDay] = useState<number>(
    safeTravellers <= 2 ? 550 : 950
  );
  const [ticketsPerPerson, setTicketsPerPerson] = useState<number>(ticketDefaults.perPerson);
  const [bufferPercent, setBufferPercent] = useState<number>(8);
  const [activePreset, setActivePreset] = useState<string>("balanced");

  // Sync defaults when user changes accommodation, transport preference, or attractions
  useEffect(() => {
    setRoomRatePerNight(stayDefaults.rate);
  }, [stayDefaults.rate]);

  useEffect(() => {
    setIntercityMode(defaultIntercityMode(transportPreference));
  }, [transportPreference]);

  useEffect(() => {
    setTicketsPerPerson(ticketDefaults.perPerson);
  }, [ticketDefaults.perPerson]);

  // Core Calculations
  const roomsOrBeds = stayDefaults.perPersonBed
    ? safeTravellers
    : Math.max(1, Math.ceil(safeTravellers / 2));

  const autoIntercity = useMemo(
    () => estimateIntercityRoundTrip(intercityMode, effectiveDistanceKm, safeTravellers),
    [intercityMode, effectiveDistanceKm, safeTravellers]
  );

  const intercityCost =
    customIntercityTotal.trim() !== "" && Number.isFinite(Number(customIntercityTotal))
      ? Math.max(0, Number(customIntercityTotal))
      : autoIntercity.total;

  const stayCost = nights * roomsOrBeds * roomRatePerNight;
  const foodCost = safeTravellers * safeDays * foodPerPersonDay;
  const localTransportCost = safeDays * localTransportPerDay;
  const ticketsCost = safeTravellers * ticketsPerPerson;

  const baseSubtotal = intercityCost + stayCost + foodCost + localTransportCost + ticketsCost;
  const contingencyCost = Math.round((baseSubtotal * bufferPercent) / 100);
  const grandTotal = baseSubtotal + contingencyCost;

  const perPersonTotal = Math.round(grandTotal / safeTravellers);
  const perPersonPerDay = Math.round(perPersonTotal / safeDays);
  const budgetDiff = budget - grandTotal;
  const isWithinBudget = budgetDiff >= 0;
  const utilizationPct = Math.min(100, Math.round((grandTotal / Math.max(1, budget)) * 100));

  // Preset handlers
  function applyPreset(preset: "backpacker" | "balanced" | "premium" | "autofit") {
    setActivePreset(preset);
    if (preset === "backpacker") {
      setIntercityMode(effectiveDistanceKm > 250 ? "train_sleeper" : "bus_ac");
      setCustomIntercityTotal("");
      setRoomRatePerNight(stayDefaults.perPersonBed ? 500 : 1100);
      setFoodPerPersonDay(400);
      setLocalTransportPerDay(350);
      setBufferPercent(5);
      return;
    }
    if (preset === "balanced") {
      setIntercityMode(defaultIntercityMode(transportPreference));
      setCustomIntercityTotal("");
      setRoomRatePerNight(stayDefaults.rate);
      setFoodPerPersonDay(650);
      setLocalTransportPerDay(safeTravellers <= 2 ? 550 : 900);
      setBufferPercent(8);
      return;
    }
    if (preset === "premium") {
      setIntercityMode("car_drive");
      setCustomIntercityTotal("");
      setRoomRatePerNight(4800);
      setFoodPerPersonDay(1300);
      setLocalTransportPerDay(1600);
      setBufferPercent(10);
      return;
    }
    if (preset === "autofit") {
      // Automatically scale adjustable expenses so Grand Total fits inside the user's target budget
      const targetBeforeBuffer = budget / (1 + bufferPercent / 100);
      const fixedIntercity =
        targetBeforeBuffer < autoIntercity.total * 1.8
          ? estimateIntercityRoundTrip("train_sleeper", effectiveDistanceKm, safeTravellers).total
          : autoIntercity.total;

      if (targetBeforeBuffer < autoIntercity.total * 1.8) {
        setIntercityMode("train_sleeper");
        setCustomIntercityTotal("");
      }

      const remaining = Math.max(1500, targetBeforeBuffer - fixedIntercity - ticketsCost);
      const stayShare = nights > 0 ? remaining * 0.45 : 0;
      const foodShare = remaining * (nights > 0 ? 0.38 : 0.65);
      const localShare = remaining * (nights > 0 ? 0.17 : 0.35);

      if (nights > 0) {
        setRoomRatePerNight(
          Math.max(500, Math.round(stayShare / (nights * roomsOrBeds) / 50) * 50)
        );
      }
      setFoodPerPersonDay(
        Math.max(250, Math.round(foodShare / (safeTravellers * safeDays) / 25) * 25)
      );
      setLocalTransportPerDay(Math.max(200, Math.round(localShare / safeDays / 50) * 50));
    }
  }

  const breakdownItems = [
    {
      key: "stay",
      label: "Accommodation & Stay",
      icon: "🏨",
      color: "#174b40",
      bgBadge: "bg-[#e9f1e9] text-[#174b40]",
      amount: stayCost,
      formula:
        nights > 0
          ? `${roomsOrBeds} ${stayDefaults.perPersonBed ? "bed(s)" : "room(s)"} × ${nights} night(s) × ${formatINR(roomRatePerNight)}/night (${accommodation})`
          : "Same-day trip (0 overnight stays)",
    },
    {
      key: "intercity",
      label: "Intercity Round-Trip Travel",
      icon: "🚆",
      color: "#2b7a66",
      bgBadge: "bg-teal-50 text-teal-800",
      amount: intercityCost,
      formula:
        customIntercityTotal.trim() !== ""
          ? `Custom verified group round-trip fare (${origin.split(",")[0]} ↔ ${destination.split(",")[0]})`
          : autoIntercity.formula,
    },
    {
      key: "food",
      label: "Food, Cafes & Dining",
      icon: "🍛",
      color: "#d68b55",
      bgBadge: "bg-orange-50 text-orange-800",
      amount: foodCost,
      formula: `${safeTravellers} traveller(s) × ${safeDays} day(s) × ${formatINR(foodPerPersonDay)}/person/day (breakfast, lunch, dinner & snacks)`,
    },
    {
      key: "local",
      label: "Local City Sightseeing Commute",
      icon: "🚕",
      color: "#eab308",
      bgBadge: "bg-amber-50 text-amber-800",
      amount: localTransportCost,
      formula: `${safeDays} day(s) × ${formatINR(localTransportPerDay)}/day for local metro, auto, cab or rental scooter`,
    },
    {
      key: "tickets",
      label: "Monument, Museum & Park Tickets",
      icon: "🎟️",
      color: "#6366f1",
      bgBadge: "bg-indigo-50 text-indigo-800",
      amount: ticketsCost,
      formula: `${safeTravellers} traveller(s) × ${formatINR(ticketsPerPerson)}/person (${ticketDefaults.paidCount} ticketed + ${ticketDefaults.freeCount} free landmarks)`,
    },
    {
      key: "buffer",
      label: `Emergency & Shopping Buffer (${bufferPercent}%)`,
      icon: "🛡️",
      color: "#64748b",
      bgBadge: "bg-slate-100 text-slate-700",
      amount: contingencyCost,
      formula: `${bufferPercent}% safety cushion for souvenirs, water, tips & unexpected price changes`,
    },
  ];

  return (
    <div className="mt-8 overflow-hidden rounded-3xl border border-[#dce7dc] bg-white shadow-lg">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-[#174b40] via-[#1f5f50] to-[#397c65] px-6 py-7 text-white sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#c4d9c9]">
              SMART BUDGET ANALYZER
            </p>
            <h2 className="mt-1.5 text-2xl font-black sm:text-3xl">
              Complete Trip Cost & Financial Breakdown
            </h2>
            <p className="mt-1.5 text-sm text-white/80">
              {origin.split(",")[0]} ↔ {destination.split(",")[0]} · {safeDays}{" "}
              {safeDays === 1 ? "day" : "days"} ({nights} {nights === 1 ? "night" : "nights"}) ·{" "}
              {safeTravellers} {safeTravellers === 1 ? "traveller" : "travellers"}
            </p>
          </div>

          <span
            className={`rounded-full px-4 py-2 text-xs font-extrabold uppercase tracking-wider shadow-sm ${
              isWithinBudget
                ? "bg-[#e9f1e9] text-[#174b40]"
                : "bg-amber-100 text-amber-950"
            }`}
          >
            {isWithinBudget
              ? `✓ Within Budget · Saves ${formatINR(budgetDiff)}`
              : `⚠️ Over Budget by ${formatINR(Math.abs(budgetDiff))}`}
          </span>
        </div>

        {/* Preset Switcher Bar */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-bold uppercase tracking-wider text-white/70">
            Quick Style:
          </span>
          {[
            { id: "backpacker", label: "🎒 Backpacker Saver" },
            { id: "balanced", label: "✨ Balanced Comfort" },
            { id: "premium", label: "👑 Premium Trip" },
            { id: "autofit", label: `🎯 Auto-Fit to ${formatINR(budget)}` },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                applyPreset(item.id as "backpacker" | "balanced" | "premium" | "autofit")
              }
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                activePreset === item.id
                  ? "bg-white text-[#174b40] shadow-sm"
                  : "bg-white/15 text-white hover:bg-white/25"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 sm:p-8">
        {/* Top 3 Executive KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-[#174b40] p-5 text-white shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-[#c4d9c9]">
              Total Estimated Trip Cost
            </p>
            <p className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              {formatINR(grandTotal)}
            </p>
            <p className="mt-2 text-xs text-white/75">
              Includes round-trip travel, stay, meals, local commute, tickets & {bufferPercent}% buffer
            </p>
          </div>

          <div className="rounded-2xl border border-[#dce7dc] bg-[#f7f8f5] p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-[#477364]">
              Per-Person Breakdown
            </p>
            <p className="mt-2 text-3xl font-black text-[#183b35]">
              {formatINR(perPersonTotal)}
              <span className="text-sm font-semibold text-gray-500"> / person</span>
            </p>
            <p className="mt-2 text-xs text-gray-600">
              Daily average: <strong>{formatINR(perPersonPerDay)}</strong> per person/day
            </p>
          </div>

          <div
            className={`rounded-2xl border p-5 ${
              isWithinBudget
                ? "border-emerald-200 bg-emerald-50/60"
                : "border-amber-200 bg-amber-50/70"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-600">
                Your Target Budget
              </p>
              <span className="text-xs font-extrabold text-[#174b40]">
                {utilizationPct}% used
              </span>
            </div>
            <p className="mt-2 text-3xl font-black text-[#183b35]">{formatINR(budget)}</p>
            <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-white/80">
              <div
                className={`h-full rounded-full transition-all ${
                  isWithinBudget ? "bg-[#174b40]" : "bg-amber-600"
                }`}
                style={{ width: `${utilizationPct}%` }}
              />
            </div>
            <p className="mt-2 text-xs font-semibold text-gray-700">
              {isWithinBudget
                ? `You have ${formatINR(budgetDiff)} unallocated for extra shopping or upgrades.`
                : `Click "Auto-Fit to ${formatINR(budget)}" above to bring costs under budget.`}
            </p>
          </div>
        </div>

        {/* Visual Stacked Expense Distribution Bar */}
        <div className="mt-7 rounded-2xl border border-gray-100 bg-[#fcfcfa] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#183b35]">
              Where Your Money Goes (Expense Share)
            </h3>
            <span className="text-xs text-gray-500">
              One-way road distance: ~{Math.round(effectiveDistanceKm)} km
            </span>
          </div>

          <div className="mt-3 flex h-4 w-full overflow-hidden rounded-full bg-gray-100">
            {breakdownItems.map((item) => {
              const pct = grandTotal > 0 ? (item.amount / grandTotal) * 100 : 0;
              if (pct <= 0) return null;
              return (
                <div
                  key={item.key}
                  title={`${item.label}: ${formatINR(item.amount)} (${Math.round(pct)}%)`}
                  style={{ width: `${pct}%`, backgroundColor: item.color }}
                  className="h-full transition-all first:rounded-l-full last:rounded-r-full"
                />
              );
            })}
          </div>

          <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {breakdownItems.map((item) => {
              const pct = grandTotal > 0 ? Math.round((item.amount / grandTotal) * 100) : 0;
              return (
                <div
                  key={item.key}
                  className="flex items-center gap-2 rounded-xl bg-white p-2.5 shadow-2xs"
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-gray-500">
                      {item.label.split(" ")[0]} ({pct}%)
                    </p>
                    <p className="text-xs font-extrabold text-[#183b35]">
                      {formatINR(item.amount)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Interactive Cost Tuning Controls */}
        <div className="mt-7">
          <h3 className="text-base font-extrabold text-[#183b35]">
            Customize Your Trip Assumptions
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Adjust any value below to match your exact train/bus ticket, hotel preference, or dining style.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* 1. Intercity Transport Mode & Override */}
            <div className="rounded-2xl border border-gray-200 bg-[#fcfcfa] p-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#477364]">
                🚆 Intercity Travel Mode
              </label>
              <select
                value={intercityMode}
                onChange={(e) => {
                  setIntercityMode(e.target.value as IntercityMode);
                  setCustomIntercityTotal("");
                }}
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-[#183b35]"
              >
                <option value="train_3ac">Train · 3AC Coach</option>
                <option value="train_sleeper">Train · Sleeper (SL)</option>
                <option value="bus_ac">AC Volvo / Express Bus</option>
                <option value="car_drive">Private Car (Fuel + Tolls)</option>
                <option value="bike_ride">Two-Wheeler / Bike</option>
              </select>
              <label className="mt-2.5 block text-[11px] font-medium text-gray-500">
                Or enter exact group round-trip fare (₹):
                <input
                  type="number"
                  min="0"
                  placeholder={`Auto: ${formatINR(autoIntercity.total)}`}
                  value={customIntercityTotal}
                  onChange={(e) => setCustomIntercityTotal(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#183b35]"
                />
              </label>
            </div>

            {/* 2. Stay / Room Rate */}
            <div className="rounded-2xl border border-gray-200 bg-[#fcfcfa] p-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-[#477364]">
                  🏨 {stayDefaults.perPersonBed ? "Hostel Bed / Night" : "Room / Night"}
                </label>
                <span className="text-xs font-black text-[#174b40]">
                  {formatINR(roomRatePerNight)}
                </span>
              </div>
              <input
                type="range"
                min="400"
                max="10000"
                step="100"
                value={roomRatePerNight}
                onChange={(e) => setRoomRatePerNight(Number(e.target.value))}
                className="mt-3 w-full accent-[#174b40]"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[11px] text-gray-500">
                  {roomsOrBeds} {stayDefaults.perPersonBed ? "bed(s)" : "room(s)"} × {nights} night(s)
                </span>
                <input
                  type="number"
                  min="0"
                  value={roomRatePerNight}
                  onChange={(e) => setRoomRatePerNight(Math.max(0, Number(e.target.value)))}
                  className="w-24 rounded-lg border border-gray-200 bg-white px-2 py-1 text-right text-xs font-bold"
                />
              </div>
            </div>

            {/* 3. Food & Dining Per Person/Day */}
            <div className="rounded-2xl border border-gray-200 bg-[#fcfcfa] p-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-[#477364]">
                  🍛 Food / Person / Day
                </label>
                <span className="text-xs font-black text-[#174b40]">
                  {formatINR(foodPerPersonDay)}
                </span>
              </div>
              <input
                type="range"
                min="250"
                max="3000"
                step="50"
                value={foodPerPersonDay}
                onChange={(e) => setFoodPerPersonDay(Number(e.target.value))}
                className="mt-3 w-full accent-[#174b40]"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[11px] text-gray-500">
                  {safeTravellers}p × {safeDays}d meals
                </span>
                <input
                  type="number"
                  min="0"
                  value={foodPerPersonDay}
                  onChange={(e) => setFoodPerPersonDay(Math.max(0, Number(e.target.value)))}
                  className="w-24 rounded-lg border border-gray-200 bg-white px-2 py-1 text-right text-xs font-bold"
                />
              </div>
            </div>

            {/* 4. Local Sightseeing & Entry Tickets */}
            <div className="rounded-2xl border border-gray-200 bg-[#fcfcfa] p-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-[#477364]">
                  🚕 Local Commute / Day
                </label>
                <span className="text-xs font-black text-[#174b40]">
                  {formatINR(localTransportPerDay)}
                </span>
              </div>
              <input
                type="range"
                min="150"
                max="3500"
                step="50"
                value={localTransportPerDay}
                onChange={(e) => setLocalTransportPerDay(Number(e.target.value))}
                className="mt-3 w-full accent-[#174b40]"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[11px] text-gray-500">Tickets/person (₹):</span>
                <input
                  type="number"
                  min="0"
                  value={ticketsPerPerson}
                  onChange={(e) => setTicketsPerPerson(Math.max(0, Number(e.target.value)))}
                  className="w-24 rounded-lg border border-gray-200 bg-white px-2 py-1 text-right text-xs font-bold"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Full Analytical Itemized Table */}
        <div className="mt-7 overflow-hidden rounded-2xl border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-[#f7f8f5] text-[11px] font-extrabold uppercase tracking-wider text-gray-600">
                  <th className="px-4 py-3.5">Expense Category</th>
                  <th className="px-4 py-3.5">Calculation & Basis</th>
                  <th className="px-4 py-3.5 text-right">Per Person</th>
                  <th className="px-4 py-3.5 text-right">Group Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {breakdownItems.map((item) => (
                  <tr key={item.key} className="hover:bg-gray-50/70">
                    <td className="px-4 py-3.5 font-bold text-[#183b35]">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm ${item.bgBadge}`}
                        >
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-600">{item.formula}</td>
                    <td className="px-4 py-3.5 text-right font-semibold text-gray-700">
                      {formatINR(item.amount / safeTravellers)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-black text-[#183b35]">
                      {formatINR(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#174b40]/20 bg-[#e9f1e9]/60 font-black text-[#183b35]">
                  <td className="px-4 py-4 text-base">Complete Trip Estimate</td>
                  <td className="px-4 py-4 text-xs font-semibold text-[#477364]">
                    All-inclusive estimate for {safeTravellers} traveller(s) across {safeDays} day(s)
                  </td>
                  <td className="px-4 py-4 text-right text-base">
                    {formatINR(perPersonTotal)}
                  </td>
                  <td className="px-4 py-4 text-right text-lg text-[#174b40]">
                    {formatINR(grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Smart Financial Insights & Quick Booking Verification */}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl bg-[#f7f8f5] p-4 text-xs leading-6 text-gray-700">
            <p className="font-extrabold uppercase tracking-wider text-[#174b40]">
              💡 Smart Financial Insights for {destination.split(",")[0]}
            </p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4">
              <li>
                <strong>Daily Cash/UPI Allowance:</strong> Keep roughly{" "}
                <strong>{formatINR(foodPerPersonDay + localTransportPerDay / safeTravellers)}</strong>{" "}
                per person per day ready for meals, metro/auto rides, and quick snacks.
              </li>
              <li>
                <strong>Sightseeing Pass Tip:</strong> Many temples, ghats, and malls have{" "}
                <strong>₹0 entry</strong>; major museums and parks average ₹40–₹250 per person.
              </li>
              {!isWithinBudget && (
                <li className="text-amber-900">
                  <strong>Savings Opportunity:</strong> Switching intercity travel to{" "}
                  <strong>Sleeper Train / Bus</strong> or using the{" "}
                  <strong>Backpacker Saver</strong> preset will immediately trim{" "}
                  {formatINR(Math.abs(budgetDiff))}+.
                </li>
              )}
            </ul>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-[#183b35]">
                Verify Live Fares & Hotel Deals
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Compare real-time ticket availability and hotel rates for your travel dates:
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={`https://www.google.com/travel/hotels/${encodeURIComponent(destination)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-[#e9f1e9] px-3.5 py-2 text-xs font-bold text-[#174b40] transition hover:bg-[#d5e5d5]"
              >
                🏨 Check Hotels in {destination.split(",")[0]} ↗
              </a>
              <a
                href="https://www.irctc.co.in/nget/train-search"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-[#f7f8f5] px-3.5 py-2 text-xs font-bold text-[#183b35] transition hover:bg-gray-200"
              >
                🚆 IRCTC Trains ↗
              </a>
              <a
                href="https://www.redbus.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-[#f7f8f5] px-3.5 py-2 text-xs font-bold text-[#183b35] transition hover:bg-gray-200"
              >
                🚌 RedBus Fares ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}