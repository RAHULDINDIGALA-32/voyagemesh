import { apiBase } from "./client";
import { ApiError, type RateLimitScope } from "./client";
import type { TripPayload } from "@/types/trip";

export type SseEvent = {
  event: string;
  data: Record<string, unknown>;
};

async function throwApiResponse(response: Response): Promise<never> {
  const body = await response.json().catch(() => null) as { detail?: unknown } | null;
  const detail = body?.detail && typeof body.detail === "object"
    ? body.detail as { message?: string; scope?: RateLimitScope; retry_after_seconds?: number; error?: string }
    : null;
  const error = new ApiError(detail?.message ?? (typeof body?.detail === "string" ? body.detail : `Request failed (${response.status})`));
  error.status = response.status;
  error.code = detail?.error;
  error.scope = detail?.scope;
  error.retryAfterSeconds = (detail?.retry_after_seconds ?? Number(response.headers.get("Retry-After") ?? 0)) || undefined;
  error.traceId = response.headers.get("X-Trace-ID") ?? undefined;
  throw error;
}

export async function readSseStream(
  response: Response,
  onEvent: (event: SseEvent) => void,
) {
  if (!response.body) {
    throw new Error("No stream");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "message";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      let dataLine = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLine += line.slice(5).trim();
        }
      }
      if (!dataLine) continue;
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(dataLine) as Record<string, unknown>;
      } catch {
        onEvent({ event: "error", data: { detail: "Received an invalid stream event" } });
        continue;
      }
      onEvent({ event: eventName, data });
      eventName = "message";
    }
  }
  if (buffer.trim()) {
    // A proxy may flush the final SSE frame without a trailing blank line.
    const dataLine = buffer.split("\n").find((line) => line.startsWith("data:"));
    if (dataLine) {
      try { onEvent({ event: eventName, data: JSON.parse(dataLine.slice(5).trim()) }); } catch { /* ignore incomplete frame */ }
    }
  }
}

export async function streamTrip(
  accessToken: string,
  query: string,
  onEvent: (event: SseEvent) => void,
  signal?: AbortSignal,
) {
  const response = await fetch(`${apiBase}/api/v1/trips/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    signal,
    body: JSON.stringify({ query }),
  });
  if (!response.ok) {
    await throwApiResponse(response);
  }
  await readSseStream(response, onEvent);
}

export async function streamFollowUp(
  accessToken: string,
  threadId: string,
  query: string,
  onEvent: (event: SseEvent) => void,
  signal?: AbortSignal,
) {
  const response = await fetch(`${apiBase}/api/v1/trips/${threadId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query }),
    signal,
  });
  if (!response.ok) {
    await throwApiResponse(response);
  }
  await readSseStream(response, onEvent);
}

export function asTripPayload(data: Record<string, unknown>): TripPayload {
  return data as unknown as TripPayload;
}
