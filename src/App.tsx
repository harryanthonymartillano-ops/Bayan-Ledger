/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { BlockchainProvider } from './context/BlockchainContext';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';
import { FlashToastProvider } from './components/ui/flash-toast';
import { PublicLayout } from './components/PublicLayout';
import { OfficialLayout } from './components/OfficialLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Home } from './pages/Public/Home';
import { PublicProjects } from './pages/Public/PublicProjects';
import { ProjectDetails } from './pages/Public/ProjectDetails';
import { TransactionReceipts } from './pages/Public/TransactionReceipts';
import { Login } from './pages/Auth/Login';
import { Dashboard } from './pages/Official/Dashboard';
import { UserManagement } from './pages/Official/UserManagement';
import { MyTasks } from './pages/Official/MyTasks';
import { ProjectPipeline } from './pages/Official/ProjectPipeline';
import { MilestoneTracker } from './pages/Official/MilestoneTracker';
import { SARORegistry } from './pages/Official/SARORegistry';
import { NCALedger } from './pages/Official/NCALedger';
import { AuditLogs } from './pages/Official/AuditLogs';
import { SystemAlerts } from './pages/Official/SystemAlerts';
import { Archive } from './pages/Official/Archive';

// New Pages
import { PaymentHashes } from './pages/Official/PaymentHashes';
import { RBAC } from './pages/Official/RBAC';
import { AuditTrails } from './pages/Official/AuditTrails';
import { TransactionDetails } from './pages/Official/TransactionDetails';
import { RealTimeStatusDashboard } from './pages/Official/RealTimeStatusDashboard';
import { ComplianceScorebardPage } from './pages/Official/ComplianceScorebard';
import { DisbursementPipeline } from './pages/Official/DisbursementPipeline';
import { WalletLink } from './pages/Official/WalletLink';
import BlockchainIntegrityCheck from './pages/Official/BlockchainIntegrityCheck';
import { ReportsAnalytics } from './pages/Official/ReportsAnalytics';

function ScrollToTop() {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    const scrollFrame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      document.querySelectorAll<HTMLElement>('[data-scroll-root]').forEach((element) => {
        element.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      });
    });

    return () => window.cancelAnimationFrame(scrollFrame);
  }, [pathname, search, hash]);

  return null;
}

function AppRoutes() {
  const location = useLocation();

  return (
    <Routes location={location} key={location.pathname}>
      <Route path="/" element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="projects" element={<PublicProjects />} />
        <Route path="project/:id" element={<ProjectDetails />} />
        <Route path="transactions" element={<TransactionReceipts />} />
        <Route path="login" element={<Login />} />
      </Route>
      <Route path="/official" element={<ProtectedRoute><OfficialLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="tasks" element={<MyTasks />} />
        <Route path="pipeline" element={<ProjectPipeline />} />
        <Route path="milestones" element={<MilestoneTracker />} />
        <Route path="saro" element={<SARORegistry />} />
        <Route path="nca" element={<NCALedger />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="audit" element={<AuditTrails />} />
        <Route path="audit-logs" element={<AuditLogs />} />
        <Route path="alerts" element={<SystemAlerts />} />
        <Route path="archive" element={<Archive />} />

        <Route path="payment-hashes" element={<PaymentHashes />} />
        <Route path="rbac" element={<RBAC />} />
        <Route path="audit-trails" element={<AuditTrails />} />
        <Route path="transaction/:txId" element={<TransactionDetails />} />
        <Route path="status-dashboard" element={<RealTimeStatusDashboard />} />
        <Route path="compliance" element={<ComplianceScorebardPage />} />
        <Route path="disbursement-pipeline" element={<DisbursementPipeline />} />
        <Route path="wallet-link" element={<WalletLink />} />
        <Route path="integrity-check" element={<BlockchainIntegrityCheck />} />
        <Route path="reports" element={<ReportsAnalytics />} />
        <Route path="analytics" element={<Navigate to="/official/reports" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <ThemeProvider>
          <FlashToastProvider>
            <BlockchainProvider>
              <NotificationProvider>
                <ScrollToTop />
                <AppRoutes />
              </NotificationProvider>
            </BlockchainProvider>
          </FlashToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </Router>
  );
}
