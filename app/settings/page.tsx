"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { displayChannel, displayTeam } from "@/lib/format";
import { SlaConfigRow, TriageState } from "@/lib/types";

const CHANNELS = ["live-chat", "email", "slack", "sms"];
const DEFAULT_TEAMS = ["agency-support", "guest-support", "billing"];

type SlaResponse = {
  ok: true;
  sla: SlaConfigRow[];
};

function key(team: string, channel: string) {
  return team + ":" + channel;
}

export default function SettingsPage() {
  const [slaRows, setSlaRows] = useState<SlaConfigRow[]>([]);
  const [state, setState] = useState<TriageState | null>(null);
  const [values, setValues] = useState<Record<string, number>>({});
  const [status, setStatus] = useState("Loading SLA settings...");

  useEffect(() => {
    async function load() {
      const [slaResponse, stateResponse] = await Promise.all([
        fetch("/api/triage/sla", { cache: "no-store" }),
        fetch("/api/triage/state", { cache: "no-store" }),
      ]);
      const slaPayload = (await slaResponse.json()) as SlaResponse;
      const statePayload = (await stateResponse.json()) as TriageState;
      setSlaRows(slaPayload.sla);
      setState(statePayload);
      setStatus("Unsaved changes stay local until you click Save thresholds.");
    }

    load().catch((err) => setStatus(err instanceof Error ? err.message : "Unable to load settings"));
  }, []);

  const teams = useMemo(() => {
    const fromState = state?.teams.map((team) => team.team) ?? [];
    return Array.from(new Set([...DEFAULT_TEAMS, ...fromState])).sort();
  }, [state]);

  const defaults = useMemo(() => {
    const map = new Map(slaRows.filter((row) => row.team === "default").map((row) => [row.channel, row.sla_minutes]));
    return CHANNELS.reduce<Record<string, number>>((acc, channel) => {
      acc[channel] = map.get(channel) ?? 30;
      return acc;
    }, {});
  }, [slaRows]);

  const effectiveValues = useMemo(() => {
    const next: Record<string, number> = {};
    for (const team of teams) {
      for (const channel of CHANNELS) {
        const row = slaRows.find((item) => item.team === team && item.channel === channel);
        next[key(team, channel)] = values[key(team, channel)] ?? row?.sla_minutes ?? defaults[channel] ?? 30;
      }
    }
    return next;
  }, [defaults, slaRows, teams, values]);

  async function save() {
    const payload = teams.flatMap((team) =>
      CHANNELS.map((channel) => ({
        team,
        channel,
        sla_minutes: Number(effectiveValues[key(team, channel)]),
      })),
    );

    const response = await fetch("/api/triage/sla", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sla: payload }),
    });

    if (!response.ok) {
      setStatus("Save failed. Check values and try again.");
      return;
    }

    const updated = (await response.json()) as SlaResponse;
    setSlaRows(updated.sla);
    setValues({});
    setStatus("Saved. The dashboard will use these thresholds on its next poll.");
  }

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <span className="dot" />
          <h1>SLA Settings</h1>
          <span className="sub">- team and channel thresholds</span>
        </div>
        <div className="right">
          <Link className="pill" href="/">
            Dashboard
          </Link>
        </div>
      </div>

      <main className="container settings-page">
        <div className="settings-panel">
          <div>
            <h2>Per-team SLA thresholds</h2>
            <p>Values are minutes until breach. Leave defaults alone unless a team needs tighter or looser channel rules.</p>
          </div>
          <button className="primary-button" type="button" onClick={save}>
            Save thresholds
          </button>
        </div>

        <div className="settings-grid">
          <div className="settings-row settings-head">
            <div>Team</div>
            {CHANNELS.map((channel) => (
              <div key={channel}>{displayChannel(channel)}</div>
            ))}
          </div>

          {teams.map((team) => (
            <div className="settings-row" key={team}>
              <div className="team-label">{displayTeam(team)}</div>
              {CHANNELS.map((channel) => (
                <label key={channel}>
                  <span>{displayChannel(channel)}</span>
                  <input
                    min={1}
                    type="number"
                    value={effectiveValues[key(team, channel)]}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [key(team, channel)]: Number(event.target.value),
                      }))
                    }
                  />
                </label>
              ))}
            </div>
          ))}
        </div>

        <div className="demo-banner">{status}</div>
      </main>
    </>
  );
}
