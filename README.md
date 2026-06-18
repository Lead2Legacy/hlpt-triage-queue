# HLPT Triage Queue

> If you're handing this to a deploy team, send them [HANDOFF.md](./HANDOFF.md).

Master support SLA dashboard for HLPT. Zapier posts tickets into a local Next.js app, the app stores open tickets in SQLite, and the dashboard polls every 10 seconds.

## Run locally

1. Copy env defaults: cp .env.example .env
2. Install dependencies: npm install
3. Seed demo data: npm run seed
4. Build: npm run build
5. Start: npm start

The app listens on PORT if provided by the host, otherwise Next.js defaults to 3000.

## Manus or container deploy

1. Create the app from this repo and set env vars from .env.example.
2. Mount or persist the working directory so data.db survives restarts.
3. Run npm install.
4. Run npm run build.
5. Start with npm start.

The same flow works on any long-lived Node container host. No external database or cache service is required.

## Auth

Dashboard auth is deferred. lib/auth.ts is the placeholder for HLPT to wire a shared password, OAuth, SSO, or JWT check later. Ingest and resolve already support X-Triage-Token via TRIAGE_INGEST_TOKEN.

## Useful commands

- npm run seed - populate demo queue data matching the approved wireframe.
- npm run build - compile the app.
- npm start - serve the compiled app.
- npm run lint - run ESLint.
