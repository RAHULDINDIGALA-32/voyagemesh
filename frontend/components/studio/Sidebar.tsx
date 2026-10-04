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
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { Stamp } from "@/components/ui/Stamp";
import { listConversations } from "@/lib/api/trips";
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
      <div className="flex items-center justify-between gap-2 border-b border-rule px-3 py-3">
        {collapsed ? (
          <span className="font-mono text-[11px] tracking-[0.18em] text-brass">
            VM
          </span>
        ) : (
          <Wordmark href="/app" />
        )}

        <button
          type="button"
          onClick={toggleSidebar}
          className="rounded-[3px] p-1.5 text-ink-soft hover:border hover:border-rule"
          aria-label="Toggle sidebar"
        >
          <PanelLeft size={16} strokeWidth={1.25} />
        </button>
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
          <div className="px-3 py-2">
            <input
              value={chatSearch}
              onChange={(event) =>
                setChatSearch(event.target.value)
              }
              placeholder="Search briefings"
              className="w-full rounded-[3px] border border-rule bg-paper px-2 py-1.5 text-xs text-ink"
            />
          </div>

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