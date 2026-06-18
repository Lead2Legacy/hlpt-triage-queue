# HLPT Master Triage Queue PRD

## Purpose

Give HLPT support one dashboard for open queue duration across Live Chat, Email, Slack, and SMS. The dashboard highlights SLA risk by team and channel and links each row back to the source ticket.

## Phase 1 scope

- Next.js 15 App Router, TypeScript, Tailwind 4.
- SQLite via better-sqlite3, stored in data.db by default.
- No Prisma, no NextAuth, no external services.
- Zapier ingest webhook with shared token.
- Resolve webhook for closing tickets.
- State endpoint for dashboard polling every 10 seconds.
- SLA config endpoints for current defaults and future settings UI.
- Dashboard matching the approved wireframe visual language.

## Data model

Tickets are keyed by (source_platform, source_ticket_id). Open tickets have resolved_at = NULL. SLA defaults are per channel:

- live-chat: 5 minutes
- sms: 10 minutes
- slack: 15 minutes
- email: 60 minutes

## User workflow

1. New source ticket arrives in Intercom, HelpScout, OpenPhone, Slack, or another source.
2. Zapier posts the payload to /api/triage/ingest.
3. Dashboard displays the ticket under team and channel.
4. Support rep clicks the ticket link to open the source platform.
5. Zapier posts to /api/triage/resolve when the source ticket closes.

## Extension points

- Add dashboard auth in lib/auth.ts.
- Build /settings on top of GET/PATCH /api/triage/sla.
- Add assignee and historical SLA tables when Zapier starts sending those fields.
- Replace placeholder average first response once source systems provide response timestamps.
