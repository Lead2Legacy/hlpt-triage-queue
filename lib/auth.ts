import { NextRequest } from "next/server";

// Auth is intentionally deferred for HLPT. Wire dashboard/session checks here
// when the receiving team chooses shared password, OAuth, SSO, or JWT.
//
// Recipe 1: shared password
// - Add DASHBOARD_PASSWORD to the host env.
// - Put a small login page in front of the dashboard that sets an httpOnly cookie.
// - In requireDashboardUser(), read cookies() and compare the signed cookie value.
//
// Recipe 2: Google OAuth via NextAuth
// - Install NextAuth only when HLPT chooses this route: npm install next-auth.
// - Configure GoogleProvider with HLPT's Google Workspace OAuth client.
// - In requireDashboardUser(), call auth() and reject when no session exists.
// - Keep /api/triage/ingest token auth separate from dashboard login.
//
// Recipe 3: reverse-proxy auth
// - Put the app behind Cloudflare Access, Tailscale Serve/Funnel, Okta, or an
//   internal proxy that handles login before traffic reaches Next.js.
// - Configure the proxy to pass a trusted identity header such as X-Forwarded-Email.
// - In requireDashboardUser(), check that header and reject missing identities.
export async function requireDashboardUser() {
  return { ok: true as const, user: null };
}

export function verifyIngestToken(request: NextRequest) {
  const expected = process.env.TRIAGE_INGEST_TOKEN;
  if (!expected) {
    return true;
  }

  return request.headers.get("x-triage-token") === expected;
}
