/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { BlockchainProvider } from './context/BlockchainContext';
import { PublicLayout } from './components/PublicLayout';
import { OfficialLayout } from './components/OfficialLayout';
import { Home } from './pages/Public/Home';
import { PublicProjects } from './pages/Public/PublicProjects';
import { PublicProposals } from './pages/Public/PublicProposals';
import { ProjectDetails } from './pages/Public/ProjectDetails';
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
import { CitizenProposals } from './pages/Official/CitizenProposals';
import { VerifiedPayments } from './pages/Official/VerifiedPayments';
import { PaymentHashes } from './pages/Official/PaymentHashes';
import { RBAC } from './pages/Official/RBAC';

export default function App() {
  return (
    <AuthProvider>
      <BlockchainProvider>
        <Router>
          <Routes>
            <Route path="/" element={<PublicLayout />}>
              <Route index element={<Home />} />
              <Route path="projects" element={<PublicProjects />} />
              <Route path="proposals" element={<PublicProposals />} />
              <Route path="project/:id" element={<ProjectDetails />} />
              <Route path="login" element={<Login />} />
            </Route>
            <Route path="/official" element={<OfficialLayout />}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="tasks" element={<MyTasks />} />
              <Route path="pipeline" element={<ProjectPipeline />} />
              <Route path="milestones" element={<MilestoneTracker />} />
              <Route path="saro" element={<SARORegistry />} />
              <Route path="nca" element={<NCALedger />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="audit" element={<AuditLogs />} />
              <Route path="alerts" element={<SystemAlerts />} />
              <Route path="archive" element={<Archive />} />
              
              {/* New Routes */}
              <Route path="citizen-proposals" element={<CitizenProposals />} />
              <Route path="verified-payments" element={<VerifiedPayments />} />
              <Route path="payment-hashes" element={<PaymentHashes />} />
              <Route path="rbac" element={<RBAC />} />
            </Route>
          </Routes>
        </Router>
      </BlockchainProvider>
    </AuthProvider>
  );
}
