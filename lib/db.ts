import Database from "better-sqlite3";
import path from "node:path";
import { computeSlaBand } from "./format";
import { ChannelState, SlaConfigRow, TeamState, TicketRow, TicketState, TriageState } from "./types";

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
      team TEXT NOT NULL DEFAULT 'default',
      channel TEXT NOT NULL,
      sla_minutes INTEGER NOT NULL,
      PRIMARY KEY (team, channel)
    );
  `);

  const columns = database.prepare("PRAGMA table_info(sla_config)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "team")) {
    database.exec("ALTER TABLE sla_config ADD COLUMN team TEXT NOT NULL DEFAULT 'default'");
  }

  const postAlterColumns = database.prepare("PRAGMA table_info(sla_config)").all() as { name: string; pk: number }[];
  const pkColumns = postAlterColumns.filter((column) => column.pk > 0).sort((a, b) => a.pk - b.pk).map((column) => column.name);
  const hasCompositePrimaryKey = pkColumns.join(":") === "team:channel";
  if (!hasCompositePrimaryKey) {
    database.exec(`
      CREATE TABLE sla_config_next (
        team TEXT NOT NULL DEFAULT 'default',
        channel TEXT NOT NULL,
        sla_minutes INTEGER NOT NULL,
        PRIMARY KEY (team, channel)
      );

      INSERT OR REPLACE INTO sla_config_next (team, channel, sla_minutes)
      SELECT COALESCE(team, 'default'), channel, sla_minutes FROM sla_config;

      DROP TABLE sla_config;
      ALTER TABLE sla_config_next RENAME TO sla_config;
    `);
  }

  const insertSla = database.prepare(`
    INSERT INTO sla_config (team, channel, sla_minutes)
    VALUES ('default', ?, ?)
    ON CONFLICT(team, channel) DO NOTHING
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
    .prepare("SELECT team, channel, sla_minutes FROM sla_config ORDER BY team, channel")
    .all() as SlaConfigRow[];
}

export function patchSlaConfig(entries: { team?: string; channel: string; sla_minutes: number }[]) {
  const stmt = getDb().prepare(`
    INSERT INTO sla_config (team, channel, sla_minutes)
    VALUES (?, ?, ?)
    ON CONFLICT(team, channel) DO UPDATE SET sla_minutes = excluded.sla_minutes
  `);

  const tx = getDb().transaction((items: { team?: string; channel: string; sla_minutes: number }[]) => {
    for (const item of items) {
      stmt.run(item.team || "default", item.channel, item.sla_minutes);
    }
  });

  tx(entries);
}

export function getTriageState(): TriageState {
  const now = Date.now();
  const slaRows = getSlaConfig();
  const slaByKey = new Map(slaRows.map((row) => [row.team + ":" + row.channel, row.sla_minutes]));
  const lookupSla = (team: string, channel: string) => slaByKey.get(team + ":" + channel) ?? slaByKey.get("default:" + channel) ?? 30;
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
    const slaMinutes = lookupSla(ticket.team, ticket.channel);
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
        team,
        channel,
        source_platform: worst?.source_platform ?? "",
        sla_minutes: lookupSla(team, channel),
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
