import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBlockchain } from '../../context/BlockchainContext';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Input } from '../../components/ui/input';
import {
  FileText,
  CheckCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Search,
  Copy,
  Check,
  ArrowRight,
  Landmark,
  PieChart,
  Coins,
  ShieldCheck,
} from 'lucide-react';

const ITEMS_PER_PAGE = 10;

type FilterStatus = 'ALL' | 'FULLY_ALLOCATED' | 'PARTIALLY_ALLOCATED' | 'PENDING';

export const SARORegistry = () => {
  const { user } = useAuth();
  const { projects } = useBlockchain();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
  const [copiedSaro, setCopiedSaro] = useState<string | null>(null);

  const formatPHP = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSaro(text);
    setTimeout(() => setCopiedSaro(null), 2000);
  };

  // Financial summary metrics
  const summary = useMemo(() => {
    const totalBudget = projects.reduce((sum, p) => sum + (p.totalBudget || 0), 0);
    const totalAllocated = projects.reduce((sum, p) => sum + (p.allocatedFunds || 0), 0);
    const pendingAllotment = Math.max(0, totalBudget - totalAllocated);
    const allocationRate = totalBudget > 0 ? Math.round((totalAllocated / totalBudget) * 100) : 0;
    const saroCount = projects.filter((p) => Boolean(p.saro)).length;

    return {
      totalBudget,
      totalAllocated,
      pendingAllotment,
      allocationRate,
      saroCount,
    };
  }, [projects]);

  // Filtered projects by search and status
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const isFullyAllocated = p.allocatedFunds >= p.totalBudget && p.totalBudget > 0;
      const isPartiallyAllocated = p.allocatedFunds > 0 && p.allocatedFunds < p.totalBudget;
      const isPending = p.allocatedFunds === 0;

      if (statusFilter === 'FULLY_ALLOCATED' && !isFullyAllocated) return false;
      if (statusFilter === 'PARTIALLY_ALLOCATED' && !isPartiallyAllocated) return false;
      if (statusFilter === 'PENDING' && !isPending) return false;

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesId = p.id.toLowerCase().includes(query);
        const matchesName = p.name.toLowerCase().includes(query);
        const matchesSaro = (p.saro || '').toLowerCase().includes(query);
        const matchesCategory = (p.category || '').toLowerCase().includes(query);
        return matchesId || matchesName || matchesSaro || matchesCategory;
      }

      return true;
    });
  }, [projects, statusFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / ITEMS_PER_PAGE));
  const paginatedProjects = filteredProjects.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleStatusSelect = (status: FilterStatus) => {
    setStatusFilter(statusFilter === status ? 'ALL' : status);
    setCurrentPage(1);
  };

  const isBudgetOfficer = user?.role === 'Budget Officer';

  return (
    <div className="max-w-7xl mx-auto pb-8 space-y-6">
      {/* ========================================================== */}
      {/* 1. HEADER */}
      {/* ========================================================== */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/60 shadow-xs">
              <FileText className="h-5 w-5" />
            </div>
            Allotment Registry (SARO)
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-3xl">
            Special Allotment Release Order (SARO) tracking, statutory budget commitments, and Gate 1 municipal fund allocation.
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
      {/* 2. FINANCIAL KPI METRICS STRIP */}
      {/* ========================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Appropriations */}
        <Card
          onClick={() => handleStatusSelect('ALL')}
          className={`cursor-pointer transition-all border shadow-xs hover:shadow-sm ${
            statusFilter === 'ALL'
              ? 'ring-2 ring-amber-500 bg-amber-50/40 border-amber-300 dark:bg-amber-950/40 dark:border-amber-500'
              : 'border-slate-200 bg-white hover:border-slate-300 dark:border-[#1e2334] dark:bg-[#121520] dark:hover:border-slate-700'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Approved Appropriations</span>
              <div className="h-7 w-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Landmark className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{formatPHP(summary.totalBudget)}</div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Across {projects.length} municipal projects</p>
          </CardContent>
        </Card>

        {/* Total Allocated SARO */}
        <Card
          onClick={() => handleStatusSelect('FULLY_ALLOCATED')}
          className={`cursor-pointer transition-all border shadow-xs hover:shadow-sm ${
            statusFilter === 'FULLY_ALLOCATED'
              ? 'ring-2 ring-amber-500 bg-amber-50/40 border-amber-300 dark:bg-amber-950/40 dark:border-amber-500'
              : 'border-slate-200 bg-white hover:border-amber-200 dark:border-[#1e2334] dark:bg-[#121520] dark:hover:border-slate-700'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Committed (SARO)</span>
              <div className="h-7 w-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Coins className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-amber-900 dark:text-amber-100">{formatPHP(summary.totalAllocated)}</div>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">{summary.saroCount} active SARO issuances</p>
          </CardContent>
        </Card>

        {/* Pending Allotment */}
        <Card
          onClick={() => handleStatusSelect('PENDING')}
          className={`cursor-pointer transition-all border shadow-xs hover:shadow-sm ${
            statusFilter === 'PENDING'
              ? 'ring-2 ring-slate-500 bg-slate-50/60 border-slate-300 dark:bg-slate-900/60 dark:border-slate-600'
              : 'border-slate-200 bg-white hover:border-slate-300 dark:border-[#1e2334] dark:bg-[#121520] dark:hover:border-slate-700'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Unallocated Balance</span>
              <div className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-slate-700 dark:text-slate-200">{formatPHP(summary.pendingAllotment)}</div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Awaiting SARO commitment</p>
          </CardContent>
        </Card>

        {/* Allocation Rate */}
        <Card className="border border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#121520] shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">SARO Commitment Rate</span>
              <div className="h-7 w-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <PieChart className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-emerald-900 dark:text-emerald-100">{summary.allocationRate}%</div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${summary.allocationRate}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ========================================================== */}
      {/* 3. TABLE CONTROLS & SARO LEDGER TABLE */}
      {/* ========================================================== */}
      <Card className="border-slate-200 dark:border-[#1e2334] shadow-sm overflow-hidden bg-white dark:bg-[#121520]">
        <CardHeader className="border-b border-slate-100 dark:border-[#1e2334] bg-slate-50/50 dark:bg-[#141824] p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Allotment Register</CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Official SARO registration records with locked blockchain funds.
              </CardDescription>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* Search input */}
              <div className="relative min-w-[220px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search project or SARO #..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 h-9 text-xs bg-white dark:bg-[#121520] dark:border-[#212638] dark:text-white"
                />
              </div>

              {/* Status filter chips */}
              <div className="flex items-center gap-1 overflow-x-auto bg-slate-100 dark:bg-[#161a26] p-1 rounded-lg border border-slate-200 dark:border-[#212638]">
                {(['ALL', 'FULLY_ALLOCATED', 'PARTIALLY_ALLOCATED', 'PENDING'] as FilterStatus[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => handleStatusSelect(st)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                      statusFilter === st
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-white dark:text-slate-950 font-bold'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    {st === 'ALL'
                      ? 'All'
                      : st === 'FULLY_ALLOCATED'
                      ? 'Fully Allocated'
                      : st === 'PARTIALLY_ALLOCATED'
                      ? 'Partially'
                      : 'Pending'}
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
                <TableHead className="text-xs font-bold text-slate-600 py-3">Project & ID</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 py-3">Approved Budget</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 py-3">SARO Allocation</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 py-3">SARO Reference Number</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 py-3">Funding Progress</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 py-3">Status</TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-600 py-3">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedProjects.map((p) => {
                const percent = p.totalBudget > 0 ? Math.min(100, Math.round((p.allocatedFunds / p.totalBudget) * 100)) : 0;
                const isFullyAllocated = p.allocatedFunds >= p.totalBudget && p.totalBudget > 0;
                const isPartiallyAllocated = p.allocatedFunds > 0 && p.allocatedFunds < p.totalBudget;

                return (
                  <TableRow key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-[#181c2b] transition-colors border-b border-slate-100 dark:border-[#1e2334]">
                    {/* Project & ID */}
                    <TableCell className="py-3">
                      <div className="font-semibold text-slate-900 text-sm">{p.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[11px] text-slate-400">{p.id}</span>
                        {p.category && (
                          <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                            {p.category}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Total Budget */}
                    <TableCell className="py-3">
                      <div className="font-semibold text-slate-900 text-sm">{formatPHP(p.totalBudget)}</div>
                      <div className="text-[11px] text-slate-400">Appropriations</div>
                    </TableCell>

                    {/* Allocated Funds */}
                    <TableCell className="py-3">
                      <div className="font-bold text-amber-700 text-sm">{formatPHP(p.allocatedFunds)}</div>
                      <div className="text-[11px] text-slate-400">Committed</div>
                    </TableCell>

                    {/* SARO Number */}
                    <TableCell className="py-3">
                      {p.saro ? (
                        <div className="inline-flex items-center gap-1.5 font-mono text-xs bg-amber-50 text-amber-900 px-2.5 py-1 rounded-md border border-amber-200">
                          <span>{p.saro}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(p.saro)}
                            title="Copy SARO number"
                            className="text-amber-600 hover:text-amber-800 transition-colors"
                          >
                            {copiedSaro === p.saro ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Not Issued</span>
                      )}
                    </TableCell>

                    {/* Funding Progress Bar */}
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isFullyAllocated ? 'bg-emerald-500' : isPartiallyAllocated ? 'bg-amber-500' : 'bg-slate-300'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-700">{percent}%</span>
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-3">
                      {isFullyAllocated ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold">
                          <CheckCircle className="w-3 h-3 mr-1 text-emerald-600" /> Fully Allocated
                        </Badge>
                      ) : isPartiallyAllocated ? (
                        <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[10px] font-semibold">
                          <Clock className="w-3 h-3 mr-1 text-amber-600" /> Partially Allocated
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-slate-100 text-slate-700 text-[10px] font-medium">
                          <Clock className="w-3 h-3 mr-1 text-slate-400" /> Pending SARO
                        </Badge>
                      )}
                    </TableCell>

                    {/* Action */}
                    <TableCell className="text-right py-3">
                      <Link
                        to={`/official/dashboard?projectId=${p.id}`}
                        className="inline-flex h-8 items-center justify-center rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500/30"
                      >
                        {isBudgetOfficer && p.allocatedFunds === 0 ? 'Allocate SARO' : 'View Ledger'}
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}

              {filteredProjects.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-36 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <FileText className="h-6 w-6 text-slate-300" />
                      <p className="text-sm font-medium text-slate-600">No allotment records found matching your filters.</p>
                      <button
                        onClick={() => {
                          setSearchTerm('');
                          setStatusFilter('ALL');
                        }}
                        className="text-xs text-amber-700 hover:underline font-semibold"
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
          {filteredProjects.length > ITEMS_PER_PAGE && (
            <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200 bg-white px-5 py-3.5 sm:flex-row">
              <div className="text-xs font-medium text-slate-600">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredProjects.length)} of {filteredProjects.length} projects
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
                        ? 'bg-amber-600 text-white'
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
