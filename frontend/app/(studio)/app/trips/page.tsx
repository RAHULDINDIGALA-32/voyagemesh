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
    <main className="mx-auto max-w-6xl px-4 pb-32 pt-8 sm:px-8 sm:pb-40 sm:pt-10">
  
      <h1 className="mt-5 font-display text-4xl">Trips</h1>
      <FoldList trips={trips.data ?? []} />
    </main>
  );
}
