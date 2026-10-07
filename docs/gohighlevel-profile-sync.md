# GoHighLevel business profile synchronization

Golden Cross Realty uses location `1nMOAalgP22erJpYc5dv`, mapped to the existing `tenant-golden-cross-beta` production client. Its read-only private integration grants locations, calendars, conversations and opportunities access. The location token is stored only inside `GMS_GOHIGHLEVEL_CONFIG` in the independent GMS project.

When a GMS administrator opens the client profile, `getGmsClient` refreshes the business name, legal business name when present, contact phone, website, address and time zone from the saved location. Business email is stored separately from `adminEmail`: importing contact details never grants access or sends invitations. Missing provider values retain saved details. Changes are applied transactionally and audited, with a revision check to prevent overwriting concurrent edits. Saved details remain available with an explicit failure status if provider access fails.

Campaigns, brands, scripts, assigned agents, customer administrator identity, notes and outbound Telnyx numbers remain GMS-managed. No provider writes, calls or messages occur. This is refresh-on-open synchronization, not a realtime webhook or scheduled refresh. Legal registration, logo and other fields outside the current GMS schema are not imported. The API requires the location's `locations.readonly` scope.

Setup: approve the location-specific private integration, store its token in the backend secret, deploy the affected functions, and run the saved connection check in the Agent Portal. The location ID by itself is not authorization. GCR's outbound number remains `+19362499427` and live calling remains disabled until Telnyx validation is complete.
