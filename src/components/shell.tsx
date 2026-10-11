"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApp } from "./app-context";
import { ClockIcon, ListIcon, SearchIcon } from "./icons";
import { PersonDrawer } from "./person-drawer";
import { UpgradeModal } from "./upgrade";

const NAV = [
  { href: "/", label: "Search", Icon: SearchIcon },
  { href: "/shortlists", label: "Shortlists", Icon: ListIcon },
  { href: "/saved", label: "Saved", Icon: ClockIcon },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function PlanPill() {
  const { plan, setUpgradeOpen } = useApp();
  if (!plan) return null;
  if (plan.plan === "paid") {
    return (
      <button className="plan-pill paid" onClick={() => setUpgradeOpen(true)}>
        <span className="dot" /> Paid plan
      </button>
    );
  }
  const left = plan.searches_remaining ?? 0;
  return (
    <>
      <button className={`plan-pill ${left === 0 ? "out" : ""}`} onClick={() => setUpgradeOpen(true)} title="About the Free plan">
        <span className="dot" /> Free · {left} <span className="hide-sm">{left === 1 ? "search" : "searches"}</span> left
      </button>
      <button className="btn btn-primary btn-sm" onClick={() => setUpgradeOpen(true)}>
        Upgrade
      </button>
    </>
  );
}

/** Header, phone tab bar and the app-wide overlays. Redirects to /login when signed out. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, ready, plan, signOut, lastSearchHref } = useApp();
  const pathname = usePathname();
  // The Search tab returns to the search on screen; the logo starts a new one.
  const navHref = (href: string) => (href === "/" ? lastSearchHref : href);
  const router = useRouter();

  useEffect(() => {
    if (ready && !session) router.replace("/login");
  }, [ready, session, router]);

  if (!ready || !session) return null;

  return (
    <>
      <header className="header">
        <Link href="/" className="brand">
          <span className="brand-mark">H</span> HireFast
        </Link>
        <nav className="nav" aria-label="Main">
          {NAV.map(({ href, label, Icon }) => (
            <Link key={href} href={navHref(href)} className={isActive(pathname, href) ? "active" : ""}>
              <Icon /> {label}
            </Link>
          ))}
        </nav>
        <div className="header-right">
          <PlanPill />
          <span className="account">{plan?.company.name}</span>
          <button className="btn btn-ghost btn-sm" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      {children}

      <nav className="tabbar" aria-label="Main">
        {NAV.map(({ href, label, Icon }) => (
          <Link key={href} href={navHref(href)} className={isActive(pathname, href) ? "active" : ""}>
            <Icon width={20} height={20} /> {label}
          </Link>
        ))}
      </nav>

      <PersonDrawer />
      <UpgradeModal />
    </>
  );
}
