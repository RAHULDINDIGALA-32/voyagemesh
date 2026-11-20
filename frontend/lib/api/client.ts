export const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export type RateLimitScope = "ip" | "user_active" | "user_daily" | "global";

export class ApiError extends Error {
  status?: number;
  code?: string;
  scope?: RateLimitScope;
  retryAfterSeconds?: number;
  recoverable?: boolean;
  traceId?: string;
}

export async function apiFetch<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: response.statusText }));
    const apiDetail = detail.detail && typeof detail.detail === "object"
      ? detail.detail as { code?: string; detail?: string; recoverable?: boolean; error?: string; scope?: RateLimitScope; retry_after_seconds?: number }
      : undefined;
    const message = typeof apiDetail?.detail === "string" ? apiDetail.detail
      : typeof detail.detail === "string"
      ? detail.detail
      : typeof detail.message === "string" ? detail.message : "Request failed";
    const error = new ApiError(message);
    error.status = response.status;
    error.code = apiDetail?.code ?? apiDetail?.error;
    error.scope = apiDetail?.scope;
    error.retryAfterSeconds = (apiDetail?.retry_after_seconds ?? Number(response.headers.get("Retry-After") ?? 0)) || undefined;
    error.recoverable = apiDetail?.recoverable;
    error.traceId = response.headers.get("X-Trace-ID") ?? undefined;
    throw error;
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}
