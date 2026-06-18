"use client";

import { useEffect, useMemo, useState } from "react";
import { channelIcon, displayChannel, displayTeam } from "@/lib/format";
import { ChannelState, SlaBand, TeamState, TicketState, TriageState } from "@/lib/types";

function fmt(ms: number) {
  const safeMs = Math.max(0, ms);
  const minutes = Math.floor(safeMs / 60000);
  const seconds = Math.floor((safeMs % 60000) / 1000);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return String(hours) + "h " + String(remainder) + "m";
  }

  return String(minutes) + ":" + String(seconds).padStart(2, "0");
}

function heroMinutes(ms: number) {
  return String(Math.max(0, Math.floor(ms / 60000)));
}

function bandFor(ageMs: number, slaMinutes: number): SlaBand {
  const pct = ageMs / 60000 / slaMinutes;
  if (pct < 0.75) return "green";
  if (pct < 1) return "yellow";
  if (pct < 1.5) return "orange";
  return "red";
}

function platformName(platform: string) {
  const names: Record<string, string> = {
    intercom: "Intercom",
    helpscout: "HelpScout",
    openphone: "OpenPhone",
    slack: "Slack Connect",
  };
  return names[platform] ?? platform;
}

function statusPill(team: TeamState) {
  const breached = team.channels.filter((channel) => channel.worst_band === "red" || channel.worst_band === "orange").length;
  if (breached > 0) {
    return <span className="pill danger">{breached} breached</span>;
  }
  if (team.channels.some((channel) => channel.worst_band === "yellow")) {
    return <span className="pill warn">approaching</span>;
  }
  return <span className="pill ok">on-time</span>;
}

function filterTeams(teams: TeamState[], search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return teams;

  return teams
    .map((team) => ({
      ...team,
      channels: team.channels
        .map((channel) => ({
          ...channel,
          tickets: channel.tickets.filter((ticket) => {
            const blob = [
              ticket.source_ticket_id,
              ticket.summary,
              ticket.customer,
              ticket.source_platform,
              displayTeam(ticket.team),
              displayChannel(ticket.channel),
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            return blob.includes(query);
          }),
        }))
        .filter((channel) => channel.tickets.length > 0),
    }))
    .filter((team) => team.channels.length > 0);
}

function ChannelCard({ channel, now }: { channel: ChannelState; now: number }) {
  const sorted = [...channel.tickets].sort((a, b) => a.opened_at - b.opened_at);
  const worst = sorted[0];
  const worstAge = worst ? now - worst.opened_at : 0;
  const worstBand = worst ? bandFor(worstAge, channel.sla_minutes) : "green";
  const pct = Math.min(100, Math.max(4, (worstAge / 60000 / channel.sla_minutes) * 100));

  return (
    <div className={["card channel", worstBand === "red" ? "breach-flash" : ""].filter(Boolean).join(" ")}>
      <div className="head">
        <div className="icon">{channelIcon(channel.channel)}</div>
        <div>
          <div className="name">{displayChannel(channel.channel)}</div>
          <div className="meta">via {platformName(channel.source_platform)}</div>
        </div>
        <div className="right">
          <div className="count">{channel.tickets.length}</div>
          <div className="count-label">open</div>
        </div>
      </div>
      <div className="bar">
        <div className={["fill", worstBand].join(" ")} style={{ width: String(pct) + "%" }} />
      </div>
      <div className="worst">
        <span className="label">Worst wait</span>
        <span className={["time", worstBand].join(" ")}>{fmt(worstAge)}</span>
      </div>
      <div className="tickets">
        {sorted.slice(0, 4).map((ticket) => (
          <TicketRow key={ticket.id} now={now} ticket={ticket} />
        ))}
        {sorted.length > 4 ? <div className="more">View all {sorted.length}</div> : null}
      </div>
    </div>
  );
}

function TicketRow({ ticket, now }: { ticket: TicketState; now: number }) {
  const ageMs = now - ticket.opened_at;
  const band = bandFor(ageMs, ticket.sla_minutes);

  return (
    <div className="ticket">
      <div>
        <a className="id" href={ticket.source_url} target="_blank" rel="noopener noreferrer">
          {ticket.source_ticket_id}
        </a>
        <span className="open-link"> open in {platformName(ticket.source_platform)}</span>
        <div className="summary">{ticket.summary || ticket.customer || "No summary provided"}</div>
      </div>
      <div className={["age", band].join(" ")}>{fmt(ageMs)}</div>
    </div>
  );
}

export default function TriageDashboard() {
  const [state, setState] = useState<TriageState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadState() {
      try {
        const response = await fetch("/api/triage/state", { cache: "no-store" });
        if (!response.ok) throw new Error("state request failed");
        const payload = (await response.json()) as TriageState;
        if (active) {
          setState(payload);
          setError(null);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load state");
      }
    }

    loadState();
    const poll = window.setInterval(loadState, 10000);
    return () => {
      active = false;
      window.clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const teams = useMemo(() => filterTeams(state?.teams ?? [], search), [state, search]);
  const worst = state?.totals.worst_ticket;
  const worstDelta = worst
    ? displayTeam(worst.team) + " · " + displayChannel(worst.channel) + " · " + worst.source_ticket_id
    : "No open tickets";
  const lastSync = state ? new Date(state.generated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "loading";

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <span className="dot" />
          <h1>Master Triage Queue</h1>
          <span className="sub">- frontline SLA pulse</span>
        </div>
        <div className="right">
          <span className="pill ok">
            On-time <b>{state?.totals.on_time ?? 0}</b>
          </span>
          <span className="pill warn">
            Approaching SLA <b>{state?.totals.approaching ?? 0}</b>
          </span>
          <span className="pill danger">
            Breached <b>{state?.totals.breached ?? 0}</b>
          </span>
          <span className="pill">
            Last sync <b>{lastSync}</b>
          </span>
        </div>
      </div>

      <div className="container">
        <div className="demo-banner">
          Live dashboard · Zapier webhook source · timers tick client-side · dashboard polls every 10s.
          {error ? " State error: " + error : ""}
        </div>

        <div className="hero">
          <div className="card">
            <div>
              <div className="label">Total open</div>
              <div className="num">{state?.totals.open ?? 0}</div>
              <div className="delta">Live from SQLite queue</div>
            </div>
            <div className="symbol">🎫</div>
          </div>
          <div className="card">
            <div>
              <div className="label">Worst wait right now</div>
              <div className="num red">
                {heroMinutes(worst ? now - worst.opened_at : 0)}
                <span className="unit"> min</span>
              </div>
              <div className="delta">{worstDelta}</div>
            </div>
            <div className="symbol">⏱️</div>
          </div>
          <div className="card">
            <div>
              <div className="label">SLA breaches today</div>
              <div className="num orange">{state?.totals.breaches_today ?? 0}</div>
              <div className="delta">Current open breach count</div>
            </div>
            <div className="symbol">⚠️</div>
          </div>
          <div className="card">
            <div>
              <div className="label">Avg first response</div>
              <div className="num green">
                {state?.totals.avg_first_response_minutes ?? 6.4}
                <span className="unit"> min</span>
              </div>
              <div className="delta">Placeholder until source systems send it</div>
            </div>
            <div className="symbol">📈</div>
          </div>
        </div>

        <div className="filters">
          <div className="group">
            <span className="chip active">All teams</span>
            <span className="chip">Agency Support</span>
            <span className="chip">Guest Support</span>
            <span className="chip">Billing</span>
            <span className="chip">Tier 2</span>
          </div>
          <div className="group">
            <span className="chip active">All channels</span>
            <span className="chip">Live Chat</span>
            <span className="chip">Email</span>
            <span className="chip">Slack</span>
            <span className="chip">SMS</span>
          </div>
          <div className="spacer" />
          <div className="group">
            <span className="chip">Sort: Worst wait down</span>
            <span className="chip">Group: Team</span>
          </div>
          <input
            className="search"
            placeholder="Search ticket #, customer, keyword..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {teams.length === 0 ? (
          <div className="empty">{state ? "No open tickets match the current view." : "Loading triage queue..."}</div>
        ) : (
          teams.map((team, index) => (
            <section key={team.team}>
              <div className={["group-row", index > 0 ? "spaced" : ""].filter(Boolean).join(" ")}>
                <h2>{displayTeam(team.team)}</h2>
                <div className="line" />
                {statusPill(team)}
              </div>
              <div className="channels">
                {team.channels.map((channel) => (
                  <ChannelCard key={team.team + channel.channel} channel={channel} now={now} />
                ))}
              </div>
            </section>
          ))
        )}

        <div className="footer">
          <div className="legend">
            <span>
              <span className="swatch fill green" />On-time (&lt; SLA)
            </span>
            <span>
              <span className="swatch fill yellow" />Approaching (75-100% SLA)
            </span>
            <span>
              <span className="swatch fill orange" />Just breached (100-150%)
            </span>
            <span>
              <span className="swatch fill red" />Critical (&gt; 150% SLA)
            </span>
          </div>
          <div className="footer-source">Webhook source: Zapier to /api/triage/ingest · refreshes every 10s</div>
        </div>
      </div>
    </>
  );
}
