"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Wordmark } from "@/components/brand/Wordmark";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/app";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      if (mode === "signup") {
        const { error: signError } = await supabase.auth.signUp({ email, password });
        if (signError) {
          setError(signError.message);
          return;
        }
      } else {
        const { error: signError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signError) {
          setError(signError.message);
          return;
        }
      }
      router.push(next);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to authenticate");
    } finally {
      setPending(false);
    }
  }

  async function onGoogle() {
    const supabase = createClient();
    const origin = window.location.origin;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-16">
      <Wordmark />
      <p className="mt-8 font-display text-3xl leading-tight">
        {mode === "login" ? "Sign in to the Chart Room" : "Open a Chart Room desk"}
      </p>
      <p className="mt-3 max-w-sm text-sm text-ink-soft">
        Email or Google. Voyages stay attached to your account.
      </p>
      <form onSubmit={onSubmit} className="mt-10 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-[12px] uppercase tracking-[0.14em] text-ink-soft">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-[3px] border border-rule bg-paper px-3 py-2 font-sans text-sm tracking-normal text-ink normal-case"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[12px] uppercase tracking-[0.14em] text-ink-soft">
          Password
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rounded-[3px] border border-rule bg-paper px-3 py-2 font-sans text-sm tracking-normal text-ink normal-case"
          />
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" variant="brass" disabled={pending}>
          {pending ? "Working…" : mode === "login" ? "Enter" : "Create desk"}
        </Button>
        <Button type="button" onClick={onGoogle}>
          Continue with Google
        </Button>
      </form>
      <p className="mt-8 text-sm text-ink-soft">
        {mode === "login" ? (
          <>
            No desk yet?{" "}
            <Link href="/signup" className="text-steel underline-offset-2 hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already commissioned?{" "}
            <Link href="/login" className="text-steel underline-offset-2 hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </main>
  );
}

export function AuthScreen({ mode }: { mode: "login" | "signup" }) {
  return (
    <Suspense fallback={<main className="min-h-full" />}>
      <AuthForm mode={mode} />
    </Suspense>
  );
}
