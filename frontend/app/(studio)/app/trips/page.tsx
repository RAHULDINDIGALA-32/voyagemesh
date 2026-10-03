"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FoldList } from "@/components/trips/FoldList";
import { listTrips } from "@/lib/api/trips";
import { useAccessToken } from "@/lib/hooks/useAccessToken";

export default function TripsPage() {
  const { token } = useAccessToken();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const trips = useQuery({
    queryKey: ["trips", token],
    queryFn: () => listTrips(token!),
    enabled: Boolean(token),
  });

  const filtered = useMemo(() => {
    return (trips.data ?? []).filter((trip) => {
      if (status !== "all" && trip.status !== status) return false;
      const hay = `${trip.title} ${trip.cover?.destination ?? ""}`.toLowerCase();
      return hay.includes(query.toLowerCase());
    });
  }, [query, status, trips.data]);

  return (
    <main className="h-full overflow-y-auto px-8 py-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-brass">Strip map</p>
      <h1 className="mt-2 font-display text-4xl">Trips</h1>
      <div className="mt-6 flex flex-wrap gap-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Destination"
          className="rounded-[3px] border border-rule bg-paper px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-[3px] border border-rule bg-paper px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="awaiting_you">Hold</option>
          <option value="ready">Ready</option>
        </select>
      </div>
      <FoldList trips={filtered} />
    </main>
  );
}
