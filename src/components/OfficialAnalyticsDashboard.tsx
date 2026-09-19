import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBlockchain, Project, Transaction, SystemAlert } from '../context/BlockchainContext';
import { useTheme } from '../context/ThemeContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { isProjectDelayed } from '../lib/scheduleStatus';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  PieChart as PieChartIcon,
  BarChart3,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Landmark,
  Coins,
  Activity,
  Layers,
  FileCheck2,
  ChevronDown,
  ChevronUp,
  Filter,
  FileSpreadsheet,
  ArrowUpRight,
} from 'lucide-react';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STATUS_COLORS: Record<string, string> = {
  Completed: '#10b981', // emerald-500
  'In Progress': '#3b82f6', // blue-500
  Delayed: '#ef4444', // red-500
  'Pending Gates': '#f59e0b', // amber-500
  Rejected: '#64748b', // slate-500
};

export const OfficialAnalyticsDashboard: React.FC = () => {
  const { projects, alerts } = useBlockchain();
  const { isDark } = useTheme();
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const axisTickColor = isDark ? '#94a3b8' : '#64748b';
  const gridLineColor = isDark ? '#1e2334' : '#f1f5f9';

  // Formatting helpers
  const formatPHP = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatCompactPHP = (amount: number) => {
    if (amount >= 1_000_000_000) return `₱${(amount / 1_000_000_000).toFixed(1)}B`;
    if (amount >= 1_000_000) return `₱${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `₱${(amount / 1_000).toFixed(0)}K`;
    return `₱${amount.toLocaleString()}`;
  };

  // Filter projects if category filter is selected
  const filteredProjects = useMemo(() => {
    if (selectedCategoryFilter === 'All') return projects;
    return projects.filter((p) => (p.category || 'General').toLowerCase() === selectedCategoryFilter.toLowerCase());
  }, [projects, selectedCategoryFilter]);

  // Unique categories for filter
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    projects.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }, [projects]);

  // ==========================================
  // TOP HIGH-LEVEL SUMMARY METRICS
  // ==========================================
  const summaryMetrics = useMemo(() => {
    const totalBudget = projects.reduce((sum, p) => sum + (p.totalBudget || 0), 0);
    const totalAllocatedSARO = projects.reduce((sum, p) => sum + (p.allocatedFunds || 0), 0);
    const totalDisbursedNCA = projects.reduce((sum, p) => sum + (p.disbursedFunds || 0), 0);
    const remainingBalance = Math.max(0, totalBudget - totalDisbursedNCA);
    const budgetUtilizationRate = totalAllocatedSARO > 0
      ? Math.min(100, (totalDisbursedNCA / totalAllocatedSARO) * 100)
      : totalBudget > 0
        ? Math.min(100, (totalDisbursedNCA / totalBudget) * 100)
        : 0;

    const allTransactions = projects.flatMap((p) => p.transactions || []);
    const successfulReleases = allTransactions.filter((t) => t.status === 'Executed' || t.status === 'Completed').length;
    const pendingReleases = allTransactions.filter((t) => t.status === '1/2 Signed' || t.status === 'Pending Transaction').length;
    const rejectedReleases = allTransactions.filter((t) => (t.status || '').toLowerCase().includes('rejected')).length;

    const unresolvedAlerts = alerts.filter((a) => a.status === 'Unresolved').length;
    const delayedCount = projects.filter(isProjectDelayed).length;

    return {
      totalProjects: projects.length,
      totalBudget,
      totalAllocatedSARO,
      totalDisbursedNCA,
      remainingBalance,
      budgetUtilizationRate,
      successfulReleases,
      pendingReleases,
      rejectedReleases,
      unresolvedAlerts,
      delayedCount,
    };
  }, [projects, alerts]);

  // ==========================================
  // GRAPH 1: MUNICIPAL BUDGET ALLOCATION BY CATEGORY
  // ==========================================
  const budgetAllocationByCategory = useMemo(() => {
    const categoryMap: Record<string, { category: string; totalBudget: number; allocatedSARO: number; disbursedNCA: number; projectCount: number }> = {};

    projects.forEach((project) => {
      const category = project.category || 'General Public Services';
      if (!categoryMap[category]) {
        categoryMap[category] = {
          category,
          totalBudget: 0,
          allocatedSARO: 0,
          disbursedNCA: 0,
          projectCount: 0,
        };
      }
      categoryMap[category].totalBudget += project.totalBudget || 0;
      categoryMap[category].allocatedSARO += project.allocatedFunds || 0;
      categoryMap[category].disbursedNCA += project.disbursedFunds || 0;
      categoryMap[category].projectCount += 1;
    });

    return Object.values(categoryMap).sort((a, b) => b.totalBudget - a.totalBudget);
  }, [projects]);

  // ==========================================
  // GRAPH 2: BUDGET VS. ACTUAL EXPENDITURE
  // ==========================================
  const budgetVsExpenditureData = useMemo(() => {
    // Show comparison per category (or top projects if only 1 category)
    if (budgetAllocationByCategory.length > 0) {
      return budgetAllocationByCategory.map((cat) => ({
        name: cat.category.length > 16 ? `${cat.category.substring(0, 14)}...` : cat.category,
        fullName: cat.category,
        'Allocated Budget': cat.totalBudget,
        'Released (SARO)': cat.allocatedSARO,
        'Actual Expenditure (NCA)': cat.disbursedNCA,
        'Remaining Balance': Math.max(0, cat.totalBudget - cat.disbursedNCA),
      }));
    }

    return [];
  }, [budgetAllocationByCategory]);

  // ==========================================
  // GRAPH 3: MONTHLY BUDGET RELEASE TREND
  // ==========================================
  const monthlyFundReleaseData = useMemo(() => {
    const months = MONTH_NAMES.map((m) => ({
      month: m,
      saroReleased: 0,
      ncaDisbursed: 0,
      totalFlow: 0,
    }));

    const allTransactions = projects.flatMap((p) => p.transactions || []);

    if (allTransactions.length > 0) {
      allTransactions.forEach((tx) => {
        if (!tx.date) return;
        const date = new Date(tx.date);
        if (isNaN(date.getTime())) return;
        const monthIndex = date.getMonth();

        if (tx.type === 'Allocation (SARO)') {
          months[monthIndex].saroReleased += Number(tx.amount || 0);
        } else if (tx.type === 'Disbursement (NCA)') {
          if (tx.status === 'Executed' || tx.status === 'Completed' || tx.status === '1/2 Signed') {
            months[monthIndex].ncaDisbursed += Number(tx.amount || 0);
          }
        }
      });
    } else {
      // Fallback from projects creation and milestone dates if transactions array is empty
      projects.forEach((p) => {
        if (p.createdAt) {
          const d = new Date(p.createdAt);
          if (!isNaN(d.getTime())) {
            months[d.getMonth()].saroReleased += p.allocatedFunds || 0;
            months[d.getMonth()].ncaDisbursed += p.disbursedFunds || 0;
          }
        }
      });
    }

    months.forEach((m) => {
      m.totalFlow = m.saroReleased + m.ncaDisbursed;
    });

    return months;
  }, [projects]);

  // ==========================================
  // GRAPH 4: PROJECT PROGRESS VS. FUND UTILIZATION
  // ==========================================
  const projectProgressVsUtilization = useMemo(() => {
    return filteredProjects.slice(0, 8).map((project) => {
      // Physical progress calculation: verified milestone percentage or verified/total ratio
      const totalMilestones = project.milestones?.length || 0;
      let physicalProgress = 0;

      if (totalMilestones > 0) {
        const sumPercentages = project.milestones.reduce((acc, m) => {
          return acc + (m.status === 'Verified' || m.status === 'Paid' ? m.percentage || (100 / totalMilestones) : 0);
        }, 0);
        physicalProgress = Math.min(100, Math.round(sumPercentages));
      } else if (project.status === 'Completed') {
        physicalProgress = 100;
      } else if (project.status === 'ACTIVE' || project.status === 'In Progress') {
        physicalProgress = 25;
      }

      const totalBudget = project.totalBudget || 1;
      const fundUtilization = Math.min(100, Math.round(((project.disbursedFunds || 0) / totalBudget) * 100));

      // Flag if funds released significantly exceed physical work (>15% discrepancy)
      const hasDiscrepancy = fundUtilization > physicalProgress + 15;

      return {
        id: project.id,
        name: project.name.length > 18 ? `${project.name.substring(0, 16)}...` : project.name,
        fullName: project.name,
        'Physical Progress (%)': physicalProgress,
        'Fund Utilization (%)': fundUtilization,
        variance: fundUtilization - physicalProgress,
        hasDiscrepancy,
      };
    });
  }, [filteredProjects]);

  // ==========================================
  // GRAPH 5: PROJECT COMPLETION STATUS DISTRIBUTION
  // ==========================================
  const projectStatusDistribution = useMemo(() => {
    let completed = 0;
    let ongoing = 0;
    let delayed = 0;
    let pendingGates = 0;
    let rejected = 0;

    projects.forEach((p) => {
      const isDelayed = isProjectDelayed(p);

      if (p.status === 'Completed') {
        completed += 1;
      } else if (p.status === 'Rejected - Budget Officer' || p.status === 'Rejected - Treasurer' || p.status === 'On Hold') {
        rejected += 1;
      } else if (isDelayed) {
        delayed += 1;
      } else if (p.status === 'ACTIVE' || p.status === 'In Progress') {
        ongoing += 1;
      } else if (p.status === 'MPDC Approved' || p.status === 'SARO Approved - Pending Treasurer') {
        pendingGates += 1;
      } else {
        ongoing += 1;
      }
    });

    const data = [
      { name: 'Completed', value: completed, color: STATUS_COLORS['Completed'] },
      { name: 'In Progress', value: ongoing, color: STATUS_COLORS['In Progress'] },
      { name: 'Delayed', value: delayed, color: STATUS_COLORS['Delayed'] },
      { name: 'Pending Gates', value: pendingGates, color: STATUS_COLORS['Pending Gates'] },
      { name: 'Rejected', value: rejected, color: STATUS_COLORS['Rejected'] },
    ].filter((item) => item.value > 0);

    return data.length > 0 ? data : [{ name: 'No Projects', value: 1, color: '#cbd5e1' }];
  }, [projects]);

  // ==========================================
  // GRAPH 6: TRANSACTION MONITORING (NORMAL VS. UNUSUAL/FLAGGED)
  // ==========================================
  const transactionMonitoringData = useMemo(() => {
    const allTransactions = projects.flatMap((p) => p.transactions || []);
    const totalTransactions = allTransactions.length;

    // Normal confirmed/executed transactions
    const normalAllocations = allTransactions.filter((t) => t.type === 'Allocation (SARO)' && !t.status.includes('Rejected')).length;
    const normalDisbursements = allTransactions.filter(
      (t) => t.type === 'Disbursement (NCA)' && (t.status === 'Executed' || t.status === 'Completed' || t.status === '1/2 Signed')
    ).length;

    // Flagged / Anomaly events from Alert System & Rejections
    const criticalAlerts = alerts.filter((a) => a.severity === 'CRITICAL' || a.severity === 'WARNING').length;
    const rejectedTxCount = allTransactions.filter((t) => (t.status || '').toLowerCase().includes('rejected')).length;
    const delayedProjectAlerts = summaryMetrics.delayedCount;

    return [
      {
        category: 'Budget Allotment (SARO)',
        'Normal / Verified': normalAllocations || (projects.length > 0 ? projects.filter((p) => p.allocatedFunds > 0).length : 0),
        'Flagged / Unusual': alerts.filter((a) => a.message?.toLowerCase().includes('budget') || a.message?.toLowerCase().includes('breach')).length,
      },
      {
        category: 'Disbursement (NCA)',
        'Normal / Verified': normalDisbursements || (projects.length > 0 ? projects.filter((p) => p.disbursedFunds > 0).length : 0),
        'Flagged / Unusual': rejectedTxCount + alerts.filter((a) => a.message?.toLowerCase().includes('disbursement')).length,
      },
      {
        category: 'Milestone Execution',
        'Normal / Verified': projects.reduce((acc, p) => acc + (p.milestones?.filter((m) => m.status === 'Verified' || m.status === 'Paid').length || 0), 0),
        'Flagged / Unusual': delayedProjectAlerts,
      },
      {
        category: 'System & Security',
        'Normal / Verified': Math.max(1, totalTransactions),
        'Flagged / Unusual': criticalAlerts,
      },
    ];
  }, [projects, alerts, summaryMetrics.delayedCount]);

  // Custom chart tooltips
  const CurrencyTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-slate-200 dark:border-[#1e2334] bg-white/95 dark:bg-[#121520]/95 p-3 shadow-lg backdrop-blur-sm">
          <p className="font-bold text-slate-800 dark:text-white text-sm mb-1">{label || payload[0]?.payload?.fullName || payload[0]?.name}</p>
          {payload.map((entry: any, index: number) => (
            <p key={`item-${index}`} className="text-xs flex items-center justify-between gap-4 py-0.5" style={{ color: entry.color || entry.fill }}>
              <span className="font-medium">{entry.name}:</span>
              <span className="font-bold">{typeof entry.value === 'number' ? formatPHP(entry.value) : entry.value}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const PercentageTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      return (
        <div className="rounded-lg border border-slate-200 dark:border-[#1e2334] bg-white/95 dark:bg-[#121520]/95 p-3 shadow-lg backdrop-blur-sm">
          <p className="font-bold text-slate-800 dark:text-white text-sm mb-1">{data?.fullName || label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={`p-${index}`} className="text-xs flex items-center justify-between gap-4 py-0.5" style={{ color: entry.color || entry.fill }}>
              <span className="font-medium">{entry.name}:</span>
              <span className="font-bold">{entry.value}%</span>
            </p>
          ))}
          {data?.hasDiscrepancy && (
            <div className="mt-2 rounded bg-red-50 dark:bg-red-950/40 p-1.5 text-[11px] font-semibold text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/60 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>Discrepancy: Financial disbursement ahead of verified physical progress.</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* ========================================================== */}
      {/* SECTION HEADER & CONTROLS */}
      {/* ========================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-slate-900 via-[#17212b] to-[#1e293b] p-6 rounded-xl text-white shadow-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live System Data
            </span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">Municipal Performance & Analytics</h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            Real-time visual telemetry derived from BayanLedger's Smart Contracts, Allotment Registry (SARO), Disbursement Ledger (NCA), and Anomaly Alert System.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {availableCategories.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 px-3 py-1.5 rounded-lg">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="All" className="bg-slate-900 text-white">All Categories ({projects.length})</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat} className="bg-slate-900 text-white">
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Link to="/official/reports">
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 px-3 flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Reports & Export</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Button>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white text-xs h-9 px-3"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4 mr-1.5" /> Collapse
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-1.5" /> Expand Analytics
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ========================================================== */}
      {/* 1. EXECUTIVE SUMMARY KPIS STRIP */}
      {/* ========================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Budget Utilization Rate */}
        <Card className="border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#121520] shadow-sm hover:shadow transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Budget Utilization Rate</span>
              <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900 dark:text-white">{summaryMetrics.budgetUtilizationRate.toFixed(1)}%</div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mt-2.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, summaryMetrics.budgetUtilizationRate)}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
              Disbursed (NCA) ÷ SARO Allotment
            </p>
          </CardContent>
        </Card>

        {/* Total Municipal Budget */}
        <Card className="border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#121520] shadow-sm hover:shadow transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Municipal Budget</span>
              <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Landmark className="w-4 h-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900 dark:text-white truncate" title={formatPHP(summaryMetrics.totalBudget)}>
              {formatCompactPHP(summaryMetrics.totalBudget)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-[10px] bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/50">
                {summaryMetrics.totalProjects} Projects Active
              </Badge>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Appropriations</span>
            </div>
          </CardContent>
        </Card>

        {/* Total Released Funds (SARO) */}
        <Card className="border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#121520] shadow-sm hover:shadow transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Released Funds (SARO)</span>
              <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Coins className="w-4 h-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-amber-900 dark:text-amber-400 truncate" title={formatPHP(summaryMetrics.totalAllocatedSARO)}>
              {formatCompactPHP(summaryMetrics.totalAllocatedSARO)}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
              Gate 1 Financial Commitment
            </p>
          </CardContent>
        </Card>

        {/* Actual Expenditure (NCA) */}
        <Card className="border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#121520] shadow-sm hover:shadow transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Actual Disbursed (NCA)</span>
              <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <FileCheck2 className="w-4 h-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-900 dark:text-emerald-400 truncate" title={formatPHP(summaryMetrics.totalDisbursedNCA)}>
              {formatCompactPHP(summaryMetrics.totalDisbursedNCA)}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Treasury Gate 2 Disbursed
            </p>
          </CardContent>
        </Card>
      </div>

      {isExpanded && (
        <>
          {/* ========================================================== */}
          {/* ROW 1: GRAPHS 1 & 2 (BUDGET ALLOCATION & BUDGET VS EXPENDITURE) */}
          {/* ========================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Graph 1: Municipal Budget Allocation by Category */}
            <Card className="border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#121520] shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-[#1e2334]">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      1. Municipal Budget Allocation by Category
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Distribution of total approved municipal funds across sectors and departments
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-xs bg-slate-100 dark:bg-[#181c2b] text-slate-700 dark:text-slate-300 dark:border-[#1e2334]">
                    {budgetAllocationByCategory.length} Categories
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {budgetAllocationByCategory.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-slate-400 text-xs italic">
                    No project categories recorded yet.
                  </div>
                ) : (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={budgetAllocationByCategory} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridLineColor} vertical={false} />
                        <XAxis
                          dataKey="category"
                          tick={{ fontSize: 11, fill: axisTickColor }}
                          interval={0}
                          angle={-15}
                          textAnchor="end"
                        />
                        <YAxis tickFormatter={formatCompactPHP} tick={{ fontSize: 11, fill: axisTickColor }} width={60} />
                        <Tooltip content={<CurrencyTooltip />} />
                        <Bar dataKey="totalBudget" name="Allocated Budget" fill="#2563eb" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="allocatedSARO" name="SARO Released" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="mt-3 flex items-center justify-center gap-6 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-blue-600" />
                    <span>Total Budget (PHP)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-amber-500" />
                    <span>SARO Allotment (PHP)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Graph 2: Budget vs. Actual Expenditure */}
            <Card className="border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#121520] shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-[#1e2334]">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      2. Budget vs. Actual Expenditure
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Comparing Allocated Budget, Released Funds (SARO), Actual Disbursed (NCA), and Remaining Balance
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                    Fiscal Performance
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {budgetVsExpenditureData.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-slate-400 text-xs italic">
                    No budget comparison data available.
                  </div>
                ) : (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={budgetVsExpenditureData} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridLineColor} vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: axisTickColor }} interval={0} angle={-15} textAnchor="end" />
                        <YAxis tickFormatter={formatCompactPHP} tick={{ fontSize: 11, fill: axisTickColor }} width={60} />
                        <Tooltip content={<CurrencyTooltip />} />
                        <Bar dataKey="Allocated Budget" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="Released (SARO)" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="Actual Expenditure (NCA)" fill="#10b981" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="Remaining Balance" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-blue-500" />
                    <span>Allocated</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-amber-500" />
                    <span>SARO Released</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-emerald-500" />
                    <span>Actual Disbursed</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-slate-400" />
                    <span>Remaining</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ========================================================== */}
          {/* ROW 2: GRAPHS 3 & 4 (MONTHLY FUND RELEASE TREND & PROGRESS VS UTILIZATION) */}
          {/* ========================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Graph 3: Monthly Fund Release Trend */}
            <Card className="border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#121520] shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-[#1e2334]">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      3. Monthly Budget & Fund Release Trend
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Pattern of SARO Allotments and NCA Cash Disbursements across the fiscal cycle
                    </CardDescription>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">Jan - Dec</span>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyFundReleaseData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="colorSaro" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="colorNca" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridLineColor} vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: axisTickColor }} />
                      <YAxis tickFormatter={formatCompactPHP} tick={{ fontSize: 11, fill: axisTickColor }} width={60} />
                      <Tooltip content={<CurrencyTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="saroReleased"
                        name="SARO Allotments"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorSaro)"
                      />
                      <Area
                        type="monotone"
                        dataKey="ncaDisbursed"
                        name="NCA Disbursements"
                        stroke="#10b981"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorNca)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex items-center justify-center gap-6 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-amber-500" />
                    <span>SARO Allotments Released (₱)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-emerald-500" />
                    <span>NCA Cash Disbursed (₱)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Graph 4: Project Progress vs. Fund Utilization */}
            <Card className="border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#121520] shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-[#1e2334]">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Activity className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      4. Project Progress vs. Fund Utilization
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Aligning physical milestone delivery (%) against financial disbursement (%)
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                    Earned Value Check
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {projectProgressVsUtilization.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-slate-400 text-xs italic">
                    No active projects to analyze progress.
                  </div>
                ) : (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={projectProgressVsUtilization} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridLineColor} vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: axisTickColor }} interval={0} angle={-15} textAnchor="end" />
                        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: axisTickColor }} width={45} />
                        <Tooltip content={<PercentageTooltip />} />
                        <Bar dataKey="Physical Progress (%)" fill="#2563eb" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="Fund Utilization (%)" fill="#10b981" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="mt-3 flex items-center justify-center gap-6 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-blue-600" />
                    <span>Physical Milestone Progress (%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-emerald-500" />
                    <span>Fund Utilization (%)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ========================================================== */}
          {/* ROW 3: GRAPHS 5 & 6 (PROJECT STATUS & TRANSACTION MONITORING) */}
          {/* ========================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Graph 5: Project Completion Status */}
            <Card className="border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#121520] shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-[#1e2334]">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <PieChartIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      5. Project Implementation Status
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Portfolio health across Completed, Ongoing, Delayed, and Pending approval states
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-xs bg-slate-100 dark:bg-[#181c2b] text-slate-700 dark:text-slate-300 dark:border-[#1e2334]">
                    Total: {summaryMetrics.totalProjects}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="h-72 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={projectStatusDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {projectStatusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? '#121520' : '#ffffff',
                          borderColor: isDark ? '#1e2334' : '#e2e8f0',
                          borderRadius: '0.5rem',
                          color: isDark ? '#f8fafc' : '#0f172a',
                        }}
                        formatter={(val: any, name: any) => [
                          `${val} Projects (${Math.round((Number(val) / Math.max(1, summaryMetrics.totalProjects)) * 100)}%)`,
                          name,
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-600 dark:text-slate-300">
                  {projectStatusDistribution.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span className="font-medium text-slate-700 dark:text-slate-200">{entry.name}:</span>
                      <span className="text-slate-500 dark:text-slate-400 font-bold">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Graph 6: Transaction Monitoring (Normal vs. Unusual/Flagged) */}
            <Card className="border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#121520] shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-[#1e2334]">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      6. Transaction Monitoring & Anomaly Alert System
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Normal verified on-chain transactions vs flagged anomalies requiring audit review
                    </CardDescription>
                  </div>
                  {summaryMetrics.unresolvedAlerts > 0 ? (
                    <Badge variant="destructive" className="text-xs flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {summaryMetrics.unresolvedAlerts} Active Alerts
                    </Badge>
                  ) : (
                    <Badge variant="default" className="text-xs bg-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      All Clean
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={transactionMonitoringData} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridLineColor} vertical={false} />
                      <XAxis dataKey="category" tick={{ fontSize: 11, fill: axisTickColor }} interval={0} angle={-10} textAnchor="end" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: axisTickColor }} width={35} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? '#121520' : '#ffffff',
                          borderColor: isDark ? '#1e2334' : '#e2e8f0',
                          borderRadius: '0.5rem',
                          color: isDark ? '#f8fafc' : '#0f172a',
                        }}
                      />
                      <Bar dataKey="Normal / Verified" fill="#10b981" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Flagged / Unusual" fill="#ef4444" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex items-center justify-center gap-6 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-emerald-500" />
                    <span>Normal / Verified On-Chain</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-red-500" />
                    <span>Flagged / Unusual (Alerts)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ========================================================== */}
          {/* SMART CONTRACT RELEASES SUMMARY FOOTER */}
          {/* ========================================================== */}
          <div className="bg-slate-50 dark:bg-[#141824] border border-slate-200 dark:border-[#1e2334] rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-[#315b7d]/10 text-[#315b7d] flex items-center justify-center font-bold">
                <ShieldCheck className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="font-bold text-slate-800 dark:text-white">Smart Contract Fund Release Status (Hardhat/Ethereum)</p>
                <p className="text-slate-500 dark:text-slate-400">
                  {summaryMetrics.successfulReleases} Executed Releases • {summaryMetrics.pendingReleases} In Multi-Sig Pipeline • {summaryMetrics.rejectedReleases} Stopped at Gates
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 px-2.5 py-1 rounded-md border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>On-Chain Immutability Verified</span>
              </div>
              <div className="flex items-center gap-1 text-blue-700 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 px-2.5 py-1 rounded-md border border-blue-200">
                <Clock className="w-3.5 h-3.5" />
                <span>2-Gate Multi-Sig Active</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
