# Trip Planner

Next.js (App Router) + Tailwind + Leaflet. Free OpenStreetMap services power the backend.

## Run it
```bash
npm install
cp .env.example .env.local   # optional, put your email in APP_CONTACT_EMAIL
npm run dev                  # http://localhost:3000
```

## Get a link (deploy)
```bash
npm i -g vercel
vercel          # follow the prompts, it prints https://your-project.vercel.app
```
Set `APP_CONTACT_EMAIL` under Project → Settings → Environment Variables.

## Backend (app/api)
| Route | What it does | Service |
|---|---|---|
| `GET /api/places?input=` | Location search suggestions | Photon (OpenStreetMap) |
| `POST /api/route` | Driving distance, time and map line | OSRM |
| `GET /api/attractions?destination=&lat=&lon=` | Named places to visit, ordered by road time | Overpass + OSRM, with a Wikipedia backup |
| `GET /api/hotels?...` | Hotel prices (see below) | none connected |

Shared helpers are in `app/api/_lib/osm.ts`.

### Hotels
Amadeus Self-Service closed on 17 July 2026, so no hotel provider is connected. `/api/hotels`
answers "not connected" and the budget uses the editable room rate. To add live prices, fill in
`getHotelOffers` in `app/api/_lib/hotelProvider.ts` (instructions are in that file).

### If tourist places show "temporarily unavailable"
The Overpass servers are often busy. The route now tries three Overpass servers, then falls back to
Wikipedia. If both fail, the message on screen includes the reason, and the same text is printed in
the terminal running `npm run dev`. Try again after a minute, or set `OVERPASS_URL` to your own server.

### Limits
The public Photon, OSRM and Overpass servers are free community services with fair-use limits.
They are fine for a demo or small project. For heavy traffic, self-host them or use a paid provider
and point `PHOTON_URL`, `OSRM_URL` and `OVERPASS_URL` at it.
