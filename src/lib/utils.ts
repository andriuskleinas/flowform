import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Build a 1–2 character initials string from a user's profile.
 * Falls back to display_name, then to the local part of the email.
 */
export function getInitialsFromProfile(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  displayName: string | null | undefined,
  email: string,
) {
  const first = firstName?.trim();
  const last = lastName?.trim();
  if (first || last) {
    return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";
  }
  const name = displayName?.trim();
  if (name) {
    const parts = name.split(/\s+/).slice(0, 2);
    return parts
      .map((p) => p[0])
      .join("")
      .toUpperCase();
  }
  return (email.split("@")[0] || "?").slice(0, 2).toUpperCase();
}

/**
 * Build a 1–2 character initials string from a free-form name.
 * Used for testimonial avatars and similar non-profile contexts.
 */
export function getInitialsFromName(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Human-readable relative time, e.g. "just now", "5m ago", "3h ago", "2d ago".
 */
export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
