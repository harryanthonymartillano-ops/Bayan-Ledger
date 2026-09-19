import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBlockchain } from '../../context/BlockchainContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { CheckSquare, AlertTriangle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

export const MyTasks = () => {
  const { user } = useAuth();
  const { projects, alerts } = useBlockchain();

  if (!user) return null;

  const renderTasks = () => {
    switch (user.role) {
      case 'MPDC (Planning)':
        const pendingMilestones = projects.flatMap(p =>
          p.allocatedFunds > 0
            ? p.milestones.filter(m => m.status === 'Pending').map(m => ({ project: p, milestone: m }))
            : []
        );
        return (
          <div className="space-y-4">
            {pendingMilestones.length === 0 ? (
              <p className="text-slate-500">No allocated projects have pending milestones to verify.</p>
            ) : (
              pendingMilestones.map((item, idx) => (
                <Card key={idx} className="border-slate-200">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-slate-900">{item.project.name}</h4>
                      <p className="text-sm text-slate-500">{item.milestone.title}</p>
                    </div>
                    <Link to={`/official/dashboard?projectId=${item.project.id}`} className="text-blue-600 hover:underline text-sm font-medium">
                      Verify Now
                    </Link>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        );

      case 'Budget Officer':
        const unallocatedProjects = projects.filter(p => p.allocatedFunds === 0);
        return (
          <div className="space-y-4">
            {unallocatedProjects.length === 0 ? (
              <p className="text-slate-500">No projects pending budget allocation.</p>
            ) : (
              unallocatedProjects.map(p => (
                <Card key={p.id} className="border-slate-200">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-slate-900">{p.name}</h4>
                      <p className="text-sm text-slate-500">Total Budget: ₱{p.totalBudget.toLocaleString()}</p>
                    </div>
                    <Link to="/official/dashboard" className="text-blue-600 hover:underline text-sm font-medium">
                      Allocate Funds
                    </Link>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        );

      case 'Treasurer':
        const pendingPayments = projects.filter(p =>
          p.milestones.some(m => m.status === 'Verified') && p.disbursedFunds < p.allocatedFunds
        );
        return (
          <div className="space-y-4">
            {pendingPayments.length === 0 ? (
              <p className="text-slate-500">No pending payments.</p>
            ) : (
              pendingPayments.map(p => (
                <Card key={p.id} className="border-slate-200">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-slate-900">{p.name}</h4>
                      <p className="text-sm text-slate-500">Available to Disburse: ₱{(p.allocatedFunds - p.disbursedFunds).toLocaleString()}</p>
                    </div>
                    <Link to="/official/dashboard" className="text-blue-600 hover:underline text-sm font-medium">
                      Disburse Funds
                    </Link>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        );
      case 'Admin':
        const unresolvedAlerts = alerts.filter(a => a.status === 'Unresolved');
        return (
          <div className="space-y-4">
            {unresolvedAlerts.length === 0 ? (
              <p className="text-slate-500">No system alerts to resolve.</p>
            ) : (
              unresolvedAlerts.map(a => (
                <Card key={a.id} className="border-amber-200 bg-amber-50">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-amber-900">Project: {a.projectId}</h4>
                        <p className="text-sm text-amber-700">{a.message}</p>
                      </div>
                    </div>
                    <Link to="/official/dashboard" className="text-blue-600 hover:underline text-sm font-medium whitespace-nowrap ml-4">
                      Review Alert
                    </Link>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        );

      default:
        return <p className="text-slate-500 text-sm">No specific tasks for this role.</p>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-8">
      <div className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center">
          <CheckSquare className="h-7 w-7 mr-2.5 text-blue-600" />
          My Tasks
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Action items requiring your attention as {user.role}.
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-xl">Pending Actions</CardTitle>
          <CardDescription>Review and complete your required tasks.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {renderTasks()}
        </CardContent>
      </Card>
    </div>
  );
};
