export type SlaBand = "green" | "yellow" | "orange" | "red";

export type TicketRow = {
  id: number;
  source_ticket_id: string;
  source_platform: string;
  source_url: string;
  team: string;
  channel: string;
  summary: string | null;
  customer: string | null;
  opened_at: number;
  resolved_at: number | null;
  payload_json: string | null;
};

export type TicketState = TicketRow & {
  age_ms: number;
  age_minutes: number;
  sla_minutes: number;
  sla_band: SlaBand;
};

export type ChannelState = {
  team: string;
  channel: string;
  source_platform: string;
  sla_minutes: number;
  open_count: number;
  worst_age_ms: number;
  worst_band: SlaBand;
  tickets: TicketState[];
};

export type TeamState = {
  team: string;
  open_count: number;
  worst_band: SlaBand;
  channels: ChannelState[];
};

export type TriageState = {
  ok: true;
  generated_at: number;
  totals: {
    open: number;
    on_time: number;
    approaching: number;
    breached: number;
    breaches_today: number;
    worst_age_ms: number;
    worst_ticket: TicketState | null;
    avg_first_response_minutes: number;
  };
  teams: TeamState[];
};

export type SlaConfigRow = {
  team: string;
  channel: string;
  sla_minutes: number;
};
