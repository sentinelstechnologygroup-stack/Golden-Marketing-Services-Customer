# Golden Marketing Services Customer Portal

Vite/React application for the Golden Marketing Services customer workspace.

## Local development

```bash
npm install
npm run dev
```

The portal uses the GMS API adapter in `src/api/gmsClient.js`. Set `VITE_API_BASE_URL` when connecting to a deployed API; without it, requests use the local `/api` path.

## Validation

```bash
npm run build
npm run lint
npm run typecheck
```
