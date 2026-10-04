"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Moon,
  PanelLeft,
  Plus,
  Settings,
  Sun,
  LogOut,
  Search,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { Stamp } from "@/components/ui/Stamp";
import { listConversations, listTrips } from "@/lib/api/trips";
import { useAccessToken } from "@/lib/hooks/useAccessToken";
import { createClient } from "@/lib/supabase/client";
import { useUiStore } from "@/stores/ui";

function statusTone(
  status: string
): "ink" | "brass" | "olive" | "danger" {
  if (status === "ready") return "olive";
  if (status === "awaiting_you") return "brass";
  if (status === "blocked" || status === "failed") return "danger";
  return "ink";
}

function statusLabel(status: string) {
  if (status === "awaiting_you") return "HOLD";
  if (status === "ready") return "READY";
  if (status === "blocked") return "BLOCK";
  return "DRAFT";
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const { token, email, fullName } = useAccessToken();

  const [accountOpen, setAccountOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTab, setSearchTab] = useState<"all" | "chats" | "trips">("all");
  const accountRef = useRef<HTMLDivElement>(null);

  const { theme, setTheme, resolvedTheme } = useTheme();

  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  const chatSearch = useUiStore((state) => state.chatSearch);
  const setChatSearch = useUiStore((state) => state.setChatSearch);

  /*
   * Close account menu when clicking outside.
   */
  useEffect(() => {
    function close(event: MouseEvent) {
      if (!accountRef.current?.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    }

    document.addEventListener("mousedown", close);

    return () => {
      document.removeEventListener("mousedown", close);
    };
  }, []);

  const displayName =
    fullName?.trim() || email?.split("@")[0] || "Account";

  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  /*
   * Conversations
   */
  const conversations = useQuery({
    queryKey: ["conversations", token],
    queryFn: () => listConversations(token!),
    enabled: Boolean(token),
  });
  const trips = useQuery({ queryKey: ["trips", token], queryFn: () => listTrips(token!), enabled: Boolean(token && searchOpen) });

  const chats = (conversations.data ?? []).filter((chat) => {
    if (!chatSearch.trim()) return true;

    const hay = `${chat.title} ${
      chat.cover?.destination ?? ""
    }`.toLowerCase();

    return hay.includes(chatSearch.toLowerCase());
  });

  /*
   * Sign out
   */
  async function signOut() {
    const supabase = createClient();

    await supabase.auth.signOut();

    router.push("/");
    router.refresh();
  }

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-rule bg-paper transition-[width] duration-200 ease-out ${
        collapsed ? "w-[72px]" : "w-[280px]"
      }`}
    >
      {/* Header */}
      <div className="relative flex items-center justify-between gap-2 border-b border-rule px-3 py-3">
        {collapsed ? (
          <span className="font-mono text-[11px] tracking-[0.18em] text-brass">
            VM
          </span>
        ) : (
          <Wordmark href="/app" />
        )}

        <div className="flex items-center gap-1">
        <button type="button" onClick={() => setSearchOpen((open) => !open)} aria-label="Search chats and trips" className="rounded-[3px] p-1.5 text-ink-soft hover:bg-paper-raised"><Search size={16} strokeWidth={1.25} /></button>
        <button
          type="button"
          onClick={toggleSidebar}
          className="rounded-[3px] p-1.5 text-ink-soft hover:border hover:border-rule"
          aria-label="Toggle sidebar"
        >
          <PanelLeft size={16} strokeWidth={1.25} />
        </button></div>
        {searchOpen ? <div className="absolute left-2 right-2 top-[calc(100%+6px)] z-50 border border-rule bg-paper p-3 shadow-[0_10px_30px_rgba(0,0,0,0.16)]"><input autoFocus value={chatSearch} onChange={(event) => setChatSearch(event.target.value)} placeholder="Search the chart room" className="w-full border-b border-rule bg-transparent px-1 py-2 text-sm outline-none" /><div className="mt-3 flex gap-4 border-b border-rule pb-2 text-[11px] uppercase tracking-[0.12em]">{(["all","chats","trips"] as const).map((tab) => <button key={tab} type="button" onClick={() => setSearchTab(tab)} className={searchTab === tab ? "text-brass" : "text-ink-soft"}>{tab}</button>)}</div><div className="mt-2 max-h-64 overflow-y-auto">{(searchTab !== "trips" ? chats : []).map((chat) => <Link key={chat.conversation_id} onClick={() => setSearchOpen(false)} href={`/app/c/${chat.conversation_id}`} className="block border-b border-rule py-2 text-sm hover:text-steel">{chat.title}<span className="block text-xs text-ink-soft">Chat · {chat.cover?.destination || "Unplotted"}</span></Link>)}{(searchTab !== "chats" ? (trips.data ?? []).filter((trip) => `${trip.title} ${trip.cover?.destination ?? ""}`.toLowerCase().includes(chatSearch.toLowerCase())) : []).map((trip) => <Link key={trip.trip_id} onClick={() => setSearchOpen(false)} href={`/app/trips/${trip.thread_id}`} className="block border-b border-rule py-2 text-sm hover:text-steel">{trip.title}<span className="block text-xs text-ink-soft">Trip · {trip.cover?.destination || "Unplotted"}</span></Link>)}{chatSearch && !chats.length && !trips.data?.length ? <p className="py-4 text-xs text-ink-soft">No matching charts.</p> : null}</div></div> : null}
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 border-b border-rule p-2">
        <Link
          href="/app"
          className={`flex items-center gap-2 rounded-[3px] px-2 py-2 text-sm ${
            pathname === "/app"
              ? "bg-paper-raised"
              : "hover:bg-paper-raised"
          }`}
        >
          <Plus size={16} strokeWidth={1.25} />

          {!collapsed && <span>New</span>}
        </Link>

        <Link
          href="/app/trips"
          className={`flex items-center gap-2 rounded-[3px] px-2 py-2 text-sm ${
            pathname.startsWith("/app/trips")
              ? "bg-paper-raised"
              : "hover:bg-paper-raised"
          }`}
        >
          <span className="font-mono text-[11px] text-steel">
            TR
          </span>

          {!collapsed && <span>Trips</span>}
        </Link>
      </nav>

      {/* Conversations */}
      {!collapsed && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {chats.map((chat) => {
              const active =
                pathname ===
                `/app/c/${chat.conversation_id}`;

              return (
                <Link
                  key={chat.conversation_id}
                  href={`/app/c/${chat.conversation_id}`}
                  className={`mb-0.5 block rounded-[3px] px-2 py-2 ${
                    active
                      ? "bg-paper-raised"
                      : "hover:bg-paper-raised"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm">
                      {chat.title}
                    </p>

                    <Stamp tone={statusTone(chat.status)}>
                      {statusLabel(chat.status)}
                    </Stamp>
                  </div>

                  <p className="mt-1 truncate font-mono text-[10px] text-ink-soft">
                    {chat.cover?.destination || "Unplotted"}
                  </p>
                </Link>
              );
            })}

            {conversations.isSuccess && chats.length === 0 ? (
              <p className="px-2 py-6 text-xs text-ink-soft">
                No briefings yet.
              </p>
            ) : null}
          </div>
        </div>
      )}

      {/* Account */}
      <div
        ref={accountRef}
        className="relative mt-auto border-t border-rule p-2"
      >
        {/* Floating Account Menu */}
        {accountOpen && !collapsed ? (
          <div
            className="
              absolute
              bottom-[calc(100%+8px)]
              left-2
              right-2
              z-50

              rounded-lg
              border
              border-rule

              bg-[#f3f2ee]
              p-2

              shadow-[0_10px_30px_rgba(0,0,0,0.18)]

              dark:bg-[#20201f]
              dark:shadow-[0_10px_30px_rgba(0,0,0,0.45)]
            "
          >
            {/* Account information */}
            <div className="px-2 py-1">
              <p className="truncate text-sm">
                {displayName}
              </p>

              <p className="truncate pt-0.5 text-xs text-ink-soft">
                {email}
              </p>
            </div>

            {/* Settings */}
            <Link
              href="/app/settings"
              onClick={() => setAccountOpen(false)}
              className="
                flex
                items-center
                gap-2
                rounded-[3px]
                px-2
                py-2
                text-sm
                hover:bg-paper-raised
              "
            >
              <Settings
                size={15}
                strokeWidth={1.25}
              />

              Settings
            </Link>

            {/* Sign out */}
            <button
              type="button"
              onClick={signOut}
              className="
                flex
                w-full
                items-center
                gap-2
                rounded-[3px]
                px-2
                py-2
                text-left
                text-sm
                text-danger
                hover:bg-paper-raised
              "
            >
              <LogOut
                size={15}
                strokeWidth={1.25}
              />

              Sign out
            </button>
          </div>
        ) : null}

        {/* Bottom Account Bar */}
        <div
          className={`flex items-center gap-1 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          {/* Theme Toggle */}
          <button
            type="button"
            onClick={() =>
              setTheme(
                resolvedTheme === "dark"
                  ? "light"
                  : "dark"
              )
            }
            className="rounded-[3px] p-2 text-ink-soft hover:bg-paper-raised"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun
                size={16}
                strokeWidth={1.25}
              />
            ) : (
              <Moon
                size={16}
                strokeWidth={1.25}
              />
            )}
          </button>

          {/* Account Button */}
          <button
            type="button"
            onClick={() =>
              setAccountOpen((open) => !open)
            }
            aria-expanded={accountOpen}
            aria-label="Open account menu"
            className={`flex items-center gap-2 rounded-[3px] py-1.5 text-left text-sm ${
              collapsed
                ? "h-10 w-10 justify-center px-0"
                : `min-w-0 flex-1 px-2 ${
                    accountOpen
                      ? "bg-paper-raised"
                      : "hover:bg-paper-raised"
                  }`
            }`}
          >
            <span
              className="
                flex
                h-7
                w-7
                shrink-0
                items-center
                justify-center
                rounded-full
                bg-brass
                font-mono
                text-[12px]
                text-paper
              "
            >
              {initials}
            </span>

            {!collapsed && (
              <span className="truncate">
                {displayName}
              </span>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
