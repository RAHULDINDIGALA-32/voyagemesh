"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useAccessToken() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data, error }) => {
        if (error) throw error;
        setToken(data.session?.access_token ?? null);
        setEmail(data.session?.user.email ?? null);
        setFullName((data.session?.user.user_metadata?.full_name as string | undefined) ?? null);
        setReady(true);
      }).catch(() => setReady(true));
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        setToken(session?.access_token ?? null);
        setEmail(session?.user.email ?? null);
        setFullName((session?.user.user_metadata?.full_name as string | undefined) ?? null);
      });
      return () => data.subscription.unsubscribe();
    } catch {
      queueMicrotask(() => setReady(true));
    }
  }, []);

  return { token, email, fullName, ready };
}
