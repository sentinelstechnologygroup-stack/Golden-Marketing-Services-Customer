const ADMIN_ROLES = new Set(["admin", "super_admin", "org_admin", "brand_admin", "client_admin", "client_supervisor", "gms_super_admin"]);

export function isPortalAdmin(session) {
  const user = session?.user || session;
  const role = String(user?.role || session?.claims?.role || "").toLowerCase();
  return ADMIN_ROLES.has(role)
    || session?.claims?.admin === true
    || session?.gmsSuperAdmin === true
    || user?.customClaims?.admin === true;
}
