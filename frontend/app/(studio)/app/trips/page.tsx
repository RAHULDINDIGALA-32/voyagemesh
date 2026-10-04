"use client";

import { useQuery } from "@tanstack/react-query";
import { FoldList } from "@/components/trips/FoldList";
import { listTrips } from "@/lib/api/trips";
import { useAccessToken } from "@/lib/hooks/useAccessToken";

export default function TripsPage() {
  const { token } = useAccessToken();
  const trips = useQuery({
    queryKey: ["trips", token],
    queryFn: () => listTrips(token!),
    enabled: Boolean(token),
  });

  return (
    <main className="h-full overflow-y-auto px-8 py-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-brass">Strip map</p>
      <h1 className="mt-2 font-display text-4xl">Trips</h1>
      <FoldList trips={trips.data ?? []} />
    </main>
  );
}
