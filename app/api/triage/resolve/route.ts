import { NextRequest, NextResponse } from "next/server";
import { verifyIngestToken } from "@/lib/auth";
import { resolveTicket } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  if (typeof body.source_ticket_id !== "string" || typeof body.source_platform !== "string") {
    return NextResponse.json(
      { ok: false, error: "source_ticket_id and source_platform are required" },
      { status: 400 },
    );
  }

  resolveTicket(body.source_platform, body.source_ticket_id);

  return NextResponse.json({ ok: true });
}
