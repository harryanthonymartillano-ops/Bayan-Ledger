import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBlockchain } from '../../context/BlockchainContext';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Input } from '../../components/ui/input';
import {
  Map,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Search,
  Camera,
  FileText,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Layers,
} from 'lucide-react';
import { format } from 'date-fns';
import { isMilestoneDelayed } from '../../lib/scheduleStatus';

const ITEMS_PER_PAGE = 10;

type FilterStatus = 'ALL' | 'PENDING' | 'VERIFIED' | 'PAID' | 'DELAYED';

export const MilestoneTracker = () => {
  const { user } = useAuth();
  const { projects } = useBlockchain();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');

  // Flatten milestones for easier display and stats
  const allMilestones = useMemo(() => {
    return projects.flatMap((p) =>
      p.milestones.map((m, index) => ({
        ...m,
        projectId: p.id,
        projectName: p.name,
        allocatedFunds: p.allocatedFunds,
        isDelayed: isMilestoneDelayed(m),
        canVerify:
          p.allocatedFunds > 0 &&
          (index === 0 || p.milestones[index - 1].status === 'Verified' || p.milestones[index - 1].status === 'Paid'),
      }))
    );
  }, [projects]);

  // Executive summary counts
  const summary = useMemo(() => {
    const total = allMilestones.length;
    const verified = allMilestones.filter((m) => m.status === 'Verified' || m.status === 'Paid').length;
    const pending = allMilestones.filter((m) => m.status === 'Pending').length;
    const delayed = allMilestones.filter((m) => m.isDelayed).length;
    return { total, verified, pending, delayed };
  }, [allMilestones]);

  // Filtered milestones based on search and status chip
  const filteredMilestones = useMemo(() => {
    return allMilestones.filter((m) => {
      if (statusFilter === 'PENDING' && m.status !== 'Pending') return false;
      if (statusFilter === 'VERIFIED' && m.status !== 'Verified') return false;
      if (statusFilter === 'PAID' && m.status !== 'Paid') return false;
      if (statusFilter === 'DELAYED' && !m.isDelayed) return false;

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesProject = m.projectName.toLowerCase().includes(query) || m.projectId.toLowerCase().includes(query);
        const matchesTitle = m.title.toLowerCase().includes(query) || (m.description || '').toLowerCase().includes(query);
        return matchesProject || matchesTitle;
      }
      return true;
    });
  }, [allMilestones, statusFilter, searchTerm]);

  const showActionColumn = user?.role === 'MPDC (Planning)';
  const totalPages = Math.max(1, Math.ceil(filteredMilestones.length / ITEMS_PER_PAGE));
  const paginatedMilestones = filteredMilestones.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleStatusSelect = (status: FilterStatus) => {
    setStatusFilter(statusFilter === status ? 'ALL' : status);
    setCurrentPage(1);
  };

  return (
    <div className="max-w-7xl mx-auto pb-8 space-y-6">
      {/* ========================================================== */}
      {/* 1. HEADER */}
      {/* ========================================================== */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200/60 shadow-xs">
              <Map className="h-5 w-5" />
            </div>
            Milestone Manager
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-3xl">
            Track phase execution, physical progress evidence, and MPDC verification sign-offs across all municipal projects.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            to="/official/pipeline"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-xs transition-colors"
          >
            <span>Project Pipeline</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* ========================================================== */}
      {/* 2. EXECUTIVE KPI CARDS */}
      {/* ========================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Milestones */}
        <Card
          onClick={() => handleStatusSelect('ALL')}
          className={`cursor-pointer transition-all border shadow-xs hover:shadow-sm ${
            statusFilter === 'ALL' ? 'ring-2 ring-blue-500 bg-blue-50/40 border-blue-300' : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Milestones</span>
              <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Layers className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">{summary.total}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Across {projects.length} municipal projects</p>
          </CardContent>
        </Card>

        {/* Verified & Paid */}
        <Card
          onClick={() => handleStatusSelect('VERIFIED')}
          className={`cursor-pointer transition-all border shadow-xs hover:shadow-sm ${
            statusFilter === 'VERIFIED' ? 'ring-2 ring-emerald-500 bg-emerald-50/40 border-emerald-300' : 'border-slate-200 bg-white hover:border-emerald-200'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Verified & Completed</span>
              <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-emerald-900">{summary.verified}</div>
            <p className="text-[11px] text-emerald-600 mt-0.5">
              {summary.total > 0 ? `${Math.round((summary.verified / summary.total) * 100)}% completion rate` : '0%'}
            </p>
          </CardContent>
        </Card>

        {/* Pending Verification */}
        <Card
          onClick={() => handleStatusSelect('PENDING')}
          className={`cursor-pointer transition-all border shadow-xs hover:shadow-sm ${
            statusFilter === 'PENDING' ? 'ring-2 ring-amber-500 bg-amber-50/40 border-amber-300' : 'border-slate-200 bg-white hover:border-amber-200'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Pending MPDC Action</span>
              <div className="h-7 w-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-amber-900">{summary.pending}</div>
            <p className="text-[11px] text-amber-600 mt-0.5">Awaiting site verification</p>
          </CardContent>
        </Card>

        {/* Delayed */}
        <Card
          onClick={() => handleStatusSelect('DELAYED')}
          className={`cursor-pointer transition-all border shadow-xs hover:shadow-sm ${
            statusFilter === 'DELAYED' ? 'ring-2 ring-red-500 bg-red-50/40 border-red-300' : 'border-slate-200 bg-white hover:border-red-200'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-red-600">Delayed / Off-Schedule</span>
              <div className="h-7 w-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-red-900">{summary.delayed}</div>
            <p className="text-[11px] text-red-600 mt-0.5">Past target schedule</p>
          </CardContent>
        </Card>
      </div>

      {/* ========================================================== */}
      {/* 3. TABLE CONTROLS & DATA TABLE */}
      {/* ========================================================== */}
      <Card className="border-slate-200 dark:border-[#1e2334] shadow-sm overflow-hidden bg-white dark:bg-[#121520]">
        <CardHeader className="border-b border-slate-100 dark:border-[#1e2334] bg-slate-50/50 dark:bg-[#141824] p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Milestone Registry</CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Physical progress deliverables mapped to cryptographic Smart Contract milestones.
              </CardDescription>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* Search input */}
              <div className="relative min-w-[220px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search project or milestone..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 h-9 text-xs bg-white"
                />
              </div>

              {/* Status pills */}
              <div className="flex items-center gap-1 overflow-x-auto bg-slate-100 p-1 rounded-lg border border-slate-200">
                {(['ALL', 'PENDING', 'VERIFIED', 'PAID', 'DELAYED'] as FilterStatus[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => handleStatusSelect(st)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                      statusFilter === st
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st === 'ALL' ? 'All' : st.charAt(0) + st.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="border-b border-slate-200">
                <TableHead className="text-xs font-bold text-slate-600 py-3">Project</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 py-3">Milestone Deliverable</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 py-3">Budget Share</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 py-3">Evidence Submissions</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 py-3">Target Schedule</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 py-3">Status</TableHead>
                {showActionColumn && <TableHead className="text-right text-xs font-bold text-slate-600 py-3">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedMilestones.map((m) => (
                <TableRow key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-[#181c2b] transition-colors border-b border-slate-100 dark:border-[#1e2334]">
                  {/* Project */}
                  <TableCell className="py-3">
                    <div className="font-semibold text-slate-900 text-sm">{m.projectName}</div>
                    <div className="font-mono text-[11px] text-slate-400 mt-0.5">{m.projectId}</div>
                  </TableCell>

                  {/* Milestone Deliverable */}
                  <TableCell className="py-3">
                    <div className="font-medium text-slate-900 text-sm">{m.title}</div>
                    <div className="text-xs text-slate-500 truncate max-w-[240px] mt-0.5">{m.description}</div>
                  </TableCell>

                  {/* Budget Share */}
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            m.status === 'Paid' ? 'bg-emerald-500' : m.status === 'Verified' ? 'bg-purple-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${Math.min(100, m.percentage || 0)}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-700">{m.percentage}%</span>
                    </div>
                  </TableCell>

                  {/* Evidence */}
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium text-slate-700">
                        <Camera className="w-3 h-3 text-slate-500" />
                        {m.photos?.length || 0}
                      </span>
                      <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium text-slate-700">
                        <FileText className="w-3 h-3 text-slate-500" />
                        {m.evidenceReportCount || 0}
                      </span>
                    </div>
                  </TableCell>

                  {/* Schedule Dates */}
                  <TableCell className="py-3">
                    <div className="text-xs text-slate-600 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{m.dueDate ? format(new Date(m.dueDate), 'MMM d, yyyy') : 'Open'}</span>
                    </div>
                    {m.dateVerified && (
                      <div className="text-[11px] text-emerald-600 mt-0.5 font-medium">
                        Verified: {format(new Date(m.dateVerified), 'MMM d, yyyy')}
                      </div>
                    )}
                  </TableCell>

                  {/* Status Badges */}
                  <TableCell className="py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {m.isDelayed && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Delayed
                        </Badge>
                      )}
                      {m.status === 'Paid' ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold">
                          <CheckCircle className="w-3 h-3 mr-1 text-emerald-600" /> Paid
                        </Badge>
                      ) : m.status === 'Verified' ? (
                        <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] font-semibold">
                          <ShieldCheck className="w-3 h-3 mr-1 text-purple-600" /> Verified
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-slate-100 text-slate-700 text-[10px] font-medium">
                          <Clock className="w-3 h-3 mr-1 text-slate-500" /> Pending
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  {/* Action */}
                  {showActionColumn && (
                    <TableCell className="text-right py-3">
                      {m.status !== 'Pending' ? (
                        <span className="text-xs text-slate-400 font-medium">Completed</span>
                      ) : m.allocatedFunds <= 0 ? (
                        <span className="text-xs text-amber-700 font-medium">Awaiting SARO</span>
                      ) : !m.canVerify ? (
                        <span className="text-xs text-slate-400">Prior phase pending</span>
                      ) : (
                        <Link
                          to={`/official/dashboard?projectId=${m.projectId}`}
                          className="inline-flex h-8 items-center justify-center rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        >
                          Verify Phase
                        </Link>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}

              {filteredMilestones.length === 0 && (
                <TableRow>
                  <TableCell colSpan={showActionColumn ? 7 : 6} className="h-36 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Layers className="h-6 w-6 text-slate-300" />
                      <p className="text-sm font-medium text-slate-600">No milestones match your search or filter.</p>
                      <button
                        onClick={() => {
                          setSearchTerm('');
                          setStatusFilter('ALL');
                        }}
                        className="text-xs text-blue-600 hover:underline font-semibold"
                      >
                        Reset filters
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {filteredMilestones.length > ITEMS_PER_PAGE && (
            <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200 bg-white px-5 py-3.5 sm:flex-row">
              <div className="text-xs font-medium text-slate-600">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredMilestones.length)} of {filteredMilestones.length} milestones
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`h-8 min-w-8 rounded-md px-2 text-xs font-bold transition-colors ${
                      currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
