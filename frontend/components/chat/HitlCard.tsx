"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  getTrip,
  getTripStatus,
  reopenIntervention,
  respondToIntervention,
  retryTrip,
} from "@/lib/api/trips";
import type { TripPayload } from "@/types/trip";

const REVIEW_PREFERENCES = [
  { id: "reduce_cost", label: "Reduce cost" },
  { id: "more_free_time", label: "More free time" },
  { id: "more_sightseeing", label: "More sightseeing" },
  { id: "change_hotel", label: "Change hotel" },
  { id: "change_flight", label: "Change flight" },
  { id: "other", label: "Other" },
] as const;

const FIELD_LABELS: Record<string, string> = {
  origin: "Departure city",
  destination: "Destination",
  travel_dates: "Travel dates",
  traveler_count: "Travelers",
  budget: "Budget",
};

export function HitlCard({
  token,
  payload,
  onResolved,
}: {
  token: string;
  payload: TripPayload;
  onResolved: (next: TripPayload) => void;
}) {
  const intervention = payload.human_intervention;
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [recoverableAction, setRecoverableAction] = useState<"retry" | "reopen" | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [preference, setPreference] = useState("reduce_cost");
  const [instructions, setInstructions] = useState("");
  const [budget, setBudget] = useState("");
  const [showBudget, setShowBudget] = useState(false);

  if (!intervention || intervention.status !== "pending") return null;
  const current = intervention;

  async function submit(action: string, data: Record<string, string> = {}) {
    if (!current.intervention_id || !current.version || !payload.thread_id) {
      setError("This review is missing required state. Reload the voyage and try again.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const next = await respondToIntervention(
        token,
        payload.thread_id,
        {
          intervention_id: current.intervention_id,
          expected_version: current.version,
          action,
          data,
        },
      );
      onResolved(next);
      if (next.status === "resuming") {
        await waitForResume(token, payload.thread_id, onResolved);
      }
    } catch (caught) {
      const failure = caught as Error & { code?: string; recoverable?: boolean };
      if ((failure.code === "stale_hitl" || failure.code === "already_resolved") && payload.thread_id) {
        const live = await getTrip(token, payload.thread_id);
        onResolved(live);
      }
      setRecoverableAction(failure.code === "hitl_expired" ? "reopen" : failure.recoverable ? "retry" : null);
      setError(caught instanceof Error ? caught.message : "Unable to continue");
    } finally {
      setPending(false);
    }
  }

  async function waitForResume(
    accessToken: string,
    threadId: string,
    resolve: (next: TripPayload) => void,
  ) {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await new Promise((done) => window.setTimeout(done, 1500));
      const status = await getTripStatus(accessToken, threadId);
      if (status.status === "resuming" || status.status === "running") continue;
      const next = await getTrip(accessToken, threadId);
      resolve(next);
      if (status.status === "failed") {
        setRecoverableAction("retry");
        setError("The decision could not be applied. You can retry the workflow.");
      }
      return;
    }
    setError("The workflow is taking longer than expected. You can reload to check its status.");
  }

  async function recover() {
    if (!payload.thread_id || !recoverableAction) return;
    setPending(true);
    setError(null);
    try {
      const next = recoverableAction === "reopen"
        ? await reopenIntervention(token, payload.thread_id)
        : await retryTrip(token, payload.thread_id);
      onResolved(next);
      if (next.status === "resuming") await waitForResume(token, payload.thread_id, onResolved);
      setRecoverableAction(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to recover workflow");
    } finally {
      setPending(false);
    }
  }

  function onClarify(event: FormEvent) {
    event.preventDefault();
    const required = current.required_fields ?? [];
    const data: Record<string, string> = {};
    for (const field of required) {
      data[field] = (fields[field] ?? "").trim();
    }
    void submit("submit", data);
  }

  return (
    <section className="my-6 max-w-xl border border-rule bg-paper-raised p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brass">
        Human review · {intervention.type?.replaceAll("_", " ")}
      </p>
      <p className="mt-2 text-sm leading-relaxed">{intervention.question}</p>

      {intervention.type === "constraint_clarification" ? (
        <form onSubmit={onClarify} className="mt-4 flex flex-col gap-3">
          {(intervention.required_fields ?? []).map((field) => (
            <label key={field} className="flex flex-col gap-1 text-xs text-ink-soft">
              {FIELD_LABELS[field] ?? field}
              <input
                required
                maxLength={500}
                value={fields[field] ?? ""}
                onChange={(event) =>
                  setFields((current) => ({ ...current, [field]: event.target.value }))
                }
                className="rounded-[3px] border border-rule bg-paper px-2 py-1.5 text-sm text-ink"
              />
            </label>
          ))}
          <Button type="submit" variant="brass" disabled={pending}>
            Continue planning
          </Button>
        </form>
      ) : null}

      {intervention.type === "budget_decision" ? (
        <div className="mt-4 space-y-3">
          <dl className="grid grid-cols-2 gap-2 font-mono text-xs">
            {Object.entries(intervention.context ?? {}).map(([key, value]) => (
              <div key={key}>
                <dt className="text-ink-soft">{key.replaceAll("_", " ")}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-2">
            {(intervention.allowed_actions ?? []).map((action) => (
              <Button
                key={action}
                type="button"
                disabled={pending}
                onClick={() => {
                  if (action === "increase_budget") {
                    setShowBudget(true);
                    return;
                  }
                  void submit(action);
                }}
              >
                {action.replaceAll("_", " ")}
              </Button>
            ))}
          </div>
          {showBudget ? (
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void submit("increase_budget", { budget });
              }}
            >
              <input
                required
                value={budget}
                onChange={(event) => setBudget(event.target.value)}
                placeholder="INR 180000"
                className="flex-1 rounded-[3px] border border-rule bg-paper px-2 py-1.5 text-sm"
              />
              <Button type="submit" variant="brass" disabled={pending}>
                Set budget
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}

      {intervention.type === "itinerary_review" ? (
        <div className="mt-4 space-y-3">
          {(() => {
            const rawDays = current.context?.itinerary_days;
            const days = Array.isArray(rawDays)
              ? rawDays as Array<{ day?: string; title?: string; summary?: string; stops?: string[] }>
              : payload.itinerary_details?.days ?? [];
            return days.length ? (
              <div className="space-y-3 border-y border-rule py-3">
                {days.map((day, index) => (
                  <div key={`${day.day ?? "day"}-${index}`} className="text-sm">
                    <p className="font-medium">{day.day} · {day.title}</p>
                    {day.summary ? <p className="mt-1 text-xs leading-5 text-ink-soft">{day.summary}</p> : null}
                    {day.stops?.length ? <p className="mt-1 text-xs text-ink-soft">{day.stops.join(" · ")}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="border border-danger/40 p-3 text-sm text-danger">The itinerary preview is unavailable, so review cannot be accepted yet.</p>
            );
          })()}
          {payload.weather_details?.summary || current.context?.weather_preview ? (
            <p className="text-xs leading-5 text-ink-soft">
              {payload.weather_details?.headline || "Weather"}
              {payload.weather_details?.metric ? ` · ${payload.weather_details.metric}` : ""}
              {" — "}
              {payload.weather_details?.summary || String(current.context?.weather_preview ?? "")}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="brass"
              disabled={pending || !getPreviewDays(current, payload).length}
              onClick={() => void submit("accept")}
            >
              Accept
            </Button>
            <Button type="button" disabled={pending || !getPreviewDays(current, payload).length} onClick={() => void submit("regenerate")}>
              Regenerate
            </Button>
          </div>
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              void submit("modify", {
                preference,
                ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
              });
            }}
          >
            <select
              value={preference}
              onChange={(event) => setPreference(event.target.value)}
              className="w-full rounded-[3px] border border-rule bg-paper px-2 py-1.5 text-sm"
            >
              {REVIEW_PREFERENCES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <textarea
              maxLength={500}
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder="Optional instructions"
              className="h-20 w-full rounded-[3px] border border-rule bg-paper px-2 py-1.5 text-sm"
            />
            <Button type="submit" disabled={pending || !getPreviewDays(current, payload).length}>
              Modify itinerary
            </Button>
          </form>
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 space-y-2 text-sm text-danger">
          <p>{error}</p>
          {recoverableAction ? <Button type="button" onClick={() => void recover()} disabled={pending}>{recoverableAction === "reopen" ? "Reopen review" : "Retry"}</Button> : null}
        </div>
      ) : null}
    </section>
  );
}

function getPreviewDays(
  intervention: NonNullable<TripPayload["human_intervention"]>,
  payload: TripPayload,
) {
  const days = intervention.context?.itinerary_days;
  return Array.isArray(days) ? days : payload.itinerary_details?.days ?? [];
}
