"use client";

import { useState } from "react";

type SaveTripProps = {
  start: string;
  destination: string;
  date: string;
  duration: string;
  travellers: string;
  budget: string;
  transport: string;
};

const STORAGE_KEY = "trip-planner-saved-trips";

export default function SaveTrip({
  start,
  destination,
  date,
  duration,
  travellers,
  budget,
  transport,
}: SaveTripProps) {
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  const budgetText = `₹${Number(budget).toLocaleString("en-IN")}`;
  const days = Number(duration);

  function saveTrip() {
    const trip = {
      start,
      destination,
      date,
      duration,
      travellers,
      budget: budgetText,
      transport,
      savedAt: new Date().toLocaleString(),
    };

    // 1. Remember it in this browser (may fail in private mode / blocked storage).
    let storedLocally = true;
    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      const trips = Array.isArray(existing) ? existing : [];
      trips.push(trip);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
    } catch {
      storedLocally = false;
    }

    // 2. Download a text copy, which does not depend on browser storage.
    try {
      const fileContent = [
        "TRIP PLANNER",
        "==============",
        `Starting location: ${trip.start}`,
        `Destination: ${trip.destination || "Explore options"}`,
        `Travel date: ${trip.date}`,
        `Duration: ${trip.duration} ${days === 1 ? "day" : "days"}`,
        `Travellers: ${trip.travellers}`,
        `Budget: ${trip.budget}`,
        `Transport: ${trip.transport}`,
        `Saved at: ${trip.savedAt}`,
      ].join("\n");

      const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "my-trip-plan.txt";
      document.body.appendChild(link); // required by some browsers (e.g. Firefox)
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);

      setFailed(false);
      setMessage(
        storedLocally
          ? "Trip saved in this browser and downloaded."
          : "Trip downloaded. It could not be saved in this browser (storage is blocked)."
      );
    } catch {
      setFailed(true);
      setMessage("Could not save the trip. Check your browser storage and download settings.");
    }
  }

  return (
    <section className="save-trip-panel">
      <div>
        <p className="save-trip-eyebrow">KEEP YOUR PLAN</p>
        <h2>Save this trip</h2>
        <p>Save the summary in this browser and download a copy as a text file.</p>
      </div>

      <div className="save-trip-details">
        <div>
          <span>Route</span>
          <strong>
            {start} → {destination || "Explore options"}
          </strong>
        </div>
        <div>
          <span>Date and duration</span>
          <strong>
            {date} · {duration} {days === 1 ? "day" : "days"}
          </strong>
        </div>
        <div>
          <span>Travellers</span>
          <strong>{travellers}</strong>
        </div>
        <div>
          <span>Budget · Transport</span>
          <strong>
            {budgetText} · {transport}
          </strong>
        </div>
      </div>

      <div className="save-trip-actions">
        <button type="button" onClick={saveTrip}>
          Save & Download Trip
        </button>
        {message && (
          <span role="status" className="save-trip-message" style={failed ? { color: "#dc2626" } : undefined}>
            {message}
          </span>
        )}
      </div>

      <p className="save-trip-note">
        Saved trips stay on this device only. This is a planning summary, not a booking.
      </p>
    </section>
  );
}
