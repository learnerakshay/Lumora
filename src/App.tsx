import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './components/AuthProvider';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicOnlyRoute } from './components/PublicOnlyRoute';
import { AppShellLoader } from './components/AppShellLoader';
import { UsageProvider } from './components/usage/UsageProvider';
import { AccessProvider } from './components/payments/AccessProvider';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { ScrollToTop } from './components/shared/ScrollToTop';

// Route-level code splitting: each page (including the Three.js/GSAP/Lenis-
// heavy landing page) ships as its own chunk instead of one shared bundle.
// The authenticated post-login path (/workspaces) no longer has to download
// or parse landing-page/Skill-Intelligence/Learning-Path code it doesn't
// need before it can render — this is the dominant lever available on the
// frontend for a faster first authenticated render on slow mobile networks.
const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const PricingPage = lazy(() => import('./pages/PricingPage').then((m) => ({ default: m.PricingPage })));
const SignInPage = lazy(() => import('./pages/SignInPage').then((m) => ({ default: m.SignInPage })));
const SignUpPage = lazy(() => import('./pages/SignUpPage').then((m) => ({ default: m.SignUpPage })));
const WorkspacesPage = lazy(() => import('./pages/WorkspacesPage').then((m) => ({ default: m.WorkspacesPage })));
const WorkspaceDetailPage = lazy(() => import('./pages/WorkspaceDetailPage').then((m) => ({ default: m.WorkspaceDetailPage })));
const UsagePage = lazy(() => import('./pages/UsagePage').then((m) => ({ default: m.UsagePage })));
const BillingPage = lazy(() => import('./pages/BillingPage').then((m) => ({ default: m.BillingPage })));
const SkillIntelligencePage = lazy(() => import('./pages/SkillIntelligencePage').then((m) => ({ default: m.SkillIntelligencePage })));
const LearningPathPage = lazy(() => import('./pages/LearningPathPage').then((m) => ({ default: m.LearningPathPage })));
const AboutPage = lazy(() => import('./pages/AboutPage').then((m) => ({ default: m.AboutPage })));
const FaqPage = lazy(() => import('./pages/FaqPage').then((m) => ({ default: m.FaqPage })));
const TermsPage = lazy(() => import('./pages/TermsPage').then((m) => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage').then((m) => ({ default: m.PrivacyPage })));
const ContactPage = lazy(() => import('./pages/ContactPage').then((m) => ({ default: m.ContactPage })));
const ReportBugPage = lazy(() => import('./pages/ReportBugPage').then((m) => ({ default: m.ReportBugPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));
const UnauthorizedPage = lazy(() => import('./pages/UnauthorizedPage').then((m) => ({ default: m.UnauthorizedPage })));

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <ErrorBoundary>
      <AuthProvider>
        <AccessProvider>
        <UsageProvider>
        <div className="min-h-screen bg-[#0b0f17] text-[#f0f4f8] selection:bg-sky-500/30 selection:text-sky-200">
          <Navbar />
          <Suspense fallback={<AppShellLoader />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/faq" element={<FaqPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/report-bug" element={<ReportBugPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            {/* Auth Routes (Public Only) */}
            <Route
              path="/sign-in"
              element={
                <PublicOnlyRoute>
                  <SignInPage />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/sign-up"
              element={
                <PublicOnlyRoute>
                  <SignUpPage />
                </PublicOnlyRoute>
              }
            />

            {/* Protected Routes */}
            <Route
              path="/workspaces"
              element={
                <ProtectedRoute>
                  <WorkspacesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/workspaces/:workspaceId"
              element={
                <ProtectedRoute>
                  <WorkspaceDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/usage"
              element={
                <ProtectedRoute>
                  <UsagePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/billing"
              element={
                <ProtectedRoute>
                  <BillingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/skills"
              element={
                <ProtectedRoute>
                  <SkillIntelligencePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/learning/:planId"
              element={
                <ProtectedRoute>
                  <LearningPathPage />
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </Suspense>
        </div>
        </UsageProvider>
        </AccessProvider>
      </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
