# Golden Marketing Services — Customer Portal

This repository hosts the customer portal frontend for Golden Marketing Services.

## Quick start

- Install dependencies: `npm install`
- Start the app: `npm run dev`
- Build for production: `npm run build`
- Preview production build: `npm run preview`

## Environment

Set API-specific env variables in `.env.local` as needed:

- `VITE_CUSTOMER_PORTAL_API_URL` (optional)
- `VITE_CUSTOMER_PORTAL_APP_ID` (optional for MCP consent endpoints)

If `VITE_CUSTOMER_PORTAL_API_URL` is not set, the app runs in preview mode with fictional sample data. Preview mode is clearly labeled in pink; configure the API before using the portal with customers.

## Deployment

- This app is Vercel-ready and uses standard `npm run build`.
- Ensure `package.json` and `package-lock.json` are in sync so Vercel install (`npm ci`) succeeds.

## Firebase multi-project configuration

This repo can target three Firebase web app blocks from a single Vite build:

- Website (`website`)
- Agent CRM (`agent_crm`)
- Customer Portal (`customer_portal`)

Set these in `.env.local` or Vercel Environment Variables:

- `VITE_FIREBASE_TARGET=customer_portal` (or `website`, `agent_crm`)
- `VITE_FIREBASE_ENV=production|development`
- Per-app web app config keys:
  - `VITE_FIREBASE_<APP>_<ENV>_<FIELD>` (env-specific override)
  - `VITE_FIREBASE_<APP>_<FIELD>` (fallback)

`<APP>` is `WEBSITE`, `AGENT_CRM`, `CUSTOMER_PORTAL`.

`<FIELD>` is one of:

- `API_KEY`
- `AUTH_DOMAIN`
- `PROJECT_ID`
- `STORAGE_BUCKET`
- `MESSAGING_SENDER_ID`
- `PROJECT_NUMBER`
- `APP_ID`
- `SERVICES`
- `SERVICES_AUTH`
- `SERVICES_FIRESTORE`
- `SERVICES_FUNCTIONS`
- `SERVICES_STORAGE`
- `SERVICES_HOSTING`

Examples:

- `VITE_FIREBASE_WEBSITE_PRODUCTION_API_KEY=...`
- `VITE_FIREBASE_CUSTOMER_PORTAL_DEVELOPMENT_API_KEY=...`

Portal-specific compatibility variables:

- `VITE_PORTAL_APP_ID`
- `VITE_PORTAL_FUNCTIONS_VERSION`
- `VITE_PORTAL_APP_BASE_URL`

The root Vite app has no legacy provider SDK or runtime dependency. `AgentCRM/`, `legacy provider/`, and `temp-legacy provider-mirror-customer/` are separate retained source/history areas and are not imported by the root website build.
