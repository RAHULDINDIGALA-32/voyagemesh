"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { respondToIntervention } from "@/lib/api/trips";
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
  const [fields, setFields] = useState<Record<string, string>>({});
  const [preference, setPreference] = useState("reduce_cost");
  const [instructions, setInstructions] = useState("");
  const [budget, setBudget] = useState("");
  const [showBudget, setShowBudget] = useState(false);

  if (!intervention || intervention.status !== "pending") return null;
  const current = intervention;

  async function submit(action: string, data: Record<string, string> = {}) {
    if (!current.intervention_id || !current.version || !payload.thread_id) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const next = await respondToIntervention(token, payload.thread_id, {
        intervention_id: current.intervention_id,
        expected_version: current.version,
        action,
        data,
      });
      onResolved(next);
    } catch (caught) {
      const status = (caught as Error & { status?: number }).status;
      if (status === 410) {
        setError("This review expired. Start a new voyage.");
      } else {
        setError(caught instanceof Error ? caught.message : "Unable to continue");
      }
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
                <dd>{value}</dd>
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
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="brass"
              disabled={pending}
              onClick={() => void submit("accept")}
            >
              Accept
            </Button>
            <Button type="button" disabled={pending} onClick={() => void submit("regenerate")}>
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
            <Button type="submit" disabled={pending}>
              Modify itinerary
            </Button>
          </form>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
    </section>
  );
}
