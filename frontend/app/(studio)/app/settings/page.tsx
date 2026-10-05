"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { useAccessToken } from "@/lib/hooks/useAccessToken";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const subscribeToHydration = () => () => {};

export default function SettingsPage() {
  const { email } = useAccessToken();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const mounted = useSyncExternalStore(subscribeToHydration, () => true, () => false);

  return (
    <main className="mx-auto max-w-xl px-8 py-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-brass">Plate 07</p>
      <h1 className="mt-2 font-display text-4xl">Desk</h1>
      <dl className="mt-8 space-y-4 text-sm">
        <div>
          <dt className="text-ink-soft">Signed in as</dt>
          <dd className="mt-1 font-mono">{email ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-ink-soft">Theme</dt>
          <dd className="mt-2 flex gap-2">
            {(["light", "dark", "system"] as const).map((value) => (
              <Button
                key={value}
                type="button"
                variant={mounted && theme === value ? "brass" : "rule"}
                onClick={() => setTheme(value)}
              >
                {value}
              </Button>
            ))}
          </dd>
        </div>
      </dl>
      <Button
        className="mt-10"
        type="button"
        onClick={async () => {
          const supabase = createClient();
          await supabase.auth.signOut();
          router.push("/");
          router.refresh();
        }}
      >
        Sign out
      </Button>
    </main>
  );
}
