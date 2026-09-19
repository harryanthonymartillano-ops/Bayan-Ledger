import React from 'react';
import { ComplianceScore, Project } from '../context/BlockchainContext';
import { Badge } from './ui/badge';
import { AlertCircle, CheckCircle, TrendingDown, TrendingUp } from 'lucide-react';

interface ComplianceScoreboardProps {
  projects: Project[];
  complianceScores: Map<string, ComplianceScore>;
}

export const ComplianceScoreboard: React.FC<ComplianceScoreboardProps> = ({
  projects,
  complianceScores
}) => {
  const getScoreColor = (score: number) => {
    if (score >= 90) return { bg: 'bg-green-100', text: 'text-green-900', badge: 'bg-green-200' };
    if (score >= 70) return { bg: 'bg-blue-100', text: 'text-blue-900', badge: 'bg-blue-200' };
    if (score >= 50) return { bg: 'bg-amber-100', text: 'text-amber-900', badge: 'bg-amber-200' };
    return { bg: 'bg-red-100', text: 'text-red-900', badge: 'bg-red-200' };
  };

  const getScoreBadge = (score: number) => {
    if (score >= 90) return 'bg-green-100 text-green-800';
    if (score >= 70) return 'bg-blue-100 text-blue-800';
    if (score >= 50) return 'bg-amber-100 text-amber-800';
    return 'bg-red-100 text-red-800';
  };

  const averageScore = complianceScores.size > 0
    ? Math.round(
        Array.from(complianceScores.values()).reduce((sum, s) => sum + s.totalScore, 0) /
          complianceScores.size
      )
    : 0;

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <div className={`${getScoreColor(averageScore).bg} border-2 border-gradient rounded-lg p-8`}>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-600 uppercase mb-2">Overall Compliance Score</p>
          <div className={`text-5xl font-bold ${getScoreColor(averageScore).text} mb-2`}>
            {averageScore}%
          </div>
          <p className="text-sm text-slate-600">Based on {complianceScores.size} projects</p>
        </div>
      </div>

      {/* Project Compliance Grid */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Project Compliance Scores</h3>

        {projects.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-lg border border-dashed border-slate-300">
            <AlertCircle className="h-10 w-10 text-slate-400 mx-auto mb-2" />
            <p className="text-slate-500 font-medium">No projects to assess</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((project) => {
              const score = complianceScores.get(project.id);
              const color = getScoreColor(score?.totalScore || 0);

              return (
                <div
                  key={project.id}
                  className={`${color.bg} border border-slate-200 rounded-lg p-5 hover:shadow-lg transition-shadow`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900 mb-1">{project.name}</h4>
                      <p className="text-xs text-slate-600">{project.location}</p>
                    </div>
                    {score && (
                      <Badge className={getScoreBadge(score.totalScore)}>
                        {score.totalScore}%
                      </Badge>
                    )}
                  </div>

                  {/* Score Components */}
                  {score && (
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-700">Documentation</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500"
                              style={{ width: `${score.documentScore}%` }}
                            />
                          </div>
                          <span className="font-semibold text-slate-900 w-12 text-right">
                            {score.documentScore}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-700">Milestones</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500"
                              style={{ width: `${score.milestoneScore}%` }}
                            />
                          </div>
                          <span className="font-semibold text-slate-900 w-12 text-right">
                            {score.milestoneScore}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-700">Budget</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-purple-500"
                              style={{ width: `${score.budgetScore}%` }}
                            />
                          </div>
                          <span className="font-semibold text-slate-900 w-12 text-right">
                            {score.budgetScore}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-700">Audit</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-orange-500"
                              style={{ width: `${score.auditScore}%` }}
                            />
                          </div>
                          <span className="font-semibold text-slate-900 w-12 text-right">
                            {score.auditScore}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Status Indicator */}
                  <div className="border-t border-slate-300 pt-3">
                    {score && score.totalScore >= 80 ? (
                      <div className="flex items-center gap-2 text-xs text-green-700">
                        <CheckCircle className="h-4 w-4" />
                        Fully compliant
                      </div>
                    ) : score && score.totalScore >= 60 ? (
                      <div className="flex items-center gap-2 text-xs text-amber-700">
                        <AlertCircle className="h-4 w-4" />
                        Needs improvement
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-red-700">
                        <AlertCircle className="h-4 w-4" />
                        Critical issues
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Compliance Guidelines */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-300 rounded-lg p-6">
        <h4 className="font-semibold text-slate-900 mb-3">Compliance Score Breakdown</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-semibold text-slate-900 flex items-center gap-2 mb-2">
              <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
              Documentation (25%)
            </p>
            <p className="text-slate-600 ml-5">Uploaded and verified documents</p>
          </div>
          <div>
            <p className="font-semibold text-slate-900 flex items-center gap-2 mb-2">
              <span className="w-3 h-3 bg-green-500 rounded-full"></span>
              Milestones (25%)
            </p>
            <p className="text-slate-600 ml-5">Verified project milestones</p>
          </div>
          <div>
            <p className="font-semibold text-slate-900 flex items-center gap-2 mb-2">
              <span className="w-3 h-3 bg-purple-500 rounded-full"></span>
              Budget (25%)
            </p>
            <p className="text-slate-600 ml-5">Budget accuracy & utilization</p>
          </div>
          <div>
            <p className="font-semibold text-slate-900 flex items-center gap-2 mb-2">
              <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
              Audit (25%)
            </p>
            <p className="text-slate-600 ml-5">System audit trail completeness</p>
          </div>
        </div>

        <div className="mt-4 p-3 bg-white rounded border border-slate-200">
          <p className="text-xs text-slate-600">
            <strong>Score Ranges:</strong> 90-100% = Excellent • 70-89% = Good • 50-69% = Fair • Below 50% = Poor
          </p>
        </div>
      </div>
    </div>
  );
};
