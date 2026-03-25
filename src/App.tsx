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
import { ProjectDetails } from './pages/Public/ProjectDetails';
import { Login } from './pages/Auth/Login';
import { Dashboard } from './pages/Official/Dashboard';
import { UserManagement } from './pages/Official/UserManagement';

export default function App() {
  return (
    <AuthProvider>
      <BlockchainProvider>
        <Router>
          <Routes>
            <Route path="/" element={<PublicLayout />}>
              <Route index element={<Home />} />
              <Route path="projects" element={<PublicProjects />} />
              <Route path="project/:id" element={<ProjectDetails />} />
              <Route path="login" element={<Login />} />
            </Route>
            <Route path="/official" element={<OfficialLayout />}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="users" element={<UserManagement />} />
            </Route>
          </Routes>
        </Router>
      </BlockchainProvider>
    </AuthProvider>
  );
}
