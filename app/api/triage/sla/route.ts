import { NextRequest, NextResponse } from "next/server";
import { getSlaConfig, patchSlaConfig } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, sla: getSlaConfig() });
}

export async function PATCH(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const entries = Array.isArray(body) ? body : (body as { sla?: unknown }).sla;
  if (!Array.isArray(entries)) {
    return NextResponse.json({ ok: false, error: "expected array or { sla: [...] }" }, { status: 400 });
  }

  const parsed = entries.map((entry) => {
    const item = entry as { team?: unknown; channel?: unknown; sla_minutes?: unknown };
    return {
      team: typeof item.team === "string" && item.team.trim() ? item.team.trim() : "default",
      channel: typeof item.channel === "string" ? item.channel : "",
      sla_minutes: Number(item.sla_minutes),
    };
  });

  const invalid = parsed.filter((entry) => !entry.channel || !Number.isInteger(entry.sla_minutes) || entry.sla_minutes < 1);
  if (invalid.length) {
    return NextResponse.json({ ok: false, error: "invalid_sla_entries" }, { status: 400 });
  }

  patchSlaConfig(parsed);

  return NextResponse.json({ ok: true, sla: getSlaConfig() });
}
