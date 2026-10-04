"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Map, MessageCircle, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { listConversations, listTrips } from "@/lib/api/trips";
import { useAccessToken } from "@/lib/hooks/useAccessToken";
import { useUiStore } from "@/stores/ui";

type SearchTab = "all" | "chats" | "trips";

function formatStamp(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) return text;
  const index = text.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <span className="text-brass">{text.slice(index, index + needle.length)}</span>
      {text.slice(index + needle.length)}
    </>
  );
}

function matchesQuery(hay: string, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return hay.toLowerCase().includes(needle);
}

export function GlobalSearch() {
  const open = useUiStore((state) => state.searchOpen);
  const closeSearch = useUiStore((state) => state.closeSearch);
  const toggleSearch = useUiStore((state) => state.toggleSearch);
  const { token } = useAccessToken();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<SearchTab>("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const conversations = useQuery({
    queryKey: ["conversations", token],
    queryFn: () => listConversations(token!),
    enabled: Boolean(token && open),
  });

  const trips = useQuery({
    queryKey: ["trips", token],
    queryFn: () => listTrips(token!),
    enabled: Boolean(token && open),
  });

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        toggleSearch();
      }
      if (event.key === "Escape" && open) {
        closeSearch();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeSearch, open, toggleSearch]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setTab("all");
      return;
    }
    const focus = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(focus);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-search-trigger]")) return;
      if (!panelRef.current?.contains(event.target as Node)) {
        closeSearch();
      }
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [closeSearch, open]);

  const chatHits = useMemo(() => {
    return (conversations.data ?? []).filter((chat) =>
      matchesQuery(`${chat.title} ${chat.cover?.destination ?? ""} ${chat.cover?.origin ?? ""}`, query),
    );
  }, [conversations.data, query]);

  const tripHits = useMemo(() => {
    return (trips.data ?? []).filter((trip) =>
      matchesQuery(`${trip.title} ${trip.cover?.destination ?? ""} ${trip.cover?.origin ?? ""}`, query),
    );
  }, [query, trips.data]);

  if (!open) return null;

  const showChats = tab !== "trips";
  const showTrips = tab !== "chats";
  const emptyQuery = !query.trim();
  const visibleChats = emptyQuery ? chatHits.slice(0, 8) : chatHits;
  const visibleTrips = emptyQuery ? tripHits.slice(0, 8) : tripHits;
  const hasResults =
    (showChats && visibleChats.length > 0) || (showTrips && visibleTrips.length > 0);

  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      <div
        ref={panelRef}
        className="pointer-events-auto absolute left-4 top-3 w-[min(calc(100%-2rem),40rem)] overflow-hidden rounded-2xl border border-rule bg-[#f3f2ee] p-2 shadow-[0_10px_30px_rgba(0,0,0,0.18)] dark:bg-[#20201f] dark:shadow-[0_10px_30px_rgba(0,0,0,0.45)]"
      >
        <div className="flex items-center gap-3 border-b border-rule px-4 py-3">
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search..."
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-soft/70"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-xs text-ink-soft hover:text-ink"
            >
              Clear
            </button>
          ) : null}
          <button
            type="button"
            onClick={closeSearch}
            aria-label="Close search"
            className="rounded-[3px] p-1 text-ink-soft hover:bg-paper hover:text-ink"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex gap-1 px-3 pt-3">
          {(
            [
              ["all", "All"],
              ["chats", "Chats"],
              ["trips", "Trips"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-full px-3 py-1 text-sm ${
                tab === id ? "bg-paper text-ink" : "text-ink-soft hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {emptyQuery ? (
          <p className="px-4 pt-2 text-xs text-ink-soft">Recent charts</p>
        ) : null}

        <div className="max-h-[min(28rem,calc(100dvh-8rem))] overflow-y-auto px-2 py-2">
          {showChats
            ? visibleChats.map((chat) => (
                <SearchRow
                  key={`chat-${chat.conversation_id}`}
                  href={`/app/c/${chat.conversation_id}`}
                  icon={<MessageCircle size={16} strokeWidth={1.4} />}
                  title={chat.title}
                  detail={`Chat · ${chat.cover?.destination || "Unplotted"}`}
                  stamp={formatStamp(chat.updated_at)}
                  query={query}
                  onPick={closeSearch}
                />
              ))
            : null}

          {showTrips
            ? visibleTrips.map((trip) => (
                <SearchRow
                  key={`trip-${trip.trip_id}`}
                  href={`/app/trips/${trip.thread_id}`}
                  icon={<Map size={16} strokeWidth={1.4} />}
                  title={trip.title}
                  detail={`Trip · ${trip.cover?.destination || "Unplotted"}`}
                  stamp={formatStamp(trip.updated_at)}
                  query={query}
                  onPick={closeSearch}
                />
              ))
            : null}

          {!hasResults ? (
            <p className="px-3 py-8 text-center text-sm text-ink-soft">
              {emptyQuery ? "No charts yet." : "No matching charts."}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SearchRow({
  href,
  icon,
  title,
  detail,
  stamp,
  query,
  onPick,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  detail: string;
  stamp: string;
  query: string;
  onPick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onPick}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-paper "
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center text-ink-soft">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">
          <Highlight text={title} query={query} />
        </span>
        {query.trim() ? (
          <span className="block truncate text-xs text-ink-soft">{detail}</span>
        ) : null}
      </span>
      {stamp ? (
        <span className="shrink-0 font-mono text-[10px] text-ink-soft">{stamp}</span>
      ) : null}
    </Link>
  );
}
