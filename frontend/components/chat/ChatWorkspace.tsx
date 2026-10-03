"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Composer, StarterQueries } from "@/components/chat/Composer";
import { HitlCard } from "@/components/chat/HitlCard";
import { asTripPayload, streamFollowUp, streamTrip } from "@/lib/api/sse";
import { getConversation, getTrip } from "@/lib/api/trips";
import { useAccessToken } from "@/lib/hooks/useAccessToken";
import type { ChatMessage, TripPayload } from "@/types/trip";

function agentLabel(node: string) {
  return node.replaceAll("_", " ");
}

export function ChatWorkspace({ conversationId }: { conversationId?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token, ready } = useAccessToken();
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [progress, setProgress] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [livePayload, setLivePayload] = useState<TripPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const conversation = useQuery({
    queryKey: ["conversation", conversationId, token],
    queryFn: () => getConversation(token!, conversationId!),
    enabled: Boolean(token && conversationId),
  });

  const threadId = conversation.data?.thread_id ?? livePayload?.thread_id;

  const trip = useQuery({
    queryKey: ["trip", threadId, token],
    queryFn: () => getTrip(token!, threadId!),
    enabled: Boolean(token && threadId),
  });

  useEffect(() => {
    const reset = window.setTimeout(() => {
      setLocalMessages([]);
      setLivePayload(null);
      setProgress([]);
      setError(null);
    }, 0);
    return () => window.clearTimeout(reset);
  }, [conversationId]);

  const messages = useMemo(() => {
    const persisted = conversation.data?.messages ?? [];
    const seen = new Set(persisted.map((item) => item.content + item.created_at));
    const extras = localMessages.filter((item) => !seen.has(item.content + item.created_at));
    return [...persisted, ...extras];
  }, [conversation.data?.messages, localMessages]);

  const payload = livePayload ?? trip.data ?? null;
  const interventionPending = payload?.human_intervention?.status === "pending";

  async function dispatch(query: string) {
    if (!token) return;
    setBusy(true);
    setError(null);
    setProgress([]);
    setLocalMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        conversation_id: conversationId ?? "pending",
        role: "user",
        content: query,
        kind: "user",
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      const handle = async (event: { event: string; data: Record<string, unknown> }) => {
        if (event.event === "started") {
          const nextId = event.data.conversation_id;
          if (!conversationId && typeof nextId === "string") {
            router.replace(`/app/c/${nextId}`);
          }
        }
        if (event.event === "progress" && typeof event.data.node === "string") {
          setProgress((current) => [...current, event.data.node as string]);
        }
        if (event.event === "completed" || event.event === "awaiting_human") {
          const next = asTripPayload(event.data);
          setLivePayload(next);
          if (next.answer) {
            setLocalMessages((current) => [
              ...current,
              {
                id: crypto.randomUUID(),
                conversation_id: next.conversation_id ?? conversationId ?? "pending",
                role: "assistant",
                content: next.answer ?? "",
                kind: "assistant",
                created_at: new Date().toISOString(),
              },
            ]);
          } else if (next.human_intervention?.question) {
            setLocalMessages((current) => [
              ...current,
              {
                id: crypto.randomUUID(),
                conversation_id: next.conversation_id ?? conversationId ?? "pending",
                role: "assistant",
                content: next.human_intervention?.question ?? "",
                kind: "hitl",
                created_at: new Date().toISOString(),
              },
            ]);
          }
        }
        if (event.event === "error") {
          setError(String(event.data.detail ?? "Planning failed"));
        }
      };

      if (!threadId) {
        await streamTrip(token, query, handle);
      } else {
        await streamFollowUp(token, threadId, query, handle);
      }
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      await queryClient.invalidateQueries({ queryKey: ["conversation"] });
      await queryClient.invalidateQueries({ queryKey: ["trip"] });
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to dispatch");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;

  return (
    <div className="flex h-full flex-col">
      {payload ? (
        <div className="flex items-center justify-between border-b border-rule px-6 py-3">
          <div>
            <p className="font-display text-lg">
              {payload.title ?? conversation.data?.title ?? "Untitled voyage"}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
              {payload.trip_constraints?.destination || "Unplotted"} ·{" "}
              {payload.trip_constraints?.travel_dates || "dates open"}
            </p>
          </div>
          {payload.thread_id ? (
            <Link href={`/app/trips/${payload.thread_id}`} className="text-xs text-steel">
              Open voyage document
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-2xl">
          {!conversationId && messages.length === 0 ? (
            <>
              <h1 className="font-display text-4xl leading-tight">New briefing</h1>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-ink-soft">
                Give origin, destination, dates, travelers, and a budget. Specialists will
                plot the voyage; you remain on the chart.
              </p>
              <StarterQueries onPick={dispatch} />
            </>
          ) : null}

          {messages.map((message) =>
            message.role === "user" ? (
              <div key={message.id} className="mb-4 flex justify-end">
                <p className="max-w-[80%] bg-paper-raised px-3 py-2 text-sm leading-relaxed">
                  {message.content}
                </p>
              </div>
            ) : (
              <div key={message.id} className="mb-6 max-w-[86%] whitespace-pre-wrap text-sm leading-7">
                {message.content}
              </div>
            ),
          )}

          {progress.length > 0 && busy ? (
            <p className="font-mono text-[11px] tracking-wide text-steel">
              {progress.map(agentLabel).join(" → ")}
            </p>
          ) : null}

          {payload?.status === "blocked" ? (
            <div className="mt-4 border border-steel px-3 py-3 text-sm">
              {payload.answer}
            </div>
          ) : null}

          {token && payload && interventionPending ? (
            <HitlCard
              token={token}
              payload={payload}
              onResolved={async (next) => {
                setLivePayload(next);
                await queryClient.invalidateQueries({ queryKey: ["conversations"] });
                await queryClient.invalidateQueries({ queryKey: ["conversation"] });
                await queryClient.invalidateQueries({ queryKey: ["trip"] });
                await queryClient.invalidateQueries({ queryKey: ["trips"] });
              }}
            />
          ) : null}

          {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
        </div>
      </div>
      <div className="mx-auto w-full max-w-2xl">
        <Composer disabled={busy || interventionPending} onSend={dispatch} />
      </div>
    </div>
  );
}
