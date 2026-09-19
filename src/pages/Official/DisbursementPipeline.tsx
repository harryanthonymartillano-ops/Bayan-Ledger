import React, { useMemo } from 'react';
import { useBlockchain, Project } from '../../context/BlockchainContext';
import { Badge } from '../../components/ui/badge';
import { AlertCircle, CheckCircle, Clock, DollarSign, TrendingDown, TrendingUp } from 'lucide-react';

type AllocationStatus = 'MPDC Approved' | 'Pending Treasurer' | 'Active / Execution' | 'Completed' | 'Rejected';

interface ProjectWithStatus extends Project {
  allocationStatus: AllocationStatus;
  availableBalance: number;
  variancePercent: number;
}

export const DisbursementPipeline: React.FC = () => {
  const { projects } = useBlockchain();

  const projectsWithStatus = useMemo((): ProjectWithStatus[] => {
    return projects.map(p => {
      let allocationStatus: AllocationStatus;
      
      if (p.status === 'Rejected - Budget Officer' || p.status === 'Rejected - Treasurer') {
        allocationStatus = 'Rejected';
      } else if (p.status === 'MPDC Approved') {
        allocationStatus = 'MPDC Approved';
      } else if (p.status === 'SARO Approved - Pending Treasurer') {
        allocationStatus = 'Pending Treasurer';
      } else if (p.status === 'ACTIVE' || p.status === 'In Progress') {
        allocationStatus = 'Active / Execution';
      } else {
        allocationStatus = 'Completed';
      }

      const availableBalance = p.allocatedFunds - p.disbursedFunds;
      const variancePercent = p.allocatedFunds > 0
        ? ((p.disbursedFunds - (p.totalBudget * 0.5)) / (p.totalBudget * 0.5)) * 100
        : 0;

      return {
        ...p,
        allocationStatus,
        availableBalance,
        variancePercent
      };
    });
  }, [projects]);

  const getStatusColor = (status: AllocationStatus) => {
    switch (status) {
      case 'MPDC Approved':
        return { bg: 'bg-slate-100', text: 'text-slate-700', badge: 'bg-slate-100 text-slate-800', border: 'border-slate-300' };
      case 'Pending Treasurer':
        return { bg: 'bg-blue-100', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800', border: 'border-blue-300' };
      case 'Active / Execution':
        return { bg: 'bg-amber-100', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-800', border: 'border-amber-300' };
      case 'Completed':
        return { bg: 'bg-green-100', text: 'text-green-700', badge: 'bg-green-100 text-green-800', border: 'border-green-300' };
      case 'Rejected':
        return { bg: 'bg-red-100', text: 'text-red-700', badge: 'bg-red-100 text-red-800', border: 'border-red-300' };
    }
  };

  const getStatusIcon = (status: AllocationStatus) => {
    switch (status) {
      case 'MPDC Approved':
        return <Clock className="h-4 w-4" />;
      case 'Pending Treasurer':
        return <DollarSign className="h-4 w-4" />;
      case 'Active / Execution':
        return <TrendingDown className="h-4 w-4" />;
      case 'Completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'Rejected':
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  // Calculate department stats
  const departmentStats = useMemo(() => {
    const depts = new Map<string, { allocated: number; disbursed: number; count: number }>();
    projectsWithStatus.forEach(p => {
      const dept = p.category || 'Other';
      const current = depts.get(dept) || { allocated: 0, disbursed: 0, count: 0 };
      depts.set(dept, {
        allocated: current.allocated + p.allocatedFunds,
        disbursed: current.disbursed + p.disbursedFunds,
        count: current.count + 1
      });
    });
    return depts;
  }, [projectsWithStatus]);

  // Budget variance alerts
  const varianceAlerts = useMemo(() => {
    return projectsWithStatus.filter(p => Math.abs(p.variancePercent) > 15);
  }, [projectsWithStatus]);

  // Real-time available balance
  const totalAllocated = projectsWithStatus.reduce((sum, p) => sum + p.allocatedFunds, 0);
  const totalDisbursed = projectsWithStatus.reduce((sum, p) => sum + p.disbursedFunds, 0);
  const totalAvailable = totalAllocated - totalDisbursed;

  const statusCounts = {
    mpdcApproved: projectsWithStatus.filter(p => p.allocationStatus === 'MPDC Approved').length,
    pendingTreasurer: projectsWithStatus.filter(p => p.allocationStatus === 'Pending Treasurer').length,
    activeExecution: projectsWithStatus.filter(p => p.allocationStatus === 'Active / Execution').length,
    completed: projectsWithStatus.filter(p => p.allocationStatus === 'Completed').length,
    rejected: projectsWithStatus.filter(p => p.allocationStatus === 'Rejected').length
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Disbursement Pipeline</h1>
          <p className="text-slate-600">
            Track MPDC-approved projects as they move through Gate 1 SARO allocation, Gate 2 Treasury activation, and public execution
          </p>
        </div>

        {/* Real-Time Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-sm text-slate-600 font-medium">Total Allocated</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">₱{(totalAllocated / 1000000).toFixed(2)}M</p>
            <p className="text-xs text-slate-500 mt-2">{projectsWithStatus.length} projects</p>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-sm text-slate-600 font-medium">Total Disbursed</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">₱{(totalDisbursed / 1000000).toFixed(2)}M</p>
            <p className="text-xs text-slate-500 mt-2">{totalAllocated > 0 ? ((totalDisbursed / totalAllocated) * 100).toFixed(1) : 0}% utilization</p>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-sm text-slate-600 font-medium">Available Balance</p>
            <p className={`text-2xl font-bold mt-1 ${totalAvailable >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ₱{(totalAvailable / 1000000).toFixed(2)}M
            </p>
            <p className="text-xs text-slate-500 mt-2">Ready to disburse</p>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-sm text-slate-600 font-medium">Variance Alerts</p>
            <p className={`text-2xl font-bold mt-1 ${varianceAlerts.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {varianceAlerts.length}
            </p>
            <p className="text-xs text-slate-500 mt-2">Projects with variance</p>
          </div>
        </div>

        {/* Pipeline Status Visualization */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Allocation Status Pipeline</h2>
          
          <div className="flex flex-col md:flex-row gap-4 md:gap-0">
            {[
              { status: 'MPDC Approved', count: statusCounts.mpdcApproved },
              { status: 'Pending Treasurer', count: statusCounts.pendingTreasurer },
              { status: 'Active / Execution', count: statusCounts.activeExecution },
              { status: 'Completed', count: statusCounts.completed },
              { status: 'Rejected', count: statusCounts.rejected }
            ].map((stage, idx) => {
              const color = getStatusColor(stage.status as AllocationStatus);
              return (
                <div key={stage.status} className="flex-1">
                  <div className={`${color.bg} border-2 ${color.border} rounded-lg p-4 text-center`}>
                    <div className="flex items-center justify-center mb-2">
                      <div className={`${color.text}`}>
                        {getStatusIcon(stage.status as AllocationStatus)}
                      </div>
                    </div>
                    <p className={`font-semibold ${color.text}`}>{stage.status}</p>
                    <p className="text-2xl font-bold text-slate-900 mt-2">{stage.count}</p>
                    <p className="text-xs text-slate-600 mt-1">projects</p>
                  </div>
                  {idx < 4 && (
                    <div className="hidden md:flex items-center justify-center mt-4">
                      <div className="w-8 h-0.5 bg-gradient-to-r from-blue-400 to-green-400 transform -rotate-12 relative right-2"></div>
                      <div className="text-blue-400 text-xl">→</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Budget Variance Alerts */}
        {varianceAlerts.length > 0 && (
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <h2 className="text-lg font-semibold text-red-900">Budget Variance Alerts</h2>
            </div>
            <div className="space-y-3">
              {varianceAlerts.map(project => (
                <div key={project.id} className="bg-white rounded border border-red-200 p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{project.name}</p>
                      <p className="text-sm text-slate-600 mt-1">{project.location}</p>
                    </div>
                    <Badge className={project.variancePercent > 0 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}>
                      {project.variancePercent > 0 ? '+' : ''}{project.variancePercent.toFixed(1)}%
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Allocated: ₱{(project.allocatedFunds / 1000).toFixed(0)}K • 
                    Disbursed: ₱{(project.disbursedFunds / 1000).toFixed(0)}K
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Department Breakdown */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Department-by-Department Breakdown</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from(departmentStats.entries()).map(([dept, stats]) => {
              const utilization = stats.allocated > 0 ? (stats.disbursed / stats.allocated) * 100 : 0;
              return (
                <div key={dept} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-slate-900">{dept}</p>
                      <p className="text-xs text-slate-600">{stats.count} projects</p>
                    </div>
                    <Badge className={utilization < 50 ? 'bg-blue-100 text-blue-800' : utilization < 80 ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}>
                      {utilization.toFixed(0)}%
                    </Badge>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Allocated:</span>
                      <span className="font-semibold text-slate-900">₱{(stats.allocated / 1000).toFixed(0)}K</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Disbursed:</span>
                      <span className="font-semibold text-slate-900">₱{(stats.disbursed / 1000).toFixed(0)}K</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Available:</span>
                      <span className="font-semibold text-slate-900">₱{((stats.allocated - stats.disbursed) / 1000).toFixed(0)}K</span>
                    </div>
                  </div>

                  {/* Utilization bar */}
                  <div className="mt-4 space-y-1">
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          utilization < 50 ? 'bg-blue-500' : utilization < 80 ? 'bg-amber-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(utilization, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500">Utilization Rate</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Status Legend */}
        <div className="mt-8 bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-300 rounded-lg p-6">
          <h3 className="font-semibold text-slate-900 mb-3">Status Legend</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-semibold text-slate-700 flex items-center gap-2 mb-1">
                <span className="w-3 h-3 bg-slate-400 rounded-full"></span>
                MPDC Approved
              </p>
              <p className="text-slate-600 ml-5">Project created directly by MPDC and ready for Gate 1 review</p>
            </div>
            <div>
              <p className="font-semibold text-slate-700 flex items-center gap-2 mb-1">
                <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                Pending Treasurer
              </p>
              <p className="text-slate-600 ml-5">Budget Officer signed the SARO and Treasury approval is pending</p>
            </div>
            <div>
              <p className="font-semibold text-slate-700 flex items-center gap-2 mb-1">
                <span className="w-3 h-3 bg-amber-500 rounded-full"></span>
                Active / Execution
              </p>
              <p className="text-slate-600 ml-5">Treasurer activated the project and milestones may now execute</p>
            </div>
            <div>
              <p className="font-semibold text-slate-700 flex items-center gap-2 mb-1">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                Completed
              </p>
              <p className="text-slate-600 ml-5">Execution and fund release are complete</p>
            </div>
            <div>
              <p className="font-semibold text-slate-700 flex items-center gap-2 mb-1">
                <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                Rejected
              </p>
              <p className="text-slate-600 ml-5">Budget Officer or Treasurer stopped the project at a gate</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
