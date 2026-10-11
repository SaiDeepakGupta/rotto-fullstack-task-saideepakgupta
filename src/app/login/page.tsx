"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { browserSupabase } from "@/lib/client/supabase";
import { useApp } from "@/components/app-context";
import { AlertIcon } from "@/components/icons";

export default function LoginPage() {
  const { session, ready } = useApp();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && session) router.replace("/");
  }, [ready, session, router]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await browserSupabase().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(error.message === "Invalid login credentials" ? "That email and password don't match." : error.message);
  }

  return (
    <main className="login">
      <div className="login-card">
        <div className="brand">
          <span className="brand-mark">H</span> HireFast
        </div>
        <h1>Sign in</h1>
        <form onSubmit={signIn}>
          <label>
            Work email
            <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Password
            <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && (
            <div className="alert error" role="alert" style={{ marginTop: 0 }}>
              <AlertIcon /> {error}
            </div>
          )}
          <button className="btn btn-primary" style={{ height: 40 }} disabled={busy}>
            {busy ? <span className="spinner" /> : null} Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
