import React, { useState, useEffect } from 'react';
import { useBlockchain, Project } from '../../context/BlockchainContext';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, AlertCircle, CheckCircle, Clock, FileText, Activity } from 'lucide-react';

export const RealTimeStatusDashboard: React.FC = () => {
  const { projects } = useBlockchain();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [autoRefresh, setAutoRefresh] = useState(true);

  const getReviewRoute = () => {
    if (!user) return '/official/dashboard';
    
    switch (user.role) {
      case 'MPDC (Planning)':
        return '/official/milestones';
      case 'Budget Officer':
        return '/official/saro';
      case 'Treasurer':
        return '/official/nca';
      case 'Admin':
        return '/official/audit';
      default:
        return '/official/dashboard';
    }
  };

  // Calculate statistics
  const stats = {
    totalProjects: projects.length,
    activeProjects: projects.filter(p => p.status === 'ACTIVE' || p.status === 'In Progress').length,
    allocatedAmount: projects.reduce((sum, p) => sum + p.allocatedFunds, 0),
    disbursedAmount: projects.reduce((sum, p) => sum + p.disbursedFunds, 0),
    totalTransactions: projects.reduce((sum, p) => sum + p.transactions.length, 0)
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'ACTIVE':
        return <CheckCircle className="h-4 w-4 text-emerald-600" />;
      case 'In Progress':
        return <Activity className="h-4 w-4 text-blue-600" />;
      case 'SARO Approved - Pending Treasurer':
        return <Clock className="h-4 w-4 text-amber-600" />;
      case 'MPDC Approved':
        return <Clock className="h-4 w-4 text-slate-600" />;
      default:
        return <Clock className="h-4 w-4 text-slate-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-100 text-green-800';
      case 'ACTIVE':
        return 'bg-emerald-100 text-emerald-800';
      case 'In Progress':
        return 'bg-blue-100 text-blue-800';
      case 'SARO Approved - Pending Treasurer':
        return 'bg-amber-100 text-amber-800';
      case 'MPDC Approved':
        return 'bg-slate-100 text-slate-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getProgressPercentage = (project: Project) => {
    const totalBudget = project.totalBudget;
    return Math.round((project.disbursedFunds / totalBudget) * 100);
  };

  // Get recent transactions
  const recentTransactions = projects
    .flatMap(p => p.transactions.map(tx => ({ ...tx, projectName: p.name })))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  // Get pending actions
  const pendingActions = projects
    .filter((project) => (project.status === 'ACTIVE' || project.status === 'In Progress') && project.milestones.some((milestone) => milestone.status === 'Pending'))
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Real-Time Status Dashboard</h1>
            <p className="text-lg text-slate-600">Live project tracking and transaction monitoring</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm text-slate-700">Auto-refresh</span>
            </label>
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
              <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-green-700">Live</span>
            </div>
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <p className="text-xs font-semibold text-slate-600 uppercase">Total Projects</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{stats.totalProjects}</p>
            <div className="mt-2 h-1 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 w-3/4" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <p className="text-xs font-semibold text-slate-600 uppercase">Active Projects</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{stats.activeProjects}</p>
            <div className="mt-2 h-1 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-green-500" style={{ width: `${(stats.activeProjects / stats.totalProjects) * 100}%` }} />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <p className="text-xs font-semibold text-slate-600 uppercase">Allocated</p>
            <p className="text-2xl font-bold text-slate-900 mt-2">₱{(stats.allocatedAmount / 1000000).toFixed(2)}M</p>
            <p className="text-xs text-slate-500 mt-2">Total SARO</p>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <p className="text-xs font-semibold text-slate-600 uppercase">Disbursed</p>
            <p className="text-2xl font-bold text-slate-900 mt-2">₱{(stats.disbursedAmount / 1000000).toFixed(2)}M</p>
            <p className="text-xs text-slate-500 mt-2">Total NCA</p>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <p className="text-xs font-semibold text-slate-600 uppercase">Transactions</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{stats.totalTransactions}</p>
            <p className="text-xs text-slate-500 mt-2">Recorded</p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-3 gap-8">
          {/* Projects Status */}
          <div className="col-span-2 space-y-6">
            {/* Active Projects */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Active Projects</h2>
              <div className="space-y-4">
                {projects.slice(0, 5).map(project => (
                  <div key={project.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/official/audit-trails`)}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="mt-1">{getStatusIcon(project.status)}</div>
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900">{project.name}</p>
                          <p className="text-xs text-slate-500">{project.location}</p>
                        </div>
                      </div>
                      <Badge className={getStatusColor(project.status)}>
                        {project.status}
                      </Badge>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-600">Budget Utilization</span>
                        <span className="text-xs font-semibold text-slate-900">{getProgressPercentage(project)}%</span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
                          style={{ width: `${getProgressPercentage(project)}%` }}
                        />
                      </div>
                    </div>

                    {/* Budget Info */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-slate-500">Allocated</p>
                        <p className="font-semibold text-slate-900">₱{project.allocatedFunds.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Disbursed</p>
                        <p className="font-semibold text-slate-900">₱{project.disbursedFunds.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Total</p>
                        <p className="font-semibold text-slate-900">₱{project.totalBudget.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Transactions</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600 uppercase">Project</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600 uppercase">Type</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600 uppercase">Amount</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600 uppercase">Date</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600 uppercase">Hash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTransactions.map((tx, idx) => (
                      <tr
                        key={tx.id}
                        className={`border-b border-slate-100 dark:border-[#1e2334] hover:bg-slate-50 dark:hover:bg-[#181c2b] cursor-pointer ${idx % 2 === 0 ? 'bg-white dark:bg-[#121520]' : 'bg-slate-50 dark:bg-[#0e111a]'}`}
                        onClick={() => navigate(`/official/transaction/${tx.id}`)}
                      >
                        <td className="px-4 py-3 font-medium text-slate-900">{tx.projectName}</td>
                        <td className="px-4 py-3">
                          <Badge className={tx.type === 'Allocation (SARO)' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}>
                            {tx.type.split(' ')[0]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">₱{tx.amount.toLocaleString()}</td>
                        <td className="px-4 py-3 text-slate-600">{new Date(tx.date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{tx.hash.substring(0, 12)}...</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Pending Actions */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <h2 className="text-lg font-semibold text-slate-900">Pending Actions</h2>
              </div>

              {pendingActions.length > 0 ? (
                <div className="space-y-3">
                  {pendingActions.map(project => (
                    <div key={project.id} className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                      <p className="text-sm font-medium text-slate-900">{project.name}</p>
                      <p className="text-xs text-amber-700 mt-1">
                        {project.milestones.filter(m => m.status === 'Pending').length} milestones awaiting verification
                      </p>
                      <Button
                        size="sm"
                        className="mt-2 w-full text-xs"
                        onClick={() => navigate(getReviewRoute())}
                      >
                        Review Now
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 text-center py-6">No pending actions</p>
              )}
            </div>

            {/* System Health */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border-2 border-green-300 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900">System Health</h3>
                <div className="w-3 h-3 bg-green-600 rounded-full animate-pulse" />
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Blockchain:</span>
                  <span className="font-semibold text-green-700">Operational</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Database:</span>
                  <span className="font-semibold text-green-700">Connected</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Web3:</span>
                  <span className="font-semibold text-green-700">Synced</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Uptime:</span>
                  <span className="font-semibold text-green-700">99.9%</span>
                </div>
              </div>

              <div className="mt-4 p-2 bg-green-100 rounded text-xs text-green-800 text-center font-medium">
                All Systems Operational
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Quick Facts</h3>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                  <span className="text-slate-600">Avg Project Value</span>
                  <span className="font-bold text-blue-900">
                    ₱{stats.totalProjects > 0 ? Math.round(stats.allocatedAmount / stats.totalProjects) : 0}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                  <span className="text-slate-600">Utilization Rate</span>
                  <span className="font-bold text-green-900">
                    {stats.allocatedAmount > 0 ? Math.round((stats.disbursedAmount / stats.allocatedAmount) * 100) : 0}%
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-purple-50 rounded">
                  <span className="text-slate-600">Remaining Budget</span>
                  <span className="font-bold text-purple-900">
                    ₱{(stats.allocatedAmount - stats.disbursedAmount).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
