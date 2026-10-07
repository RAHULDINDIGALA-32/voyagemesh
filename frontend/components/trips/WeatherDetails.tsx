"use client";

import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  Shirt,
  Sun,
  Thermometer,
  TriangleAlert,
  Umbrella,
  Wind,
  type LucideIcon,
} from "lucide-react";

import type { WeatherCard, WeatherDay } from "@/types/trip";

/* ---------------- helpers ---------------- */

const filled = (v?: string) => Boolean(v?.trim());

/** "31" + "C" -> "31°C"; leaves "31°C" / "88F" untouched. */
const deg = (value?: string, unit?: string) => {
  const t = value?.trim();
  if (!t) return "";
  if (/°|[CF]$/i.test(t)) return t;
  const u = unit?.trim().toUpperCase();
  return u ? `${t}°${u}` : `${t}°`;
};

/** "40" -> "40%"; leaves "40%" untouched. */
const pct = (value?: string) => {
  const t = value?.trim();
  if (!t) return "";
  return /^\d+(\.\d+)?$/.test(t) ? `${t}%` : t;
};

function conditionIcon(text?: string): LucideIcon {
  const s = (text ?? "").toLowerCase();
  if (/thunder|storm/.test(s)) return CloudLightning;
  if (/snow|sleet|ice|hail/.test(s)) return CloudSnow;
  if (/rain|drizzle|shower/.test(s)) return CloudRain;
  if (/fog|mist|haze|smoke/.test(s)) return CloudFog;
  if (/partly|few clouds|scattered|mostly sunny/.test(s)) return CloudSun;
  if (/cloud|overcast/.test(s)) return Cloud;
  if (/clear|sun/.test(s)) return Sun;
  return CloudSun;
}

export function hasWeatherData(w?: WeatherCard): boolean {
  if (!w) return false;
  return (
    [
      w.summary,
      w.metric,
      w.condition,
      w.season,
      w.temp_high,
      w.temp_low,
      w.feels_like,
      w.humidity,
      w.wind,
      w.precip_chance,
      w.uv_index,
    ].some(filled) ||
    Boolean(w.forecast?.length || w.alerts?.length || w.packing_hints?.length)
  );
}

/* ---------------- small pieces ---------------- */

function Label({ children }: { children: string }) {
  return (
    <p className="font-mono text-[9px] uppercase tracking-[.16em] text-ink-soft">
      {children}
    </p>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-rule bg-paper-raised px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-brass">
        <Icon size={13} aria-hidden="true" />
        <span className="font-mono text-[9px] uppercase tracking-wider text-ink-soft">
          {label}
        </span>
      </div>
      <p className="mt-1 text-sm font-medium text-ink">{value}</p>
    </div>
  );
}

function ForecastDay({ day, unit }: { day: WeatherDay; unit?: string }) {
  const Icon = conditionIcon(day.condition);
  const high = deg(day.high, unit);
  const low = deg(day.low, unit);
  const rain = pct(day.precip_chance);

  return (
    <li className="flex flex-col items-center gap-1.5 rounded-xl border border-rule bg-paper-raised px-2 py-3 text-center">
      {filled(day.date) ? (
        <span className="font-mono text-[10px] uppercase tracking-wide text-ink-soft">
          {day.date}
        </span>
      ) : null}

      <Icon size={22} className="text-brass" aria-hidden="true" />

      {high || low ? (
        <p className="text-sm font-medium text-ink">
          {high}
          {high && low ? (
            <span className="font-normal text-ink-soft"> / {low}</span>
          ) : (
            low
          )}
        </p>
      ) : null}

      {filled(day.condition) ? (
        <p className="text-[11px] leading-4 text-ink-soft">{day.condition}</p>
      ) : null}

      {rain ? (
        <p className="flex items-center gap-1 font-mono text-[10px] text-brass">
          <Droplets size={11} aria-hidden="true" />
          {rain}
        </p>
      ) : null}
    </li>
  );
}

/* ---------------- main card body ---------------- */

export function WeatherDetails({ weather: w }: { weather: WeatherCard }) {
  const HeroIcon = conditionIcon(w.condition || w.summary);

  const high = deg(w.temp_high, w.temp_unit);
  const low = deg(w.temp_low, w.temp_unit);
  // Older trips only stored a single `metric` like "23 °C".
  const legacyMetric = !high && !low ? w.metric?.trim() : "";

  const stats: Array<{ icon: LucideIcon; label: string; value: string }> = [
    { icon: Thermometer, label: "Feels like", value: deg(w.feels_like, w.temp_unit) },
    { icon: Droplets, label: "Humidity", value: pct(w.humidity) },
    { icon: Wind, label: "Wind", value: w.wind?.trim() ?? "" },
    { icon: Umbrella, label: "Rain chance", value: pct(w.precip_chance) },
    { icon: Sun, label: "UV index", value: w.uv_index?.trim() ?? "" },
  ].filter((s) => s.value);

  const forecast = (w.forecast ?? []).filter(
    (d) => filled(d.date) || filled(d.condition) || filled(d.high) || filled(d.low),
  );
  const alerts = (w.alerts ?? []).filter(filled);
  const hints = (w.packing_hints ?? []).filter(filled);

  const showHero = high || low || legacyMetric || filled(w.condition) || filled(w.season);

  return (
    <div className="space-y-5">
      {/* Hero: icon, temperature, condition, season */}
      {showHero ? (
        <div className="flex items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-full border border-brass bg-paper-raised text-brass">
            <HeroIcon size={26} aria-hidden="true" />
          </span>

          <div className="min-w-0">
            {high || low ? (
              <p className="font-display text-4xl leading-none text-ink">
                {high || low}
                {high && low ? (
                  <span className="ml-2 font-body text-base text-ink-soft">
                    / {low}
                  </span>
                ) : null}
              </p>
            ) : legacyMetric ? (
              <p className="font-display text-4xl leading-none text-ink">
                {legacyMetric}
              </p>
            ) : null}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {filled(w.condition) ? (
                <span className="text-sm text-ink">{w.condition}</span>
              ) : legacyMetric && filled(w.metric_label) ? (
                <span className="text-sm text-ink-soft">{w.metric_label}</span>
              ) : null}

              {filled(w.season) ? (
                <span className="rounded-full border border-brass/50 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-brass">
                  {w.season}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {filled(w.summary) ? (
        <p className="text-sm leading-6 text-ink-soft">{w.summary}</p>
      ) : null}

      {/* Alerts */}
      {alerts.length ? (
        <ul className="space-y-2" role="list">
          {alerts.map((alert, i) => (
            <li
              key={`${alert}-${i}`}
              className="flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/5 px-3 py-2 text-xs leading-5 text-danger"
            >
              <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{alert}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Stat tiles: only the ones that have data */}
      {stats.length ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {stats.map((s) => (
            <Stat key={s.label} {...s} />
          ))}
        </div>
      ) : null}

      {/* Day-by-day */}
      {forecast.length ? (
        <div>
          <Label>Forecast</Label>
          <ul
            className="mt-2 grid grid-flow-col auto-cols-[minmax(5.5rem,1fr)] gap-2 overflow-x-auto pb-1"
            role="list"
          >
            {forecast.map((day, i) => (
              <ForecastDay key={`${day.date}-${i}`} day={day} unit={w.temp_unit} />
            ))}
          </ul>
        </div>
      ) : null}

      {/* Packing hints as chips */}
      {hints.length ? (
        <div className="border-t border-rule pt-4">
          <Label>Pack for it</Label>
          <ul className="mt-2 flex flex-wrap gap-2" role="list">
            {hints.map((hint, i) => (
              <li
                key={`${hint}-${i}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-paper-raised px-3 py-1 text-xs text-ink-soft"
              >
                <Shirt size={12} className="text-brass" aria-hidden="true" />
                {hint}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}