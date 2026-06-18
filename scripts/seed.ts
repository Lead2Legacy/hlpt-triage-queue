import { getDb, upsertTicket } from "../lib/db";

const now = Date.now();

function openedMinutesAgo(minutes: number) {
  return now - minutes * 60 * 1000;
}

const tickets = [
  ["TK-101", "intercom", "https://example.com/intercom/TK-101", "agency-support", "live-chat", "Form embed not loading on subdomain", "agency@example.com", 8],
  ["TK-102", "intercom", "https://example.com/intercom/TK-102", "agency-support", "live-chat", "Branded login URL question", "ops@example.com", 6],
  ["TK-103", "intercom", "https://example.com/intercom/TK-103", "agency-support", "live-chat", "Snapshot import failed mid-way", "admin@example.com", 3],
  ["TK-104", "intercom", "https://example.com/intercom/TK-104", "agency-support", "live-chat", "How do I invite a sub-account?", "owner@example.com", 2],
  ["TK-204", "helpscout", "https://secure.helpscout.net/conversation/12345", "agency-support", "email", "Re: refund - no reply in 2 days", "jane@example.com", 125],
  ["TK-205", "helpscout", "https://secure.helpscout.net/conversation/12346", "agency-support", "email", "Stripe Connect failing on agency account", "billing@example.com", 92],
  ["TK-206", "helpscout", "https://secure.helpscout.net/conversation/12347", "agency-support", "email", "Custom domain DNS not propagating", "domains@example.com", 47],
  ["TK-207", "helpscout", "https://secure.helpscout.net/conversation/12348", "agency-support", "email", "Workflow trigger ran twice", "workflow@example.com", 31],
  ["TK-301", "slack", "https://example.slack.com/archives/C012/p301", "agency-support", "slack", "Sub-account API key rotate", "partner@example.com", 12],
  ["TK-302", "slack", "https://example.slack.com/archives/C012/p302", "agency-support", "slack", "Webhook 401 - Zapier connection", "zapier@example.com", 4],
  ["TK-408", "openphone", "https://example.com/openphone/TK-408", "agency-support", "sms", "A2P registration stuck", "+15555550108", 45],
  ["TK-409", "openphone", "https://example.com/openphone/TK-409", "agency-support", "sms", "Twilio number port question", "+15555550109", 28],
  ["TK-501", "intercom", "https://example.com/intercom/TK-501", "guest-support", "live-chat", "Where do I find my receipt?", "guest1@example.com", 3],
  ["TK-502", "intercom", "https://example.com/intercom/TK-502", "guest-support", "live-chat", "Account login loop", "guest2@example.com", 2],
  ["TK-601", "helpscout", "https://secure.helpscout.net/conversation/12601", "guest-support", "email", "Booking confirmation missing", "guest3@example.com", 65],
  ["TK-602", "helpscout", "https://secure.helpscout.net/conversation/12602", "guest-support", "email", "Reschedule request", "guest4@example.com", 41],
  ["TK-603", "helpscout", "https://secure.helpscout.net/conversation/12603", "guest-support", "email", "Promo code not applying", "guest5@example.com", 22],
  ["TK-701", "slack", "https://example.slack.com/archives/C013/p701", "guest-support", "slack", "Cannot join workspace invite", "guest6@example.com", 8],
  ["TK-801", "openphone", "https://example.com/openphone/TK-801", "guest-support", "sms", "Two-factor code did not arrive", "+15555550801", 5],
  ["TK-901", "helpscout", "https://secure.helpscout.net/conversation/12901", "billing", "email", "Invoice PDF missing tax line", "finance@example.com", 18],
  ["TK-902", "helpscout", "https://secure.helpscout.net/conversation/12902", "billing", "email", "Card decline - please retry", "card@example.com", 9],
  ["TK-903", "intercom", "https://example.com/intercom/TK-903", "billing", "live-chat", "Update billing email", "bookkeeper@example.com", 2],
] as const;

getDb();

for (const [source_ticket_id, source_platform, source_url, team, channel, summary, customer, ageMinutes] of tickets) {
  upsertTicket({
    source_ticket_id,
    source_platform,
    source_url,
    team,
    channel,
    summary,
    customer,
    opened_at: openedMinutesAgo(ageMinutes),
    payload_json: JSON.stringify({ seeded: true, source_ticket_id }),
  });
}

console.log("Seeded " + tickets.length + " demo tickets.");
