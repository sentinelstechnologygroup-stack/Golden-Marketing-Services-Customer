import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import { AuthProvider } from "@/lib/AuthContext";
import UserNotRegisteredError from "@/components/UserNotRegisteredError";
import ScrollToTop from "@/components/ScrollToTop";
import PageNotFound from "@/lib/PageNotFound";
import { PortalAuthProvider, usePortalAuth } from "@/lib/PortalAuthContext";
import PortalProtectedRoute from "@/lib/PortalProtectedRoute";
import PortalLayout from "@/components/portal/PortalLayout";
import { isPreviewMode } from "@/services/portalAdapter";
import { isPortalAdmin } from "@/lib/adminAccess";

// Public auth pages (eager — small, needed before any protected route)
import SignIn from "@/pages/portal/SignIn";
import ForgotPassword from "@/pages/portal/ForgotPassword";
import Verify from "@/pages/portal/Verify";

// Protected pages (lazy / code-split)
const Dashboard = lazy(() => import("@/pages/portal/Dashboard"));
const Leads = lazy(() => import("@/pages/portal/Leads"));
const LeadDetail = lazy(() => import("@/pages/portal/LeadDetail"));
const Appointments = lazy(() => import("@/pages/portal/Appointments"));
const Reports = lazy(() => import("@/pages/portal/Reports"));
const Billing = lazy(() => import("@/pages/portal/Billing"));
const InvoiceDetail = lazy(() => import("@/pages/portal/InvoiceDetail"));
const Documents = lazy(() => import("@/pages/portal/Documents"));
const Support = lazy(() => import("@/pages/portal/Support"));
const Notifications = lazy(() => import("@/pages/portal/Notifications"));
const Security = lazy(() => import("@/pages/portal/Security"));
const Account = lazy(() => import("@/pages/portal/Account"));
const AdminPortal = lazy(() => import("@/pages/portal/AdminPortal"));

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-2 border-[var(--line)] border-t-[var(--teal)] rounded-full animate-spin" />
    </div>
  );
}

function ProtectedLayout() {
  return (
    <PortalLayout>
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
    </PortalLayout>
  );
}

function AdminPortalRoute() {
  const { session } = usePortalAuth();
  return isPortalAdmin(session) ? <AdminPortal /> : <Navigate to="/dashboard" replace />;
}

function RootRedirect() {
  const { status } = usePortalAuth();
  const location = useLocation();
  if (status === "loading") return <PageFallback />;
  if (status === "authenticated") return <Navigate to="/dashboard" replace />;
  return <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<SignIn />} />
      <Route path="/sign-in" element={<Navigate to="/login" replace />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/verify" element={<Verify />} />

      <Route element={<PortalProtectedRoute />}>
        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/leads/:id" element={<LeadDetail />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/billing/invoices/:id" element={<InvoiceDetail />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/support" element={<Support />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/security" element={<Security />} />
          <Route path="/admin" element={<AdminPortalRoute />} />
          <Route path="/account" element={<Account />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <div className={isPreviewMode ? "preview-data-enabled" : undefined}>
      {isPreviewMode && (
        <div className="preview-data-notice" role="status">
          <strong>GMS PREVIEW DATA</strong>
          <span>Account, lead, and performance records are fictional sample content.</span>
        </div>
      )}
      <AuthProvider>
        <PortalAuthProvider>
          <QueryClientProvider client={queryClientInstance}>
            <Router>
              <ScrollToTop />
              <AppRoutes />
            </Router>
            <Toaster />
          </QueryClientProvider>
        </PortalAuthProvider>
      </AuthProvider>
    </div>
  );
}

export default App;
