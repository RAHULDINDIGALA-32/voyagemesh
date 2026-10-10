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
  G,
  Link,
  Font,
  StyleSheet,
  TextProps,
} from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { asTripDocument } from "@/lib/plan/parse";
import type {
  BudgetCard,
  FlightOption,
  HotelOption,
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

/** Category colours for the budget bar (brass family + olive accents). */
const SERIES = [
  "#9A7230",
  "#5B6B3A",
  "#C2A15E",
  "#7D8B57",
  "#6F5522",
  "#B5BE8F",
  "#D8C28D",
  "#8A8068",
];

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

const join = (...parts: Array<string | undefined | null | false>) =>
  parts
    .map((p) => (p ? p.trim() : ""))
    .filter(Boolean)
    .join(" · ");

const has = (v?: string | null) => !!v?.trim();

const pad = (n: number) => String(n).padStart(2, "0");

const deg = (v?: string, unit?: string) =>
  v && /^-?\d+(\.\d+)?$/.test(v.trim()) ? `${v.trim()}°${unit ?? ""}` : v;

const today = () =>
  new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/** Shrinks a font size as text gets longer so prices never overflow a cell. */
const fit = (text: string | undefined, base: number, min: number, limit: number) => {
  const len = (text ?? "").length;
  return len <= limit ? base : Math.max(min, Math.round((base * limit) / len));
};

/** "Hyderabad (HYD)" -> { code: "HYD", name: "Hyderabad" }; otherwise name only. */
function splitPlace(value?: string) {
  const text = safe(value).trim();
  if (!text) return { code: "", name: "" };
  const match = text.match(/\b[A-Z]{3}\b/);
  if (!match) return { code: "", name: text };
  const name = text
    .replace(match[0], "")
    .replace(/[()\-–,/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { code: match[0], name };
}

/** Pulls a number out of "₹1,20,000" or "$800–$1,000" (ranges are averaged). */
function parseAmount(value?: string): number | null {
  if (!value) return null;
  const nums = value.replace(/,/g, "").match(/\d+(\.\d+)?/g);
  if (!nums?.length) return null;
  const values = nums.map(Number);
  return values.reduce((a, b) => a + b, 0) / values.length;
}

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
  /* layout helpers */
  row: { flexDirection: "row", alignItems: "center" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

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
  section: { marginBottom: 24 },
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

  /* shared: hero panel, pill, at-a-glance table */
  hero: {
    flexDirection: "row",
    borderWidth: 0.75,
    borderColor: C.rule,
    borderRadius: 4,
    backgroundColor: C.raised,
    marginBottom: 12,
  },
  heroMetric: {
    width: 150,
    padding: 12,
    justifyContent: "center",
    backgroundColor: C.brassSoft,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  heroMetricVal: { fontFamily: SERIF_B, marginTop: 4, color: C.ink },
  heroBody: { flex: 1, padding: 12, justifyContent: "center" },
  pill: {
    borderWidth: 0.75,
    borderColor: C.brass,
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  ledHead: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: C.ink },
  glRow: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 2, borderBottomWidth: 0.5, borderBottomColor: C.rule },

  /* flight pass */
  pass: {
    flexDirection: "row",
    borderWidth: 0.75,
    borderColor: C.rule,
    borderRadius: 5,
    backgroundColor: C.raised,
    marginBottom: 10,
  },
  passMain: { flex: 1, padding: 12 },
  passIdx: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.brass,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  passAirline: { fontFamily: SERIF_B, fontSize: 12.5 },
  passRoute: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: C.rule,
  },
  passPlace: { flex: 1 },
  passCode: { fontFamily: SERIF_B, color: C.ink },
  passCity: { fontFamily: SERIF, fontSize: 8.5, color: C.soft, marginTop: 1 },
  passTime: { fontFamily: MONO, fontSize: 8, color: C.ink, marginTop: 3 },
  passMid: { width: 96, alignItems: "center", paddingTop: 3, paddingHorizontal: 4 },
  passLine: { flex: 1, height: 0, borderTopWidth: 1, borderTopColor: C.brass, borderTopStyle: "dashed" },
  passStub: {
    width: 118,
    padding: 12,
    justifyContent: "space-between",
    borderLeftWidth: 1,
    borderLeftColor: C.rule,
    borderLeftStyle: "dashed",
    backgroundColor: C.brassSoft,
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
  },
  notch: {
    position: "absolute",
    right: 112,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: C.paper,
  },

  /* stay card */
  stay: {
    borderWidth: 0.75,
    borderColor: C.rule,
    borderRadius: 5,
    backgroundColor: C.raised,
    marginBottom: 10,
  },
  stayTop: { flexDirection: "row" },
  stayBody: { flex: 1, padding: 12 },
  stayIdx: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.brass,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },
  stayName: { fontFamily: SERIF_B, fontSize: 14, flex: 1 },
  stayMeta: { flexDirection: "row", alignItems: "center", marginRight: 14 },
  stayQuote: {
    marginTop: 10,
    paddingLeft: 9,
    borderLeftWidth: 2,
    borderLeftColor: C.brass,
  },
  stayPrice: {
    width: 112,
    padding: 12,
    justifyContent: "center",
    alignItems: "flex-end",
    backgroundColor: C.brassSoft,
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
  },
  stayFoot: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderTopWidth: 0.5,
    borderTopColor: C.rule,
  },

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

  /* budget */
  bar: { flexDirection: "row", height: 8, marginTop: 10 },
  ledRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: C.rule,
  },
  swatch: { width: 7, height: 7, borderRadius: 1.5, marginRight: 7, marginTop: 3 },
  ledTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    marginTop: 2,
    borderTopWidth: 1.5,
    borderTopColor: C.ink,
  },
  box: { flex: 1, borderWidth: 0.75, borderColor: C.rule, borderRadius: 4, padding: 10 },

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

  /* voyage note / closing */
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
/*  SVG ornaments + icons                                               */
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
      <Circle cx={245} cy={31} r={4} fill={C.brassSoft} stroke={C.brass} strokeWidth={1} />
    </Svg>
  );
}

/** Aeroplane silhouette pointing right (the source glyph points up, so we rotate it). */
function PlaneIcon({ size = 13 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={{ marginHorizontal: 3 }}>
      <G transform="rotate(90 12 12)">
        <Path
          d="M21 16v-2l-8-5V3.5C13 2.67 12.33 2 11.5 2S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"
          fill={C.brass}
        />
      </G>
    </Svg>
  );
}

function PinIcon({ size = 9 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={{ marginRight: 4 }}>
      <Path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z" fill={C.brass} />
      <Circle cx={12} cy={9} r={2.6} fill={C.raised} />
    </Svg>
  );
}

function MoonIcon({ size = 9 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={{ marginRight: 4 }}>
      <Path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" fill={C.brass} />
    </Svg>
  );
}

/** Decorative barcode for the boarding-pass stub (deterministic per option). */
function Barcode({ seed }: { seed: number }) {
  const bars = Array.from({ length: 24 }, (_, k) => ((k * 7 + seed * 3) % 4) + 1);
  return (
    <View style={{ flexDirection: "row", height: 16, alignItems: "stretch" }}>
      {bars.map((w, k) => (
        <View
          key={k}
          style={{
            width: w * 0.55,
            marginRight: k % 3 === 0 ? 1.6 : 0.8,
            backgroundColor: C.ink,
          }}
        />
      ))}
    </View>
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

function Pill({ text }: { text: string }) {
  return (
    <View style={s.pill}>
      <T style={s.monoBrass7}>{text.toUpperCase()}</T>
    </View>
  );
}

/** Headline panel: tinted metric block on the left, summary on the right. */
function Hero({
  metric,
  label,
  fallbackLabel,
  summary,
  extra,
}: {
  metric?: string;
  label?: string;
  fallbackLabel: string;
  summary?: string;
  extra?: ReactNode;
}) {
  if (!has(metric) && !has(summary)) return null;
  return (
    <View style={s.hero} wrap={false}>
      {has(metric) ? (
        <View style={s.heroMetric}>
          <T style={s.mono7}>{(label || fallbackLabel).toUpperCase()}</T>
          <T style={[s.heroMetricVal, { fontSize: fit(metric, 22, 12, 11) }]}>{metric}</T>
        </View>
      ) : null}
      <View style={s.heroBody}>
        {has(summary) ? (
          <T style={{ fontSize: 10.5, lineHeight: 1.5, color: C.soft }}>{summary}</T>
        ) : null}
        {extra}
      </View>
    </View>
  );
}

type GlanceCol = { label: string; flex: number; right?: boolean };

/** Compact comparison table shown above option cards (like a "compare" bar). */
function Glance({ cols, rows }: { cols: GlanceCol[]; rows: string[][] }) {
  return (
    <View style={{ marginBottom: 12 }} wrap={false}>
      <View style={s.ledHead}>
        {cols.map((c, i) => (
          <T key={i} style={[s.mono7, { flex: c.flex, textAlign: c.right ? "right" : "left" }]}>
            {c.label.toUpperCase()}
          </T>
        ))}
      </View>
      {rows.map((r, ri) => (
        <View key={ri} style={[s.glRow, ri % 2 ? { backgroundColor: C.raised } : {}]}>
          {r.map((cell, ci) => (
            <T
              key={ci}
              style={[
                {
                  flex: cols[ci].flex,
                  fontSize: 9,
                  textAlign: cols[ci].right ? "right" : "left",
                },
                ci === 0 ? { fontFamily: SERIF_B } : ci === cols.length - 1 ? { fontFamily: MONO_B } : {},
              ]}
            >
              {cell || "—"}
            </T>
          ))}
        </View>
      ))}
    </View>
  );
}

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
/*  Flights                                                             */
/* ------------------------------------------------------------------ */

function PassPlace({
  place,
  time,
  timeLabel,
  align,
}: {
  place?: string;
  time?: string;
  timeLabel: string;
  align: "left" | "right";
}) {
  const { code, name } = splitPlace(place);
  const big = code || name || "—";
  const size = code ? 26 : fit(big, 15, 9, 10);
  const right = align === "right";
  return (
    <View style={[s.passPlace, right ? { alignItems: "flex-end" } : {}]}>
      <T style={[s.passCode, { fontSize: size, textAlign: right ? "right" : "left" }]}>{big}</T>
      {code && name ? (
        <T style={[s.passCity, { textAlign: right ? "right" : "left" }]}>{name}</T>
      ) : null}
      {has(time) ? (
        <View style={{ marginTop: 6, alignItems: right ? "flex-end" : "flex-start" }}>
          <T style={s.mono7}>{timeLabel}</T>
          <T style={[s.passTime, { textAlign: right ? "right" : "left" }]}>{time}</T>
        </View>
      ) : null}
    </View>
  );
}

function BoardingPass({ o, i }: { o: FlightOption; i: number }) {
  return (
    <View style={s.pass} wrap={false}>
      {/* perforation notches */}
      <View style={[s.notch, { top: -6 }]} />
      <View style={[s.notch, { bottom: -6 }]} />

      <View style={s.passMain}>
        <View style={s.rowBetween}>
          <View style={s.row}>
            <View style={s.passIdx}>
              <T style={{ fontFamily: MONO_B, fontSize: 7, color: C.brass }}>{pad(i + 1)}</T>
            </View>
            <View>
              <T style={s.passAirline}>{o.airline || "Route option"}</T>
              {has(o.flight_number) ? (
                <T style={[s.monoBrass7, { marginTop: 1 }]}>{o.flight_number!.toUpperCase()}</T>
              ) : null}
            </View>
          </View>
          {has(o.cabin) ? <Pill text={o.cabin!} /> : null}
        </View>

        {o.origin || o.destination ? (
          <View style={s.passRoute}>
            <PassPlace place={o.origin} time={o.departs} timeLabel="DEPARTS" align="left" />
            <View style={s.passMid}>
              <T style={[s.mono7, { marginBottom: 3 }]}>{(o.duration || "").toUpperCase() || " "}</T>
              <View style={[s.row, { width: "100%" }]}>
                <View style={s.passLine} />
                <PlaneIcon />
                <View style={s.passLine} />
              </View>
            </View>
            <PassPlace place={o.destination} time={o.arrives} timeLabel="ARRIVES" align="right" />
          </View>
        ) : has(o.departs) || has(o.arrives) || has(o.duration) ? (
          <T style={[s.passTime, { marginTop: 10 }]}>
            {join(o.departs && `Dep ${o.departs}`, o.arrives && `Arr ${o.arrives}`, o.duration)}
          </T>
        ) : null}

        {has(o.notes) ? (
          <T style={{ fontFamily: SERIF_I, fontSize: 9, lineHeight: 1.45, color: C.soft, marginTop: 10 }}>
            {o.notes}
          </T>
        ) : null}
      </View>

      <View style={s.passStub}>
        <T style={s.monoBrass7}>{`OPTION ${pad(i + 1)}`}</T>
        <View style={{ marginVertical: 8 }}>
          <T style={s.mono7}>EST. FARE</T>
          <T
            style={{
              fontFamily: SERIF_B,
              fontSize: fit(o.estimate, 15, 9, 11),
              marginTop: 3,
              color: C.ink,
            }}
          >
            {o.estimate || "On request"}
          </T>
        </View>
        <Barcode seed={i + 1} />
      </View>
    </View>
  );
}

function Flights({ trip, sec }: { trip: TripDocument; sec: Sec }) {
  const f = trip.flights;
  const options = f?.options ?? [];
  return (
    <>
      <SectionHead
        sec={sec}
        metric={options.length ? pad(options.length) : undefined}
        label={options.length === 1 ? "Option" : "Options"}
      />
      <Hero
        metric={f?.metric}
        label={f?.metric_label}
        fallbackLabel="Flight estimate"
        summary={f?.summary}
      />

      {options.length > 1 ? (
        <Glance
          cols={[
            { label: "Carrier", flex: 1.4 },
            { label: "Route", flex: 1.3 },
            { label: "Departs", flex: 1.4 },
            { label: "Est. fare", flex: 1, right: true },
          ]}
          rows={options.map((o) => {
            const a = splitPlace(o.origin);
            const b = splitPlace(o.destination);
            const from = a.code || a.name;
            const to = b.code || b.name;
            return [
              join(o.airline, o.flight_number) || "Route option",
              from && to ? `${from} - ${to}` : "",
              o.departs || "",
              o.estimate || "",
            ];
          })}
        />
      ) : null}

      {options.map((o, i) => (
        <BoardingPass key={i} o={o} i={i} />
      ))}

      {!options.length && !has(f?.summary) ? (
        <T style={s.empty}>Flight details are not available yet.</T>
      ) : null}
      <Notes items={f?.notes} title="Good to know" />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Stays                                                               */
/* ------------------------------------------------------------------ */

function StayCard({ o, i }: { o: HotelOption; i: number }) {
  return (
    <View style={s.stay} wrap={false}>
      <View style={s.stayTop}>
        <View style={s.stayBody}>
          <View style={s.rowBetween}>
            <View style={[s.row, { flex: 1, marginRight: 8 }]}>
              <View style={s.stayIdx}>
                <T style={{ fontFamily: MONO_B, fontSize: 8, color: C.brass }}>{pad(i + 1)}</T>
              </View>
              <T style={s.stayName}>{o.name || "Stay option"}</T>
            </View>
            {has(o.style) ? <Pill text={o.style!} /> : null}
          </View>

          {has(o.area) || has(o.nights) ? (
            <View style={[s.row, { marginTop: 9, flexWrap: "wrap" }]}>
              {has(o.area) ? (
                <View style={s.stayMeta}>
                  <PinIcon />
                  <T style={{ fontSize: 9.5, color: C.soft }}>{o.area}</T>
                </View>
              ) : null}
              {has(o.nights) ? (
                <View style={s.stayMeta}>
                  <MoonIcon />
                  <T style={{ fontSize: 9.5, color: C.soft }}>{o.nights}</T>
                </View>
              ) : null}
            </View>
          ) : null}

          {has(o.why) ? (
            <View style={s.stayQuote}>
              <T style={{ fontFamily: SERIF_I, fontSize: 9.5, lineHeight: 1.5, color: C.soft }}>{o.why}</T>
            </View>
          ) : null}
        </View>

        {has(o.estimate_per_night) ? (
          <View style={s.stayPrice}>
            <T style={[s.mono7, { textAlign: "right" }]}>PER NIGHT</T>
            <T
              style={{
                fontFamily: SERIF_B,
                fontSize: fit(o.estimate_per_night, 16, 9, 11),
                textAlign: "right",
                marginTop: 3,
              }}
            >
              {o.estimate_per_night}
            </T>
          </View>
        ) : null}
      </View>

      {has(o.source) ? (
        <View style={s.stayFoot}>
          <T style={s.mono7}>{`SOURCE · ${o.source!.toUpperCase()}`}</T>
        </View>
      ) : null}
    </View>
  );
}

function Stays({ trip, sec }: { trip: TripDocument; sec: Sec }) {
  const h = trip.hotels;
  const options = h?.options ?? [];
  return (
    <>
      <SectionHead
        sec={sec}
        metric={options.length ? pad(options.length) : undefined}
        label={options.length === 1 ? "Pick" : "Picks"}
      />
      <Hero
        metric={h?.metric}
        label={h?.metric_label}
        fallbackLabel="Stay estimate"
        summary={h?.summary}
      />

      {options.length > 1 ? (
        <Glance
          cols={[
            { label: "Property", flex: 1.6 },
            { label: "Area", flex: 1.2 },
            { label: "Style", flex: 1 },
            { label: "Per night", flex: 1, right: true },
          ]}
          rows={options.map((o) => [o.name || "Stay option", o.area || "", o.style || "", o.estimate_per_night || ""])}
        />
      ) : null}

      {options.map((o, i) => (
        <StayCard key={i} o={o} i={i} />
      ))}

      {!options.length && !has(h?.summary) ? (
        <T style={s.empty}>Accommodation details are not available yet.</T>
      ) : null}
      <Notes items={h?.notes} title="Good to know" />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Weather                                                             */
/* ------------------------------------------------------------------ */

const hasWeather = (w?: WeatherCard) =>
  !!w &&
  ([w.summary, w.headline, w.metric, w.condition, w.season, w.temp_high, w.temp_low].some(has) ||
    !!w.forecast?.length ||
    !!w.alerts?.length ||
    !!w.packing_hints?.length);

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

/* ------------------------------------------------------------------ */
/*  Budget                                                              */
/* ------------------------------------------------------------------ */

const hasBudget = (b?: BudgetCard) =>
  !!b &&
  (has(b.summary) ||
    has(b.estimated_total) ||
    has(b.metric) ||
    !!b.lines?.length ||
    !!b.exclusions?.length ||
    !!b.assumptions?.length);

function Budget({ trip, sec }: { trip: TripDocument; sec: Sec }) {
  const b = trip.budget!;
  const total = b.estimated_total || b.metric;
  const lines = b.lines ?? [];

  const parsed = lines.map((l) => parseAmount(l.amount));
  const sum = parsed.reduce<number>((a, v) => a + (v ?? 0), 0);
  const showShares = sum > 0 && parsed.filter((v) => v !== null).length >= 2;
  const pct = (i: number) => (showShares && parsed[i] ? (parsed[i]! / sum) * 100 : null);
  const color = (i: number) => SERIES[i % SERIES.length];

  return (
    <>
      <SectionHead
        sec={sec}
        metric={lines.length ? pad(lines.length) : undefined}
        label={lines.length === 1 ? "Category" : "Categories"}
      />

      <Hero
        metric={total}
        label={b.metric_label}
        fallbackLabel="Estimated total"
        summary={b.summary}
        extra={
          has(b.currency) ? (
            <View style={{ marginTop: 8, alignItems: "flex-start" }}>
              <Pill text={`Currency ${b.currency}`} />
            </View>
          ) : undefined
        }
      />

      {showShares ? (
        <View wrap={false} style={{ marginBottom: 10 }}>
          <T style={[s.mono7, { marginBottom: -2 }]}>WHERE THE MONEY GOES</T>
          <View style={s.bar}>
            {lines.map((_, i) => {
              const p = pct(i);
              if (!p) return null;
              return (
                <View
                  key={i}
                  style={{
                    flex: p,
                    backgroundColor: color(i),
                    borderRadius: 2,
                    marginRight: i < lines.length - 1 ? 1.5 : 0,
                  }}
                />
              );
            })}
          </View>
        </View>
      ) : null}

      {lines.length ? (
        <View>
          <View style={s.ledHead}>
            <T style={[s.mono7, { flex: 1 }]}>CATEGORY</T>
            <T style={[s.mono7, { width: 100, textAlign: "right" }]}>AMOUNT</T>
            {showShares ? <T style={[s.mono7, { width: 34, textAlign: "right" }]}>SHARE</T> : null}
          </View>
          {lines.map((l, i) => {
            const p = pct(i);
            return (
              <View
                key={i}
                style={[s.ledRow, i % 2 ? { backgroundColor: C.raised } : {}]}
                wrap={false}
              >
                {showShares ? <View style={[s.swatch, { backgroundColor: color(i) }]} /> : null}
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <T style={{ fontFamily: SERIF_B, fontSize: 10.5 }}>{l.category}</T>
                  {has(l.notes) ? (
                    <T style={{ fontSize: 8.5, lineHeight: 1.4, color: C.soft, marginTop: 1.5 }}>{l.notes}</T>
                  ) : null}
                </View>
                <T style={{ width: 100, textAlign: "right", fontFamily: MONO_B, fontSize: 9 }}>
                  {l.amount || "—"}
                </T>
                {showShares ? (
                  <T style={{ width: 34, textAlign: "right", fontFamily: MONO, fontSize: 8, color: C.soft }}>
                    {p ? `${Math.round(p)}%` : ""}
                  </T>
                ) : null}
              </View>
            );
          })}
          {has(total) ? (
            <View style={s.ledTotal} wrap={false}>
              <T style={{ fontFamily: SERIF_B, fontSize: 13 }}>Estimated total</T>
              <T style={{ fontFamily: MONO_B, fontSize: 13, color: C.brass }}>{total}</T>
            </View>
          ) : null}
        </View>
      ) : null}

      {b.assumptions?.length || b.exclusions?.length ? (
        <View style={[s.row, { alignItems: "flex-start", marginTop: 12 }]} wrap={false}>
          {b.assumptions?.length ? (
            <View style={[s.box, b.exclusions?.length ? { marginRight: 8 } : {}]}>
              <T style={[s.monoBrass7, { marginBottom: 5 }]}>ASSUMPTIONS</T>
              {b.assumptions.map((a, i) => (
                <T key={i} style={s.note}>{`•  ${a}`}</T>
              ))}
            </View>
          ) : null}
          {b.exclusions?.length ? (
            <View style={[s.box, { borderStyle: "dashed" }]}>
              <T style={[s.mono7, { marginBottom: 5 }]}>NOT INCLUDED</T>
              {b.exclusions.map((e, i) => (
                <T key={i} style={s.note}>{`•  ${e}`}</T>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Itinerary, packing, timeline                                        */
/* ------------------------------------------------------------------ */

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
  const f = trip.flights;
  const h = trip.hotels;
  const defs = [
    {
      key: "flights",
      title: "Flights",
      blurb: "Boarding-pass style options, times and fares",
      on: has(f?.summary) || has(f?.metric) || !!f?.options?.length || !!f?.notes?.length,
    },
    {
      key: "stays",
      title: "Stays",
      blurb: "Where to sleep, by area, style and price",
      on: has(h?.summary) || has(h?.metric) || !!h?.options?.length || !!h?.notes?.length,
    },
    { key: "weather", title: "Weather", blurb: "What the sky will do, and how to dress for it", on: hasWeather(trip.weather) },
    { key: "budget", title: "Budget", blurb: "The ledger: estimates, shares and exclusions", on: hasBudget(trip.budget) },
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
      no: pad(i + 1),
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
    ["SECTIONS", pad(sections.length)],
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
            <T style={[s.stripVal, { fontSize: fit(value, 12, 8.5, 16) }]}>{value}</T>
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
      <T style={s.voyageNoteText}>{message}</T>
      <T style={s.voyageNoteSub}>Travel well. Wander freely. Make it yours.</T>
      <T style={s.voyageNoteBrand}>— VoyageMesh</T>
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