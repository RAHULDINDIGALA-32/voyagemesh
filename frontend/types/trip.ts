export type ConversationSummary = {
  conversation_id: string;
  trip_id: string;
  thread_id: string;
  title: string;
  status: string;
  updated_at: string;
  cover?: {
    destination?: string;
    origin?: string;
    travel_dates?: string;
    traveler_count?: string;
    budget?: string;
  };
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  kind: string;
  created_at: string;
};

export type FlightOption = {
  airline?: string;
  flight_number?: string;
  origin?: string;
  destination?: string;
  departs?: string;
  arrives?: string;
  duration?: string;
  cabin?: string;
  estimate?: string;
  notes?: string;
};

export type FlightCard = {
  headline?: string;
  summary?: string;
  metric?: string;
  metric_label?: string;
  options?: FlightOption[];
  notes?: string[];
};

export type HotelOption = {
  name?: string;
  area?: string;
  nights?: string;
  style?: string;
  estimate_per_night?: string;
  why?: string;
  source?: string;
};

export type HotelCard = {
  headline?: string;
  summary?: string;
  metric?: string;
  metric_label?: string;
  options?: HotelOption[];
  notes?: string[];
};

export type BudgetLine = {
  category: string;
  amount?: string;
  notes?: string;
};

export type BudgetCard = {
  headline?: string;
  summary?: string;
  metric?: string;
  metric_label?: string;
  estimated_total?: string;
  currency?: string;
  lines?: BudgetLine[];
  exclusions?: string[];
  assumptions?: string[];
};

export type ItineraryStop = {
  time?: string;
  title?: string;
  detail?: string;
  place?: string;
};

export type ItineraryDay = {
  day?: string;
  title?: string;
  summary?: string;
  stops?: ItineraryStop[];
};

export type ItineraryCard = {
  headline?: string;
  summary?: string;
  metric?: string;
  metric_label?: string;
  days?: ItineraryDay[];
  highlights?: string[];
};

export type WeatherCard = {
  headline?: string;
  summary?: string;
  metric?: string;
  metric_label?: string;
  packing_hints?: string[];
};

export type PackingItem = {
  item: string;
  reason?: string;
  category?: string;
};

export type TimelineEvent = {
  when?: string;
  title: string;
  detail?: string;
  kind?: string;
};

export type TripTimeline = {
  summary?: string;
  events?: TimelineEvent[];
};

export type TripDocument = {
  origin?: string;
  destination?: string;
  dates?: string;
  travelers?: string;
  trip_summary?: string;
  chat_message?: string;
  flights?: FlightCard;
  hotels?: HotelCard;
  budget?: BudgetCard;
  itinerary?: ItineraryCard;
  weather?: WeatherCard;
  packing?: { summary?: string; items?: PackingItem[] };
  timeline?: TripTimeline;
  assumptions?: string[];
};

export type TripPayload = {
  request_id: string;
  thread_id: string;
  status: string;
  answer?: string | null;
  flight_results?: string | null;
  hotel_results?: string | null;
  weather_results?: string | null;
  budget_analysis?: string | null;
  itinerary?: string | null;
  trip_document?: TripDocument | null;
  /** Canonical, field-wise API response. Legacy string fields above remain supported for old trips. */
  trip_summary?: string;
  flight_details?: FlightCard;
  hotel_details?: HotelCard;
  weather_details?: WeatherCard;
  budget_details?: BudgetCard;
  itinerary_details?: ItineraryCard;
  packing_list?: { summary?: string; items?: PackingItem[] };
  timeline?: TripTimeline;
  selected_agents?: string[];
  trip_constraints?: Record<string, string>;
  input_guardrail?: Record<string, string | boolean>;
  output_validation?: Record<string, string | boolean>;
  human_intervention?: Intervention;
  workflow_token?: string | null;
  errors?: string[];
  conversation_id?: string | null;
  trip_id?: string | null;
  title?: string | null;
};

export type Intervention = {
  type?: "constraint_clarification" | "budget_decision" | "itinerary_review" | string;
  status?: string;
  intervention_id?: string;
  version?: number;
  question?: string;
  required_fields?: string[];
  allowed_actions?: string[];
  context?: Record<string, string>;
  expires_at?: string;
};

export type TripRecord = ConversationSummary & {
  latest_payload?: TripPayload;
};
