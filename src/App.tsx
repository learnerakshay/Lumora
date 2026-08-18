import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './components/AuthProvider';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicOnlyRoute } from './components/PublicOnlyRoute';
import { AppShellLoader } from './components/AppShellLoader';
import { UsageProvider } from './components/usage/UsageProvider';
import { AccessProvider } from './components/payments/AccessProvider';

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
const LegalPage = lazy(() => import('./pages/LegalPage').then((m) => ({ default: m.LegalPage })));

export default function App() {
  return (
    <BrowserRouter>
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
            <Route path="/privacy" element={<LegalPage eyebrow="Lumora policies" title="Privacy"><p>Lumora keeps each Workspace and its source material isolated to the authenticated user. We do not expose private Workspace content through public pages.</p><p>This hackathon preview may use third-party providers to process content only when you explicitly use the corresponding product feature.</p></LegalPage>} />
            <Route path="/terms" element={<LegalPage eyebrow="Lumora policies" title="Terms"><p>Lumora is provided as a hackathon preview for evaluation and learning. Use the service only with material you are authorized to upload and process.</p><p>Features and availability may change while the product is under active development.</p></LegalPage>} />
            <Route path="/contact" element={<LegalPage eyebrow="Lumora support" title="Contact"><p>Questions about Lumora can be sent to <a className="text-sky-300 underline decoration-sky-500/40 underline-offset-4 hover:text-sky-200" href="mailto:support@lumora.ai">support@lumora.ai</a>.</p></LegalPage>} />

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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </div>
        </UsageProvider>
        </AccessProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
