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
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { Stamp } from "@/components/ui/Stamp";
import { listConversations } from "@/lib/api/trips";
import { useAccessToken } from "@/lib/hooks/useAccessToken";
import { createClient } from "@/lib/supabase/client";
import { useUiStore } from "@/stores/ui";

function statusTone(status: string): "ink" | "brass" | "olive" | "danger" {
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

const subscribeToHydration = () => () => {};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { token, email, fullName } = useAccessToken();
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const { setTheme, resolvedTheme } = useTheme();
  // Keep the server HTML and the first client render identical. next-themes reads
  // localStorage/media settings only after hydration.
  const mounted = useSyncExternalStore(subscribeToHydration, () => true, () => false);

  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const searchOpen = useUiStore((state) => state.searchOpen);
  const toggleSearch = useUiStore((state) => state.toggleSearch);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!accountRef.current?.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const displayName = fullName?.trim() || email?.split("@")[0] || "Account";
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const conversations = useQuery({
    queryKey: ["conversations", token],
    queryFn: () => listConversations(token!),
    enabled: Boolean(token),
  });

  const chats = conversations.data ?? [];

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <aside
      className={`flex h-full shrink-0 flex-col overflow-hidden border-r border-rule bg-paper transition-[width] duration-200 ease-out ${
        collapsed ? "w-16" : "w-[280px]"
      }`}
    >
      <div
        className={`flex border-b border-rule ${
          collapsed
            ? "flex-col items-center gap-1 px-1 py-2"
            : "items-center justify-between gap-2 px-3 py-3"
        }`}
      >
        {collapsed ? (
          <span className="py-1 font-mono text-[11px] tracking-[0.18em] text-brass">VM</span>
        ) : (
          <Wordmark href="/app" />
        )}

        <div className={`flex items-center ${collapsed ? "flex-col gap-1" : "gap-0.5"}`}>
          <button
            type="button"
            data-search-trigger
            onClick={toggleSearch}
            aria-label="Search chats and trips"
            aria-expanded={searchOpen}
            className={`rounded-[3px] p-1.5 text-ink-soft hover:bg-paper-raised ${
              searchOpen ? "bg-paper-raised text-ink" : ""
            }`}
          >
            <Search size={16} strokeWidth={1.25} />
          </button>
          <button
            type="button"
            onClick={toggleSidebar}
            className="rounded-[3px] p-1.5 text-ink-soft hover:bg-paper-raised"
            aria-label="Toggle sidebar"
          >
            <PanelLeft size={16} strokeWidth={1.25} />
          </button>
        </div>
      </div>

      <nav className="flex flex-col gap-1 border-b border-rule p-2">
        <Link
          href="/app"
          className={`flex items-center gap-2 rounded-[3px] px-2 py-2 text-sm ${
            pathname === "/app" ? "bg-paper-raised" : "hover:bg-paper-raised"
          } ${collapsed ? "justify-center px-0" : ""}`}
        >
          <Plus size={16} strokeWidth={1.25} />
          {!collapsed && <span>New</span>}
        </Link>

        <Link
          href="/app/trips"
          className={`flex items-center gap-2 rounded-[3px] px-2 py-2 text-sm ${
            pathname.startsWith("/app/trips") ? "bg-paper-raised" : "hover:bg-paper-raised"
          } ${collapsed ? "justify-center px-0" : ""}`}
        >
          <span className="font-mono text-[11px] text-steel">TR</span>
          {!collapsed && <span>Trips</span>}
        </Link>
      </nav>

      {!collapsed && (
        <div className="flex min-h-0 flex-1 flex-col ">
          <p className="px-3 py-1 text-s text-ink-soft mt-2">Trip chats</p>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 mt-2">
            {chats.map((chat) => {
              const active = pathname === `/app/c/${chat.conversation_id}`;
              return (
                <Link
                  key={chat.conversation_id}
                  href={`/app/c/${chat.conversation_id}`}
                  className={`mb-0.5 block rounded-[3px] px-2 py-2 ${
                    active ? "bg-paper-raised" : "hover:bg-paper-raised"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm">{chat.title}</p>
                    <Stamp tone={statusTone(chat.status)}>{statusLabel(chat.status)}</Stamp>
                  </div>
                  <p className="mt-1 truncate font-mono text-[10px] text-ink-soft">
                    {chat.cover?.destination || "Unplotted"}
                  </p>
                </Link>
              );
            })}

            {conversations.isSuccess && chats.length === 0 ? (
              <p className="px-2 py-6 text-xs text-ink-soft">No briefings yet.</p>
            ) : null}
          </div>
        </div>
      )}

      <div ref={accountRef} className="relative mt-auto border-t border-rule p-2">
        {accountOpen && !collapsed ? (
          <div className="absolute bottom-[calc(100%+8px)] left-2 right-2 z-50 rounded-lg border border-rule bg-[#f3f2ee] p-2 shadow-[0_10px_30px_rgba(0,0,0,0.18)] dark:bg-[#20201f] dark:shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
            <div className="px-2 py-1">
              <p className="truncate text-sm">{displayName}</p>
              <p className="truncate pt-0.5 text-xs text-ink-soft">{email}</p>
            </div>
            <Link
              href="/app/settings"
              onClick={() => setAccountOpen(false)}
              className="flex items-center gap-2 rounded-[3px] px-2 py-2 text-sm hover:bg-paper-raised"
            >
              <Settings size={15} strokeWidth={1.25} />
              Settings
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="flex w-full items-center gap-2 rounded-[3px] px-2 py-2 text-left text-sm text-danger hover:bg-paper-raised"
            >
              <LogOut size={15} strokeWidth={1.25} />
              Sign out
            </button>
          </div>
        ) : null}

        <div
          className={`flex items-center gap-1 ${
            collapsed ? "flex-col justify-center" : ""
          }`}
        >
          <button
            type="button"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="rounded-[3px] p-2 text-ink-soft hover:bg-paper-raised"
            aria-label="Toggle theme"
          >
            {mounted && resolvedTheme === "dark" ? (
              <Sun size={16} strokeWidth={1.25} />
            ) : (
              <Moon size={16} strokeWidth={1.25} />
            )}
          </button>

          <button
            type="button"
            onClick={() => setAccountOpen((open) => !open)}
            aria-expanded={accountOpen}
            aria-label="Open account menu"
            className={`flex items-center gap-2 rounded-[3px] py-1.5 text-left text-sm ${
              collapsed
                ? "h-10 w-10 justify-center px-0"
                : `min-w-0 flex-1 px-2 ${
                    accountOpen ? "bg-paper-raised" : "hover:bg-paper-raised"
                  }`
            }`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brass font-mono text-[12px] text-paper">
              {initials}
            </span>
            {!collapsed && <span className="truncate">{displayName}</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
