// Admin gate. In dev (or when no allowlist set), any authed user is admin.
// In prod, set ADMIN_IMPERSONATE_EMAILS=comma,separated,emails — that same
// list governs admin-only routes.

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowlist = process.env.ADMIN_IMPERSONATE_EMAILS;
  if (!allowlist) return process.env.NODE_ENV !== "production";
  return allowlist
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .includes(email.toLowerCase());
}
