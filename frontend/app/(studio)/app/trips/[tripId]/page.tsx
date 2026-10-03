"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { VoyageDocument } from "@/components/trips/VoyageDocument";
import { getTrip } from "@/lib/api/trips";
import { useAccessToken } from "@/lib/hooks/useAccessToken";

export default function TripDocumentPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = use(params);
  const { token } = useAccessToken();
  const trip = useQuery({
    queryKey: ["trip", tripId, token],
    queryFn: () => getTrip(token!, tripId),
    enabled: Boolean(token && tripId),
  });

  if (trip.isError) {
    return <p className="p-8 text-sm text-danger">This chart could not be opened.</p>;
  }
  if (!trip.data) {
    return <p className="p-8 text-sm text-ink-soft">Drawing chart…</p>;
  }

  return (
    <div className="h-full overflow-y-auto">
      <VoyageDocument payload={trip.data} conversationId={trip.data.conversation_id} />
    </div>
  );
}
