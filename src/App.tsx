import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './components/AuthProvider';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicOnlyRoute } from './components/PublicOnlyRoute';
import { HomePage } from './pages/HomePage';
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';
import { WorkspacesPage } from './pages/WorkspacesPage';
import { WorkspaceDetailPage } from './pages/WorkspaceDetailPage';
import { UsagePage } from './pages/UsagePage';
import { SkillIntelligencePage } from './pages/SkillIntelligencePage';
import { LegalPage } from './pages/LegalPage';
import { UsageProvider } from './components/usage/UsageProvider';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <UsageProvider>
        <div className="min-h-screen bg-[#0b0f17] text-[#f0f4f8] selection:bg-sky-500/30 selection:text-sky-200">
          <Navbar />
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
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
              path="/skills"
              element={
                <ProtectedRoute>
                  <SkillIntelligencePage />
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        </UsageProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
