"use client";

import { useEffect, useMemo, useState } from "react";

type TransportComparisonProps = {
  origin: string;
  destination: string;
  travellers: number;
  /** One-way road distance in km from the route service (null if unavailable). */
  distanceKm?: number | null;
  /** The transport preference chosen in the form, used for the initial selection. */
  preference?: string;
  onSelect?: (name: string) => void;
};

type TransportOption = {
  name: string;
  icon: string;
  /** Estimated round-trip cost for the whole group, or null when it cannot be estimated. */
  groupCost: number | null;
  description: string;
  availability: string;
};

// Rough planning rates per km (assumptions, not fares). Updating them here updates every card.
const TRAIN_PER_KM = 0.6; // sleeper-class style fare, per person
const BUS_PER_KM = 1.5; // ordinary/express bus, per person
const TAXI_PER_KM = 14; // outstation cab, per vehicle
const TAXI_SEATS = 4;
const MIN_FARE = 50;

function initialSelection(preference?: string) {
  if (preference === "Bus") return "Bus";
  if (preference === "Driving") return "Car / Taxi";
  return "Train";
}

export default function TransportComparison({
  origin,
  destination,
  travellers,
  distanceKm = null,
  preference,
  onSelect,
}: TransportComparisonProps) {
  const [selected, setSelected] = useState(() => initialSelection(preference));

  const people = Math.max(1, Math.floor(Number(travellers)) || 1);
  const hasDistance = typeof distanceKm === "number" && Number.isFinite(distanceKm) && distanceKm > 0;

  useEffect(() => {
    onSelect?.(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const options = useMemo<TransportOption[]>(() => {
    const roundTrip = hasDistance ? (distanceKm as number) * 2 : 0;
    const perPerson = (rate: number) => Math.max(MIN_FARE * 2, roundTrip * rate);
    const vehicles = Math.ceil(people / TAXI_SEATS);

    // Flight is intentionally absent: no flight provider is connected, so none can be confirmed.
    return [
      {
        name: "Train",
        icon: "🚆",
        groupCost: hasDistance ? perPerson(TRAIN_PER_KM) * people : null,
        description: "Compare rail options for your journey.",
        availability: "Fare and seat availability not checked",
      },
      {
        name: "Bus",
        icon: "🚌",
        groupCost: hasDistance ? perPerson(BUS_PER_KM) * people : null,
        description: "Consider intercity bus connections.",
        availability: "Routes and seats not checked",
      },
      {
        name: "Car / Taxi",
        icon: "🚗",
        groupCost: hasDistance ? roundTrip * TAXI_PER_KM * vehicles : null,
        description: `Flexible travel by road. ${vehicles} ${vehicles === 1 ? "vehicle" : "vehicles"} for ${people} ${people === 1 ? "traveller" : "travellers"}.`,
        availability: "Estimated planning cost per vehicle, not a quote",
      },
    ];
  }, [hasDistance, distanceKm, people]);

  const money = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Math.round(amount / 10) * 10);

  const current = options.find((option) => option.name === selected) ?? options[0];

  return (
    <section className="transport-panel">
      <div className="transport-heading">
        <p className="transport-eyebrow">CHOOSE HOW YOU TRAVEL</p>
        <h2>Compare transport options</h2>
        <p>
          {origin || "Starting point"} → {destination || "Destination"}
          {hasDistance ? ` · about ${Math.round(distanceKm as number)} km each way` : ""}
        </p>
      </div>

      <div className="transport-notice">
        {hasDistance
          ? "Round-trip prices are planning estimates calculated from the road distance and typical per-km rates, not verified fares or live availability. "
          : "No road distance is available for this trip yet, so prices cannot be estimated. "}
        Flight availability is not connected, so no flight is presented as confirmed.
      </div>

      <div className="transport-grid">
        {options.map((option) => (
          <button
            type="button"
            key={option.name}
            aria-pressed={selected === option.name}
            className={`transport-card ${selected === option.name ? "transport-selected" : ""}`}
            onClick={() => setSelected(option.name)}
          >
            <span className="transport-icon">{option.icon}</span>
            <span className="transport-name">{option.name}</span>
            <strong className="transport-price">
              {option.groupCost === null ? "Not estimated" : money(option.groupCost)}
            </strong>
            <span className="transport-per-person">
              {option.groupCost === null
                ? "Needs route distance"
                : option.name === "Car / Taxi"
                  ? `${money(option.groupCost / people)} per person · round trip`
                  : `${money(option.groupCost / people)} per person · round trip`}
            </span>
            <span className="transport-description">{option.description}</span>
            <span className="transport-time">{option.availability}</span>
            <span className="transport-select-label">
              {selected === option.name ? "✓ Selected" : "Select option"}
            </span>
          </button>
        ))}
      </div>

      <div className="transport-selected-summary">
        <span>Selected transport</span>
        <strong>
          {current.icon} {current.name}
        </strong>
        <span>
          Estimated group cost (round trip):{" "}
          <strong>{current.groupCost === null ? "Not estimated" : money(current.groupCost)}</strong>
        </span>
      </div>
    </section>
  );
}
