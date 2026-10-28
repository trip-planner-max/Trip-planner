// GET /api/hotels?destination=Digha&checkInDate=2026-11-14&nights=2&adults=2&rooms=1&lat=..&lon=..
//
// The budget calculator shows a "Lowest live offer" only when this route returns
//   { available: true, isLive: true, lowestTotalINR: number, offers: [{ name, totalINR }], note }
//
// Amadeus Self-Service (which an earlier version of this app used) was shut down on 17 July 2026,
// so there is no free built-in hotel provider. Until you connect one in lib/hotelProvider.ts,
// this route answers "not connected" and the calculator keeps using the editable room rate.
// Prices are never invented.

import { json } from "../_lib/osm";
import { getHotelOffers, type HotelQuery } from "../_lib/hotelProvider";

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;

  const query: HotelQuery = {
    destination: (p.get("destination") ?? "").trim(),
    checkInDate: p.get("checkInDate") ?? "",
    nights: Number(p.get("nights")),
    adults: Number(p.get("adults")),
    rooms: Number(p.get("rooms")),
    lat: p.get("lat") ? Number(p.get("lat")) : undefined,
    lon: p.get("lon") ? Number(p.get("lon")) : undefined,
  };

  if (
    !query.destination ||
    !/^\d{4}-\d{2}-\d{2}$/.test(query.checkInDate) ||
    !Number.isInteger(query.nights) || query.nights < 1 || query.nights > 30 ||
    !Number.isInteger(query.adults) || query.adults < 1 ||
    !Number.isInteger(query.rooms) || query.rooms < 1
  ) {
    return json({ available: false, isLive: false, reason: "Hotel lookup needs a destination, check-in date, nights, adults and rooms." }, 400);
  }

  try {
    const result = await getHotelOffers(query);

    if (!result) {
      return json({
        available: false,
        isLive: false,
        reason: "Live hotel prices are not connected, so the estimate uses your editable room rate.",
      });
    }

    const offers = result.offers
      .filter((o) => o.name && Number.isFinite(o.totalINR) && o.totalINR > 0)
      .sort((a, b) => a.totalINR - b.totalINR)
      .slice(0, 5);

    if (!offers.length) {
      return json({ available: false, isLive: false, reason: "No hotel offers were returned for these dates." });
    }

    return json({
      available: true,
      isLive: result.isLive,
      lowestTotalINR: offers[0].totalINR,
      offers,
      note: result.note ?? "Live offers from the connected hotel provider. Confirm price and availability before booking.",
    });
  } catch {
    return json({ available: false, isLive: false, reason: "Could not contact the hotel quote provider." });
  }
}
