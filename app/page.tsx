"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import LocationAutocomplete, {
  type PlaceSelection,
} from "./components/LocationAutocomplete";
import Itinerary, { type TouristPlace } from "./components/Itinerary";
import BudgetCalculator from "./components/BudgetCalculator";
import TransportComparison from "./components/TransportComparison";
import SaveTrip from "./components/SaveTrip";

const TripMap = dynamic(
  () => import("./components/TripMap").then((module) => module.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-80 items-center justify-center bg-gray-100 text-gray-500">
        Loading map...
      </div>
    ),
  }
);

type DestinationMode = "fixed" | "explore";

type Plan = {
  id: number;
  start: string;
  startPlace: PlaceSelection;
  mode: DestinationMode;
  destination: string;
  destinationPlace: PlaceSelection | null;
  date: string;
  duration: number;
  travellers: number;
  budget: number;
  transport: string;
  stay: string;
  overnightStay: boolean;
};

type CatalogDestination = {
  name: string;
  state: string;
  lat: number;
  lon: number;
  vibe: string;
  description: string;
  dailyBasePerPerson: number;
  image: string;
};

// Rich catalog of famous Indian destinations (East Coast, Bengal, Odisha, Andhra, Hills, Spiritual & Pan-India)
const EXPLORE_CATALOG: CatalogDestination[] = [
  {
    name: "Kolkata",
    state: "West Bengal",
    lat: 22.5726,
    lon: 88.3639,
    vibe: "Heritage, Temples & Malls",
    description: "Victoria Memorial, Dakshineswar Kali Temple, Science City, Eco Park & vibrant street food.",
    dailyBasePerPerson: 1100,
    image: "https://images.unsplash.com/photo-1558431382-27e303142255?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Digha",
    state: "West Bengal",
    lat: 21.6266,
    lon: 87.5074,
    vibe: "Beach & Weekend Getaway",
    description: "Shallow golden beaches, Marine Aquarium, Udaipur beach & fresh coastal seafood.",
    dailyBasePerPerson: 950,
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Mandarmani",
    state: "West Bengal",
    lat: 21.6667,
    lon: 87.7056,
    vibe: "Coastal Resort & Drive",
    description: "One of India's longest driveable beaches with peaceful seaside resorts and red crabs.",
    dailyBasePerPerson: 1200,
    image: "https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Shantiniketan",
    state: "West Bengal",
    lat: 23.6776,
    lon: 87.6852,
    vibe: "Culture, Art & Heritage",
    description: "Rabindranath Tagore's Visva-Bharati campus, Sonajhuri Haat, Kopai River & Baul music.",
    dailyBasePerPerson: 950,
    image: "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Puri",
    state: "Odisha",
    lat: 19.8135,
    lon: 85.8312,
    vibe: "Temple & Golden Beach",
    description: "Sacred Shree Jagannath Temple, Blue Flag Golden Beach, and nearby Konark Sun Temple.",
    dailyBasePerPerson: 1050,
    image: "https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Bhubaneswar",
    state: "Odisha",
    lat: 20.2961,
    lon: 85.8245,
    vibe: "Temples, Caves & Zoo",
    description: "Lingaraj Temple, Udayagiri & Khandagiri Caves, Nandankanan Zoological Park & Dhauli Giri.",
    dailyBasePerPerson: 1050,
    image: "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Bishnupur",
    state: "West Bengal",
    lat: 23.0679,
    lon: 87.3165,
    vibe: "Terracotta Temples",
    description: "Famous 17th-century Malla dynasty terracotta temples, Rasmancha & Baluchari silk weaving.",
    dailyBasePerPerson: 850,
    image: "https://images.unsplash.com/photo-1609947017136-9daf32a5eb16?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Jamshedpur",
    state: "Jharkhand",
    lat: 22.8046,
    lon: 86.2029,
    vibe: "Lakes, Hills & Parks",
    description: "Jubilee Park, Dalma Wildlife Sanctuary, Dimna Lake & clean tree-lined avenues.",
    dailyBasePerPerson: 1000,
    image: "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Ranchi",
    state: "Jharkhand",
    lat: 23.3441,
    lon: 85.3096,
    vibe: "Waterfalls & Valleys",
    description: "Hundru Falls, Dassam Falls, Patratu Valley hairpin bends, Rock Garden & Pahari Mandir.",
    dailyBasePerPerson: 1000,
    image: "https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Visakhapatnam",
    state: "Andhra Pradesh",
    lat: 17.6868,
    lon: 83.2185,
    vibe: "Beaches, Hills & Submarine",
    description: "RK Beach, Kailasagiri Hill, INS Kurusura Submarine Museum, Rushikonda & Simhachalam Temple.",
    dailyBasePerPerson: 1150,
    image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Araku Valley",
    state: "Andhra Pradesh",
    lat: 18.3273,
    lon: 82.8775,
    vibe: "Coffee Plantations & Caves",
    description: "Misty Eastern Ghats valley, Borra Caves, Chaparai Waterfalls & organic coffee estates.",
    dailyBasePerPerson: 1100,
    image: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Darjeeling",
    state: "West Bengal",
    lat: 27.041,
    lon: 88.2663,
    vibe: "Himalayan Tea & Toy Train",
    description: "Tiger Hill sunrise over Kanchenjunga, Batasia Loop, Toy Train & lush mountain tea estates.",
    dailyBasePerPerson: 1350,
    image: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Gangtok",
    state: "Sikkim",
    lat: 27.3389,
    lon: 88.6065,
    vibe: "Mountain Lakes & Monasteries",
    description: "MG Marg, Tsomgo Lake, Nathula Pass, Rumtek Monastery & panoramic Himalayan cable car.",
    dailyBasePerPerson: 1450,
    image: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Varanasi",
    state: "Uttar Pradesh",
    lat: 25.3176,
    lon: 82.9739,
    vibe: "Ghats & Spiritual Heritage",
    description: "Kashi Vishwanath Temple, Dashashwamedh Ghat Ganga Aarti, Assi Ghat boat rides & Sarnath.",
    dailyBasePerPerson: 1050,
    image: "https://images.unsplash.com/photo-1561361513-2d000a50f0dc?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Tirupati",
    state: "Andhra Pradesh",
    lat: 13.6288,
    lon: 79.4192,
    vibe: "Sacred Hill Temple",
    description: "Sri Venkateswara Swamy Temple on Tirumala Hills, Silathoranam, Kapila Theertham & Chandragiri Fort.",
    dailyBasePerPerson: 1100,
    image: "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Hyderabad",
    state: "Telangana",
    lat: 17.385,
    lon: 78.4867,
    vibe: "Palaces, Forts & Biryani",
    description: "Charminar, Golconda Fort, Ramoji Film City, Hussain Sagar, Birla Mandir & Salar Jung Museum.",
    dailyBasePerPerson: 1250,
    image: "https://images.unsplash.com/photo-1572445271230-a78b5944a659?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Goa",
    state: "Goa",
    lat: 15.2993,
    lon: 74.124,
    vibe: "Beaches, Forts & Nightlife",
    description: "Baga & Palolem beaches, Aguada Fort, Old Goa churches, Dudhsagar Falls & water sports.",
    dailyBasePerPerson: 1600,
    image: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=900&q=85",
  },
  {
    name: "Manali",
    state: "Himachal Pradesh",
    lat: 32.2432,
    lon: 77.1892,
    vibe: "Snow Peaks & Adventure",
    description: "Solang Valley, Rohtang Pass, Atal Tunnel, Hadimba Temple & riverside cafes in Old Manali.",
    dailyBasePerPerson: 1500,
    image: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=900&q=85",
  },
  {
    name: "Munnar",
    state: "Kerala",
    lat: 10.0889,
    lon: 77.0595,
    vibe: "Tea Gardens & Misty Hills",
    description: "Eravikulam National Park, Mattupetty Dam, rolling emerald tea estates & spice gardens.",
    dailyBasePerPerson: 1350,
    image: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=900&q=85",
  },
  {
    name: "Jaipur",
    state: "Rajasthan",
    lat: 26.9124,
    lon: 75.7873,
    vibe: "Royal Forts & Palaces",
    description: "Amber Fort, Hawa Mahal, City Palace, Nahargarh sunset views & vibrant Johari Bazaar.",
    dailyBasePerPerson: 1300,
    image: "https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Rishikesh",
    state: "Uttarakhand",
    lat: 30.0869,
    lon: 78.2676,
    vibe: "River Rafting & Yoga",
    description: "Laxman Jhula, Triveni Ghat Ganga Aarti, white-water river rafting & cliffside cafes.",
    dailyBasePerPerson: 1150,
    image: "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Ooty",
    state: "Tamil Nadu",
    lat: 11.4102,
    lon: 76.695,
    vibe: "Nilgiri Hills & Lakes",
    description: "Botanical Gardens, Ooty Lake, Doddabetta Peak, Nilgiri Mountain Railway & Coonoor tea estates.",
    dailyBasePerPerson: 1300,
    image: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=900&q=80",
  },
];

function haversineRoadKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const straightKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  // Multiply by 1.26 to approximate real highway road distance
  return Math.max(15, Math.round(straightKm * 1.26));
}

function estimateExploreTripCost(
  dest: CatalogDestination,
  roadKm: number,
  days: number,
  travellers: number,
  stayType: string
): number {
  const stayMultiplier = stayType.toLowerCase().includes("luxury")
    ? 2.1
    : stayType.toLowerCase().includes("budget") || stayType.toLowerCase().includes("hostel")
      ? 0.72
      : 1.0;

  // Round-trip sleeper/3AC/bus blended travel cost per person
  const roundTripPerPerson = Math.max(250, Math.round(roadKm * 2 * 1.15));
  const dailyPerPerson = Math.round(dest.dailyBasePerPerson * stayMultiplier);
  const totalForGroup = (roundTripPerPerson + dailyPerPerson * days) * travellers;

  return Math.round(totalForGroup / 100) * 100;
}

/** Reads the one-way road distance (km) from whatever shape the route API returns. */
function routeKm(route: any): number | null {
  if (!route) return null;

  const direct = Number(route.distanceKm);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const meters = Number(route.distanceMeters ?? route.distanceMeter);
  if (Number.isFinite(meters) && meters > 0) return meters / 1000;

  const text = String(route.distanceText ?? "").replace(/,/g, "");
  const match = text.match(/([\d.]+)\s*(km|kilomet\w*|mi|miles?|m)\b/i);
  if (!match) return null;

  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;

  const unit = match[2].toLowerCase();
  if (unit.startsWith("mi")) return value * 1.609344;
  if (unit === "m") return value / 1000;
  return value;
}

function formatHours(hours: number) {
  if (hours < 1) return `${Math.max(10, Math.round(hours * 60))} min`;
  let h = Math.floor(hours);
  let m = Math.round((hours - h) * 60);
  if (m === 60) {
    h += 1;
    m = 0;
  }
  return `${h} h ${m} min`;
}

function estimateIndianCarHours(distanceKm: number | null, route: any): string {
  if (!distanceKm || distanceKm <= 0) return route?.durationText || "Unavailable";
  const avgSpeedKmh = distanceKm < 60 ? 38 : distanceKm < 200 ? 50 : 55;
  const restBreakHours = Math.floor(distanceKm / 250) * 0.35;
  return formatHours(distanceKm / avgSpeedKmh + restBreakHours);
}

function estimateIndianBikeHours(distanceKm: number | null): string {
  if (!distanceKm || distanceKm <= 0) return "Unavailable";
  const avgSpeedKmh = distanceKm < 60 ? 36 : distanceKm < 200 ? 45 : 50;
  const restBreakHours = Math.floor(distanceKm / 180) * 0.25;
  return formatHours(distanceKm / avgSpeedKmh + restBreakHours);
}

function estimateIndianTrainHours(distanceKm: number | null): string {
  if (!distanceKm || distanceKm <= 0) return "Unavailable";
  if (distanceKm < 30) return "Local / Metro (~45 min)";
  const railDistanceKm = distanceKm * 0.96;
  return formatHours(railDistanceKm / 62 + 0.4);
}

export default function Home() {
  // ---- form state ----
  const [start, setStart] = useState("");
  const [startPlace, setStartPlace] = useState<PlaceSelection | null>(null);
  const [mode, setMode] = useState<DestinationMode>("fixed");
  const [destination, setDestination] = useState("");
  const [destinationPlace, setDestinationPlace] =
    useState<PlaceSelection | null>(null);
  const [date, setDate] = useState("");
  const [today, setToday] = useState("");
  const [duration, setDuration] = useState("3");
  const [travellers, setTravellers] = useState("2");
  const [budget, setBudget] = useState("15000");
  const [transport, setTransport] = useState("Any transport");
  const [stay, setStay] = useState("Comfortable hotel");
  const [error, setError] = useState("");

  // ---- results state ----
  const [plan, setPlan] = useState<Plan | null>(null);
  const [exploreFilter, setExploreFilter] = useState<"nearby" | "all" | "stretch">("nearby");
  const [exploreDestination, setExploreDestination] = useState("");
  const [explorePlace, setExplorePlace] = useState<PlaceSelection | null>(null);
  const [routeData, setRouteData] = useState<any>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [attractions, setAttractions] = useState<TouristPlace[]>([]);
  const [selectedTransport, setSelectedTransport] = useState("");

  useEffect(() => {
    const now = new Date();
    const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    const isoToday = localDate.toISOString().slice(0, 10);
    setToday(isoToday);
  }, []);

  const destLabel = plan
    ? plan.mode === "fixed"
      ? plan.destination
      : exploreDestination
    : "";
  const destPlace = plan
    ? plan.mode === "fixed"
      ? plan.destinationPlace
      : explorePlace
    : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!startPlace || startPlace.label !== start) {
      setError("Please select a starting location from the suggestions.");
      return;
    }

    if (
      mode === "fixed" &&
      (!destinationPlace || destinationPlace.label !== destination)
    ) {
      setError("Please select a destination from the suggestions.");
      return;
    }

    const daysCount = Number(duration);
    if (!Number.isInteger(daysCount) || daysCount < 1 || daysCount > 60) {
      setError("Please enter a valid duration between 1 and 60 days.");
      return;
    }

    const people = Number(travellers);
    if (!Number.isInteger(people) || people < 1 || people > 50) {
      setError("Enter a whole number of travellers between 1 and 50.");
      return;
    }

    if (!Number.isFinite(Number(budget)) || Number(budget) <= 0) {
      setError("Please enter a valid budget greater than ₹0.");
      return;
    }

    // Calendar is optional: if left blank, automatically default to today's date
    const effectiveDate = date.trim() || today || new Date().toISOString().slice(0, 10);

    setRouteData(null);
    setRouteError("");
    setAttractions([]);
    setSelectedTransport("");
    setExploreDestination("");
    setExplorePlace(null);
    setExploreFilter("nearby");

    setPlan({
      id: Date.now(),
      start,
      startPlace,
      mode,
      destination,
      destinationPlace: mode === "fixed" ? destinationPlace : null,
      date: effectiveDate,
      duration: daysCount,
      travellers: people,
      budget: Number(budget),
      transport,
      stay,
      overnightStay: daysCount > 1,
    });

    window.setTimeout(() => {
      document.getElementById("results")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  }

  // Selecting an Explore card sets its coordinates immediately (0ms, no slow API lookup needed!)
  function chooseExploreDestination(item: CatalogDestination) {
    const fullLabel = `${item.name}, ${item.state}, India`;
    setExploreDestination(fullLabel);
    setExplorePlace({
      placeId: `${item.lon},${item.lat}`,
      label: fullLabel,
      lat: item.lat,
      lon: item.lon,
    });
    setRouteData(null);
    setRouteError("");
    setAttractions([]);
  }

  // ---- route lookup ----
  const planId = plan?.id;
  const originId = plan?.startPlace.placeId;
  const destinationId = destPlace?.placeId;

  useEffect(() => {
    if (!planId || !originId || !destinationId) {
      setRouteData(null);
      setRouteLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadRoute() {
      setRouteLoading(true);
      setRouteError("");
      setRouteData(null);

      try {
        const response = await fetch("/api/route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            originPlaceId: originId,
            destinationPlaceId: destinationId,
            transport: "Any transport",
          }),
          signal: controller.signal,
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Route information is unavailable.");
        }

        setRouteData(payload);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setRouteError(
          err instanceof Error
            ? err.message
            : "Could not load route information."
        );
      } finally {
        if (!controller.signal.aborted) setRouteLoading(false);
      }
    }

    void loadRoute();
    return () => controller.abort();
  }, [planId, originId, destinationId]);

  const distanceKm = routeKm(routeData);

  // ---- Dynamic Explore by Budget Engine ----
  const enrichedExploreList = useMemo(() => {
    if (!plan || plan.mode !== "explore") return [];

    const startCity = plan.start.split(",")[0].trim().toLowerCase();

    return EXPLORE_CATALOG.filter((d) => d.name.toLowerCase() !== startCity)
      .map((dest) => {
        const approxRoadKm = haversineRoadKm(
          plan.startPlace.lat,
          plan.startPlace.lon,
          dest.lat,
          dest.lon
        );
        const estimatedGroupCost = estimateExploreTripCost(
          dest,
          approxRoadKm,
          plan.duration,
          plan.travellers,
          plan.stay
        );
        const fitsBudget = estimatedGroupCost <= plan.budget * 1.05;
        const isNearby = approxRoadKm <= 550;

        return {
          ...dest,
          approxRoadKm,
          estimatedGroupCost,
          fitsBudget,
          isNearby,
        };
      })
      .sort((a, b) => {
        // Sort places that fit budget first, then closest to user's starting location
        if (a.fitsBudget !== b.fitsBudget) return a.fitsBudget ? -1 : 1;
        return a.approxRoadKm - b.approxRoadKm;
      });
  }, [plan]);

  const filteredExploreList = useMemo(() => {
    if (exploreFilter === "nearby") {
      const near = enrichedExploreList.filter((d) => d.isNearby && d.fitsBudget);
      return near.length > 0 ? near : enrichedExploreList.filter((d) => d.isNearby);
    }
    if (exploreFilter === "all") {
      const fitting = enrichedExploreList.filter((d) => d.fitsBudget);
      return fitting.length > 0 ? fitting : enrichedExploreList;
    }
    return enrichedExploreList;
  }, [enrichedExploreList, exploreFilter]);

  const readyForDetails = Boolean(plan && destLabel);

  return (
    <main className="min-h-screen bg-[#f7f8f5] text-[#183b35]">
      <nav className="mx-auto flex max-w-[1080px] items-center justify-between px-5 py-5 sm:px-8">
        <a href="#" className="text-xl font-black tracking-tight">
          trip<span className="text-[#d68b55]">planner</span>
        </a>
        <div className="flex items-center gap-5 text-sm font-medium">
          <a href="#planner">Plan a trip</a>
          <a href="#destinations">Explore places</a>
        </div>
      </nav>

      <section className="mx-auto grid max-w-[1080px] gap-10 px-5 py-10 sm:px-8 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#477364]">
            YOUR NEXT CHAPTER STARTS HERE
          </p>
          <h1 className="mt-4 text-5xl font-black leading-tight sm:text-6xl">
            Less planning.
            <br />
            <span className="text-[#d68b55]">More exploring.</span>
          </h1>
          <p className="mt-5 max-w-xl leading-8 text-gray-600">
            Plan your next journey with locations, travel dates, transport
            options, a budget, and a suggested itinerary.
          </p>
          <a
            href="#planner"
            className="mt-7 inline-block rounded-full bg-[#174b40] px-7 py-4 font-bold text-white"
          >
            Build my itinerary →
          </a>
        </div>
        <div className="hero-illustration" role="img" aria-label="Illustration of green mountains, a golden sun, and a lake">
          <svg viewBox="0 0 700 420" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
            <defs>
              <linearGradient id="heroSky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#cfe5ea" />
                <stop offset="100%" stopColor="#e9f1e9" />
              </linearGradient>
              <linearGradient id="heroLake" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#aacdc8" />
                <stop offset="100%" stopColor="#dce9df" />
              </linearGradient>
            </defs>
            <rect width="700" height="420" fill="url(#heroSky)" />
            <circle cx="535" cy="82" r="35" fill="#f4d7a8" />
            <path d="M0 236 116 94 232 214 370 70 520 220 620 126 700 204 700 270 0 270Z" fill="#7ea894" />
            <path d="M0 260 100 166 206 260 340 145 460 270 590 170 700 250 700 292 0 292Z" fill="#4d8870" />
            <path d="M0 268 Q120 248 235 270 T470 265 T700 276 V420 H0Z" fill="url(#heroLake)" />
            <path d="M0 312 Q120 300 235 313 T470 309 T700 320 M0 352 Q120 342 235 353 T470 350 T700 358 M0 390 Q120 383 235 391 T470 388 T700 397" stroke="#ffffff" strokeOpacity=".65" strokeWidth="3" fill="none" />
            <path d="M370 70 340 145 376 119 398 138 416 108Z" fill="#e7f0e7" opacity=".85" />
          </svg>
        </div>
      </section>

      <section id="planner" className="scroll-mt-5 px-4 pb-16 sm:px-8">
        <div className="mx-auto max-w-5xl overflow-visible rounded-3xl bg-white shadow-xl">
          <div className="rounded-t-3xl bg-[#174b40] px-6 py-8 text-white sm:px-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c4d9c9]">
              THE JOURNEY BUILDER
            </p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">
              Plan a trip that feels like you.
            </h2>
            <p className="mt-3 text-white/75">
              Enter your starting point, destination preference, duration, and budget.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8 p-5 sm:p-10">
            <div>
              <h3 className="mb-4 text-xl font-extrabold">01 · Where to?</h3>
              <div className="grid gap-5 sm:grid-cols-2">
                <LocationAutocomplete
                  label="Starting location *"
                  value={start}
                  placeholder="Search city, address, station..."
                  onChange={(value) => {
                    setStart(value);
                    setStartPlace(null);
                  }}
                  onSelect={(place) => {
                    setStart(place.label);
                    setStartPlace(place);
                  }}
                />

                <div>
                  <span className="mb-2 block text-sm font-semibold">
                    Destination preference *
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ["fixed", "Fixed destination"],
                        ["explore", "Explore by budget"],
                      ] as const
                    ).map(([value, text]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={mode === value}
                        onClick={() => setMode(value)}
                        className={`rounded-xl border p-3 text-sm font-semibold ${
                          mode === value
                            ? "border-[#174b40] bg-[#e9f1e9]"
                            : "border-gray-200"
                        }`}
                      >
                        {text}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {mode === "fixed" && (
                <div className="mt-5">
                  <LocationAutocomplete
                    label="Your destination *"
                    value={destination}
                    placeholder="Search for a destination..."
                    onChange={(value) => {
                      setDestination(value);
                      setDestinationPlace(null);
                    }}
                    onSelect={(place) => {
                      setDestination(place.label);
                      setDestinationPlace(place);
                    }}
                  />
                </div>
              )}
            </div>

            <div className="border-t border-gray-100" />

            <div>
              <h3 className="mb-4 text-xl font-extrabold">
                02 · Your travel details
              </h3>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <label className="block text-sm font-semibold">
                  Start date <span className="font-normal text-gray-400">(optional)</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fcfcfa] px-3 py-3.5 font-normal"
                  />
                </label>

                <label className="block text-sm font-semibold">
                  Duration (days) *
                  <input
                    type="number"
                    min="1"
                    max="60"
                    step="1"
                    required
                    value={duration}
                    onChange={(event) => setDuration(event.target.value)}
                    placeholder="e.g. 3"
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fcfcfa] px-3 py-3.5 font-normal"
                  />
                </label>

                <label className="block text-sm font-semibold">
                  Travellers *
                  <input
                    type="number"
                    min="1"
                    max="50"
                    step="1"
                    required
                    value={travellers}
                    onChange={(event) => setTravellers(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fcfcfa] px-3 py-3.5 font-normal"
                    placeholder="Enter number of travellers"
                  />
                </label>

                <label className="block text-sm font-semibold">
                  Total budget (₹) *
                  <input
                    required
                    type="number"
                    min="1"
                    value={budget}
                    onChange={(event) => setBudget(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fcfcfa] px-3 py-3.5 font-normal"
                  />
                </label>
              </div>
            </div>

            <div className="border-t border-gray-100" />

            <div>
              <h3 className="mb-4 text-xl font-extrabold">
                03 · Make it your style
              </h3>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-sm font-semibold">
                  Transport preference
                  <select
                    value={transport}
                    onChange={(event) => setTransport(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fcfcfa] px-4 py-3.5 font-normal"
                  >
                    {["Any transport", "Driving", "Walking", "Cycling", "Train", "Bus"].map(
                      (item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label className="block text-sm font-semibold">
                  Accommodation
                  <select
                    value={stay}
                    onChange={(event) => setStay(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fcfcfa] px-4 py-3.5 font-normal"
                  >
                    {["Budget stay", "Comfortable hotel", "Luxury hotel", "Hostel", "Homestay"].map(
                      (item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      )
                    )}
                  </select>
                </label>
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full rounded-2xl bg-[#174b40] px-6 py-5 text-lg font-extrabold text-white shadow-lg transition hover:bg-[#10382f]"
            >
              Plan My Trip →
            </button>

            <p className="text-center text-xs text-gray-500">
              Planning estimates only. Verify fares, opening hours and prices before travelling.
            </p>
          </form>
        </div>
      </section>

      {plan && (
        <section
          id="results"
          aria-live="polite"
          className="scroll-mt-6 px-4 pb-16 sm:px-8"
        >
          <div className="mx-auto max-w-[1080px] rounded-3xl bg-[#e9f1e9] p-5 sm:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#477364]">
              YOUR TRIP SUMMARY
            </p>
            <h2 className="mt-3 text-3xl font-black sm:text-5xl">
              Your adventure starts here.
            </h2>
            <p className="mt-3 leading-7 text-gray-600">
              {plan.start} →{" "}
              {plan.mode === "fixed"
                ? plan.destination
                : exploreDestination || "Select a destination below"}
              {" · "}
              {plan.duration} {plan.duration === 1 ? "day" : "days"}
              {" · "}
              {plan.travellers} {plan.travellers === 1 ? "traveller" : "travellers"}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full bg-white px-4 py-2 font-semibold">
                Budget: ₹{plan.budget.toLocaleString("en-IN")}
              </span>
              <span className="rounded-full bg-white px-4 py-2 font-semibold">
                Transport: {plan.transport}
              </span>
              <span className="rounded-full bg-white px-4 py-2 font-semibold">
                Stay: {plan.stay}
              </span>
            </div>

            {plan.mode === "explore" && (
              <div id="destinations" className="scroll-mt-8 pt-8">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c9824b]">
                      EXPLORE BY BUDGET & DISTANCE
                    </p>
                    <h3 className="mt-1.5 text-2xl font-black sm:text-3xl">
                      Famous places from {plan.start.split(",")[0]}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      Estimated for {plan.travellers} traveller(s), {plan.duration} day(s) & {plan.stay.toLowerCase()}. Click any place to load its full route, map and itinerary.
                    </p>
                  </div>

                  {/* Filter Tabs */}
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "nearby", label: "📍 Famous Near Me (< 550 km)" },
                      { id: "all", label: `✓ All Within ₹${plan.budget.toLocaleString("en-IN")}` },
                      { id: "stretch", label: "🌏 All 22 Famous Places" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setExploreFilter(tab.id as "nearby" | "all" | "stretch")}
                        className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${
                          exploreFilter === tab.id
                            ? "bg-[#174b40] text-white shadow-sm"
                            : "bg-white text-[#183b35] hover:bg-gray-100"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredExploreList.map((place) => {
                    const isSelected =
                      exploreDestination.split(",")[0].toLowerCase() ===
                      place.name.toLowerCase();

                    return (
                      <article
                        key={place.name}
                        className={`flex flex-col justify-between overflow-hidden rounded-3xl bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${
                          isSelected ? "ring-3 ring-[#174b40]" : ""
                        }`}
                      >
                        <div>
                          <div className="relative h-48 w-full overflow-hidden bg-gray-200">
                            <img
                              src={place.image}
                              alt={place.name}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                            <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                              <span className="rounded-full bg-black/70 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-xs">
                                ~{place.approxRoadKm} km away
                              </span>
                              <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold text-[#174b40]">
                                {place.vibe}
                              </span>
                            </div>
                          </div>

                          <div className="p-5">
                            <div className="flex items-baseline justify-between gap-2">
                              <h4 className="text-xl font-black text-[#183b35]">
                                {place.name}
                              </h4>
                              <span className="text-xs font-semibold text-gray-500">
                                {place.state}
                              </span>
                            </div>

                            <p className="mt-2 text-xs leading-5 text-gray-600">
                              {place.description}
                            </p>
                          </div>
                        </div>

                        <div className="border-t border-gray-100 bg-[#fcfcfa] p-5 pt-3.5">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[11px] text-gray-500">
                                Est. for {plan.travellers}p · {plan.duration}d
                              </p>
                              <p className="text-lg font-black text-[#174b40]">
                                ₹{place.estimatedGroupCost.toLocaleString("en-IN")}
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                                place.fitsBudget
                                  ? "bg-emerald-100 text-emerald-900"
                                  : "bg-amber-100 text-amber-900"
                              }`}
                            >
                              {place.fitsBudget ? "✓ Fits Budget" : "Slightly Above"}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => chooseExploreDestination(place)}
                            className={`mt-3.5 w-full rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                              isSelected
                                ? "bg-[#397c65] text-white"
                                : "bg-[#174b40] text-white hover:bg-[#10382f]"
                            }`}
                          >
                            {isSelected
                              ? "Selected destination ✓"
                              : `Plan ${place.name} Trip →`}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}

            {readyForDetails && (
              <div className="mt-8 overflow-hidden rounded-3xl border border-[#dce7dc] bg-white shadow-lg">
                <div className="bg-gradient-to-r from-[#174b40] to-[#397c65] p-5 text-white sm:p-7">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">
                    YOUR JOURNEY AT A GLANCE
                  </p>
                  <h3 className="mt-2 text-2xl font-black">The road to your next memory</h3>
                  <p className="mt-2 text-sm text-white/80">
                    Explore the route, compare travel modes, and plan your stops.
                  </p>
                </div>

                <div className="p-5 sm:p-7">
                  <p className="mt-1 text-sm text-gray-500">
                    {plan.start} → {destLabel}
                  </p>

                  {routeLoading && (
                    <p role="status" className="mt-4 text-sm text-gray-500">
                      Loading route...
                    </p>
                  )}

                  {routeError && (
                    <p role="status" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                      {routeError}
                    </p>
                  )}

                  {routeData && (
                    <>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-2xl bg-[#f7f8f5] p-4">
                          <p className="text-sm text-gray-500">🛣️ Road distance</p>
                          <p className="mt-1 text-xl font-black">{routeData.distanceText}</p>
                          <p className="mt-1 text-xs text-gray-500">
                            One-way highway route via OSRM.
                          </p>
                        </div>

                        <div className="rounded-2xl bg-[#f7f8f5] p-4">
                          <p className="text-sm text-gray-500">🚗 Car / cab estimate</p>
                          <p className="mt-1 text-xl font-black">
                            {estimateIndianCarHours(distanceKm, routeData)}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Indian highway average (~50–55 km/h) with tolls & brief stops.
                          </p>
                        </div>

                        <div className="rounded-2xl bg-[#f7f8f5] p-4">
                          <p className="text-sm text-gray-500">🏍️ Bike estimate</p>
                          <p className="mt-1 text-xl font-black">
                            {estimateIndianBikeHours(distanceKm)}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Highway two-wheeler cruise (~48–50 km/h with rest breaks).
                          </p>
                        </div>

                        <div className="rounded-2xl bg-[#f7f8f5] p-4">
                          <p className="text-sm text-gray-500">🚆 Express train est.</p>
                          <p className="mt-1 text-xl font-black">
                            {estimateIndianTrainHours(distanceKm)}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Typical Superfast/Express rail time (~62 km/h average).
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 overflow-hidden rounded-2xl">
                        <TripMap
                          encodedPolyline={routeData.encodedPolyline}
                          origin={plan.start}
                          destination={destLabel}
                          attractions={attractions}
                          originLat={plan.startPlace.lat}
                          originLon={plan.startPlace.lon}
                          destinationLat={destPlace?.lat}
                          destinationLon={destPlace?.lon}
                        />
                      </div>

                      <p className="mt-2 text-xs text-gray-500">
                        Route estimates may differ from actual travel conditions.
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {!readyForDetails && (
              <p className="mt-8 rounded-2xl border border-dashed border-[#b9cdb9] bg-white/60 p-5 text-center text-sm text-gray-600">
                Pick any destination card above with <strong>Plan Trip →</strong> to
                load its road route, photo-pin map, day-by-day itinerary, and budget breakdown.
              </p>
            )}

            {readyForDetails && (
              <div key={`${plan.id}-${destLabel}`}>
                <Itinerary
                  destination={destLabel}
                  durationDays={plan.duration}
                  startDate={plan.date}
                  overnightStay={plan.overnightStay}
                  totalBudget={plan.budget}
                  travellers={plan.travellers}
                  destinationLat={destPlace?.lat}
                  destinationLon={destPlace?.lon}
                  onAttractionsLoaded={setAttractions}
                />

                <BudgetCalculator
                  travellers={plan.travellers}
                  durationDays={plan.duration}
                  budget={plan.budget}
                  accommodation={plan.stay}
                  overnightStay={plan.overnightStay}
                  destination={destLabel}
                  origin={plan.start}
                  transportPreference={plan.transport}
                  routeDistanceKm={distanceKm}
                  attractions={attractions}
                  checkInDate={plan.date}
                  destinationLat={destPlace?.lat}
                  destinationLon={destPlace?.lon}
                />

                <TransportComparison
                  origin={plan.start}
                  destination={destLabel}
                  travellers={plan.travellers}
                  distanceKm={distanceKm}
                  preference={plan.transport}
                  onSelect={setSelectedTransport}
                />

                <SaveTrip
                  start={plan.start}
                  destination={destLabel}
                  date={plan.date}
                  duration={String(plan.duration)}
                  travellers={String(plan.travellers)}
                  budget={String(plan.budget)}
                  transport={selectedTransport || plan.transport}
                />
              </div>
            )}
          </div>
        </section>
      )}

      <section id="how-it-works" className="bg-white px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-[1080px]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c9824b]">
            SIMPLE BY DESIGN
          </p>
          <h2 className="mt-3 text-3xl font-black sm:text-4xl">From idea to itinerary.</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {[
              { title: "Tell us your plan", text: "Enter your locations, duration, budget, and group size." },
              { title: "Choose your style", text: "Choose your preferred transport and accommodation." },
              { title: "Explore possibilities", text: "Review the route, trip summary, and sample itinerary." },
            ].map((item, index) => (
              <div key={item.title} className="rounded-2xl bg-[#f7f8f5] p-6">
                <p className="text-sm font-black text-[#c9824b]">0{index + 1}</p>
                <h3 className="mt-3 text-lg font-extrabold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-[#174b40] px-5 py-8 text-white sm:px-8">
        <div className="mx-auto flex max-w-[1080px] flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <p className="text-lg font-black">
            trip<span className="text-[#e5a773]">planner</span>
          </p>
          <p className="text-sm text-white/70">Every great journey begins with a plan.</p>
        </div>
      </footer>
    </main>
  );
}