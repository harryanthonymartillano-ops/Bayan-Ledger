import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileSignature,
  FileText,
  Landmark,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useBlockchain } from '../../context/BlockchainContext';
import apiClient from '../../lib/apiClient';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';

type TransparencyStage = {
  phase: string;
  title: string;
  status: 'Completed' | 'Pending' | 'Rejected' | 'Locked' | 'Ready' | 'In Progress';
  statusLabel: string;
  actorRole: string;
  actorWallet?: string | null;
  timestamp?: string | null;
  reference?: string | null;
  amount?: number;
  notes?: string;
};

type TransparencySummary = {
  projectId: string;
  name: string;
  status: string;
  metadataHash?: string | null;
  createdByWallet?: string | null;
  budgetOfficerWallet?: string | null;
  treasurerWallet?: string | null;
  treasurySealHash?: string | null;
  saroRef?: string | null;
  latestDisbursementRef?: string | null;
  totalBudget: number;
  allocatedFunds: number;
  disbursedFunds: number;
  milestoneCount: number;
  verifiedMilestoneCount: number;
  paidMilestoneCount: number;
  transactionCount: number;
  publicDocumentCount: number;
  stages: TransparencyStage[];
};

type TrailLog = {
  id: string;
  timestamp: string;
  action: string;
  actor_name?: string;
  actor_role?: string;
  actor_wallet?: string | null;
  resource_type?: string;
  resource_id?: string;
  details?: Record<string, unknown> | string | null;
  details_text?: string;
  hash?: string;
  tx_hash?: string;
};

type ProjectAuditTrail = {
  project: {
    id: string;
    name: string;
    status: string;
  };
  coverage: {
    projectLogs: number;
    milestoneLogs: number;
    transactionLogs: number;
    documentLogs: number;
    milestonePhotoLogs: number;
    systemAlertLogs: number;
    totalLogs: number;
  };
  logs: TrailLog[];
};

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

const formatCurrency = (amount?: number | null) => {
  if (typeof amount !== 'number' || Number.isNaN(amount)) {
    return 'N/A';
  }
  return peso.format(amount);
};

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Not yet recorded';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, 'MMM d, yyyy HH:mm:ss');
};

const shortenHash = (value?: string | null) => {
  if (!value) return 'Not recorded';
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
};

const formatActionLabel = (action: string) =>
  action
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const getStageBadge = (status: TransparencyStage['status']) => {
  switch (status) {
    case 'Completed':
      return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Completed</Badge>;
    case 'Ready':
    case 'In Progress':
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">{status}</Badge>;
    case 'Pending':
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pending</Badge>;
    case 'Rejected':
      return <Badge variant="destructive">Rejected</Badge>;
    default:
      return <Badge variant="outline">Locked</Badge>;
  }
};

const getLogTone = (action: string) => {
  const normalized = action.toLowerCase();

  if (normalized.includes('reject') || normalized.includes('alert')) {
    return {
      badge: 'bg-red-100 text-red-800',
      icon: AlertTriangle,
      card: 'border-red-200 bg-red-50/40',
    };
  }

  if (normalized.includes('execute') || normalized.includes('activate') || normalized.includes('verify')) {
    return {
      badge: 'bg-emerald-100 text-emerald-800',
      icon: CheckCircle2,
      card: 'border-emerald-200 bg-emerald-50/40',
    };
  }

  if (normalized.includes('create') || normalized.includes('upload') || normalized.includes('sign')) {
    return {
      badge: 'bg-blue-100 text-blue-800',
      icon: FileSignature,
      card: 'border-blue-200 bg-blue-50/40',
    };
  }

  return {
    badge: 'bg-slate-100 text-slate-800',
    icon: Activity,
    card: 'border-slate-200 bg-white',
  };
};

const describeLogDetails = (log: TrailLog) => {
  if (typeof log.details === 'string' && log.details.trim().length > 0) {
    return log.details;
  }

  if (!log.details || typeof log.details !== 'object') {
    return log.details_text || 'Recorded in the immutable audit ledger.';
  }

  const details = log.details as Record<string, unknown>;
  const parts: string[] = [];
  const action = log.action || '';

  // PROJECT ACTIONS
  if (action.includes('PROJECT')) {
    if (typeof details.name === 'string') parts.push(`📋 Project: ${details.name}`);
    if (typeof details.category === 'string') parts.push(`🏷️ Category: ${details.category}`);
    if (typeof details.totalBudget === 'number') parts.push(`💰 Budget: ${formatCurrency(details.totalBudget)}`);
    if (typeof details.location === 'string') parts.push(`📍 Location: ${details.location}`);
    if (typeof details.startDate === 'string') parts.push(`📅 Start: ${details.startDate}`);
    if (typeof details.endDate === 'string') parts.push(`📅 End: ${details.endDate}`);
    if (typeof details.status === 'string') parts.push(`Status: ${details.status}`);
  }

  // TRANSACTION & FUND REQUEST ACTIONS
  if (action.includes('TRANSACTION') || action.includes('SARO') || action.includes('FUND')) {
    if (typeof details.projectId === 'string') parts.push(`📋 Project: ${details.projectId}`);
    if (typeof details.amount === 'number') parts.push(`💵 Amount: ${formatCurrency(details.amount)}`);
    if (typeof details.saro === 'string') parts.push(`🔖 SARO: ${details.saro}`);
    if (typeof details.reason === 'string') parts.push(`📝 Reason: ${details.reason}`);
    if (typeof details.requestId === 'string') parts.push(`ID: ${details.requestId.substring(0, 12)}...`);
    if (typeof details.status === 'string') parts.push(`Status: ${details.status}`);
    if (typeof details.transactionHash === 'string') parts.push(`🔗 Hash: ${shortenHash(details.transactionHash)}`);
    if (typeof details.request_tx_hash === 'string') parts.push(`🔗 Tx Hash: ${shortenHash(details.request_tx_hash)}`);
  }

  // MILESTONE ACTIONS
  if (action.includes('MILESTONE')) {
    if (typeof details.milestoneId === 'string') parts.push(`🎯 Milestone: ${details.milestoneId}`);
    if (typeof details.milestoneName === 'string') parts.push(`📌 Name: ${details.milestoneName}`);
    if (typeof details.description === 'string') parts.push(`📝 Desc: ${details.description.substring(0, 40)}...`);
    if (typeof details.dueDate === 'string') parts.push(`📅 Due: ${details.dueDate}`);
    if (typeof details.completionDate === 'string') parts.push(`✅ Completed: ${details.completionDate}`);
    if (typeof details.photoCount === 'number') parts.push(`📸 Photos: ${details.photoCount}`);
    if (typeof details.photoHash === 'string') parts.push(`📸 Hash: ${shortenHash(details.photoHash)}`);
    if (typeof details.milestoneVerificationHash === 'string') parts.push(`✔️ Verified: ${shortenHash(details.milestoneVerificationHash)}`);
    if (typeof details.status === 'string') parts.push(`Status: ${details.status}`);
  }

  // DOCUMENT ACTIONS
  if (action.includes('DOCUMENT')) {
    if (typeof details.fileName === 'string') parts.push(`📄 File: ${details.fileName}`);
    if (typeof details.documentType === 'string') parts.push(`📋 Type: ${details.documentType}`);
    if (typeof details.fileSize === 'number') parts.push(`📊 Size: ${(details.fileSize / 1024).toFixed(2)} KB`);
    if (typeof details.checksumHash === 'string') parts.push(`🔐 Checksum: ${shortenHash(details.checksumHash)}`);
    if (typeof details.blockchain_tx_hash === 'string') parts.push(`🔗 Recorded: ${shortenHash(details.blockchain_tx_hash)}`);
    if (typeof details.uploadedBy === 'string') parts.push(`👤 By: ${details.uploadedBy}`);
  }

  // APPROVAL & SIGNATURE ACTIONS
  if (action.includes('APPROVAL') || action.includes('APPROVED') || action.includes('SIGN')) {
    if (typeof details.amount === 'number') parts.push(`💵 Amount: ${formatCurrency(details.amount)}`);
    if (typeof details.approverName === 'string') parts.push(`👤 Approver: ${details.approverName}`);
    if (typeof details.approverRole === 'string') parts.push(`🎖️ Role: ${details.approverRole}`);
    if (typeof details.reason === 'string') parts.push(`📝 Reason: ${details.reason}`);
    if (typeof details.treasurySealHash === 'string') parts.push(`🏛️ Seal: ${shortenHash(details.treasurySealHash)}`);
    if (typeof details.budgetSignatureHash === 'string') parts.push(`✍️ Signature: ${shortenHash(details.budgetSignatureHash)}`);
    if (typeof details.status === 'string') parts.push(`Status: ${details.status}`);
  }

  // DISBURSEMENT ACTIONS
  if (action.includes('DISBURSE')) {
    if (typeof details.amount === 'number') parts.push(`💸 Disbursed: ${formatCurrency(details.amount)}`);
    if (typeof details.projectId === 'string') parts.push(`📋 Project: ${details.projectId}`);
    if (typeof details.recipient === 'string') parts.push(`👤 Recipient: ${details.recipient}`);
    if (typeof details.disbursementMethod === 'string') parts.push(`📤 Method: ${details.disbursementMethod}`);
    if (typeof details.referenceNumber === 'string') parts.push(`📌 Ref: ${details.referenceNumber}`);
    if (typeof details.disbursementSealHash === 'string') parts.push(`🔐 Hash: ${shortenHash(details.disbursementSealHash)}`);
  }

  // USER MANAGEMENT ACTIONS
  if (action.includes('USER')) {
    if (typeof details.email === 'string') parts.push(`📧 Email: ${details.email}`);
    if (typeof details.firstName === 'string' || typeof details.lastName === 'string') {
      const name = [details.firstName, details.lastName].filter(Boolean).join(' ');
      parts.push(`👤 Name: ${name}`);
    }
    if (typeof details.role === 'string') parts.push(`🎖️ Role: ${details.role}`);
    if (typeof details.status === 'string') parts.push(`Status: ${details.status}`);
    if (typeof details.reason === 'string') parts.push(`📝 Reason: ${details.reason}`);
  }

  // SYSTEM ALERTS & ANOMALIES
  if (action.includes('ALERT') || action.includes('ANOMALY') || action.includes('DETECTED')) {
    if (typeof details.alertType === 'string') parts.push(`⚠️ Type: ${details.alertType}`);
    if (typeof details.severity === 'string') parts.push(`🚨 Severity: ${details.severity}`);
    if (typeof details.message === 'string') parts.push(`📢 Message: ${details.message.substring(0, 50)}...`);
    if (typeof details.affectedResource === 'string') parts.push(`📋 Resource: ${details.affectedResource}`);
    if (typeof details.recommendedAction === 'string') parts.push(`🔧 Action: ${details.recommendedAction}`);
  }

  // GENERIC FALLBACK
  if (typeof details.projectId === 'string') parts.push(`📋 Project: ${details.projectId}`);
  if (typeof details.amount === 'number' && !action.includes('TRANSACTION') && !action.includes('FUND')) parts.push(`💰 Amount: ${formatCurrency(details.amount)}`);
  if (typeof details.status === 'string' && !parts.some(p => p.includes('Status'))) parts.push(`Status: ${details.status}`);
  if (typeof details.reason === 'string' && !parts.some(p => p.includes('Reason'))) parts.push(`📝 Reason: ${details.reason}`);

  if (parts.length > 0) {
    return parts.join(' | ');
  }

  return log.details_text || 'Recorded in the immutable audit ledger.';
};

export const AuditTrails: React.FC = () => {
  const { token } = useAuth();
  const { projects } = useBlockchain();
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [summary, setSummary] = useState<TransparencySummary | null>(null);
  const [trail, setTrail] = useState<ProjectAuditTrail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) {
      return projects;
    }
    const query = searchQuery.toLowerCase();
    return projects.filter((project) =>
      project.name.toLowerCase().includes(query) ||
      project.location.toLowerCase().includes(query) ||
      project.id.toLowerCase().includes(query)
    );
  }, [projects, searchQuery]);

  const totalPages = Math.ceil(filteredProjects.length / ITEMS_PER_PAGE);
  const paginatedProjects = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProjects.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredProjects, currentPage]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  useEffect(() => {
    if (!selectedProjectId || !token) return;

    let cancelled = false;

    const loadAuditTrail = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [summaryResponse, trailResponse] = await Promise.all([
          apiClient.getProjectTransparencySummary(selectedProjectId) as Promise<{ summary: TransparencySummary }>,
          apiClient.getProjectAuditTrail(token, selectedProjectId) as Promise<{ trail: ProjectAuditTrail }>,
        ]);

        if (cancelled) return;

        setSummary(summaryResponse.summary);
        setTrail(trailResponse.trail);
      } catch (loadError: any) {
        if (!cancelled) {
          setError(loadError?.message || 'Failed to load project audit trail.');
          setSummary(null);
          setTrail(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadAuditTrail();

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId, token]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Digital Audit Trail</h1>
        <p className="mt-2 text-slate-600">
          Real project-linked audit history across MPDC approval, Budget Officer SARO allocation, Treasurer activation,
          milestone verification, and payment execution.
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Select Project</CardTitle>
          <CardDescription>Choose the project whose audit chain you want to inspect.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by project name, location, or ID..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Projects Grid */}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {paginatedProjects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => setSelectedProjectId(project.id)}
                className={`rounded-lg border p-4 text-left transition ${selectedProjectId === project.id
                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-blue-300'
                  }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{project.name}</div>
                    <div className="mt-1 text-sm text-slate-600">{project.location}</div>
                    <div className="mt-2 text-xs text-slate-500">{project.id}</div>
                  </div>
                  <Badge variant={selectedProjectId === project.id ? 'default' : 'outline'}>{project.status}</Badge>
                </div>
              </button>
            ))}
          </div>

          {/* No Results */}
          {filteredProjects.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-slate-600 font-medium">No projects found</p>
              <p className="text-sm text-slate-500 mt-1">Try adjusting your search criteria</p>
            </div>
          )}

          {paginatedProjects.length === 0 && filteredProjects.length > 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-slate-600 font-medium">No projects on this page</p>
              <p className="text-sm text-slate-500 mt-1">Results found: {filteredProjects.length}</p>
            </div>
          )}

          {/* Pagination Controls */}
          {filteredProjects.length > ITEMS_PER_PAGE && (
            <div className="flex flex-col items-center gap-4 pt-4 border-t border-slate-200">
              <div className="text-sm text-slate-600">
                Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredProjects.length)} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredProjects.length)} of {filteredProjects.length} projects
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Previous
                </button>

                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition ${currentPage === page
                          ? 'bg-blue-600 text-white'
                          : 'border border-slate-300 text-slate-700 bg-white hover:bg-slate-50'
                        }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedProject && summary && trail && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Project Status</div>
                <div className="mt-2 text-xl font-bold text-slate-900">{summary.status}</div>
                <div className="mt-2 text-sm text-slate-600">{trail.coverage.totalLogs} immutable audit events</div>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Budget</div>
                <div className="mt-2 text-xl font-bold text-slate-900">{formatCurrency(summary.totalBudget)}</div>
                <div className="mt-2 text-sm text-slate-600">Allocated: {formatCurrency(summary.allocatedFunds)}</div>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Disbursed</div>
                <div className="mt-2 text-xl font-bold text-slate-900">{formatCurrency(summary.disbursedFunds)}</div>
                <div className="mt-2 text-sm text-slate-600">Transactions: {summary.transactionCount}</div>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Milestone Progress</div>
                <div className="mt-2 text-xl font-bold text-slate-900">
                  {summary.paidMilestoneCount}/{summary.milestoneCount}
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  Verified: {summary.verifiedMilestoneCount} | Public docs: {summary.publicDocumentCount}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Gate and Phase Ledger</CardTitle>
              <CardDescription>
                The system now enforces direct MPDC approval, then Gate 1 SARO allocation, then Gate 2 Treasury activation.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              {summary.stages.map((stage) => (
                <div key={`${stage.phase}-${stage.title}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{stage.phase}</div>
                      <div className="mt-1 text-lg font-semibold text-slate-900">{stage.title}</div>
                    </div>
                    {getStageBadge(stage.status)}
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actor</div>
                      <div className="mt-1 text-sm text-slate-800">{stage.actorRole}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recorded At</div>
                      <div className="mt-1 text-sm text-slate-800">{formatDateTime(stage.timestamp)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Wallet / Ref</div>
                      <div className="mt-1 text-sm text-slate-800">
                        {stage.actorWallet ? shortenHash(stage.actorWallet) : 'Not yet recorded'}
                        {stage.reference ? ` | ${shortenHash(stage.reference)}` : ''}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</div>
                      <div className="mt-1 text-sm text-slate-800">{formatCurrency(stage.amount)}</div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">
                    {stage.notes || stage.statusLabel}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Audit Coverage</CardTitle>
              <CardDescription>Logs linked to this project and its dependent records.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              {[
                { label: 'Project', value: trail.coverage.projectLogs, icon: ShieldCheck },
                { label: 'Milestones', value: trail.coverage.milestoneLogs, icon: FileSignature },
                { label: 'Transactions', value: trail.coverage.transactionLogs, icon: Landmark },
                { label: 'Documents', value: trail.coverage.documentLogs, icon: FileText },
                { label: 'Photos', value: trail.coverage.milestonePhotoLogs, icon: Activity },
                { label: 'Alerts', value: trail.coverage.systemAlertLogs, icon: AlertTriangle },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Icon className="h-4 w-4" />
                      <span className="text-xs font-semibold uppercase tracking-wide">{item.label}</span>
                    </div>
                    <div className="mt-2 text-2xl font-bold text-slate-900">{item.value}</div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Chronological Audit Events</CardTitle>
              <CardDescription>
                Every step is shown in order, with actor identity, linked resource, and blockchain reference where available.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {trail.logs.map((log) => {
                const tone = getLogTone(log.action);
                const Icon = tone.icon;

                return (
                  <div key={log.id} className={`rounded-lg border p-4 ${tone.card}`}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={tone.badge}>{formatActionLabel(log.action)}</Badge>
                          <Badge variant="outline">{log.resource_type || 'system'}</Badge>
                          <span className="text-xs text-slate-500">{formatDateTime(log.timestamp)}</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="rounded-full bg-white p-2 shadow-sm">
                            <Icon className="h-4 w-4 text-slate-700" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">
                              {log.actor_name || 'System'} <span className="font-normal text-slate-500">({log.actor_role || 'System'})</span>
                            </div>
                            <div className="mt-1 text-sm text-slate-700">{describeLogDetails(log)}</div>
                          </div>
                        </div>
                      </div>
                      <div className="grid gap-2 text-sm text-slate-600 lg:min-w-[260px]">
                        <div className="flex items-center gap-2">
                          <Wallet className="h-4 w-4" />
                          <span>{shortenHash(log.actor_wallet)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span>{log.resource_id || 'No linked resource id'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock3 className="h-4 w-4" />
                          <span>{shortenHash(log.hash || log.tx_hash)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {trail.logs.length === 0 && !isLoading && (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500">
                  No audit entries are linked to this project yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Blockchain Anchors</CardTitle>
              <CardDescription>Key references auditors can verify against on-chain records and treasury documents.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Metadata Hash', value: summary.metadataHash, icon: FileSignature },
                { label: 'MPDC Wallet', value: summary.createdByWallet, icon: ShieldCheck },
                { label: 'SARO Reference', value: summary.saroRef, icon: Landmark },
                { label: 'Treasury Seal', value: summary.treasurySealHash, icon: Wallet },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Icon className="h-4 w-4" />
                      <span className="text-xs font-semibold uppercase tracking-wide">{item.label}</span>
                    </div>
                    <div className="mt-3 break-all font-mono text-sm text-slate-900">{item.value || 'Not yet recorded'}</div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}

      {!selectedProject && (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-10 text-center text-slate-500">No projects are available for audit review yet.</CardContent>
        </Card>
      )}

      {isLoading && (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-10 text-center text-slate-500">Loading project audit trail...</CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50 shadow-sm">
          <CardContent className="p-6 text-sm text-red-700">{error}</CardContent>
        </Card>
      )}
    </div>
  );
};
