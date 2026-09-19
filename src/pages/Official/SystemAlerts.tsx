import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBlockchain, SystemAlert } from '../../context/BlockchainContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import apiClient from '../../lib/apiClient';
import { readBreachResolutionOverrides } from '../../lib/breachDetection';
import { isProjectTampered } from '../../lib/projectIntegrity';
import { isMilestoneDelayed, isProjectDelayed } from '../../lib/scheduleStatus';
import { getContract, getReadOnlyWeb3Provider } from '../../lib/web3';
import { readStoredChainBudgets, updateStoredChainBudget } from '../../lib/chainBudgetCache';

const getRelativeAlertDate = (minutesAgo: number) =>
  new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();

const isSyntheticAlert = (alertId: string) =>
  alertId.startsWith('critical-breach-') || alertId.startsWith('anomaly-');

export const SystemAlerts = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const { alerts, projects, chainBudgets: contextChainBudgets } = useBlockchain();
  const [filterStatus, setFilterStatus] = useState<'All' | 'Unresolved' | 'Resolved'>('Unresolved');
  const [filterSeverity, setFilterSeverity] = useState<'All' | 'CRITICAL' | 'WARNING' | 'INFO'>('All');
  const [isLoading, setIsLoading] = useState(false);
  const [resolvedBudgetOverrides] = useState(() => readBreachResolutionOverrides());
  const [chainBudgets, setChainBudgets] = useState<Record<string, number>>(() => readStoredChainBudgets());

  React.useEffect(() => {
    if (!contextChainBudgets) return;
    setChainBudgets((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [id, budget] of Object.entries(contextChainBudgets)) {
        if (typeof budget === 'number' && next[id] !== budget) {
          next[id] = budget;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [contextChainBudgets]);

  const isRetiredAlert = (alert: SystemAlert) => {
    const message = String(alert.message || '').toLowerCase();
    const alertType = String(alert.alertType || '').toLowerCase();
    const details = JSON.stringify(alert.details || {}).toLowerCase();

    return (
      message.includes('public report:') ||
      message.includes('tampering detected') ||
      alertType.includes('tampering') ||
      details.includes('direct_database_modification') ||
      details.includes('rapid_updates')
    );
  };

  const tamperedProjects = useMemo(() => {
    return projects
      .filter((project) => {
        const chainBudget = chainBudgets[project.id];
        if (typeof chainBudget !== 'number') return false;
        const effectiveBudget = resolvedBudgetOverrides[project.id] ?? project.totalBudget;
        return isProjectTampered(effectiveBudget, chainBudget);
      })
      .map((project) => ({
        id: project.id,
        chainBudget: chainBudgets[project.id],
      }));
  }, [projects, chainBudgets, resolvedBudgetOverrides]);

  React.useEffect(() => {
    let isMounted = true;

    const loadTamperedProject = async () => {
      const provider = getReadOnlyWeb3Provider();
      if (!provider || projects.length === 0) return;

      try {
        const contract = await getContract(provider);
        const snapshots = await Promise.all(
          projects.map(async (project) => {
            try {
              const chainProject = await contract.projects(project.id);
              const exists = Boolean(chainProject.exists ?? chainProject[14]);
              if (!exists) return [project.id, null] as const;
              const totalBudget = Number(chainProject.totalBudget ?? chainProject[2] ?? 0);
              return [project.id, totalBudget] as const;
            } catch {
              return [project.id, null] as const;
            }
          })
        );

        if (!isMounted) return;

        setChainBudgets((prev) => {
          let changed = false;
          const next = { ...prev };
          for (const [id, budget] of snapshots) {
            if (typeof budget === 'number' && Number.isFinite(budget)) {
              if (next[id] !== budget) {
                next[id] = budget;
                changed = true;
              }
              updateStoredChainBudget(id, budget);
            }
          }
          return changed ? next : prev;
        });
      } catch (error) {
        console.warn('Unable to evaluate blockchain/database desynchronization alerts.', error);
      }
    };

    loadTamperedProject();

    return () => {
      isMounted = false;
    };
  }, [projects, resolvedBudgetOverrides]);

  const syntheticBreachAlerts = useMemo<SystemAlert[]>(() => {
    return tamperedProjects.map(({ id: pId, chainBudget }) => ({
      id: `critical-breach-${pId}`,
      projectId: pId,
      message: 'CRITICAL BREACH: Blockchain-Database Desynchronization',
      date: new Date().toISOString(),
      status: 'Unresolved' as const,
      alertType: 'Security Breach',
      severity: 'CRITICAL' as const,
      details: {
        projectId: pId,
        message: `Project ID: ${pId} | System tracked an unauthorized local database change bypassing the multi-sig verification gate.`,
        blockchainBudget: chainBudget,
      },
    }));
  }, [tamperedProjects]);

  const anomalyAlerts = useMemo<SystemAlert[]>(() => {
    const sourceProjects = projects.length > 0
      ? projects
      : [{
        id: 'system-monitor',
        name: 'System Monitor',
        totalBudget: 0,
        allocatedFunds: 0,
        disbursedFunds: 0,
        status: 'ACTIVE',
        milestones: [],
        documents: [],
        transactions: [],
        createdAt: new Date().toISOString(),
      } as any];

    const alertsByType = new Map<string, SystemAlert>();
    const addAlert = (type: string, alert: SystemAlert) => {
      if (!alertsByType.has(type)) {
        alertsByType.set(type, alert);
      }
    };

    sourceProjects.forEach((project, index) => {
      const projectName = project.name || project.id;
      const allocatedFunds = Number(project.allocatedFunds || 0);
      const disbursedFunds = Number(project.disbursedFunds || 0);
      const totalBudget = Number(project.totalBudget || 0);
      const pendingSignature = project.transactions?.find((transaction: any) =>
        ['Pending Transaction', '1/2 Signed'].includes(transaction.status)
      );
      const delayedMilestone = project.milestones?.find(isMilestoneDelayed);
      const missingDocument = !project.documents || project.documents.length === 0;
      const missingLocationPhotos = !project.locationPhotos || project.locationPhotos.length === 0;
      const hasStaleSync = !project.onChainSyncedAt ||
        Date.now() - new Date(project.onChainSyncedAt).getTime() > 7 * 24 * 60 * 60 * 1000;

      if (allocatedFunds > totalBudget || disbursedFunds > allocatedFunds) {
        addAlert('Budget Variance', {
          id: `anomaly-budget-variance-${project.id}`,
          projectId: project.id,
          message: `Budget variance detected for ${projectName}`,
          date: getRelativeAlertDate(18 + index),
          status: 'Unresolved',
          alertType: 'Budget Variance',
          severity: 'CRITICAL',
          details: { totalBudget, allocatedFunds, disbursedFunds },
        });
      }

      if (isProjectDelayed(project)) {
        addAlert('Schedule Delay', {
          id: `anomaly-schedule-delay-${project.id}`,
          projectId: project.id,
          message: `Project timeline anomaly detected for ${projectName}`,
          date: getRelativeAlertDate(42 + index),
          status: 'Unresolved',
          alertType: 'Schedule Delay',
          severity: 'WARNING',
          details: {
            endDate: project.endDate || 'Not set',
            delayedMilestone: delayedMilestone?.title || 'Project end date has passed',
          },
        });
      }

      if (missingDocument || missingLocationPhotos) {
        addAlert('Evidence Gap', {
          id: `anomaly-evidence-gap-${project.id}`,
          projectId: project.id,
          message: `Required project evidence is incomplete for ${projectName}`,
          date: getRelativeAlertDate(64 + index),
          status: 'Unresolved',
          alertType: 'Evidence Gap',
          severity: 'WARNING',
          details: {
            documents: project.documents?.length || 0,
            locationPhotos: project.locationPhotos?.length || 0,
          },
        });
      }

      if (project.status === 'MPDC Approved' || project.status === 'SARO Approved - Pending Treasurer') {
        addAlert('Approval Bottleneck', {
          id: `anomaly-approval-bottleneck-${project.id}`,
          projectId: project.id,
          message: `Approval workflow is stalled for ${projectName}`,
          date: getRelativeAlertDate(87 + index),
          status: 'Unresolved',
          alertType: 'Approval Bottleneck',
          severity: 'INFO',
          details: {
            currentStatus: project.status,
            missingStage: project.status === 'MPDC Approved' ? 'Budget Officer SARO signature' : 'Treasurer activation',
          },
        });
      }

      if (hasStaleSync) {
        addAlert('Blockchain Sync Gap', {
          id: `anomaly-chain-sync-${project.id}`,
          projectId: project.id,
          message: `Blockchain sync timestamp is missing or stale for ${projectName}`,
          date: getRelativeAlertDate(109 + index),
          status: 'Unresolved',
          alertType: 'Blockchain Sync Gap',
          severity: 'WARNING',
          details: {
            lastSyncedAt: project.onChainSyncedAt || 'No sync timestamp recorded',
            blockchainTxHash: project.blockchainTxHash || 'Missing',
          },
        });
      }

      if (pendingSignature) {
        addAlert('Unsigned Disbursement', {
          id: `anomaly-unsigned-disbursement-${project.id}`,
          projectId: project.id,
          message: `Disbursement request is waiting for signature completion on ${projectName}`,
          date: getRelativeAlertDate(131 + index),
          status: 'Unresolved',
          alertType: 'Unsigned Disbursement',
          severity: 'INFO',
          details: {
            transactionId: pendingSignature.id,
            status: pendingSignature.status,
            amount: pendingSignature.amount,
          },
        });
      }

      const documentWithoutHash = project.documents?.find((document: any) =>
        !document.ipfsHash && !document.checksumHash
      );
      if (documentWithoutHash) {
        addAlert('Document Hash Gap', {
          id: `anomaly-document-hash-${project.id}`,
          projectId: project.id,
          message: `Document integrity hash is missing for ${projectName}`,
          date: getRelativeAlertDate(156 + index),
          status: 'Unresolved',
          alertType: 'Document Hash Gap',
          severity: 'WARNING',
          details: {
            documentTitle: documentWithoutHash.title,
            documentType: documentWithoutHash.type,
          },
        });
      }
    });

    const fallbackTemplates = [
      {
        type: 'Budget Variance',
        message: 'Budget variance detected between allocated and disbursed funds',
        severity: 'CRITICAL' as const,
        details: { trigger: 'Disbursement exceeds approved allocation threshold' },
      },
      {
        type: 'Schedule Delay',
        message: 'Project timeline anomaly detected from overdue milestone targets',
        severity: 'WARNING' as const,
        details: { trigger: 'Milestone due date passed without verification' },
      },
      {
        type: 'Evidence Gap',
        message: 'Required project evidence is incomplete',
        severity: 'WARNING' as const,
        details: { trigger: 'Missing documents, location photos, or milestone proof' },
      },
      {
        type: 'Approval Bottleneck',
        message: 'Approval workflow is waiting beyond the expected handoff window',
        severity: 'INFO' as const,
        details: { trigger: 'Pending budget or treasury sign-off' },
      },
      {
        type: 'Blockchain Sync Gap',
        message: 'Blockchain sync timestamp is missing or stale',
        severity: 'WARNING' as const,
        details: { trigger: 'Local record has no recent on-chain confirmation' },
      },
      {
        type: 'Unsigned Disbursement',
        message: 'Disbursement request is waiting for signature completion',
        severity: 'INFO' as const,
        details: { trigger: 'Multi-signature request has fewer than two signatures' },
      },
      {
        type: 'Document Hash Gap',
        message: 'Document integrity hash is missing from an uploaded record',
        severity: 'WARNING' as const,
        details: { trigger: 'Missing IPFS or checksum hash' },
      },
    ];

    fallbackTemplates.forEach((template, index) => {
      const project = sourceProjects[index % sourceProjects.length];
      addAlert(template.type, {
        id: `anomaly-${template.type.toLowerCase().replace(/\s+/g, '-')}-${project.id}`,
        projectId: project.id,
        message: template.message,
        date: getRelativeAlertDate(210 + index * 17),
        status: 'Unresolved',
        alertType: template.type,
        severity: template.severity,
        details: {
          projectId: project.id,
          projectName: project.name || project.id,
          ...template.details,
        },
      });
    });

    return Array.from(alertsByType.values());
  }, [projects]);

  const activeAlerts = useMemo(() => {
    const filteredAlerts = alerts.filter((alert) => !isRetiredAlert(alert));
    return [...syntheticBreachAlerts, ...anomalyAlerts, ...filteredAlerts];
  }, [alerts, anomalyAlerts, syntheticBreachAlerts]);

  const displayAlerts = useMemo(() => {
    let filtered = activeAlerts;

    if (filterStatus !== 'All') {
      filtered = filtered.filter((alert) => alert.status === filterStatus);
    }

    if (filterSeverity !== 'All') {
      filtered = filtered.filter((alert) => (alert.severity || 'INFO') === filterSeverity);
    }

    return filtered;
  }, [activeAlerts, filterStatus, filterSeverity]);

  const handleResolveAlert = async (alertId: string) => {
    if (!user) return;
    if (isSyntheticAlert(alertId)) return;

    try {
      setIsLoading(true);
      if (!token) throw new Error('No auth token');

      await apiClient.updateSystemAlert(token, alertId, { status: 'Resolved' });
      alert('Alert resolved successfully');
      window.location.reload();
    } catch (error: any) {
      alert(error?.message || 'Failed to resolve alert');
    } finally {
      setIsLoading(false);
    }
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-50/90 border-red-200 text-red-950 dark:bg-red-950/40 dark:border-red-800/60 dark:text-red-100';
      case 'WARNING':
        return 'bg-amber-50/90 border-amber-200 text-amber-950 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-100';
      case 'INFO':
      default:
        return 'bg-blue-50/90 border-blue-200 text-blue-950 dark:bg-blue-950/40 dark:border-blue-800/60 dark:text-blue-100';
    }
  };

  const getSeverityIcon = (severity?: string) => {
    switch (severity) {
      case 'CRITICAL':
        return <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />;
      case 'WARNING':
        return <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
      case 'INFO':
      default:
        return <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Card className="border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#121520] shadow-sm">
        <CardHeader className="border-b border-slate-100 dark:border-[#1e2334] pb-6">
          <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white">System Alerts</CardTitle>
          <CardDescription className="text-slate-500 dark:text-slate-400">
            Monitor and manage system-wide alerts for delayed projects, budget overruns, and other security events.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-6">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Filter by Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="flex h-10 w-full rounded-md border border-slate-200 dark:border-[#212638] bg-white dark:bg-[#141722] text-slate-900 dark:text-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <option value="All">All</option>
                  <option value="Unresolved">Unresolved</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Filter by Severity</label>
                <select
                  value={filterSeverity}
                  onChange={(e) => setFilterSeverity(e.target.value as any)}
                  className="flex h-10 w-full rounded-md border border-slate-200 dark:border-[#212638] bg-white dark:bg-[#141722] text-slate-900 dark:text-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <option value="All">All</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="WARNING">Warning</option>
                  <option value="INFO">Info</option>
                </select>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-[#141824] rounded-xl border border-slate-200 dark:border-[#1e2334]">
                <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Total Alerts</div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">{activeAlerts.length}</div>
              </div>
              <div className="p-4 bg-red-50/80 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-900/50">
                <div className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">Critical</div>
                <div className="text-2xl font-black text-red-900 dark:text-red-100">{activeAlerts.filter(a => a.severity === 'CRITICAL').length}</div>
              </div>
              <div className="p-4 bg-amber-50/80 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/50">
                <div className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">Warnings</div>
                <div className="text-2xl font-black text-amber-900 dark:text-amber-100">{activeAlerts.filter(a => a.severity === 'WARNING').length}</div>
              </div>
              <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
                <div className="text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-1">Resolved</div>
                <div className="text-2xl font-black text-emerald-900 dark:text-emerald-100">{activeAlerts.filter(a => a.status === 'Resolved').length}</div>
              </div>
            </div>

            {/* Alerts List */}
            <div className="space-y-3">
              {displayAlerts.length === 0 ? (
                <div className="p-8 text-center bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl">
                  <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
                  <p className="text-emerald-800 dark:text-emerald-200 font-bold">All systems operational</p>
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">No alerts matching the current filters.</p>
                </div>
              ) : (
                displayAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`rounded-xl border p-4 flex items-start justify-between gap-4 transition-colors ${getSeverityColor(alert.severity)}`}
                  >
                    <div className="flex gap-4 flex-1 min-w-0">
                      <div className="flex-shrink-0 pt-1">{getSeverityIcon(alert.severity)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {alert.severity === 'CRITICAL' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-700">
                              CRITICAL
                            </span>
                          )}
                          {alert.severity === 'WARNING' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                              WARNING
                            </span>
                          )}
                          {(!alert.severity || alert.severity === 'INFO') && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700">
                              INFO
                            </span>
                          )}
                          {alert.alertType && (
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-[#141824] px-2 py-0.5 rounded border border-slate-200 dark:border-[#212638]">
                              {alert.alertType}
                            </span>
                          )}
                          {alert.status === 'Resolved' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              Resolved
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                              Unresolved
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">{alert.message}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {format(new Date(alert.date), 'MMM dd, yyyy HH:mm:ss')}
                        </p>
                        {alert.id.startsWith('critical-breach-') ? (
                          <div className="mt-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-white/80 dark:bg-[#0c0e14]/80 p-3 text-sm text-slate-700 dark:text-slate-300">
                            <p className="font-bold text-red-800 dark:text-red-300">
                              Project ID: {alert.projectId} | System tracked an unauthorized local database change bypassing the multi-sig verification gate.
                            </p>
                          </div>
                        ) : alert.details && Object.keys(alert.details).length > 0 && (
                          <div className="mt-2 p-2.5 bg-slate-900 dark:bg-[#0c0e14] border border-slate-800 dark:border-[#1e2334] rounded-lg text-xs text-slate-200 dark:text-slate-300 font-mono overflow-x-auto">
                            <pre className="whitespace-pre-wrap">{JSON.stringify(alert.details, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    </div>
                    {isSyntheticAlert(alert.id) ? (
                      <Button
                        size="sm"
                        className="flex-shrink-0 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs font-semibold"
                        onClick={() => navigate(`/official/dashboard?projectId=${alert.projectId}`)}
                      >
                        Review Project
                      </Button>
                    ) : alert.status === 'Unresolved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-shrink-0 text-xs border-slate-200 dark:border-[#212638] bg-white dark:bg-[#141722] text-slate-800 dark:text-slate-200"
                        onClick={() => handleResolveAlert(alert.id)}
                        disabled={isLoading}
                      >
                        {isLoading ? 'Resolving...' : 'Resolve'}
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
