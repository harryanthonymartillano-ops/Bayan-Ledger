import React from 'react';
import { DepartmentBudget, Project } from '../context/BlockchainContext';
import { Badge } from './ui/badge';
import { TrendingUp, Target, DollarSign, MapPin } from 'lucide-react';

interface BudgetTransparencyCardsProps {
  departmentBudgets: DepartmentBudget[];
  projects: Project[];
}

export const BudgetTransparencyCards: React.FC<BudgetTransparencyCardsProps> = ({
  departmentBudgets,
  projects
}) => {
  const totalAllocated = departmentBudgets.reduce((sum, d) => sum + d.allocatedBudget, 0);
  const totalSpent = departmentBudgets.reduce((sum, d) => sum + d.spentBudget, 0);
  const totalRemaining = totalAllocated - totalSpent;
  const utilizationRate = totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0;

  const getUtilizationColor = (utilization: number) => {
    if (utilization < 30) return 'text-red-600';
    if (utilization < 70) return 'text-amber-600';
    if (utilization < 100) return 'text-green-600';
    return 'text-orange-600';
  };

  const getProgressBarColor = (percentage: number): string => {
    if (percentage < 50) return 'bg-blue-500';
    if (percentage < 80) return 'bg-green-500';
    if (percentage < 100) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Overall Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-blue-600 uppercase">Total Allocated</p>
            <DollarSign className="h-5 w-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-blue-900">₱{(totalAllocated / 1000000).toFixed(2)}M</p>
          <p className="text-xs text-blue-600 mt-2">{departmentBudgets.length} departments</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-green-600 uppercase">Total Spent</p>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-900">₱{(totalSpent / 1000000).toFixed(2)}M</p>
          <p className="text-xs text-green-600 mt-2">{utilizationRate}% utilized</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-purple-600 uppercase">Remaining</p>
            <Target className="h-5 w-5 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-purple-900">₱{(totalRemaining / 1000000).toFixed(2)}M</p>
          <p className="text-xs text-purple-600 mt-2">{100 - utilizationRate}% available</p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-orange-600 uppercase">Utilization</p>
            <div className={`text-2xl font-bold ${getUtilizationColor(utilizationRate)}`}>
              {utilizationRate}%
            </div>
          </div>
          <div className="h-1.5 bg-orange-200 rounded-full overflow-hidden mt-2">
            <div
              className={getProgressBarColor(utilizationRate)}
              style={{ width: `${Math.min(utilizationRate, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Department Cards */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Budget by Department</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departmentBudgets.map((dept) => {
            const utilized = dept.allocatedBudget > 0 ? (dept.spentBudget / dept.allocatedBudget) * 100 : 0;
            const deptProjects = projects.filter(p => p.category === dept.department);

            return (
              <div
                key={dept.department}
                className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-lg transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900 mb-1">{dept.department}</h4>
                    <Badge className="bg-slate-100 text-slate-800 text-xs">
                      {dept.projectCount} projects
                    </Badge>
                  </div>
                  <Badge className={getUtilizationColor(utilized) === 'text-green-600' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
                    {Math.round(utilized)}%
                  </Badge>
                </div>

                {/* Budget Breakdown */}
                <div className="space-y-3 mb-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-slate-600">Allocated</p>
                      <p className="text-sm font-semibold text-slate-900">
                        ₱{dept.allocatedBudget.toLocaleString()}
                      </p>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500"
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-slate-600">Spent</p>
                      <p className="text-sm font-semibold text-slate-900">
                        ₱{dept.spentBudget.toLocaleString()}
                      </p>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getProgressBarColor(utilized)}`}
                        style={{ width: `${Math.min(utilized, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-slate-600">Remaining</p>
                      <p className="text-sm font-semibold text-slate-900">
                        ₱{(dept.allocatedBudget - dept.spentBudget).toLocaleString()}
                      </p>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500"
                        style={{ width: `${Math.max(0, 100 - utilized)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Project List */}
                {projects.length > 0 && (
                  <div className="border-t border-slate-200 pt-3">
                    <p className="text-xs font-semibold text-slate-600 uppercase mb-2">Active Projects</p>
                    <div className="space-y-1">
                      {projects.slice(0, 3).map((proj) => (
                        <div key={proj.id} className="text-xs text-slate-600">
                          <div className="flex justify-between">
                            <span className="truncate">{proj.name}</span>
                            <span className="font-medium text-slate-900">
                              {Math.round((proj.disbursedFunds / proj.allocatedFunds) * 100) || 0}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Budget Source Breakdown */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Projects by Budget Source</h3>
        {(() => {
          const projectsBySource = new Map<string, Project[]>();
          projects.forEach(p => {
            const source = p.budgetSource || 'Unspecified';
            if (!projectsBySource.has(source)) {
              projectsBySource.set(source, []);
            }
            projectsBySource.get(source)!.push(p);
          });

          if (projectsBySource.size === 0) {
            return <p className="text-slate-500 text-sm">No budget source information available</p>;
          }

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from(projectsBySource.entries()).map(([source, sourceProjects]) => {
                const totalBudget = sourceProjects.reduce((sum, p) => sum + p.totalBudget, 0);
                const totalDisbursed = sourceProjects.reduce((sum, p) => sum + p.disbursedFunds, 0);

                return (
                  <div
                    key={source}
                    className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900 mb-2">{source}</h4>
                        <Badge className="bg-amber-100 text-amber-800 text-xs">
                          {sourceProjects.length} project{sourceProjects.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-3 mb-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs text-slate-600">Total Budget</p>
                          <p className="text-sm font-semibold text-slate-900">
                            ₱{(totalBudget / 1000000).toFixed(2)}M
                          </p>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs text-slate-600">Disbursed</p>
                          <p className="text-sm font-semibold text-slate-900">
                            ₱{(totalDisbursed / 1000000).toFixed(2)}M
                          </p>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={getProgressBarColor((totalDisbursed / totalBudget) * 100)}
                            style={{ width: `${Math.min((totalDisbursed / totalBudget) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Project List for this Source */}
                    <div className="border-t border-slate-200 pt-3">
                      <p className="text-xs font-semibold text-slate-600 uppercase mb-2">Projects</p>
                      <div className="space-y-1">
                        {sourceProjects.slice(0, 3).map((proj) => (
                          <div key={proj.id} className="text-xs">
                            <div className="flex justify-between items-start gap-2">
                              <span className="truncate text-slate-600 flex-1">{proj.name}</span>
                              <span className="font-medium text-slate-900 whitespace-nowrap">
                                ₱{(proj.totalBudget / 1000).toFixed(0)}K
                              </span>
                            </div>
                          </div>
                        ))}
                        {sourceProjects.length > 3 && (
                          <p className="text-xs text-slate-500 mt-2 italic">
                            +{sourceProjects.length - 3} more project(s)
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Transparency Statement */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
        <h4 className="font-semibold text-blue-900 mb-2">Budget Transparency Commitment</h4>
        <p className="text-sm text-blue-800 mb-3">
          All budget allocations and disbursements are tracked in real-time and verified on the blockchain. Department breakdowns show actual spending vs. allocated funds to ensure accountability and prevent budget overruns. Budget sources identify where funds originate (CHED, GAA, National, Local, etc.), and location photos provide geographic verification and proof of project existence.
        </p>
        <div className="grid grid-cols-2 text-xs text-blue-700">
          <div>✓ Real-time budget tracking</div>
          <div>✓ Budget source transparency</div>
          <div>✓ Department-level accountability</div>
          <div>✓ Location photo verification</div>
          <div>✓ Blockchain verified</div>
          <div>✓ Public accessibility</div>
        </div>
      </div>
    </div>
  );
};
