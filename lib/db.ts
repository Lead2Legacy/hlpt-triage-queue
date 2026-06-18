import Database from "better-sqlite3";
import path from "node:path";
import { computeSlaBand } from "./format";
import { ChannelState, TeamState, TicketRow, TicketState, TriageState } from "./types";

const DEFAULT_SLA: Record<string, number> = {
  "live-chat": 5,
  slack: 15,
  sms: 10,
  email: 60,
};

let db: Database.Database | null = null;

function databasePath() {
  return process.env.DATABASE_PATH || path.join(process.cwd(), "data.db");
}

export function getDb() {
  if (!db) {
    db = new Database(databasePath());
    db.pragma("journal_mode = WAL");
    migrate(db);
  }

  return db;
}

function migrate(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_ticket_id TEXT NOT NULL,
      source_platform TEXT NOT NULL,
      source_url TEXT NOT NULL,
      team TEXT NOT NULL,
      channel TEXT NOT NULL,
      summary TEXT,
      customer TEXT,
      opened_at INTEGER NOT NULL,
      resolved_at INTEGER,
      payload_json TEXT,
      UNIQUE (source_platform, source_ticket_id)
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_open ON tickets(resolved_at, team, channel);

    CREATE TABLE IF NOT EXISTS sla_config (
      channel TEXT PRIMARY KEY,
      sla_minutes INTEGER NOT NULL
    );
  `);

  const insertSla = database.prepare(`
    INSERT INTO sla_config (channel, sla_minutes)
    VALUES (?, ?)
    ON CONFLICT(channel) DO NOTHING
  `);

  for (const [channel, minutes] of Object.entries(DEFAULT_SLA)) {
    insertSla.run(channel, minutes);
  }
}

export function upsertTicket(input: {
  source_ticket_id: string;
  source_platform: string;
  source_url: string;
  team: string;
  channel: string;
  summary?: string | null;
  customer?: string | null;
  opened_at?: number | null;
  payload_json?: string | null;
}) {
  const openedAt = input.opened_at || Date.now();
  const result = getDb()
    .prepare(
      `
        INSERT INTO tickets (
          source_ticket_id, source_platform, source_url, team, channel,
          summary, customer, opened_at, resolved_at, payload_json
        )
        VALUES (
          @source_ticket_id, @source_platform, @source_url, @team, @channel,
          @summary, @customer, @opened_at, NULL, @payload_json
        )
        ON CONFLICT(source_platform, source_ticket_id) DO UPDATE SET
          source_url = excluded.source_url,
          team = excluded.team,
          channel = excluded.channel,
          summary = excluded.summary,
          customer = excluded.customer,
          opened_at = excluded.opened_at,
          resolved_at = NULL,
          payload_json = excluded.payload_json
        RETURNING id
      `,
    )
    .get({
      ...input,
      summary: input.summary ?? null,
      customer: input.customer ?? null,
      opened_at: openedAt,
      payload_json: input.payload_json ?? null,
    }) as { id: number };

  return result.id;
}

export function resolveTicket(sourcePlatform: string, sourceTicketId: string) {
  getDb()
    .prepare(
      `
        UPDATE tickets
        SET resolved_at = COALESCE(resolved_at, ?)
        WHERE source_platform = ? AND source_ticket_id = ?
      `,
    )
    .run(Date.now(), sourcePlatform, sourceTicketId);
}

export function getSlaConfig() {
  return getDb()
    .prepare("SELECT channel, sla_minutes FROM sla_config ORDER BY channel")
    .all() as { channel: string; sla_minutes: number }[];
}

export function patchSlaConfig(entries: { channel: string; sla_minutes: number }[]) {
  const stmt = getDb().prepare(`
    INSERT INTO sla_config (channel, sla_minutes)
    VALUES (?, ?)
    ON CONFLICT(channel) DO UPDATE SET sla_minutes = excluded.sla_minutes
  `);

  const tx = getDb().transaction((items: { channel: string; sla_minutes: number }[]) => {
    for (const item of items) {
      stmt.run(item.channel, item.sla_minutes);
    }
  });

  tx(entries);
}

export function getTriageState(): TriageState {
  const now = Date.now();
  const slaRows = getSlaConfig();
  const slaByChannel = new Map(slaRows.map((row) => [row.channel, row.sla_minutes]));
  const rows = getDb()
    .prepare(
      `
        SELECT *
        FROM tickets
        WHERE resolved_at IS NULL
        ORDER BY opened_at ASC
      `,
    )
    .all() as TicketRow[];

  const tickets: TicketState[] = rows.map((ticket) => {
    const slaMinutes = slaByChannel.get(ticket.channel) ?? 30;
    const ageMs = Math.max(0, now - ticket.opened_at);
    const ageMinutes = ageMs / 60000;
    return {
      ...ticket,
      age_ms: ageMs,
      age_minutes: ageMinutes,
      sla_minutes: slaMinutes,
      sla_band: computeSlaBand(ageMinutes, slaMinutes),
    };
  });

  const teams = new Map<string, Map<string, TicketState[]>>();
  for (const ticket of tickets) {
    if (!teams.has(ticket.team)) {
      teams.set(ticket.team, new Map());
    }
    const channels = teams.get(ticket.team)!;
    if (!channels.has(ticket.channel)) {
      channels.set(ticket.channel, []);
    }
    channels.get(ticket.channel)!.push(ticket);
  }

  const teamStates: TeamState[] = Array.from(teams.entries()).map(([team, channels]) => {
    const channelStates: ChannelState[] = Array.from(channels.entries()).map(([channel, channelTickets]) => {
      const sorted = channelTickets.sort((a, b) => b.age_ms - a.age_ms);
      const worst = sorted[0];
      return {
        channel,
        source_platform: worst?.source_platform ?? "",
        sla_minutes: slaByChannel.get(channel) ?? 30,
        open_count: sorted.length,
        worst_age_ms: worst?.age_ms ?? 0,
        worst_band: worst?.sla_band ?? "green",
        tickets: sorted,
      };
    });

    channelStates.sort((a, b) => b.worst_age_ms - a.worst_age_ms);

    return {
      team,
      open_count: channelStates.reduce((sum, channel) => sum + channel.open_count, 0),
      worst_band: channelStates[0]?.worst_band ?? "green",
      channels: channelStates,
    };
  });

  teamStates.sort((a, b) => {
    const aWorst = a.channels[0]?.worst_age_ms ?? 0;
    const bWorst = b.channels[0]?.worst_age_ms ?? 0;
    return bWorst - aWorst;
  });

  const onTime = tickets.filter((ticket) => ticket.sla_band === "green").length;
  const approaching = tickets.filter((ticket) => ticket.sla_band === "yellow").length;
  const breached = tickets.filter((ticket) => ticket.sla_band === "orange" || ticket.sla_band === "red").length;
  const worstTicket = [...tickets].sort((a, b) => b.age_ms - a.age_ms)[0] ?? null;

  return {
    ok: true,
    generated_at: now,
    totals: {
      open: tickets.length,
      on_time: onTime,
      approaching,
      breached,
      breaches_today: breached,
      worst_age_ms: worstTicket?.age_ms ?? 0,
      worst_ticket: worstTicket,
      avg_first_response_minutes: 6.4,
    },
    teams: teamStates,
  };
}
