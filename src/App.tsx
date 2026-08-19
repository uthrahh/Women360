import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AppProvider } from "@/context/AppContext";
import { ToastProvider } from "@/components/ui/Toast";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { LoadingState } from "@/components/ui/states";

import LandingPage from "@/features/landing/LandingPage";
import LoginPage from "@/features/auth/LoginPage";
import RegisterPage from "@/features/auth/RegisterPage";
import ForgotPasswordPage from "@/features/auth/ForgotPasswordPage";
import ResetPasswordPage from "@/features/auth/ResetPasswordPage";
import OnboardingPage from "@/features/onboarding/OnboardingPage";

const DashboardPage = lazy(() => import("@/features/dashboard/DashboardPage"));
const HealthPage = lazy(() => import("@/features/health/HealthPage"));
const CyclePage = lazy(() => import("@/features/cycle/CyclePage"));
const NutritionPage = lazy(() => import("@/features/nutrition/NutritionPage"));
const ActivityPage = lazy(() => import("@/features/activity/ActivityPage"));
const SleepPage = lazy(() => import("@/features/sleep/SleepPage"));
const WellbeingPage = lazy(() => import("@/features/wellbeing/WellbeingPage"));
const GoalsPage = lazy(() => import("@/features/goals/GoalsPage"));
const InsightsPage = lazy(() => import("@/features/insights/InsightsPage"));
const ReportsPage = lazy(() => import("@/features/reports/ReportsPage"));
const LearnPage = lazy(() => import("@/features/learn/LearnPage"));
const MessagesPage = lazy(() => import("@/features/messages/MessagesPage"));
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage"));
import NotFoundPage from "@/pages/NotFoundPage";

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />

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
        </BrowserRouter>
      </ToastProvider>
    </AppProvider>
  );
}
