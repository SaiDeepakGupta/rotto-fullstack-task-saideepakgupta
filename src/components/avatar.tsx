"use client";

import { useState } from "react";

/** Candidate portrait, falling back to initials if the image can't load. */
export function Avatar({ src, name, large }: { src: string; name: string; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const cls = `avatar ${large ? "lg" : ""}`;
  if (failed) {
    const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("");
    return <div className={`${cls} avatar-fallback`} aria-hidden>{initials}</div>;
  }
  return <img className={cls} src={src} alt="" loading="lazy" onError={() => setFailed(true)} />;
}

/** Company logo that disappears instead of showing a broken image. */
export function Logo({ src, size = "sm" }: { src: string; size?: "sm" | "md" }) {
  const [failed, setFailed] = useState(false);
  if (failed) return size === "md" ? <div className="logo md" aria-hidden /> : null;
  return <img className={`logo ${size === "md" ? "md" : ""}`} src={src} alt="" loading="lazy" onError={() => setFailed(true)} />;
}
