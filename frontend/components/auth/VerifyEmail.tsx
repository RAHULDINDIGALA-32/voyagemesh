"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Wordmark } from "@/components/brand/Wordmark";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

export function VerifyEmail() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const validEmail = useMemo(() => email.trim().includes("@"), [email]);

  async function resend() {
    if (!validEmail) return;
    setPending(true); setStatus(null); setError(null);
    const { error: resendError } = await createClient().auth.resend({
      type: "signup", email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/app` },
    });
    if (resendError) setError(resendError.message);
    else setStatus("A fresh verification link is on its way. Check your inbox and spam folder.");
    setPending(false);
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-16">
      <Wordmark />
      <p className="mt-8 font-display text-3xl leading-tight">Confirm your email</p>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">Follow the link in the verification email sent to below email.</p>
      <label className="mt-8 flex flex-col gap-1.5 text-[12px] uppercase tracking-[0.14em] text-ink-soft">
        Email address
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="rounded-[3px] border border-rule bg-paper px-3 py-2 text-sm tracking-normal text-ink" />
      </label>
      {status ? <p className="mt-4 text-sm text-olive">{status}</p> : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      <Button className="mt-5" type="button" variant="brass" disabled={!validEmail || pending} onClick={() => void resend()}>{pending ? "Sending…" : "Resend verification email"}</Button>
      <Link href="/login" className="mt-6 text-sm text-steel underline-offset-2 hover:underline">Return to sign in</Link>
    </main>
  );
}
