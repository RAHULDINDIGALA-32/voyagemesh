"use client";

import {
  pdf,
  Document,
  Page,
  Text,
  View,
  Svg,
  Path,
  Circle,
  Line,
  Polygon,
  Link,
  Font,
  StyleSheet,
  TextProps,
} from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { asTripDocument } from "@/lib/plan/parse";
import type {
  TripDocument,
  TripPayload,
  WeatherCard,
  PackingItem,
} from "@/types/trip";

/* ------------------------------------------------------------------ */
/*  Tokens (light theme, matches web: paper / ink / brass / olive)      */
/* ------------------------------------------------------------------ */

const C = {
  paper: "#F3EFE6",
  raised: "#FBF8F1",
  ink: "#1A1814",
  soft: "#5E574B",
  rule: "#D9D1BF",
  brass: "#9A7230",
  brassSoft: "#EADFC3",
  olive: "#5B6B3A",
  danger: "#9B3B2E",
};

const SERIF = "Times-Roman";
const SERIF_B = "Times-Bold";
const SERIF_I = "Times-Italic";
const MONO = "Courier";
const MONO_B = "Courier-Bold";

Font.registerHyphenationCallback((word) => [word]); // no mid-word breaks

/* ------------------------------------------------------------------ */
/*  Text safety + small helpers                                         */
/* ------------------------------------------------------------------ */

const GLYPH_MAP: Record<string, string> = {
  "₹": "Rs ",
  "→": " to ",
  "←": " from ",
  "≈": "~",
  "−": "-",
  "‑": "-",
  "✓": "",
};

/** Keep Latin-1 + common WinAnsi punctuation; transliterate or drop the rest. */
export const safe = (v?: string | null) =>
  (v ?? "").replace(
    /[^\x00-\xFF\u2013\u2014\u2018-\u201E\u2022\u2026\u20AC\u2122]/gu,
    (ch) => GLYPH_MAP[ch] ?? "",
  );

const join = (...parts: Array<string | undefined | null>) =>
  parts
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" · ");

const has = (v?: string | null) => !!v?.trim();

const deg = (v?: string, unit?: string) =>
  v && /^-?\d+(\.\d+)?$/.test(v.trim()) ? `${v.trim()}°${unit ?? ""}` : v;

const today = () =>
  new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });


function T({
  style,
  children,
}: Pick<TextProps, "style"> & {
  children?: string | null;
}) {
  return <Text style={style}>{safe(children)}</Text>;
}

/* ------------------------------------------------------------------ */
/*  Styles                                                              */
/* ------------------------------------------------------------------ */

const s = StyleSheet.create({
  /* pages */
  cover: { backgroundColor: C.paper, color: C.ink, padding: 52, fontFamily: SERIF },
  page: {
    backgroundColor: C.paper,
    color: C.ink,
    paddingTop: 66,
    paddingBottom: 58,
    paddingHorizontal: 42,
    fontSize: 10,
    fontFamily: SERIF,
  },

  /* running header / footer */
  runHead: {
    position: "absolute",
    top: 24,
    left: 42,
    right: 42,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 6,
    borderBottomWidth: 0.75,
    borderBottomColor: C.rule,
  },
  runFoot: {
    position: "absolute",
    bottom: 24,
    left: 42,
    right: 42,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
    borderTopWidth: 0.75,
    borderTopColor: C.rule,
  },
  mono7: { fontFamily: MONO, fontSize: 7, letterSpacing: 1.6, color: C.soft },
  monoBrass7: { fontFamily: MONO, fontSize: 7, letterSpacing: 1.6, color: C.brass },

  /* cover */
  frame: {
    position: "absolute",
    top: 20,
    left: 20,
    right: 20,
    bottom: 20,
    borderWidth: 0.75,
    borderColor: C.rule,
  },
  kicker: { fontFamily: MONO, fontSize: 8, letterSpacing: 2.4, color: C.brass },
  coverTitle: { fontFamily: SERIF_B, fontSize: 40, lineHeight: 1.05, marginTop: 10 },
  coverSummary: {
    fontFamily: SERIF_I,
    fontSize: 12,
    lineHeight: 1.5,
    color: C.soft,
    marginTop: 14,
    maxWidth: 400,
  },
  routeLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  routeLabel: { fontFamily: MONO, fontSize: 7, letterSpacing: 1.6, color: C.soft },
  routePlace: { fontFamily: SERIF_B, fontSize: 15, marginTop: 3 },
  strip: {
    flexDirection: "row",
    marginTop: 28,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.ink,
  },
  stripCell: { flex: 1, paddingVertical: 9, paddingHorizontal: 10 },
  stripCellDiv: { borderLeftWidth: 0.75, borderLeftColor: C.rule },
  stripVal: { fontFamily: SERIF_B, fontSize: 12, marginTop: 3 },
  tocRow: {
    flexDirection: "row",
    alignItems: "baseline",
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: C.rule,
  },
  tocNo: { width: 28, fontFamily: MONO_B, fontSize: 9, color: C.brass },
  tocTitle: { fontFamily: SERIF_B, fontSize: 12, width: 120, color: C.ink },
  tocBlurb: { flex: 1, fontFamily: SERIF_I, fontSize: 9.5, color: C.soft },

  /* sections */
  section: { marginBottom: 22 },
  secHead: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingBottom: 6,
    marginBottom: 10,
    borderBottomWidth: 1.25,
    borderBottomColor: C.brass,
  },
  secNo: { fontFamily: MONO_B, fontSize: 9, color: C.brass, letterSpacing: 1.5 },
  secTitle: { fontFamily: SERIF_B, fontSize: 22, marginTop: 2 },
  metricVal: { fontFamily: MONO_B, fontSize: 11, textAlign: "right" },
  metricLbl: { fontFamily: MONO, fontSize: 6.5, letterSpacing: 1.4, color: C.soft, textAlign: "right", marginTop: 2 },
  summary: { fontSize: 10.5, lineHeight: 1.5, color: C.soft, marginBottom: 10 },
  sub: { fontFamily: MONO_B, fontSize: 7.5, letterSpacing: 1.8, color: C.brass, marginTop: 10, marginBottom: 6 },
  note: { fontSize: 9, lineHeight: 1.45, color: C.soft, marginBottom: 2 },
  empty: { fontFamily: SERIF_I, color: C.soft },

  /* flight pass */
  pass: {
    flexDirection: "row",
    borderWidth: 0.75,
    borderColor: C.rule,
    borderRadius: 4,
    backgroundColor: C.raised,
    marginBottom: 8,
  },
  passMain: { flex: 1, padding: 10 },
  passStub: {
    width: 118,
    padding: 10,
    justifyContent: "center",
    borderLeftWidth: 1,
    borderLeftColor: C.rule,
    borderLeftStyle: "dashed",
    backgroundColor: C.brassSoft,
  },
  passAirline: { flexDirection: "row", justifyContent: "space-between" },
  passRoute: { flexDirection: "row", alignItems: "center", marginTop: 8, marginBottom: 6 },
  passCity: { flex: 1, fontFamily: SERIF_B, fontSize: 14 },
  passTimes: { fontFamily: MONO, fontSize: 8, color: C.soft },

  /* stay card */
  stay: {
    flexDirection: "row",
    borderWidth: 0.75,
    borderColor: C.rule,
    borderRadius: 4,
    backgroundColor: C.raised,
    padding: 10,
    marginBottom: 8,
  },
  stayIdx: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: C.brass,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  stayName: { fontFamily: SERIF_B, fontSize: 13 },
  stayPrice: { fontFamily: MONO_B, fontSize: 10, textAlign: "right" },

  /* weather */
  tiles: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -3 },
  tileWrap: { width: "25%", padding: 3 },
  tile: { borderWidth: 0.75, borderColor: C.rule, borderRadius: 3, backgroundColor: C.raised, padding: 7 },
  tileVal: { fontFamily: SERIF_B, fontSize: 13, marginTop: 3 },
  fcRow: { flexDirection: "row", flexWrap: "wrap" },
  fcCell: { padding: 7, borderWidth: 0.5, borderColor: C.rule, backgroundColor: C.raised },
  alert: {
    borderLeftWidth: 2.5,
    borderLeftColor: C.danger,
    paddingLeft: 8,
    paddingVertical: 2,
    marginBottom: 4,
    fontSize: 9.5,
    color: C.danger,
  },

  /* budget ledger */
  ledHead: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: C.ink },
  ledRow: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: C.rule },
  ledTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    marginTop: 2,
    borderTopWidth: 1.5,
    borderTopColor: C.ink,
  },

  /* day + rail */
  dayHead: { flexDirection: "row", alignItems: "center", marginTop: 12, marginBottom: 8 },
  dayBadge: {
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 3,
    borderWidth: 0.75,
    borderColor: C.brass,
    backgroundColor: C.brassSoft,
    marginRight: 9,
  },
  dayTitle: { fontFamily: SERIF_B, fontSize: 13 },
  rail: { marginLeft: 66, borderLeftWidth: 1, borderLeftColor: C.brass, borderLeftStyle: "solid" },
  railItem: { paddingLeft: 14, paddingBottom: 9, position: "relative" },
  railLeft: {
    position: "absolute",
    left: -66,
    top: 1.5,
    width: 55,
    textAlign: "right",
    fontFamily: MONO,
    fontSize: 7.5,
    color: C.brass,
  },
  railDot: {
    position: "absolute",
    left: -3.5,
    top: 2.5,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.brass,
  },
  railTitle: { fontFamily: SERIF_B, fontSize: 10.5 },
  railDetail: { fontSize: 9.5, lineHeight: 1.45, color: C.soft, marginTop: 1 },
  railMeta: { fontFamily: MONO, fontSize: 7.5, color: C.olive, marginTop: 2 },
  chip: {
    fontFamily: MONO,
    fontSize: 7.5,
    color: C.brass,
    borderWidth: 0.75,
    borderColor: C.brass,
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginRight: 5,
    marginBottom: 5,
  },

  /* packing */
  packGrid: { flexDirection: "row", flexWrap: "wrap" },
  packItem: { width: "50%", flexDirection: "row", paddingRight: 10, marginBottom: 6 },
  check: { width: 9, height: 9, borderWidth: 1, borderColor: C.ink, borderRadius: 1.5, marginRight: 7, marginTop: 1.5 },

    /* voyage note / closing page */
  voyageNote: {
    marginTop: 36,
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 28,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.rule,
    alignItems: "center",
  },

  voyageNoteKicker: {
    fontFamily: MONO,
    fontSize: 7.5,
    letterSpacing: 2.2,
    color: C.brass,
    textAlign: "center",
    marginBottom: 16,
  },

  voyageNoteText: {
    fontFamily: SERIF_I,
    fontSize: 15,
    lineHeight: 1.6,
    color: C.ink,
    textAlign: "center",
    maxWidth: 410,
  },

  voyageNoteSub: {
    fontFamily: SERIF_B,
    fontSize: 10,
    lineHeight: 1.5,
    color: C.soft,
    textAlign: "center",
    marginTop: 18,
  },

  voyageNoteBrand: {
    fontFamily: SERIF_I,
    fontSize: 11,
    color: C.brass,
    textAlign: "center",
    marginTop: 12,
  },
});

/* ------------------------------------------------------------------ */
/*  SVG ornaments                                                       */
/* ------------------------------------------------------------------ */

function Compass({ size = 84 }: { size?: number }) {
  const c = 50;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx={c} cy={c} r={46} stroke={C.brass} strokeWidth={0.8} fill="none" />
      <Circle cx={c} cy={c} r={38} stroke={C.rule} strokeWidth={0.6} fill="none" />
      <Line x1={c} y1={2} x2={c} y2={98} stroke={C.rule} strokeWidth={0.6} />
      <Line x1={2} y1={c} x2={98} y2={c} stroke={C.rule} strokeWidth={0.6} />
      <Polygon points="50,6 56,44 50,50 44,44" fill={C.brass} />
      <Polygon points="50,94 44,56 50,50 56,56" fill={C.brassSoft} stroke={C.brass} strokeWidth={0.5} />
      <Polygon points="94,50 56,56 50,50 56,44" fill={C.brassSoft} stroke={C.brass} strokeWidth={0.5} />
      <Polygon points="6,50 44,44 50,50 44,56" fill={C.brassSoft} stroke={C.brass} strokeWidth={0.5} />
      <Circle cx={c} cy={c} r={2.4} fill={C.paper} stroke={C.brass} strokeWidth={0.8} />
    </Svg>
  );
}

function Arrow({ width = 30 }: { width?: number }) {
  return (
    <Svg width={width} height={10} viewBox="0 0 30 10" style={{ marginHorizontal: 8 }}>
      <Line x1={0} y1={5} x2={27} y2={5} stroke={C.brass} strokeWidth={1} />
      <Path d="M23 1 L29 5 L23 9" stroke={C.brass} strokeWidth={1} fill="none" />
    </Svg>
  );
}

function RouteGraphic() {
  return (
    <Svg width={490} height={64} viewBox="0 0 490 64">
      <Path
        d="M 12 46 C 130 -6, 340 82, 478 18"
        stroke={C.brass}
        strokeWidth={1.4}
        strokeDasharray="2 6"
        fill="none"
      />
      <Circle cx={12} cy={46} r={7} fill={C.raised} stroke={C.brass} strokeWidth={1.2} />
      <Circle cx={12} cy={46} r={2.4} fill={C.brass} />
      <Circle cx={478} cy={18} r={7} fill={C.raised} stroke={C.brass} strokeWidth={1.2} />
      <Path d="M475 13 L475 24 M475 13 L483 15.5 L475 18" stroke={C.brass} strokeWidth={1} fill="none" />
      {/* mid-route marker */}
      <Circle cx={245} cy={31} r={4} fill={C.brassSoft} stroke={C.brass} strokeWidth={1} />
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Reusable blocks                                                     */
/* ------------------------------------------------------------------ */

type Sec = { key: string; id: string; no: string; title: string; blurb: string };

function SectionHead({
  sec,
  metric,
  label,
}: {
  sec: Sec;
  metric?: string;
  label?: string;
}) {
  return (
    <View style={s.secHead} wrap={false} minPresenceAhead={90}>
      <View>
        <T style={s.secNo}>{`SECTION ${sec.no}`}</T>
        <T style={s.secTitle}>{sec.title}</T>
      </View>
      {has(metric) ? (
        <View>
          <T style={s.metricVal}>{metric}</T>
          {has(label) ? <T style={s.metricLbl}>{label!.toUpperCase()}</T> : null}
        </View>
      ) : null}
    </View>
  );
}

const Summary = ({ text }: { text?: string }) =>
  has(text) ? <T style={s.summary}>{text}</T> : null;

const Notes = ({ items, title }: { items?: string[]; title?: string }) =>
  items?.length ? (
    <View>
      {title ? <T style={s.sub}>{title.toUpperCase()}</T> : null}
      {items.map((n, i) => (
        <T key={i} style={s.note}>{`•  ${n}`}</T>
      ))}
    </View>
  ) : null;

type RailItem = { left?: string; title?: string; detail?: string; meta?: string };

function Rail({ items }: { items: RailItem[] }) {
  return (
    <View style={s.rail}>
      {items.map((it, i) => (
        <View key={i} style={s.railItem} wrap={false}>
          <T style={s.railLeft}>{it.left}</T>
          <View style={s.railDot} />
          {has(it.title) ? <T style={s.railTitle}>{it.title}</T> : null}
          {has(it.detail) ? <T style={s.railDetail}>{it.detail}</T> : null}
          {has(it.meta) ? <T style={s.railMeta}>{it.meta}</T> : null}
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Sections                                                            */
/* ------------------------------------------------------------------ */

function Flights({ trip, sec }: { trip: TripDocument; sec: Sec }) {
  const f = trip.flights;
  return (
    <>
      <SectionHead sec={sec} metric={f?.metric} label={f?.metric_label} />
      <Summary text={f?.summary} />
      {(f?.options ?? []).map((o, i) => (
        <View key={i} style={s.pass} wrap={false}>
          <View style={s.passMain}>
            <View style={s.passAirline}>
              <T style={{ fontFamily: SERIF_B, fontSize: 12 }}>{o.airline || "Route option"}</T>
              <T style={s.monoBrass7}>{(o.flight_number || `OPTION ${i + 1}`).toUpperCase()}</T>
            </View>
            {o.origin || o.destination ? (
              <View style={s.passRoute}>
                <T style={s.passCity}>{o.origin || "—"}</T>
                <Arrow />
                <T style={[s.passCity, { textAlign: "right" }]}>{o.destination || "—"}</T>
              </View>
            ) : null}
            <T style={s.passTimes}>
              {join(
                o.departs && `Dep ${o.departs}`,
                o.arrives && `Arr ${o.arrives}`,
                o.duration,
              )}
            </T>
            {has(o.notes) ? <T style={[s.note, { marginTop: 5 }]}>{o.notes}</T> : null}
          </View>
          <View style={s.passStub}>
            <T style={s.monoBrass7}>{(o.cabin || "FARE").toUpperCase()}</T>
            <T style={{ fontFamily: SERIF_B, fontSize: 13, marginTop: 4 }}>
              {o.estimate || "On request"}
            </T>
          </View>
        </View>
      ))}
      <Notes items={f?.notes} title="Flight notes" />
    </>
  );
}

function Stays({ trip, sec }: { trip: TripDocument; sec: Sec }) {
  const h = trip.hotels;
  return (
    <>
      <SectionHead sec={sec} metric={h?.metric} label={h?.metric_label} />
      <Summary text={h?.summary} />
      {(h?.options ?? []).map((o, i) => (
        <View key={i} style={s.stay} wrap={false}>
          <View style={s.stayIdx}>
            <T style={{ fontFamily: MONO_B, fontSize: 8, color: C.brass }}>{String(i + 1).padStart(2, "0")}</T>
          </View>
          <View style={{ flex: 1 }}>
            <T style={s.stayName}>{o.name || "Stay option"}</T>
            <T style={[s.mono7, { marginTop: 3 }]}>
              {join(o.area, o.nights, o.style).toUpperCase()}
            </T>
            {has(o.why) ? <T style={[s.note, { marginTop: 5 }]}>{o.why}</T> : null}
            {has(o.source) ? <T style={[s.mono7, { marginTop: 3 }]}>{`SOURCE: ${o.source}`}</T> : null}
          </View>
          {has(o.estimate_per_night) ? (
            <View style={{ width: 92, marginLeft: 8 }}>
              <T style={s.stayPrice}>{o.estimate_per_night}</T>
              <T style={[s.mono7, { textAlign: "right", marginTop: 2 }]}>PER NIGHT</T>
            </View>
          ) : null}
        </View>
      ))}
      <Notes items={h?.notes} title="Stay notes" />
    </>
  );
}

const hasWeather = (w?: WeatherCard) =>
  !!w &&
  [w.summary, w.headline, w.metric, w.condition, w.season, w.temp_high, w.temp_low].some(has) ||
  !!w?.forecast?.length ||
  !!w?.alerts?.length ||
  !!w?.packing_hints?.length;

function Weather({ trip, sec }: { trip: TripDocument; sec: Sec }) {
  const w = trip.weather!;
  const u = w.temp_unit;
  const tiles: Array<[string, string | undefined]> = [
    ["Conditions", w.condition],
    ["Season", w.season],
    ["High", deg(w.temp_high, u)],
    ["Low", deg(w.temp_low, u)],
    ["Feels like", deg(w.feels_like, u)],
    ["Humidity", w.humidity],
    ["Wind", w.wind],
    ["Rain chance", w.precip_chance],
    ["UV index", w.uv_index],
  ];
  const shownTiles = tiles.filter(([, v]) => has(v));
  const fc = w.forecast ?? [];
  const cols = Math.min(Math.max(fc.length, 1), 7);

  return (
    <>
      <SectionHead sec={sec} metric={w.metric} label={w.metric_label} />
      {has(w.headline) ? (
        <T style={{ fontFamily: SERIF_I, fontSize: 13, marginBottom: 6 }}>{w.headline}</T>
      ) : null}
      <Summary text={w.summary} />

      {shownTiles.length ? (
        <View style={s.tiles} wrap={false}>
          {shownTiles.map(([label, value]) => (
            <View key={label} style={s.tileWrap}>
              <View style={s.tile}>
                <T style={s.mono7}>{label.toUpperCase()}</T>
                <T style={s.tileVal}>{value}</T>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {fc.length ? (
        <>
          <T style={s.sub}>FORECAST</T>
          <View style={s.fcRow}>
            {fc.map((d, i) => (
              <View key={i} style={[s.fcCell, { width: `${100 / cols}%` }]} wrap={false}>
                <T style={s.monoBrass7}>{(d.date || `Day ${i + 1}`).toUpperCase()}</T>
                <T style={{ fontSize: 9, marginTop: 3 }}>{d.condition}</T>
                <T style={{ fontFamily: SERIF_B, fontSize: 10.5, marginTop: 3 }}>
                  {join(deg(d.high, u), deg(d.low, u))}
                </T>
                {has(d.precip_chance) ? (
                  <T style={[s.mono7, { marginTop: 2 }]}>{`RAIN ${d.precip_chance}`}</T>
                ) : null}
              </View>
            ))}
          </View>
        </>
      ) : null}

      {w.alerts?.length ? (
        <View style={{ marginTop: 10 }}>
          {w.alerts.map((a, i) => (
            <T key={i} style={s.alert}>{a}</T>
          ))}
        </View>
      ) : null}
      <Notes items={w.packing_hints} title="Pack for the weather" />
    </>
  );
}

function Budget({ trip, sec }: { trip: TripDocument; sec: Sec }) {
  const b = trip.budget;
  const total = b?.estimated_total || b?.metric;
  const lines = b?.lines ?? [];
  return (
    <>
      <SectionHead sec={sec} metric={total} label={b?.metric_label || (b?.currency ? `Currency ${b.currency}` : undefined)} />
      <Summary text={b?.summary} />
      {lines.length ? (
        <View>
          <View style={s.ledHead}>
            <T style={[s.mono7, { flex: 1.1 }]}>CATEGORY</T>
            <T style={[s.mono7, { width: 90, textAlign: "right" }]}>AMOUNT</T>
            <T style={[s.mono7, { flex: 1.6, paddingLeft: 12 }]}>NOTES</T>
          </View>
          {lines.map((l, i) => (
            <View
              key={i}
              style={[s.ledRow, i % 2 ? { backgroundColor: C.raised } : {}]}
              wrap={false}
            >
              <T style={{ flex: 1.1, fontFamily: SERIF_B }}>{l.category}</T>
              <T style={{ width: 90, textAlign: "right", fontFamily: MONO_B, fontSize: 9 }}>{l.amount}</T>
              <T style={{ flex: 1.6, paddingLeft: 12, fontSize: 9, color: C.soft }}>{l.notes}</T>
            </View>
          ))}
          {has(total) ? (
            <View style={s.ledTotal} wrap={false}>
              <T style={{ fontFamily: SERIF_B, fontSize: 13 }}>Estimated total</T>
              <T style={{ fontFamily: MONO_B, fontSize: 13, color: C.brass }}>{total}</T>
            </View>
          ) : null}
        </View>
      ) : null}
      <Notes items={b?.exclusions} title="Not included" />
      <Notes items={b?.assumptions} title="Budget assumptions" />
    </>
  );
}

function Itinerary({ trip, sec }: { trip: TripDocument; sec: Sec }) {
  const it = trip.itinerary;
  const days = it?.days ?? [];
  return (
    <>
      <SectionHead sec={sec} metric={it?.metric} label={it?.metric_label} />
      <Summary text={it?.summary} />
      {it?.highlights?.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 4 }}>
          {it.highlights.map((h, i) => (
            <T key={i} style={s.chip}>{h}</T>
          ))}
        </View>
      ) : null}
      {days.map((d, i) => (
        <View key={i}>
          <View style={s.dayHead} wrap={false} minPresenceAhead={70}>
            <View style={s.dayBadge}>
              <T style={s.monoBrass7}>{(d.day || `Day ${i + 1}`).toUpperCase()}</T>
            </View>
            <T style={s.dayTitle}>{d.title || ""}</T>
          </View>
          <Summary text={d.summary} />
          <Rail
            items={(d.stops ?? []).map((st) => ({
              left: st.time,
              title: st.title,
              detail: st.detail,
              meta: st.place ? `@ ${st.place}` : undefined,
            }))}
          />
        </View>
      ))}
    </>
  );
}

function Packing({ trip, sec }: { trip: TripDocument; sec: Sec }) {
  const items = trip.packing?.items ?? [];
  const groups = new Map<string, PackingItem[]>();
  items.forEach((it) => {
    const k = it.category?.trim() || "Essentials";
    groups.set(k, [...(groups.get(k) ?? []), it]);
  });
  return (
    <>
      <SectionHead sec={sec} />
      <Summary text={trip.packing?.summary} />
      {[...groups.entries()].map(([cat, list]) => (
        <View key={cat}>
          <T style={s.sub}>{cat.toUpperCase()}</T>
          <View style={s.packGrid}>
            {list.map((it, i) => (
              <View key={i} style={s.packItem} wrap={false}>
                <View style={s.check} />
                <View style={{ flex: 1 }}>
                  <T style={{ fontFamily: SERIF_B, fontSize: 10 }}>{it.item}</T>
                  {has(it.reason) ? <T style={{ fontSize: 8.5, color: C.soft }}>{it.reason}</T> : null}
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}
    </>
  );
}

function Timeline({ trip, sec }: { trip: TripDocument; sec: Sec }) {
  const tl = trip.timeline;
  return (
    <>
      <SectionHead sec={sec} />
      <Summary text={tl?.summary} />
      <Rail
        items={(tl?.events ?? []).map((e) => ({
          left: e.when || e.kind,
          title: e.title,
          detail: e.detail,
          meta: e.when && e.kind ? e.kind.toUpperCase() : undefined,
        }))}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Document                                                            */
/* ------------------------------------------------------------------ */

function buildSections(trip: TripDocument): Sec[] {
  const defs = [
    { key: "flights", title: "Flights", blurb: "Boarding-pass style options, times and fares", on: has(trip.flights?.summary) || !!trip.flights?.options?.length },
    { key: "stays", title: "Stays", blurb: "Where to sleep, by area and style", on: has(trip.hotels?.summary) || !!trip.hotels?.options?.length },
    { key: "weather", title: "Weather", blurb: "What the sky will do, and how to dress for it", on: hasWeather(trip.weather) },
    { key: "budget", title: "Budget", blurb: "The ledger: estimates, totals and exclusions", on: has(trip.budget?.summary) || !!trip.budget?.lines?.length },
    { key: "itinerary", title: "Itinerary", blurb: "Day-by-day plan with timed stops", on: has(trip.itinerary?.summary) || !!trip.itinerary?.days?.length },
    { key: "packing", title: "Packing checklist", blurb: "Tick-off list grouped by category", on: !!trip.packing?.items?.length },
    { key: "timeline", title: "Journey timeline", blurb: "The whole trip, start to finish", on: !!trip.timeline?.events?.length },
  ];
  return defs
    .filter((d) => d.on)
    .map((d, i) => ({
      key: d.key,
      title: d.title,
      blurb: d.blurb,
      no: String(i + 1).padStart(2, "0"),
      id: `sec-${d.key}`,
    }));
}

function renderSection(sec: Sec, trip: TripDocument): ReactNode {
  switch (sec.key) {
    case "flights": return <Flights trip={trip} sec={sec} />;
    case "stays": return <Stays trip={trip} sec={sec} />;
    case "weather": return <Weather trip={trip} sec={sec} />;
    case "budget": return <Budget trip={trip} sec={sec} />;
    case "itinerary": return <Itinerary trip={trip} sec={sec} />;
    case "packing": return <Packing trip={trip} sec={sec} />;
    case "timeline": return <Timeline trip={trip} sec={sec} />;
    default: return null;
  }
}

function Cover({ trip, sections }: { trip: TripDocument; sections: Sec[] }) {
  const budget = trip.budget?.estimated_total || trip.budget?.metric;
  const facts: Array<[string, string]> = [
    ["DATES", trip.dates || "Open"],
    ["TRAVELERS", trip.travelers || "Not specified"],
    ["BUDGET", budget || "TBD"],
    ["SECTIONS", String(sections.length).padStart(2, "0")],
  ];

  return (
    <Page size="A4" style={s.cover}>
      <View style={s.frame} fixed />

      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View>
          <T style={s.kicker}>VOYAGEMESH · FIELD BOOKLET</T>
          <T style={[s.mono7, { marginTop: 4 }]}>{`PREPARED ${today().toUpperCase()}`}</T>
        </View>
        <Compass />
      </View>

      <View style={{ marginTop: 56 }}>
        <T style={s.kicker}>VOYAGE CHART</T>
        <T style={s.coverTitle}>
          {trip.destination ? `Journey to ${trip.destination}` : "Your Voyage"}
        </T>
        <T style={s.coverSummary}>
          {trip.trip_summary || "Your itinerary, bookings and preparations in one field booklet."}
        </T>
      </View>

      <View style={{ marginTop: 38 }}>
        <RouteGraphic />
        <View style={s.routeLabels}>
          <View>
            <T style={s.routeLabel}>STARTING FROM</T>
            <T style={s.routePlace}>{trip.origin || "—"}</T>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <T style={s.routeLabel}>DESTINATION</T>
            <T style={s.routePlace}>{trip.destination || "—"}</T>
          </View>
        </View>
      </View>

      <View style={s.strip}>
        {facts.map(([label, value], i) => (
          <View key={label} style={[s.stripCell, i ? s.stripCellDiv : {}]}>
            <T style={s.mono7}>{label}</T>
            <T style={s.stripVal}>{value}</T>
          </View>
        ))}
      </View>

      <View style={{ marginTop: 30 }}>
        <T style={[s.kicker, { marginBottom: 6 }]}>CONTENTS</T>
        {sections.map((sec) => (
          <Link key={sec.id} src={`#${sec.id}`} style={{ textDecoration: "none", color: C.ink }}>
            <View style={s.tocRow}>
              <T style={s.tocNo}>{sec.no}</T>
              <T style={s.tocTitle}>{sec.title}</T>
              <T style={s.tocBlurb}>{sec.blurb}</T>
            </View>
          </Link>
        ))}
      </View>

      <View style={{ position: "absolute", left: 52, right: 52, bottom: 44 }}>
        <T style={{ fontFamily: SERIF_I, fontSize: 8.5, color: C.soft, lineHeight: 1.45 }}>
          Planned by the VoyageMesh multi-agent system. Fares, schedules and weather are estimates
          gathered at planning time; please confirm all details with providers before booking.
        </T>
      </View>
    </Page>
  );
}

function VoyageNote({ trip }: { trip: TripDocument }) {
  const destination = trip.destination || "your destination";
  const origin = trip.origin;

  const message = origin
    ? `From ${origin} to ${destination}, may this journey bring you memorable places, unexpected moments, and stories worth carrying home.`
    : `As you set out toward ${destination}, may this journey bring you memorable places, unexpected moments, and stories worth carrying home.`;

  return (
    <View style={s.voyageNote} wrap={false}>
      <T style={s.voyageNoteKicker}>A NOTE FOR THE JOURNEY</T>

      <T style={s.voyageNoteText}>
        {message}
      </T>

      <T style={s.voyageNoteSub}>
        Travel well. Wander freely. Make it yours.
      </T>

      <T style={s.voyageNoteBrand}>
        — VoyageMesh
      </T>
    </View>
  );
}


function VoyagePdf({ trip }: { trip: TripDocument }) {
  const sections = buildSections(trip);
  const place = trip.destination || "Voyage";

  return (
    <Document
      title={safe(`VoyageMesh · ${place}`)}
      author="VoyageMesh"
      subject={safe(`Trip plan for ${place}`)}
      creator="VoyageMesh"
      producer="VoyageMesh"
    >
      <Cover trip={trip} sections={sections} />

      <Page size="A4" style={s.page}>
        <View style={s.runHead} fixed>
          <T style={s.monoBrass7}>VOYAGEMESH · FIELD BOOKLET</T>
          <T style={s.mono7}>{place.toUpperCase()}</T>
        </View>

        {sections.length ? (
          sections.map((sec) => (
            <View key={sec.id} id={sec.id} style={s.section}>
              {renderSection(sec, trip)}
            </View>
          ))
        ) : (
          <T style={s.empty}>Trip details are still being prepared.</T>
        )}

        {trip.assumptions?.length ? (
          <View style={s.section} wrap={false}>
            <T style={s.sub}>PLANNING ASSUMPTIONS</T>
            {trip.assumptions.map((a, i) => (
              <T key={i} style={s.note}>{`•  ${a}`}</T>
            ))}
          </View>
        ) : null}

        <VoyageNote trip={trip} />


        <View style={s.runFoot} fixed>
          <T style={s.mono7}>{`GENERATED ${today().toUpperCase()}`}</T>
          <Text
            style={s.mono7}
            render={({ pageNumber, totalPages }) => `PAGE ${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

/* ------------------------------------------------------------------ */
/*  Download                                                            */
/* ------------------------------------------------------------------ */

function fileBase(trip: TripDocument) {
  const clean = (v: string) => v.replaceAll(/[^\w]+/g, "-").replaceAll(/^-+|-+$/g, "");
  return `VoyageMesh-${clean(trip.destination || "voyage")}-${clean(trip.dates || "open")}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadPlanPdf(payload: TripPayload) {
  const trip = asTripDocument(payload);
  const blob = await pdf(<VoyagePdf trip={trip} />).toBlob();
  downloadBlob(blob, `${fileBase(trip)}.pdf`);
}