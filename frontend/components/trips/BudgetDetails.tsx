import { Info, MinusCircle } from "lucide-react";
import type { BudgetCard } from "@/types/trip";

/** Pulls a number out of strings like "₹1,20,000", "$800–$1,000" (ranges are averaged). */
function parseAmount(value?: string): number | null {
  if (!value) return null;
  const nums = value.replace(/,/g, "").match(/\d+(\.\d+)?/g);
  if (!nums?.length) return null;
  const values = nums.map(Number);
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function hasBudgetData(b?: BudgetCard | null) {
  return Boolean(
    b?.estimated_total ||
      b?.metric ||
      b?.lines?.length ||
      b?.assumptions?.length ||
      b?.exclusions?.length,
  );
}

// Brass at stepped opacities keeps the palette on-theme while telling segments apart.
const shade = (i: number, n: number) => Math.max(0.28, 1 - (i * 0.72) / Math.max(n - 1, 1));

export function BudgetDetails({ budget }: { budget: BudgetCard }) {
  const lines = budget.lines ?? [];
  const total = budget.estimated_total || budget.metric;
  const totalLabel = budget.metric_label || "Estimated total";

  const parsed = lines.map((l) => parseAmount(l.amount));
  const sum = parsed.reduce<number>((a, v) => a + (v ?? 0), 0);
  const showShares = sum > 0 && parsed.filter((v) => v !== null).length >= 2;
  const pct = (i: number) => (showShares && parsed[i] ? (parsed[i]! / sum) * 100 : null);

  return (
    <div className="space-y-6">
      {/* Hero total */}
      <div className="rounded-xl border border-rule bg-paper-raised p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="font-mono text-[9px] uppercase tracking-[.18em] text-ink-soft">
            {totalLabel}
          </p>
          {budget.currency ? (
            <span className="rounded-full border border-brass/50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-brass">
              {budget.currency}
            </span>
          ) : null}
        </div>

        <p className="mt-1 font-display text-4xl leading-tight text-ink">
          {total || "Not specified"}
        </p>

        {budget.summary ? (
          <p className="mt-3 text-sm leading-6 text-ink-soft">{budget.summary}</p>
        ) : null}

        {showShares ? (
          <div
            className="mt-4 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full"
            role="img"
            aria-label="Budget distribution by category"
          >
            {lines.map((line, i) => {
              const p = pct(i);
              if (!p) return null;
              return (
                <span
                  key={i}
                  title={`${line.category} · ${Math.round(p)}%`}
                  className="h-full bg-brass first:rounded-l-full last:rounded-r-full"
                  style={{ width: `${p}%`, opacity: shade(i, lines.length) }}
                />
              );
            })}
          </div>
        ) : null}
      </div>

      {/* Breakdown */}
      <section>
        <h3 className="mb-1 font-mono text-[10px] uppercase tracking-[.16em] text-brass">
          Breakdown
        </h3>

        {lines.length ? (
          <ul className="divide-y divide-rule">
            {lines.map((line, i) => {
              const p = pct(i);
              return (
                <li key={`${line.category}-${i}`} className="py-3">
                  <div className="flex items-baseline justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-2">
                      {showShares ? (
                        <span
                          className="size-2.5 shrink-0 rounded-sm bg-brass"
                          style={{ opacity: shade(i, lines.length) }}
                          aria-hidden="true"
                        />
                      ) : null}
                      <span className="text-sm font-medium text-ink">{line.category}</span>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="font-mono text-sm text-ink">
                        {line.amount || "—"}
                      </span>
                      {p ? (
                        <span className="ml-2 font-mono text-[10px] text-ink-soft">
                          {Math.round(p)}%
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {line.notes ? (
                    <p className={`mt-1 text-xs leading-5 text-ink-soft ${showShares ? "pl-[1.125rem]" : ""}`}>
                      {line.notes}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink-soft">Budget details are not available yet.</p>
        )}
      </section>

      {/* Assumptions & exclusions */}
      {budget.assumptions?.length ? (
        <section className="rounded-xl border border-rule p-4">
          <h3 className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.16em] text-brass">
            <Info size={13} /> Assumptions
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-ink-soft">
            {budget.assumptions.map((a, i) => (
              <li key={`${a}-${i}`}>{a}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {budget.exclusions?.length ? (
        <section className="rounded-xl border border-dashed border-rule p-4">
          <h3 className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.16em] text-ink-soft">
            <MinusCircle size={13} /> Not included
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-ink-soft">
            {budget.exclusions.map((e, i) => (
              <li key={`${e}-${i}`}>{e}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}