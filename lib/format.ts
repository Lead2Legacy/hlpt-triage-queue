import { SlaBand } from "./types";

export function computeSlaBand(ageMinutes: number, slaMinutes: number): SlaBand {
  const pct = ageMinutes / slaMinutes;
  if (pct < 0.75) return "green";
  if (pct < 1) return "yellow";
  if (pct < 1.5) return "orange";
  return "red";
}

export function displayChannel(channel: string) {
  const labels: Record<string, string> = {
    "live-chat": "Live Chat",
    email: "Email",
    slack: "Slack",
    sms: "SMS",
  };
  return labels[channel] ?? channel;
}

export function displayTeam(team: string) {
  const labels: Record<string, string> = {
    "agency-support": "Agency Support",
    "guest-support": "Guest Support",
    billing: "Billing",
    "tier-2": "Tier 2",
  };
  return labels[team] ?? team;
}

export function channelIcon(channel: string) {
  const icons: Record<string, string> = {
    "live-chat": "💬",
    email: "✉️",
    slack: "#️⃣",
    sms: "📱",
  };
  return icons[channel] ?? "🎫";
}
