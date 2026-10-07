"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { CompassMark } from "@/components/brand/CompassMark";
import { Composer } from "@/components/chat/Composer";
import { HitlCard } from "@/components/chat/HitlCard";
import { RichText } from "@/components/ui/RichText";
import { asTripPayload, streamFollowUp, streamTrip } from "@/lib/api/sse";
import { getConversation, getTrip } from "@/lib/api/trips";
import { useAccessToken } from "@/lib/hooks/useAccessToken";
import { pickGreeting } from "@/lib/studio/greetings";
import type { ChatMessage, TripPayload } from "@/types/trip";

function agentLabel(node: string) {
  return node.replaceAll("_", " ");
}

export function ChatWorkspace({ conversationId }: { conversationId?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token, ready, fullName } = useAccessToken();
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [progress, setProgress] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [livePayload, setLivePayload] = useState<TripPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

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
  //const document = payload ? asTripDocument(payload) : null;
  //const weatherLine = [document?.weather?.metric, document?.weather?.summary]
    //.filter((part) => part?.trim())
    //.join(" · ");
  const interventionPending = payload?.human_intervention?.status === "pending";
  const greeting = useMemo(() => pickGreeting(fullName), [fullName]);
  const isFresh = !conversationId && messages.length === 0 && !busy;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, progress, busy]);

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
    let createdConversationId: string | undefined;

    try {
      const handle = (event: { event: string; data: Record<string, unknown> }) => {
        if (event.event === "progress" && typeof event.data.node === "string") {
          setProgress((current) => [...current, event.data.node as string]);
        }
        if (event.event === "completed" || event.event === "awaiting_human") {
          const next = asTripPayload(event.data);
          if (!conversationId && typeof next.conversation_id === "string") {
            createdConversationId = next.conversation_id;
          }
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
      if (createdConversationId) {
        router.replace(`/app/c/${createdConversationId}`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to dispatch");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;

  const composer = (
    <Composer
      variant={isFresh ? "hero" : "dock"}
      showSuggestions={isFresh}
      disabled={busy || interventionPending}
      onSend={dispatch}
    />
  );

  return (
    <div className="flex h-full flex-col">
      {payload && !isFresh ? (
        <div className="flex items-center justify-between border-b border-rule px-6 py-3">
          <div>
            <p className="font-display text-lg">
              {payload.title ?? conversation.data?.title ?? "Untitled voyage"}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
              {payload.trip_constraints?.destination || "Unplotted"} ·{" "}
              {payload.trip_constraints?.travel_dates || "Open Dates"}
            </p>
          </div>
          {payload.thread_id ? (
            <Link href={`/app/trips/${payload.thread_id}`} className="rounded-lg border border-brass/50 bg-paper-raised px-3 py-2 text-xs font-medium text-steel transition hover:border-brass hover:bg-paper">
              View trip plan <span aria-hidden="true">→</span>
            </Link>
          ) : null}
        </div>
      ) : null}

      {isFresh ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6">
          <div className="w-full max-w-2xl">
            <div className="mb-8 flex items-center justify-center gap-3">
              <CompassMark />
              <h1 className="text-center font-display text-[2.15rem] leading-tight tracking-tight">
                {greeting}
              </h1>
            </div>
            {composer}
          </div>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
            <div className="mx-auto max-w-2xl">
              {messages.map((message) =>
                message.role === "user" ? (
                  <div key={message.id} className="mb-4 flex justify-end">
                    <p className="max-w-[80%] rounded-2xl bg-paper-raised px-3 py-2 text-sm leading-relaxed">
                      {message.content}
                    </p>
                  </div>
                ) : (
                  <div key={message.id} className="mb-6 max-w-[86%] text-sm leading-7">
                    <RichText text={message.content} />
                    {message.id === messages[messages.length - 1]?.id && payload?.thread_id && message.kind === "assistant" ? (
                      <Link href={`/app/trips/${payload.thread_id}`} className="mt-3 inline-flex items-center gap-1 rounded-lg border border-brass/50 bg-paper-raised px-3 py-2 text-xs font-medium text-steel hover:border-brass">
                        Open trip plan <span aria-hidden="true">→</span>
                      </Link>
                    ) : null}
                  </div>
                ),
              )}

              {progress.length > 0 && busy ? (
                <p className="font-mono text-[11px] tracking-wide text-steel">
                  {progress.map(agentLabel).join(" → ")}
                </p>
              ) : null}

              {payload?.status === "blocked" ? (
                <div className="mt-4 border border-steel px-3 py-3 text-sm">{payload.answer}</div>
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
              <div ref={endRef} />
            </div>
          </div>
          <div className="mx-auto w-full max-w-2xl px-4 pb-5 pt-2">{composer}</div>
        </>
      )}
    </div>
  );
}