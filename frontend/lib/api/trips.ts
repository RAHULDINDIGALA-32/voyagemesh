import { apiFetch } from "./client";
import type { ChatMessage, ConversationSummary, TripPayload, TripRecord } from "@/types/trip";

export function listConversations(token: string) {
  return apiFetch<ConversationSummary[]>("/api/v1/conversations", token);
}

export function getConversation(token: string, id: string) {
  return apiFetch<ConversationSummary & { messages: ChatMessage[] }>(
    `/api/v1/conversations/${id}`,
    token,
  );
}

export function renameConversation(token: string, id: string, title: string) {
  return apiFetch<ConversationSummary>(`/api/v1/conversations/${id}`, token, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export function deleteConversation(token: string, id: string) {
  return apiFetch<{ status: string }>(`/api/v1/conversations/${id}`, token, {
    method: "DELETE",
  });
}

export function listTrips(token: string) {
  return apiFetch<TripRecord[]>("/api/v1/trips", token);
}

export function getTrip(token: string, threadId: string) {
  return apiFetch<TripPayload>(`/api/v1/trips/${threadId}`, token);
}

export function respondToIntervention(
  accessToken: string,
  threadId: string,
  payload: {
    intervention_id: string;
    expected_version: number;
    action: string;
    data?: Record<string, string>;
  },
) {
  return apiFetch<TripPayload>(`/api/v1/trips/${threadId}/interventions`, accessToken, {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      data: payload.data ?? {},
    }),
  });
}

export function getTripStatus(token: string, threadId: string) {
  return apiFetch<{ thread_id: string; status: string; failure_reason?: string; errors?: string[] }>(
    `/api/v1/trips/${threadId}/status`, token,
  );
}

export function retryTrip(token: string, threadId: string) {
  return apiFetch<TripPayload>(`/api/v1/trips/${threadId}/retry`, token, { method: "POST" });
}

export function reopenIntervention(token: string, threadId: string) {
  return apiFetch<TripPayload>(`/api/v1/trips/${threadId}/interventions/reopen`, token, { method: "POST" });
}
