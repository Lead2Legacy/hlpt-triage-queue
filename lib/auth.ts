import { NextRequest } from "next/server";

// Auth is intentionally deferred for HLPT. Wire dashboard/session checks here
// when the receiving team chooses shared password, OAuth, SSO, or JWT.
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
