import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AppProvider, useApp } from "@/context/AppContext";
import { ToastProvider } from "@/components/ui/Toast";
import { FeaturesProvider } from "@/context/FeaturesContext";
import { ErrorBoundary, ForcedFailure } from "@/components/ErrorBoundary";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { isNativeApp } from "@/lib/platform";
import { RouteFocus, SkipLink } from "@/components/RouteFocus";
import { AnalyticsRoot } from "@/components/analytics/AnalyticsRoot";

// Everything below is loaded when its route is opened, so the first visit downloads only the
// shell that decides which screen to show: a visitor on the landing page never fetches the
// signed-in app, its menus or its animation library, and someone signing in never fetches the landing page.
const LoginPage = lazy(() => import("@/features/auth/LoginPage"));
const RegisterPage = lazy(() => import("@/features/auth/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("@/features/auth/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("@/features/auth/ResetPasswordPage"));
const OnboardingPage = lazy(() => import("@/features/onboarding/OnboardingPage"));
const AppShell = lazy(() => import("@/components/layout/AppShell").then((m) => ({ default: m.AppShell })));
const StaffShell = lazy(() => import("@/components/layout/StaffShell").then((m) => ({ default: m.StaffShell })));

// Lazy: the landing page is only for visitors who aren't signed in, which the signed-in app (and the
// phone app, which never shows the landing page) shouldn't download.
const PrivacyPage = lazy(() => import("@/features/legal/PrivacyPage"));
const TermsPage = lazy(() => import("@/features/legal/TermsPage"));
const ReleaseNotesPage = lazy(() => import("@/features/legal/ReleaseNotesPage"));
const AnalyticsReferencePage = lazy(() => import("@/features/legal/AnalyticsReferencePage"));
const LandingPage = lazy(() => import("@/features/landing/LandingPage"));
const DashboardPage = lazy(() => import("@/features/dashboard/DashboardPage"));
const HealthPage = lazy(() => import("@/features/health/HealthPage"));
const CyclePage = lazy(() => import("@/features/cycle/CyclePage"));
const NutritionPage = lazy(() => import("@/features/nutrition/NutritionPage"));
const ActivityPage = lazy(() => import("@/features/activity/ActivityPage"));
const SleepPage = lazy(() => import("@/features/sleep/SleepPage"));
const WellbeingPage = lazy(() => import("@/features/wellbeing/WellbeingPage"));
const GoalsPage = lazy(() => import("@/features/goals/GoalsPage"));
const HabitsPage = lazy(() => import("@/features/habits/HabitsPage"));
const InsightsPage = lazy(() => import("@/features/insights/InsightsPage"));
const ReportsPage = lazy(() => import("@/features/reports/ReportsPage"));
const LearnPage = lazy(() => import("@/features/learn/LearnPage"));
const MessagesPage = lazy(() => import("@/features/messages/MessagesPage"));
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage"));
const AdminPage = lazy(() => import("@/features/admin/AdminPage"));
const CoachPage = lazy(() => import("@/features/coach/CoachPage"));
import NotFoundPage from "@/pages/NotFoundPage";

// In device-only testing mode there's no login screen — the app should go
// straight to the dashboard once the device's throwaway account is set up,
// rather than showing the marketing landing page.
function RootRoute() {
  const { auth } = useApp();
  if (!isNativeApp())
    return (
      <Suspense fallback={<PageLoading />}>
        <LandingPage />
      </Suspense>
    );
  if (auth.bootstrapError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <ErrorState
          title="Couldn't set up this device"
          description={auth.bootstrapError}
          onRetry={auth.retryDeviceSetup}
        />
      </div>
    );
  }
  if (auth.bootstrapping) return <LoadingState label="Setting up this device" />;
  return <Navigate to="/app/dashboard" replace />;
}

// What a whole page shows while its code arrives, outside the signed-in layouts (which supply their own padding).
function PageLoading() {
  return (
    <div className="px-6 py-8 max-w-3xl mx-auto">
      <LoadingState label="Loading" />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
    <AppProvider>
      <FeaturesProvider>
      <ToastProvider>
        <BrowserRouter>
          <SkipLink />
          <RouteFocus />
          <AnalyticsRoot />
          <ForcedFailure />
          <Suspense fallback={<PageLoading />}>
          <Routes>
            <Route path="/" element={<RootRoute />} />
            <Route path="/privacy" element={<Suspense fallback={<PageLoading />}><PrivacyPage /></Suspense>} />
            <Route path="/terms" element={<Suspense fallback={<PageLoading />}><TermsPage /></Suspense>} />
            <Route path="/release-notes" element={<ReleaseNotesPage />} />
            <Route path="/analytics-reference" element={<AnalyticsReferencePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />

            <Route element={<ProtectedRoute role="admin" />}>
              <Route element={<StaffShell />}>
                <Route path="/admin" element={<Suspense fallback={<LoadingState label="Loading" />}><AdminPage /></Suspense>} />
              </Route>
            </Route>
            <Route element={<ProtectedRoute role="coach" />}>
              <Route element={<StaffShell />}>
                <Route path="/coach" element={<Suspense fallback={<LoadingState label="Loading" />}><CoachPage /></Suspense>} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route path="/app" element={<AppShell />}>
                <Route
                  path="dashboard"
                  element={<Suspense fallback={<LoadingState label="Loading" />}><DashboardPage /></Suspense>}
                />
                <Route
                  path="health"
                  element={<Suspense fallback={<LoadingState label="Loading" />}><HealthPage /></Suspense>}
                />
                <Route
                  path="cycle"
                  element={<Suspense fallback={<LoadingState label="Loading" />}><CyclePage /></Suspense>}
                />
                <Route
                  path="nutrition"
                  element={<Suspense fallback={<LoadingState label="Loading" />}><NutritionPage /></Suspense>}
                />
                <Route
                  path="activity"
                  element={<Suspense fallback={<LoadingState label="Loading" />}><ActivityPage /></Suspense>}
                />
                <Route
                  path="sleep"
                  element={<Suspense fallback={<LoadingState label="Loading" />}><SleepPage /></Suspense>}
                />
                <Route
                  path="wellbeing"
                  element={<Suspense fallback={<LoadingState label="Loading" />}><WellbeingPage /></Suspense>}
                />
                <Route
                  path="goals"
                  element={<Suspense fallback={<LoadingState label="Loading" />}><GoalsPage /></Suspense>}
                />
                <Route
                  path="habits"
                  element={<Suspense fallback={<LoadingState label="Loading" />}><HabitsPage /></Suspense>}
                />
                <Route
                  path="insights"
                  element={<Suspense fallback={<LoadingState label="Loading" />}><InsightsPage /></Suspense>}
                />
                <Route
                  path="reports"
                  element={<Suspense fallback={<LoadingState label="Loading" />}><ReportsPage /></Suspense>}
                />
                <Route
                  path="learn"
                  element={<Suspense fallback={<LoadingState label="Loading" />}><LearnPage /></Suspense>}
                />
                <Route
                  path="messages"
                  element={<Suspense fallback={<LoadingState label="Loading" />}><MessagesPage /></Suspense>}
                />
                <Route
                  path="settings"
                  element={<Suspense fallback={<LoadingState label="Loading" />}><SettingsPage /></Suspense>}
                />
              </Route>
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
      </FeaturesProvider>
    </AppProvider>
    </ErrorBoundary>
  );
}
