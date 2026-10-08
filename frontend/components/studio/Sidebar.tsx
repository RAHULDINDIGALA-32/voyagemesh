"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Moon,
  PanelLeft,
  Plus,
  Settings,
  Sun,
  LogOut,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Map
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { deleteConversation, listConversations, renameConversation } from "@/lib/api/trips";
import { useAccessToken } from "@/lib/hooks/useAccessToken";
import { createClient } from "@/lib/supabase/client";
import { useUiStore } from "@/stores/ui";

const subscribeToHydration = () => () => { };

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { token, email, fullName } = useAccessToken();
  const [accountOpen, setAccountOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
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

  useEffect(() => {
    function closeMenu(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpenMenu(null);
    }
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
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

  async function saveRename() {
    if (!token || !renameId || !renameValue.trim()) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await renameConversation(token, renameId, renameValue.trim());
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      await queryClient.invalidateQueries({ queryKey: ["conversation"] });
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
      setRenameId(null);
      setOpenMenu(null);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Unable to rename chat");
    } finally {
      setActionBusy(false);
    }
  }

  async function confirmDelete() {
    if (!token || !deleteTarget) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await deleteConversation(token, deleteTarget.id);
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      await queryClient.invalidateQueries({ queryKey: ["trips"] });
      if (pathname === `/app/c/${deleteTarget.id}`) router.replace("/app");
      setDeleteTarget(null);
      setOpenMenu(null);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Unable to delete chat");
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <aside
      className={`flex h-full shrink-0 flex-col overflow-hidden border-r border-rule bg-paper transition-[width] duration-200 ease-out ${collapsed ? "w-16" : "w-[280px]"
        }`}
    >
      <div
        className={`flex border-b border-rule ${collapsed
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
            className={`rounded-[3px] p-1.5 text-ink-soft hover:bg-paper-raised ${searchOpen ? "bg-paper-raised text-ink" : ""
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
          className={`flex items-center gap-2 rounded-[3px] px-2 py-2 text-sm ${pathname === "/app" ? "bg-paper-raised" : "hover:bg-paper-raised"
            } ${collapsed ? "justify-center px-0" : ""}`}
        >
          <Plus size={16} strokeWidth={1.25} />
          {!collapsed && <span>New</span>}
        </Link>

        <Link
          href="/app/trips"
          className={`flex items-center gap-2 rounded-[3px] px-2 py-2 text-sm ${pathname.startsWith("/app/trips") ? "bg-paper-raised" : "hover:bg-paper-raised"
            } ${collapsed ? "justify-center px-0" : ""}`}
        >
          {<Map size={16} strokeWidth={1.4} className="text-steel" />}
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
                <div
                  key={chat.conversation_id}
                  className={`relative mb-0.5 rounded-[3px] px-2 py-2 ${active ? "bg-paper-raised" : "hover:bg-paper-raised"
                    }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    {renameId === chat.conversation_id ? (
                      <form
                        className="flex min-w-0 flex-1 gap-1"
                        onSubmit={(event) => { event.preventDefault(); void saveRename(); }}
                      >
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(event) => setRenameValue(event.target.value)}
                          onKeyDown={(event) => { if (event.key === "Escape") setRenameId(null); }}
                          className="min-w-0 flex-1 rounded border border-rule bg-paper px-1.5 py-1 text-sm outline-none focus:border-brass"
                          maxLength={120}
                        />
                        <button type="submit" disabled={actionBusy} className="text-xs text-brass"></button>
                      </form>
                    ) : (
                      <Link href={`/app/c/${chat.conversation_id}`} className="min-w-0 flex-1 truncate text-sm">
                        {chat.title}
                      </Link>
                    )}
                    <button
                      type="button"
                      aria-label={`Options for ${chat.title}`}
                      aria-expanded={openMenu === chat.conversation_id}
                      onClick={() => setOpenMenu((current) => current === chat.conversation_id ? null : chat.conversation_id)}
                      className="shrink-0 rounded-md p-1 text-ink-soft opacity-70 hover:bg-paper hover:text-ink group-hover:opacity-100"
                    >
                      <MoreVertical size={16} strokeWidth={1.7} />
                    </button>
                  </div>
                  <p className="mt-1 truncate font-mono text-[10px] text-ink-soft">
                    {chat.cover?.destination || "Unplotted"}
                  </p>
                  {openMenu === chat.conversation_id ? (
                    <div ref={menuRef} className="absolute right-2 top-9 z-50 w-44 rounded-xl border border-rule bg-[#f3f2ee] p-2 shadow-[0_10px_30px_rgba(0,0,0,0.18)] dark:bg-[#20201f] dark:shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-paper-raised"
                        onClick={() => { setRenameId(chat.conversation_id); setRenameValue(chat.title); setOpenMenu(null); }}
                      >
                        <Pencil size={15} strokeWidth={1.6} /> Rename
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-danger hover:bg-red-600/30"
                        onClick={() => { setDeleteTarget({ id: chat.conversation_id, title: chat.title }); setActionError(null); setOpenMenu(null); }}
                      >
                        <Trash2 size={15} strokeWidth={1.6} /> Delete
                      </button>
                    </div>
                  ) : null}
                </div>
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
          className={`flex items-center gap-1 ${collapsed ? "flex-col justify-center" : ""
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
            className={`flex items-center gap-2 rounded-[3px] py-1.5 text-left text-sm ${collapsed
                ? "h-10 w-10 justify-center px-0"
                : `min-w-0 flex-1 px-2 ${accountOpen ? "bg-paper-raised" : "hover:bg-paper-raised"
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
      {deleteTarget ? (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/45 px-4" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="delete-chat-title" className="w-full max-w-md rounded-2xl border border-rule bg-[#f3f2ee] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.18)] dark:bg-[#20201f] dark:shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
            <h2 id="delete-chat-title" className="text-lg font-semibold">Delete chat?</h2>
            <p className="mt-2 text-sm leading-6 text-ink-soft">This chat and its connected trip will be permanently deleted. This action cannot be undone.</p>
            {actionError ? <p className="mt-3 text-sm text-red-300">{actionError}</p> : null}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" disabled={actionBusy} onClick={() => setDeleteTarget(null)} className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/15">Cancel</button>
              <button type="button" disabled={actionBusy} onClick={() => void confirmDelete()} className="rounded-lg border border-red-300 bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-[0_0_0_2px_rgba(239,68,68,0.35)] hover:bg-red-400">{actionBusy ? "Deleting…" : "Delete"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
