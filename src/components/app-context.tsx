"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { api } from "@/lib/client/api";
import { browserSupabase } from "@/lib/client/supabase";
import type { PlanInfo, Shortlist } from "@/lib/types";

type AppState = {
  session: Session | null;
  ready: boolean;
  plan: PlanInfo | null;
  refreshPlan: () => Promise<void>;
  shortlists: Shortlist[];
  refreshShortlists: () => Promise<void>;
  personId: string | null;
  openPerson: (id: string | null) => void;
  /** URL of the search on screen, so the Search tab returns to it. */
  lastSearchHref: string;
  setLastSearchHref: (href: string) => void;
  upgradeOpen: boolean;
  setUpgradeOpen: (open: boolean) => void;
  toast: (message: string) => void;
  signOut: () => Promise<void>;
};

const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [shortlists, setShortlists] = useState<Shortlist[]>([]);
  const [personId, openPerson] = useState<string | null>(null);
  const [lastSearchHref, setLastSearchHref] = useState("/");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const supabase = browserSupabase();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const refreshPlan = useCallback(async () => {
    try {
      setPlan(await api<PlanInfo>("/api/plan"));
    } catch {
      /* the header simply shows no plan */
    }
  }, []);

  const refreshShortlists = useCallback(async () => {
    try {
      setShortlists(await api<Shortlist[]>("/api/shortlists"));
    } catch {
      /* lists show their own errors where they are rendered */
    }
  }, []);

  const signedIn = Boolean(session);
  useEffect(() => {
    if (!signedIn) return;
    refreshPlan();
    refreshShortlists();
  }, [signedIn, refreshPlan, refreshShortlists]);

  const toast = useCallback((message: string) => {
    setToastMessage(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 2400);
  }, []);

  const signOut = useCallback(async () => {
    await browserSupabase().auth.signOut();
    setPlan(null);
    setShortlists([]);
    setLastSearchHref("/");
  }, []);

  const value = useMemo<AppState>(
    () => ({
      session, ready, plan, refreshPlan, shortlists, refreshShortlists,
      personId, openPerson, lastSearchHref, setLastSearchHref, upgradeOpen, setUpgradeOpen, toast, signOut,
    }),
    [session, ready, plan, refreshPlan, shortlists, refreshShortlists, personId, lastSearchHref, upgradeOpen, toast, signOut],
  );

  return (
    <AppContext.Provider value={value}>
      {children}
      {toastMessage && (
        <div className="toast" role="status">
          {toastMessage}
        </div>
      )}
    </AppContext.Provider>
  );
}
