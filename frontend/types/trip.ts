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
