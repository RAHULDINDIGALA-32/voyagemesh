"use client";

import { pdf, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { asTripDocument } from "@/lib/plan/parse";
import type { TripDocument, TripPayload } from "@/types/trip";

const styles = StyleSheet.create({
  page: { backgroundColor: "#F3EFE6", color: "#1A1814", padding: 36, fontSize: 10, fontFamily: "Times-Roman" },
  kicker: { fontSize: 8, letterSpacing: 2, marginBottom: 8, fontFamily: "Courier" },
  title: { fontSize: 22, marginBottom: 6, fontFamily: "Times-Bold" },
  meta: { fontSize: 9, marginBottom: 16, fontFamily: "Courier" },
  h: { fontSize: 12, marginTop: 14, marginBottom: 6, fontFamily: "Times-Bold" },
  p: { marginBottom: 4, lineHeight: 1.4 },
  box: { flexDirection: "row", gap: 8, marginBottom: 4 },
  check: { width: 10, height: 10, border: "1pt solid #1A1814", marginTop: 2 },
});

const join = (...parts: Array<string | undefined>) => parts.filter(Boolean).join(" · ");

function VoyagePdf({ trip }: { trip: TripDocument }) {
  const packing = trip.packing?.items ?? [];
  const timeline = trip.timeline?.events ?? [];
  const days = trip.itinerary?.days ?? [];
  return <Document><Page size="A4" style={styles.page}>
    <Text style={styles.kicker}>VOYAGEMESH · FIELD BOOKLET</Text>
    <Text style={styles.title}>{trip.destination ? `Journey to ${trip.destination}` : "Voyage"}</Text>
    <Text style={styles.meta}>{join(trip.origin || "—", trip.destination || "—", trip.dates || "dates open", trip.travelers || "travelers n/a")}</Text>
    <Text style={styles.h}>Trip summary</Text><Text style={styles.p}>{trip.trip_summary || "Trip details are being prepared."}</Text>
    <Text style={styles.h}>Flights</Text><Text style={styles.p}>{trip.flights?.summary || "No flight research available."}</Text>
    {(trip.flights?.options ?? []).map((option, index) => <Text key={index} style={styles.p}>{join(option.airline, option.flight_number, option.origin && option.destination ? `${option.origin} → ${option.destination}` : undefined, option.departs, option.arrives, option.duration, option.estimate, option.notes)}</Text>)}
    <Text style={styles.h}>Stays</Text><Text style={styles.p}>{trip.hotels?.summary || "No accommodation research available."}</Text>
    {(trip.hotels?.options ?? []).map((option, index) => <Text key={index} style={styles.p}>{join(option.name, option.area, option.nights, option.style, option.estimate_per_night, option.why)}</Text>)}
    <Text style={styles.h}>Weather</Text>
    <Text style={styles.p}>{join(trip.weather?.headline, trip.weather?.metric, trip.weather?.metric_label) || "No weather research available."}</Text>
    {trip.weather?.summary ? <Text style={styles.p}>{trip.weather.summary}</Text> : null}
    {(trip.weather?.packing_hints ?? []).map((hint, index) => <Text key={`w-${index}`} style={styles.p}>{hint}</Text>)}
    <Text style={styles.h}>Budget</Text><Text style={styles.p}>{trip.budget?.summary || "No budget analysis available."}</Text>
    {(trip.budget?.lines ?? []).map((line, index) => <Text key={index} style={styles.p}>{join(line.category, line.amount, line.notes)}</Text>)}
    <Text style={styles.h}>Packing checklist</Text>
    {(packing.length ? packing : [{ item: "Review packing requirements before departure" }]).map((entry, index) => <View key={`${entry.item}-${index}`} style={styles.box}><View style={styles.check} /><Text>{join(entry.item, entry.reason)}</Text></View>)}
    <Text style={styles.h}>Complete timeline</Text>
    {(timeline.length ? timeline : [{ title: "Timeline is being prepared" }]).map((event, index) => <Text key={index} style={styles.p}>{join(event.when, event.title, event.detail)}</Text>)}
    <Text style={styles.h}>Day-by-day itinerary</Text>
    {days.length ? days.map((day, index) => <View key={`${day.day}-${index}`} wrap={false}><Text style={styles.p}>{join(day.day, day.title, day.summary)}</Text>{(day.stops ?? []).map((stop, stopIndex) => <Text key={stopIndex} style={styles.p}>{join(stop.time, stop.title, stop.detail, stop.place)}</Text>)}</View>) : <Text style={styles.p}>{trip.itinerary?.summary || "No itinerary yet."}</Text>}
    {(trip.assumptions ?? []).length ? <><Text style={styles.h}>Assumptions</Text>{trip.assumptions?.map((item, index) => <Text key={index} style={styles.p}>{item}</Text>)}</> : null}
  </Page></Document>;
}

function fileBase(trip: TripDocument) {
  const dest = (trip.destination || "voyage").replaceAll(/[^\w]+/g, "-");
  const dates = (trip.dates || "open").replaceAll(/[^\w]+/g, "-");
  return `VoyageMesh-${dest}-${dates}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}

export async function downloadPlanPdf(payload: TripPayload) {
  const trip = asTripDocument(payload);
  downloadBlob(await pdf(<VoyagePdf trip={trip} />).toBlob(), `${fileBase(trip)}.pdf`);
}
