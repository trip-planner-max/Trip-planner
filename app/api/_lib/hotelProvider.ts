// Plug a hotel price provider in here. Return null while none is connected.
//
// To connect one:
//   1. Call your provider's hotel search with the query below.
//   2. Convert each offer to { name, totalINR }, where totalINR is the TOTAL for the whole stay
//      (all nights, all rooms), in Indian rupees.
//   3. Return { offers, isLive: true } for real prices. Use isLive: false for sandbox/test data;
//      the calculator then ignores those prices.
// Keep API keys in environment variables (.env.local), never in this file.

export type HotelQuery = {
  destination: string;
  checkInDate: string; // YYYY-MM-DD
  nights: number;
  adults: number;
  rooms: number;
  lat?: number;
  lon?: number;
};

export type HotelOffer = { name: string; totalINR: number };

export type HotelResult = {
  offers: HotelOffer[];
  isLive: boolean;
  note?: string;
};

export async function getHotelOffers(_query: HotelQuery): Promise<HotelResult | null> {
  return null; // no provider connected
}
