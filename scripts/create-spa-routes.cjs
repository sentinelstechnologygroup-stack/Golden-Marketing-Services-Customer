const fs = require("node:fs");
const path = require("node:path");

const dist = path.resolve("dist");
const index = fs.readFileSync(path.join(dist, "index.html"));
const routes = [
  "login",
  "sign-in",
  "forgot-password",
  "verify",
  "dashboard",
  "leads",
  "appointments",
  "reports",
  "billing",
  "documents",
  "onboarding",
  "support",
  "notifications",
  "security",
  "account",
  "admin",
];

for (const route of routes) {
  fs.writeFileSync(path.join(dist, `${route}.html`), index);
}

