import React, { useMemo, useState } from 'react';
import { useBlockchain } from '../../context/BlockchainContext';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Input } from '../../components/ui/input';
import {
  List,
  CheckCircle,
  Clock,
  AlertTriangle,
  Landmark,
  ShieldCheck,
  FileSignature,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from 'lucide-react';
import { isProjectDelayed } from '../../lib/scheduleStatus';
import { Link } from 'react-router-dom';

const ITEMS_PER_PAGE = 10;

type FilterStage = 'ALL' | 'MPDC_APPROVED' | 'PENDING_TREASURER' | 'ACTIVE' | 'DELAYED' | 'COMPLETED' | 'TERMINAL';

export const ProjectPipeline = () => {
  const { projects } = useBlockchain();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<FilterStage>('ALL');

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);

  const pipelineRows = useMemo(() => {
    return projects.map((project) => {
      const verifiedMilestones = project.milestones.filter(
        (milestone) => milestone.status === 'Verified' || milestone.status === 'Paid'
      ).length;
      const paidMilestones = project.milestones.filter((milestone) => milestone.status === 'Paid').length;
      const allocationTransaction = project.transactions.find((transaction) => transaction.type === 'Allocation (SARO)');

      let currentGate = 'Phase 1';
      let nextAction = 'Awaiting MPDC direct creation';
      let gateTone = 'slate';

      if (project.status === 'MPDC Approved') {
        currentGate = 'Gate 1 (SARO)';
        nextAction = 'Budget Officer must create SARO or reject';
        gateTone = 'amber';
      } else if (project.status === 'SARO Approved - Pending Treasurer') {
        currentGate = 'Gate 2 (NCA & Seal)';
        nextAction = 'Treasurer must execute SARO with digital seal';
        gateTone = 'blue';
      } else if (project.status === 'ACTIVE') {
        currentGate = 'Execution';
        nextAction = 'Execution unlocked: milestone evidence may begin';
        gateTone = 'emerald';
      } else if (project.status === 'In Progress') {
        currentGate = 'Execution';
        nextAction = 'Milestones and fund disbursements underway';
        gateTone = 'emerald';
      } else if (project.status === 'Completed') {
        currentGate = 'Completed';
        nextAction = 'Project and disbursement lifecycle completed';
        gateTone = 'emerald';
      } else if (project.status === 'Rejected - Budget Officer' || project.status === 'Rejected - Treasurer') {
        currentGate = 'Terminal';
        nextAction = project.rejectionReason || 'Project was stopped at an approval gate';
        gateTone = 'red';
      }

      const gateBadgeClass =
        gateTone === 'amber'
          ? 'bg-amber-100 text-amber-800 border-amber-300'
          : gateTone === 'blue'
            ? 'bg-blue-100 text-blue-800 border-blue-300'
            : gateTone === 'emerald'
              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
              : gateTone === 'red'
                ? 'bg-red-100 text-red-800 border-red-300'
                : 'bg-slate-100 text-slate-800 border-slate-300';

      return {
        ...project,
        currentGate,
        nextAction,
        gateBadgeClass,
        isDelayed: isProjectDelayed(project),
        verifiedMilestones,
        paidMilestones,
        allocationReference: project.saro || allocationTransaction?.description || 'Pending SARO',
      };
    });
  }, [projects]);

  // Stage counts for summary cards
  const summary = useMemo(
    () => ({
      mpdcApproved: pipelineRows.filter((project) => project.status === 'MPDC Approved').length,
      pendingTreasurer: pipelineRows.filter((project) => project.status === 'SARO Approved - Pending Treasurer').length,
      active: pipelineRows.filter((project) => project.status === 'ACTIVE' || project.status === 'In Progress').length,
      delayed: pipelineRows.filter((project) => project.isDelayed).length,
      completed: pipelineRows.filter((project) => project.status === 'Completed').length,
      rejected: pipelineRows.filter(
        (project) => project.status === 'Rejected - Budget Officer' || project.status === 'Rejected - Treasurer'
      ).length,
    }),
    [pipelineRows]
  );

  // Filtered rows by stage and search
  const filteredRows = useMemo(() => {
    return pipelineRows.filter((project) => {
      // Stage filter
      if (stageFilter === 'MPDC_APPROVED' && project.status !== 'MPDC Approved') return false;
      if (stageFilter === 'PENDING_TREASURER' && project.status !== 'SARO Approved - Pending Treasurer') return false;
      if (stageFilter === 'ACTIVE' && project.status !== 'ACTIVE' && project.status !== 'In Progress') return false;
      if (stageFilter === 'DELAYED' && !project.isDelayed) return false;
      if (stageFilter === 'COMPLETED' && project.status !== 'Completed') return false;
      if (
        stageFilter === 'TERMINAL' &&
        project.status !== 'Rejected - Budget Officer' &&
        project.status !== 'Rejected - Treasurer'
      )
        return false;

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesId = project.id.toLowerCase().includes(query);
        const matchesName = project.name.toLowerCase().includes(query);
        const matchesLocation = (project.location || '').toLowerCase().includes(query);
        const matchesCategory = (project.category || '').toLowerCase().includes(query);
        const matchesRef = (project.allocationReference || '').toLowerCase().includes(query);
        return matchesId || matchesName || matchesLocation || matchesCategory || matchesRef;
      }

      return true;
    });
  }, [pipelineRows, stageFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ITEMS_PER_PAGE));
  const paginatedRows = filteredRows.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleStageSelect = (stage: FilterStage) => {
    setStageFilter(stageFilter === stage ? 'ALL' : stage);
    setCurrentPage(1);
  };

  return (
    <div className="max-w-7xl mx-auto pb-8">
      {/* Header with reduced top space */}
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <List className="h-5 w-5" />
            </div>
            Project Pipeline
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Lifecycle monitoring of municipal projects as they advance through Gate 1 (SARO), Gate 2 (Treasury Seal), and milestone execution.
          </p>
        </div>

        <Link
          to="/official/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors self-start sm:self-auto"
        >
          <span>View Dashboard Analytics</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Stage Summary Cards with Interactive Filter */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* Gate 1 */}
        <Card
          onClick={() => handleStageSelect('MPDC_APPROVED')}
          className={`cursor-pointer transition-all border shadow-sm hover:shadow ${
            stageFilter === 'MPDC_APPROVED'
              ? 'ring-2 ring-amber-500 bg-amber-50/80 border-amber-300'
              : 'border-slate-200 bg-white hover:border-amber-200'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Gate 1: SARO</span>
              <FileSignature className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-amber-900">{summary.mpdcApproved}</div>
            <p className="text-[10px] text-slate-500 mt-0.5">Awaiting Budget Sign</p>
          </CardContent>
        </Card>

        {/* Gate 2 */}
        <Card
          onClick={() => handleStageSelect('PENDING_TREASURER')}
          className={`cursor-pointer transition-all border shadow-sm hover:shadow ${
            stageFilter === 'PENDING_TREASURER'
              ? 'ring-2 ring-blue-500 bg-blue-50/80 border-blue-300'
              : 'border-slate-200 bg-white hover:border-blue-200'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Gate 2: Seal</span>
              <Landmark className="h-4 w-4 text-blue-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-blue-900">{summary.pendingTreasurer}</div>
            <p className="text-[10px] text-slate-500 mt-0.5">Awaiting Treasury</p>
          </CardContent>
        </Card>

        {/* Operational */}
        <Card
          onClick={() => handleStageSelect('ACTIVE')}
          className={`cursor-pointer transition-all border shadow-sm hover:shadow ${
            stageFilter === 'ACTIVE'
              ? 'ring-2 ring-emerald-500 bg-emerald-50/80 border-emerald-300'
              : 'border-slate-200 bg-white hover:border-emerald-200'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">In Execution</span>
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-black text-emerald-900">{summary.active}</div>
            <p className="text-[10px] text-slate-500 mt-0.5">Active & In Progress</p>
          </CardContent>
        </Card>

        {/* Delayed */}
        <Card
          onClick={() => handleStageSelect('DELAYED')}
          className={`cursor-pointer transition-all border shadow-sm hover:shadow ${
            stageFilter === 'DELAYED'
              ? 'ring-2 ring-red-500 bg-red-50/80 border-red-300'
              : 'border-slate-200 bg-white hover:border-red-200'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-red-600">Delayed</span>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-red-900">{summary.delayed}</div>
            <p className="text-[10px] text-red-600 mt-0.5">Past target schedule</p>
          </CardContent>
        </Card>

        {/* Completed */}
        <Card
          onClick={() => handleStageSelect('COMPLETED')}
          className={`cursor-pointer transition-all border shadow-sm hover:shadow ${
            stageFilter === 'COMPLETED'
              ? 'ring-2 ring-emerald-600 bg-emerald-50/80 border-emerald-300'
              : 'border-slate-200 bg-white hover:border-emerald-200'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Completed</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-black text-emerald-900">{summary.completed}</div>
            <p className="text-[10px] text-slate-500 mt-0.5">Finished projects</p>
          </CardContent>
        </Card>

        {/* Terminal / Stopped */}
        <Card
          onClick={() => handleStageSelect('TERMINAL')}
          className={`cursor-pointer transition-all border shadow-sm hover:shadow ${
            stageFilter === 'TERMINAL'
              ? 'ring-2 ring-slate-600 bg-slate-100 border-slate-300'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Terminal</span>
              <XCircle className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-2 text-2xl font-black text-slate-700">{summary.rejected}</div>
            <p className="text-[10px] text-slate-500 mt-0.5">Rejected at gates</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card with Search & Filters */}
      <Card className="border-slate-200 dark:border-[#1e2334] shadow-sm overflow-hidden bg-white dark:bg-[#121520]">
        <div className="border-b border-slate-100 dark:border-[#1e2334] p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-slate-50/50 dark:bg-[#151926]/60">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Pipeline Projects</h2>
            <Badge variant="outline" className="bg-white dark:bg-[#181c2b] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#1e2334] text-xs">
              {filteredRows.length} of {pipelineRows.length} total
            </Badge>
            {stageFilter !== 'ALL' && (
              <button
                onClick={() => setStageFilter('ALL')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline ml-1"
              >
                Clear stage filter
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by ID, name, or location..."
                className="h-9 pl-9 text-xs bg-white dark:bg-[#181c2b] border-slate-200 dark:border-[#1e2334] text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        <div className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-[#151926]">
              <TableRow>
                <TableHead className="w-[280px]">Project & Location</TableHead>
                <TableHead className="w-[200px]">Approval Gate & Next Action</TableHead>
                <TableHead className="w-[230px]">Financial Execution</TableHead>
                <TableHead className="w-[180px]">Milestone Delivery</TableHead>
                <TableHead className="text-right w-[100px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRows.map((project) => {
                const progress = project.totalBudget > 0 ? (project.disbursedFunds / project.totalBudget) * 100 : 0;

                return (
                  <TableRow key={project.id} className="hover:bg-slate-50/80 dark:hover:bg-[#181c2b] transition-colors border-b border-slate-100 dark:border-[#1e2334]">
                    {/* Project & Location */}
                    <TableCell>
                      <div className="font-mono text-[11px] font-semibold text-slate-400">{project.id}</div>
                      <div className="font-bold text-slate-900 text-sm mt-0.5 leading-snug">{project.name}</div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-slate-100 text-slate-700">
                          {project.category}
                        </Badge>
                        <span>•</span>
                        <span className="truncate max-w-[150px]">{project.location}</span>
                      </div>
                    </TableCell>

                    {/* Current Gate & Next Action */}
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className={`text-xs font-semibold ${project.gateBadgeClass}`}>
                          {project.currentGate}
                        </Badge>
                        {project.isDelayed && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                            <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                            Delayed
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1.5 text-xs text-slate-600 leading-relaxed max-w-xs">{project.nextAction}</div>
                    </TableCell>

                    {/* Financial Position */}
                    <TableCell>
                      <div className="text-sm font-bold text-slate-900">{formatCurrency(project.totalBudget)}</div>
                      <div className="mt-0.5 text-[11px] text-slate-500 flex items-center gap-1.5">
                        <span>SARO: {formatCurrency(project.allocatedFunds)}</span>
                        <span>•</span>
                        <span className="text-emerald-700 font-medium">NCA: {formatCurrency(project.disbursedFunds)}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="w-full bg-slate-100 rounded-full h-2 max-w-[140px] overflow-hidden border border-slate-200">
                          <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, progress)}%` }} />
                        </div>
                        <span className="text-[11px] font-bold text-slate-600">{progress.toFixed(0)}%</span>
                      </div>
                    </TableCell>

                    {/* Milestone Readiness */}
                    <TableCell>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Landmark className="h-3.5 w-3.5 text-blue-500" />
                          <span>
                            Verified: <strong>{project.verifiedMilestones}</strong>/{project.milestones.length}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                          <span>
                            Paid: <strong>{project.paidMilestones}</strong>/{project.milestones.length}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate" title={project.allocationReference}>
                          Ref: {project.allocationReference}
                        </div>
                      </div>
                    </TableCell>

                    {/* Action */}
                    <TableCell className="text-right">
                      <Link
                        to={`/official/dashboard?projectId=${project.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-2.5 py-1.5 rounded-md transition-colors"
                      >
                        Details
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}

              {filteredRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <List className="h-6 w-6 text-slate-300 dark:text-slate-600" />
                      <p className="text-sm font-medium">No projects match the selected stage or search criteria.</p>
                      {stageFilter !== 'ALL' && (
                        <button
                          onClick={() => setStageFilter('ALL')}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
                        >
                          View all pipeline projects
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {filteredRows.length > ITEMS_PER_PAGE && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 dark:border-[#1e2334] bg-white dark:bg-[#121520] px-4 py-3 sm:flex-row text-xs">
            <div className="text-slate-500 dark:text-slate-400 font-medium">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredRows.length)} of {filteredRows.length} projects
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#141722] px-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1b1f2e] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`h-8 min-w-8 rounded-md px-2 text-xs font-bold transition-colors ${
                    currentPage === page
                      ? 'bg-blue-600 text-white'
                      : 'border border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#141722] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1b1f2e]'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#141722] px-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1b1f2e] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
