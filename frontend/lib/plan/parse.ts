import type {
  BudgetCard,
  FlightCard,
  HotelCard,
  ItineraryCard,
  TripDocument,
  TripPayload,
  WeatherCard,
} from "@/types/trip";

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value.replace(/^```(?:json)?\s*|\s*```$/gim, "").trim());
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function textOf(raw: string | null | undefined): string {
  if (!raw) return "";
  const object = asObject(raw);
  if (!object) return raw;
  const summary = object.summary;
  return typeof summary === "string" ? summary : raw;
}

function card<T>(raw: string | null | undefined, fallbackHeadline: string): T {
  const object = asObject(raw);
  if (object) return object as T;
  if (!raw?.trim()) return { headline: fallbackHeadline, summary: "" } as T;
  return { headline: fallbackHeadline, summary: textOf(raw) } as T;
}

function populated<T extends object>(value: T | undefined | null): T | undefined {
  return value && Object.keys(value).length > 0 ? value : undefined;
}

export function asTripDocument(payload: TripPayload): TripDocument {
  const supplied = payload.trip_document;
  const constraints = payload.trip_constraints ?? {};
  const flights = (populated(payload.flight_details) ?? supplied?.flights ?? card<FlightCard>(payload.flight_results, "Flights")) as FlightCard;
  const hotels = (populated(payload.hotel_details) ?? supplied?.hotels ?? card<HotelCard>(payload.hotel_results, "Hotels")) as HotelCard;
  const budget = (populated(payload.budget_details) ?? supplied?.budget ?? card<BudgetCard>(payload.budget_analysis, "Budget")) as BudgetCard;
  const itinerary = (populated(payload.itinerary_details) ?? supplied?.itinerary ?? card<ItineraryCard>(payload.itinerary, "Itinerary")) as ItineraryCard;
  const weather = (populated(payload.weather_details) ?? supplied?.weather ?? card<WeatherCard>(payload.weather_results, "Weather")) as WeatherCard;

  return {
    origin: supplied?.origin || constraints.origin || "",
    destination: supplied?.destination || constraints.destination || "",
    dates: supplied?.dates || constraints.travel_dates || "",
    travelers: supplied?.travelers || constraints.traveler_count || "",
    trip_summary: payload.trip_summary || supplied?.trip_summary || payload.answer || itinerary.summary || "",
    chat_message: supplied?.chat_message || payload.answer || "",
    flights,
    hotels,
    budget,
    itinerary,
    weather,
    packing: populated(payload.packing_list) ?? supplied?.packing ?? { items: [] },
    timeline: populated(payload.timeline) ?? supplied?.timeline ?? { events: [] },
    assumptions: supplied?.assumptions ?? budget.assumptions ?? [],
  };
}

export function chatCopy(payload: TripPayload | null | undefined, fallback: string) {
  if (!payload) return fallback;
  const document = asTripDocument(payload);
  return document.chat_message || payload.answer || fallback;
}
