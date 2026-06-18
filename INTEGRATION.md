# Zapier Integration Guide

## Webhook URLs

- Ingest: POST https://YOUR-HOST/api/triage/ingest
- Resolve: POST https://YOUR-HOST/api/triage/resolve
- Dashboard state: GET https://YOUR-HOST/api/triage/state

Set TRIAGE_INGEST_TOKEN in the app env and send it as X-Triage-Token on ingest and resolve requests.

## Ingest payload

Required fields:

- source_ticket_id: source ticket identifier, for example TK-204
- source_platform: helpscout, intercom, openphone, slack, or similar
- source_url: deep link to the ticket
- team: agency-support, guest-support, billing, or another configured team
- channel: live-chat, email, slack, or sms

Optional fields:

- summary
- customer
- opened_at, milliseconds since epoch. If omitted, server time is used.

## Example curl

curl -X POST http://localhost:3000/api/triage/ingest \
  -H 'Content-Type: application/json' \
  -H 'X-Triage-Token: local-dev-token' \
  -d '{ "source_ticket_id": "TK-SMOKE-1", "source_platform": "helpscout", "source_url": "https://secure.helpscout.net/conversation/smoke", "team": "agency-support", "channel": "email", "summary": "Smoke test ticket", "customer": "smoke@example.com" }'

## Resolve curl

curl -X POST http://localhost:3000/api/triage/resolve \
  -H 'Content-Type: application/json' \
  -H 'X-Triage-Token: local-dev-token' \
  -d '{ "source_ticket_id": "TK-SMOKE-1", "source_platform": "helpscout" }'

## Common Zapier triggers

- Intercom: New Conversation or New Open Conversation.
- HelpScout: New Conversation.
- OpenPhone: New Message or tagged support conversation.
- Slack Connect: New Message Posted to Channel.

Map the source platform's permanent ticket URL to source_url so the dashboard click-through stays useful.
