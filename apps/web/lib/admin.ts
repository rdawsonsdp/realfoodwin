// Admin gate. In dev (or when no allowlist set), any authed user is admin.
// In prod, set ADMIN_IMPERSONATE_EMAILS=comma,separated,emails — that same
// list governs admin-only routes.
//
// In addition, a successful Test Login → "Sign in as Admin" flow sets an
// httpOnly `rfw-test-admin` cookie. Any request carrying that cookie is
// treated as admin regardless of email, so demo admins can reach the admin
// portal (model picker, personas, retention, etc.) without env-var setup.

import { cookies } from "next/headers";

const ADMIN_COOKIE = "rfw-test-admin";

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowlist = process.env.ADMIN_IMPERSONATE_EMAILS;
  if (!allowlist) return process.env.NODE_ENV !== "production";
  return allowlist
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .includes(email.toLowerCase());
}

export function hasAdminCookie(): boolean {
  try {
    return cookies().get(ADMIN_COOKIE)?.value === "1";
  } catch {
    return false;
  }
}

// Server-side admin check that combines the email allowlist and the
// test-login cookie. Use this in admin route guards and the Nav.
export function isAdminRequest(email: string | null | undefined): boolean {
  return isAdminEmail(email) || hasAdminCookie();
}
