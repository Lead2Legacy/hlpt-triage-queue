import { NextRequest, NextResponse } from "next/server";
import { verifyIngestToken } from "@/lib/auth";
import { upsertTicket } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUIRED_FIELDS = ["source_ticket_id", "source_platform", "source_url", "team", "channel"] as const;

export async function POST(request: NextRequest) {
  if (!verifyIngestToken(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const missing = REQUIRED_FIELDS.filter((field) => typeof body[field] !== "string" || !body[field]);
  if (missing.length) {
    return NextResponse.json({ ok: false, error: "missing_fields", fields: missing }, { status: 400 });
  }

  const openedAt = typeof body.opened_at === "number" ? body.opened_at : null;
  const id = upsertTicket({
    source_ticket_id: String(body.source_ticket_id),
    source_platform: String(body.source_platform),
    source_url: String(body.source_url),
    team: String(body.team),
    channel: String(body.channel),
    summary: typeof body.summary === "string" ? body.summary : null,
    customer: typeof body.customer === "string" ? body.customer : null,
    opened_at: openedAt,
    payload_json: JSON.stringify(body),
  });

  return NextResponse.json({ ok: true, id });
}
