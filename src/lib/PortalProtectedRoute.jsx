import { Navigate, Outlet, useLocation } from "react-router-dom";
import { usePortalAuth } from "@/lib/PortalAuthContext";
import InitialPasswordChange from "@/components/InitialPasswordChange";

export default function PortalProtectedRoute() {
  const { status, session } = usePortalAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[var(--offwhite)]">
        <div className="w-8 h-8 border-2 border-[var(--line)] border-t-[var(--teal)] rounded-full animate-spin" aria-label="Loading" />
      </div>
    );
  }
  if (status !== "authenticated") {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  }
  if (session?.mustChangePassword) return <InitialPasswordChange />;
  return <Outlet />;
}
