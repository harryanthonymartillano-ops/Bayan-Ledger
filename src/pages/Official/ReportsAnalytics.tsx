import React, { useState, useMemo } from 'react';
import { useBlockchain, Project } from '../../context/BlockchainContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { isProjectDelayed, isMilestoneDelayed } from '../../lib/scheduleStatus';
import { isProjectTampered } from '../../lib/projectIntegrity';
import { readStoredChainBudgets } from '../../lib/chainBudgetCache';
import { readBreachResolutionOverrides } from '../../lib/breachDetection';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  BarChart3,
  FileSpreadsheet,
  FileText,
  Download,
  Filter,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  TrendingUp,
  Landmark,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  MapPin,
  ArrowUpRight,
  X,
  SlidersHorizontal,
  Coins,
  Activity,
  FileCheck2,
  PieChart as PieChartIcon,
  AlertCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
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

type TabView = 'analytics' | 'audit' | 'projects' | 'transactions' | 'milestones';
type DatePreset = 'all' | '30days' | '90days' | 'thisYear' | 'custom';
type BudgetFilter = 'all' | 'under1m' | '1mTo5m' | '5mTo20m' | 'above20m';
type IntegrityFilter = 'all' | 'verified' | 'tampered';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STATUS_COLORS: Record<string, string> = {
  Completed: '#10b981', // emerald-500
  'In Progress': '#3b82f6', // blue-500
  Delayed: '#ef4444', // red-500
  'Pending Gates': '#f59e0b', // amber-500
  'MPDC Approved': '#8b5cf6', // purple-500
  'SARO Approved - Pending Treasurer': '#06b6d4', // cyan-500
  'On Hold': '#64748b', // slate-500
  ACTIVE: '#22c55e', // green-500
  Rejected: '#64748b',
};

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];

export const ReportsAnalytics: React.FC = () => {
  const { projects, alerts } = useBlockchain();
  const { user } = useAuth();
  const { isDark } = useTheme();

  // Active Tab
  const [activeTab, setActiveTab] = useState<TabView>('analytics');

  // Filter States
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [budgetFilter, setBudgetFilter] = useState<BudgetFilter>('all');
  const [integrityFilter, setIntegrityFilter] = useState<IntegrityFilter>('all');
  const [showFiltersDrawer, setShowFiltersDrawer] = useState<boolean>(true);

  // Expanded project rows in Projects table
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  // Export State
  const [isExportingPDF, setIsExportingPDF] = useState<boolean>(false);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const axisTickColor = isDark ? '#94a3b8' : '#64748b';
  const gridLineColor = isDark ? '#1e2334' : '#f1f5f9';

  // Notification toast helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // PDF Currency formatters - standard ASCII characters only (avoids Unicode peso glyph ± rendering issue)
  const formatPdfPHP = (amount: number) => {
    return `PHP ${Math.round(amount || 0).toLocaleString('en-US')}`;
  };

  // Currency formatters
  const formatPHP = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatCompactPHP = (amount: number) => {
    if (amount >= 1_000_000_000) return `₱${(amount / 1_000_000_000).toFixed(1)}B`;
    if (amount >= 1_000_000) return `₱${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `₱${(amount / 1_000).toFixed(0)}K`;
    return `₱${amount.toLocaleString()}`;
  };

  // Calculate project physical progress
  const calculateProgress = (project: Project): number => {
    if (project.status === 'Completed') return 100;
    if (!project.milestones || project.milestones.length === 0) return 0;
    const verifiedWeight = project.milestones
      .filter((m) => m.status === 'Verified' || m.status === 'Paid')
      .reduce((sum, m) => sum + (m.percentage || 0), 0);
    return Math.min(100, Math.round(verifiedWeight));
  };

  // Check if project has active tampering alerts or budget breach on-chain
  const checkIsTampered = (project: Project): boolean => {
    const hasTamperAlert = alerts.some(
      (a) =>
        a.projectId === project.id &&
        a.status === 'Unresolved' &&
        (a.alertType?.toLowerCase().includes('tamper') || a.message?.toLowerCase().includes('tamper'))
    );
    if (hasTamperAlert) return true;

    const chainBudgets = readStoredChainBudgets();
    const chainBudget = chainBudgets[project.id];
    if (typeof chainBudget === 'number' && Number.isFinite(chainBudget)) {
      const overrides = readBreachResolutionOverrides();
      const effectiveBudget = overrides[project.id] ?? project.totalBudget;
      return isProjectTampered(effectiveBudget, chainBudget);
    }

    return false;
  };

  // Categories list
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    projects.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }, [projects]);

  // Filtered Projects Computation
  const filteredProjects = useMemo(() => {
    const now = new Date();

    return projects.filter((project) => {
      // 1. Search Query
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = project.name.toLowerCase().includes(query);
        const matchesId = project.id.toLowerCase().includes(query);
        const matchesLoc = (project.location || '').toLowerCase().includes(query);
        const matchesDesc = (project.description || '').toLowerCase().includes(query);
        const matchesSaro = (project.saro || '').toLowerCase().includes(query);
        if (!matchesName && !matchesId && !matchesLoc && !matchesDesc && !matchesSaro) {
          return false;
        }
      }

      // 2. Category
      if (selectedCategory !== 'ALL') {
        const projectCat = project.category || 'General Public Services';
        if (projectCat.toLowerCase() !== selectedCategory.toLowerCase()) {
          return false;
        }
      }

      // 3. Status
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'Delayed') {
          if (!isProjectDelayed(project)) return false;
        } else {
          if (project.status !== selectedStatus) return false;
        }
      }

      // 4. Budget Range
      const budget = project.totalBudget || 0;
      if (budgetFilter === 'under1m' && budget >= 1_000_000) return false;
      if (budgetFilter === '1mTo5m' && (budget < 1_000_000 || budget > 5_000_000)) return false;
      if (budgetFilter === '5mTo20m' && (budget < 5_000_000 || budget > 20_000_000)) return false;
      if (budgetFilter === 'above20m' && budget <= 20_000_000) return false;

      // 5. Integrity
      const isTampered = checkIsTampered(project);
      if (integrityFilter === 'verified' && isTampered) return false;
      if (integrityFilter === 'tampered' && !isTampered) return false;

      // 6. Date Range
      const projectDate = new Date(project.startDate || project.createdAt);
      if (!Number.isNaN(projectDate.getTime())) {
        if (datePreset === '30days') {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(now.getDate() - 30);
          if (projectDate < thirtyDaysAgo) return false;
        } else if (datePreset === '90days') {
          const ninetyDaysAgo = new Date();
          ninetyDaysAgo.setDate(now.getDate() - 90);
          if (projectDate < ninetyDaysAgo) return false;
        } else if (datePreset === 'thisYear') {
          const currentYear = now.getFullYear();
          if (projectDate.getFullYear() !== currentYear) return false;
        } else if (datePreset === 'custom') {
          if (customStartDate) {
            const start = new Date(customStartDate);
            if (projectDate < start) return false;
          }
          if (customEndDate) {
            const end = new Date(customEndDate);
            end.setHours(23, 59, 59, 999);
            if (projectDate > end) return false;
          }
        }
      }

      return true;
    });
  }, [
    projects,
    searchTerm,
    selectedCategory,
    selectedStatus,
    budgetFilter,
    integrityFilter,
    datePreset,
    customStartDate,
    customEndDate,
  ]);

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return filteredProjects.flatMap((p) =>
      (p.transactions || []).map((t) => ({
        ...t,
        projectName: p.name,
        projectCategory: p.category,
      }))
    );
  }, [filteredProjects]);

  // Filtered Milestones
  const filteredMilestones = useMemo(() => {
    return filteredProjects.flatMap((p) =>
      (p.milestones || []).map((m) => ({
        ...m,
        projectId: p.id,
        projectName: p.name,
        projectStatus: p.status,
      }))
    );
  }, [filteredProjects]);

  // Executive Summary Metrics (Derived strictly from filtered projects)
  const summaryMetrics = useMemo(() => {
    const totalBudget = filteredProjects.reduce((sum, p) => sum + (p.totalBudget || 0), 0);
    const totalAllocatedSARO = filteredProjects.reduce((sum, p) => sum + (p.allocatedFunds || 0), 0);
    const totalDisbursedNCA = filteredProjects.reduce((sum, p) => sum + (p.disbursedFunds || 0), 0);
    const remainingBalance = Math.max(0, totalBudget - totalDisbursedNCA);
    const budgetUtilizationRate =
      totalAllocatedSARO > 0
        ? Math.min(100, (totalDisbursedNCA / totalAllocatedSARO) * 100)
        : totalBudget > 0
          ? Math.min(100, (totalDisbursedNCA / totalBudget) * 100)
          : 0;

    const delayedCount = filteredProjects.filter(isProjectDelayed).length;
    const tamperedCount = filteredProjects.filter(checkIsTampered).length;
    const completedCount = filteredProjects.filter((p) => p.status === 'Completed').length;
    const inProgressCount = filteredProjects.filter((p) => p.status === 'In Progress' || p.status === 'ACTIVE').length;

    const allTx = filteredProjects.flatMap((p) => p.transactions || []);
    const successfulReleases = allTx.filter((t) => t.status === 'Executed' || t.status === 'Completed').length;
    const pendingReleases = allTx.filter((t) => t.status === '1/2 Signed' || t.status === 'Pending Transaction').length;
    const rejectedReleases = allTx.filter((t) => (t.status || '').toLowerCase().includes('rejected')).length;
    const unresolvedAlerts = alerts.filter((a) => a.status === 'Unresolved').length;

    return {
      totalProjects: filteredProjects.length,
      totalBudget,
      totalAllocatedSARO,
      totalDisbursedNCA,
      remainingBalance,
      budgetUtilizationRate,
      delayedCount,
      tamperedCount,
      completedCount,
      inProgressCount,
      successfulReleases,
      pendingReleases,
      rejectedReleases,
      unresolvedAlerts,
    };
  }, [filteredProjects, alerts]);

  // ==========================================
  // GRAPH 1: MUNICIPAL BUDGET ALLOCATION BY CATEGORY
  // ==========================================
  const budgetAllocationByCategory = useMemo(() => {
    const categoryMap: Record<string, { category: string; totalBudget: number; allocatedSARO: number; disbursedNCA: number; projectCount: number }> = {};

    filteredProjects.forEach((project) => {
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
  }, [filteredProjects]);

  // ==========================================
  // GRAPH 2: BUDGET VS. ACTUAL EXPENDITURE
  // ==========================================
  const budgetVsExpenditureData = useMemo(() => {
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

    if (filteredTransactions.length > 0) {
      filteredTransactions.forEach((tx) => {
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
      filteredProjects.forEach((p) => {
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
  }, [filteredTransactions, filteredProjects]);

  // ==========================================
  // GRAPH 4: PROJECT PROGRESS VS. FUND UTILIZATION (EARNED VALUE)
  // ==========================================
  const projectProgressVsUtilization = useMemo(() => {
    return filteredProjects.slice(0, 8).map((project) => {
      const physicalProgress = calculateProgress(project);
      const totalBudget = project.totalBudget || 1;
      const fundUtilization = Math.min(100, Math.round(((project.disbursedFunds || 0) / totalBudget) * 100));
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
  // GRAPH 5: PROJECT IMPLEMENTATION STATUS DISTRIBUTION
  // ==========================================
  const projectStatusDistribution = useMemo(() => {
    let completed = 0;
    let ongoing = 0;
    let delayed = 0;
    let pendingGates = 0;
    let rejected = 0;

    filteredProjects.forEach((p) => {
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
  }, [filteredProjects]);

  // ==========================================
  // GRAPH 6: TRANSACTION MONITORING & SECURITY TELEMETRY
  // ==========================================
  const transactionMonitoringData = useMemo(() => {
    const totalTransactions = filteredTransactions.length;
    const normalAllocations = filteredTransactions.filter((t) => t.type === 'Allocation (SARO)' && !t.status.includes('Rejected')).length;
    const normalDisbursements = filteredTransactions.filter(
      (t) => t.type === 'Disbursement (NCA)' && (t.status === 'Executed' || t.status === 'Completed' || t.status === '1/2 Signed')
    ).length;

    const criticalAlerts = alerts.filter((a) => a.severity === 'CRITICAL' || a.severity === 'WARNING').length;
    const rejectedTxCount = filteredTransactions.filter((t) => (t.status || '').toLowerCase().includes('rejected')).length;
    const delayedProjectAlerts = summaryMetrics.delayedCount;

    return [
      {
        category: 'Budget Allotment (SARO)',
        'Normal / Verified': normalAllocations || (filteredProjects.length > 0 ? filteredProjects.filter((p) => (p.allocatedFunds || 0) > 0).length : 0),
        'Flagged / Unusual': alerts.filter((a) => a.message?.toLowerCase().includes('budget') || a.message?.toLowerCase().includes('breach')).length,
      },
      {
        category: 'Disbursement (NCA)',
        'Normal / Verified': normalDisbursements || (filteredProjects.length > 0 ? filteredProjects.filter((p) => (p.disbursedFunds || 0) > 0).length : 0),
        'Flagged / Unusual': rejectedTxCount + alerts.filter((a) => a.message?.toLowerCase().includes('disbursement')).length,
      },
      {
        category: 'Milestone Execution',
        'Normal / Verified': filteredProjects.reduce((acc, p) => acc + (p.milestones?.filter((m) => m.status === 'Verified' || m.status === 'Paid').length || 0), 0),
        'Flagged / Unusual': delayedProjectAlerts,
      },
      {
        category: 'System & Security',
        'Normal / Verified': Math.max(1, totalTransactions),
        'Flagged / Unusual': criticalAlerts,
      },
    ];
  }, [filteredTransactions, filteredProjects, alerts, summaryMetrics.delayedCount]);

  // ==========================================
  // AUDIT & VARIANCE FINDINGS (SPECIAL OVERSIGHT FEATURE)
  // ==========================================
  const auditDiscrepancyProjects = useMemo(() => {
    return filteredProjects.map((p) => {
      const physicalProgress = calculateProgress(p);
      const totalBudget = p.totalBudget || 1;
      const disbursed = p.disbursedFunds || 0;
      const fundUtilization = Math.min(100, Math.round((disbursed / totalBudget) * 100));
      const variance = fundUtilization - physicalProgress;
      const isOverDisbursed = variance > 15;
      const isDelayed = isProjectDelayed(p);
      const isTampered = checkIsTampered(p);

      let riskLevel: 'HIGH' | 'MODERATE' | 'LOW' = 'LOW';
      if (isTampered || (isOverDisbursed && variance > 30)) {
        riskLevel = 'HIGH';
      } else if (isOverDisbursed || isDelayed) {
        riskLevel = 'MODERATE';
      }

      let auditFinding = 'On-schedule & within financial gates';
      let recommendedAction = 'Continue periodic milestone inspections';

      if (isTampered) {
        auditFinding = 'CRITICAL: Database budget differs from Sepolia smart contract state.';
        recommendedAction = 'Execute blockchain resynchronization & alert Commission on Audit (COA).';
      } else if (isOverDisbursed) {
        auditFinding = `Discrepancy: Cash disbursed (${fundUtilization}%) exceeds physical work (${physicalProgress}%) by +${variance}%.`;
        recommendedAction = 'Halt Gate 2 cash releases until MPDC completes on-site verification.';
      } else if (isDelayed) {
        auditFinding = 'Milestone target due date exceeded without verified deliverables.';
        recommendedAction = 'Issue official Notice to Comply to project contractor.';
      }

      return {
        project: p,
        physicalProgress,
        fundUtilization,
        variance,
        isOverDisbursed,
        isDelayed,
        isTampered,
        riskLevel,
        auditFinding,
        recommendedAction,
      };
    });
  }, [filteredProjects]);

  const flaggedVarianceCount = useMemo(() => {
    return auditDiscrepancyProjects.filter((d) => d.isOverDisbursed || d.isDelayed || d.isTampered).length;
  }, [auditDiscrepancyProjects]);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim()) count++;
    if (selectedCategory !== 'ALL') count++;
    if (selectedStatus !== 'ALL') count++;
    if (datePreset !== 'all') count++;
    if (budgetFilter !== 'all') count++;
    if (integrityFilter !== 'all') count++;
    return count;
  }, [searchTerm, selectedCategory, selectedStatus, datePreset, budgetFilter, integrityFilter]);

  // Reset Filters
  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('ALL');
    setSelectedStatus('ALL');
    setDatePreset('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setBudgetFilter('all');
    setIntegrityFilter('all');
  };

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

  // Canvas Helper: Draw rounded rectangles
  const drawRoundRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // Format compact currency for canvas charts (ASCII standard, no unicode peso glyph)
  const formatChartCurrency = (amount: number) => {
    if (amount >= 1_000_000_000) return `PHP ${(amount / 1_000_000_000).toFixed(1)}B`;
    if (amount >= 1_000_000) return `PHP ${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `PHP ${(amount / 1_000).toFixed(0)}K`;
    return `PHP ${Math.round(amount).toLocaleString()}`;
  };

  // 1. CANVAS: BAR GRAPH IMAGE (Budget Allocation by Sector)
  const generateBarChartImage = (data: typeof budgetAllocationByCategory): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 540;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1200, 540);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    drawRoundRect(ctx, 4, 4, 1192, 532, 16);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Budget Allocation by Sector (Bar Graph)', 40, 48);

    ctx.fillStyle = '#64748b';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Financial comparison of Approved Budget, SARO Allotments, and NCA Disbursements', 40, 74);

    const legends = [
      { label: 'Approved Budget', color: '#2563eb' },
      { label: 'SARO Allocated', color: '#f59e0b' },
      { label: 'NCA Disbursed', color: '#10b981' },
    ];
    let legX = 660;
    legends.forEach((item) => {
      ctx.fillStyle = item.color;
      drawRoundRect(ctx, legX, 42, 14, 14, 3);
      ctx.fill();

      ctx.fillStyle = '#334155';
      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(item.label, legX + 20, 54);
      legX += 165;
    });

    const plotLeft = 130;
    const plotRight = 1150;
    const plotTop = 110;
    const plotBottom = 450;
    const plotWidth = plotRight - plotLeft;
    const plotHeight = plotBottom - plotTop;

    const items = data.slice(0, 6);
    if (items.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('No sector budget data available for the selected filters.', plotLeft + 100, plotTop + 150);
      return canvas.toDataURL('image/png');
    }

    const maxBudget = Math.max(...items.flatMap((c) => [c.totalBudget, c.allocatedSARO, c.disbursedNCA]), 1000000);
    const magnitude = Math.pow(10, Math.floor(Math.log10(maxBudget)));
    const niceMax = Math.ceil(maxBudget / magnitude) * magnitude;

    const steps = 4;
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'right';

    for (let i = 0; i <= steps; i++) {
      const yVal = (niceMax / steps) * i;
      const yPos = plotBottom - (yVal / niceMax) * plotHeight;

      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(plotLeft, yPos);
      ctx.lineTo(plotRight, yPos);
      ctx.stroke();

      ctx.fillText(formatChartCurrency(yVal), plotLeft - 14, yPos + 4);
    }
    ctx.textAlign = 'left';

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(plotLeft, plotBottom);
    ctx.lineTo(plotRight, plotBottom);
    ctx.stroke();

    const groupWidth = plotWidth / items.length;
    const barWidth = Math.min(30, (groupWidth - 36) / 3);
    const barGap = 4;

    items.forEach((cat, idx) => {
      const groupCenterX = plotLeft + idx * groupWidth + groupWidth / 2;
      const startX = groupCenterX - (barWidth * 3 + barGap * 2) / 2;

      const bH = Math.max(2, (cat.totalBudget / niceMax) * plotHeight);
      const aH = Math.max(2, (cat.allocatedSARO / niceMax) * plotHeight);
      const dH = Math.max(2, (cat.disbursedNCA / niceMax) * plotHeight);

      ctx.fillStyle = '#2563eb';
      drawRoundRect(ctx, startX, plotBottom - bH, barWidth, bH, 4);
      ctx.fill();

      ctx.fillStyle = '#f59e0b';
      drawRoundRect(ctx, startX + barWidth + barGap, plotBottom - aH, barWidth, aH, 4);
      ctx.fill();

      ctx.fillStyle = '#10b981';
      drawRoundRect(ctx, startX + (barWidth + barGap) * 2, plotBottom - dH, barWidth, dH, 4);
      ctx.fill();

      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';

      let displayName = cat.category;
      if (displayName.length > 16) displayName = displayName.substring(0, 14) + '...';
      ctx.fillText(displayName, groupCenterX, plotBottom + 26);

      ctx.fillStyle = '#64748b';
      ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`${cat.projectCount} Project${cat.projectCount > 1 ? 's' : ''}`, groupCenterX, plotBottom + 42);
      ctx.textAlign = 'left';
    });

    return canvas.toDataURL('image/png');
  };

  // 2. CANVAS: PIE / DONUT GRAPH IMAGE (Project Status Distribution)
  const generatePieChartImage = (data: typeof projectStatusDistribution, totalCount: number): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 490;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1200, 490);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    drawRoundRect(ctx, 4, 4, 1192, 482, 16);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Project Status Distribution (Pie / Donut Graph)', 40, 48);

    ctx.fillStyle = '#64748b';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Execution and schedule health distribution across all filtered municipal projects', 40, 74);

    const safeTotal = Math.max(1, totalCount);
    const cx = 260;
    const cy = 270;
    const outerRadius = 145;
    const innerRadius = 85;

    let startAngle = -Math.PI / 2;

    data.forEach((item, idx) => {
      const sliceAngle = (item.value / safeTotal) * 2 * Math.PI;
      const endAngle = startAngle + sliceAngle;
      const fillColor = item.color || STATUS_COLORS[item.name] || PIE_COLORS[idx % PIE_COLORS.length] || '#64748b';

      ctx.beginPath();
      ctx.arc(cx, cy, outerRadius, startAngle, endAngle, false);
      ctx.arc(cx, cy, innerRadius, endAngle, startAngle, true);
      ctx.closePath();

      ctx.fillStyle = fillColor;
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      startAngle = endAngle;
    });

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${totalCount}`, cx, cy + 4);

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('PROJECTS', cx, cy + 26);
    ctx.textAlign = 'left';

    const listX = 520;
    let listY = 120;
    const rowHeight = 48;

    data.slice(0, 6).forEach((item, idx) => {
      const fillColor = item.color || STATUS_COLORS[item.name] || PIE_COLORS[idx % PIE_COLORS.length] || '#64748b';
      const pct = ((item.value / safeTotal) * 100).toFixed(1);

      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.arc(listX + 10, listY + 12, 9, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(item.name, listX + 30, listY + 16);

      ctx.fillStyle = '#475569';
      ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${item.value} Project${item.value > 1 ? 's' : ''} (${pct}%)`, listX + 620, listY + 16);
      ctx.textAlign = 'left';

      ctx.fillStyle = '#f1f5f9';
      drawRoundRect(ctx, listX + 30, listY + 26, 590, 7, 3);
      ctx.fill();

      const barW = Math.max(4, (item.value / safeTotal) * 590);
      ctx.fillStyle = fillColor;
      drawRoundRect(ctx, listX + 30, listY + 26, barW, 7, 3);
      ctx.fill();

      listY += rowHeight;
    });

    return canvas.toDataURL('image/png');
  };

  // 3. CANVAS: LINE / AREA TRAJECTORY GRAPH IMAGE (Disbursement & Allotment Trajectory)
  const generateLineChartImage = (data: typeof monthlyFundReleaseData): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 520;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1200, 520);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    drawRoundRect(ctx, 4, 4, 1192, 512, 16);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Disbursement & Allotment Trajectory (Line & Area Graph)', 40, 48);

    ctx.fillStyle = '#64748b';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Chronological monthly trajectory of SARO Allotments against NCA Cash Disbursements', 40, 74);

    const legends = [
      { label: 'SARO Allotments (Area)', color: '#f59e0b' },
      { label: 'NCA Disbursements (Area)', color: '#10b981' },
    ];
    let legX = 660;
    legends.forEach((item) => {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(legX + 6, 48, 6, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = '#334155';
      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(item.label, legX + 18, 52);
      legX += 240;
    });

    const plotLeft = 130;
    const plotRight = 1150;
    const plotTop = 110;
    const plotBottom = 430;
    const plotWidth = plotRight - plotLeft;
    const plotHeight = plotBottom - plotTop;

    const items = data.length > 0 ? data : [
      { month: 'Q1', saroReleased: 50000000, ncaDisbursed: 20000000, totalFlow: 70000000 },
      { month: 'Q2', saroReleased: 90000000, ncaDisbursed: 45000000, totalFlow: 135000000 },
      { month: 'Q3', saroReleased: 140000000, ncaDisbursed: 70000000, totalFlow: 210000000 },
    ];

    const maxVal = Math.max(...items.flatMap((d) => [d.saroReleased, d.ncaDisbursed]), 1000000);
    const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)));
    const niceMax = Math.ceil(maxVal / magnitude) * magnitude;

    const steps = 4;
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'right';

    for (let i = 0; i <= steps; i++) {
      const yVal = (niceMax / steps) * i;
      const yPos = plotBottom - (yVal / niceMax) * plotHeight;

      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(plotLeft, yPos);
      ctx.lineTo(plotRight, yPos);
      ctx.stroke();

      ctx.fillText(formatChartCurrency(yVal), plotLeft - 14, yPos + 4);
    }
    ctx.textAlign = 'left';

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(plotLeft, plotBottom);
    ctx.lineTo(plotRight, plotBottom);
    ctx.stroke();

    const getX = (i: number) => {
      if (items.length === 1) return plotLeft + plotWidth / 2;
      return plotLeft + (i / (items.length - 1)) * plotWidth;
    };
    const getY = (val: number) => plotBottom - (val / niceMax) * plotHeight;

    // SARO Allotments (Amber #f59e0b)
    const gradSARO = ctx.createLinearGradient(0, plotTop, 0, plotBottom);
    gradSARO.addColorStop(0, 'rgba(245, 158, 11, 0.35)');
    gradSARO.addColorStop(1, 'rgba(245, 158, 11, 0.02)');

    ctx.beginPath();
    ctx.moveTo(getX(0), plotBottom);
    items.forEach((item, i) => {
      ctx.lineTo(getX(i), getY(item.saroReleased));
    });
    ctx.lineTo(getX(items.length - 1), plotBottom);
    ctx.closePath();
    ctx.fillStyle = gradSARO;
    ctx.fill();

    ctx.beginPath();
    items.forEach((item, i) => {
      if (i === 0) ctx.moveTo(getX(i), getY(item.saroReleased));
      else ctx.lineTo(getX(i), getY(item.saroReleased));
    });
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    items.forEach((item, i) => {
      const px = getX(i);
      const py = getY(item.saroReleased);
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    });

    // NCA Disbursements (Emerald #10b981)
    const gradNCA = ctx.createLinearGradient(0, plotTop, 0, plotBottom);
    gradNCA.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
    gradNCA.addColorStop(1, 'rgba(16, 185, 129, 0.02)');

    ctx.beginPath();
    ctx.moveTo(getX(0), plotBottom);
    items.forEach((item, i) => {
      ctx.lineTo(getX(i), getY(item.ncaDisbursed));
    });
    ctx.lineTo(getX(items.length - 1), plotBottom);
    ctx.closePath();
    ctx.fillStyle = gradNCA;
    ctx.fill();

    ctx.beginPath();
    items.forEach((item, i) => {
      if (i === 0) ctx.moveTo(getX(i), getY(item.ncaDisbursed));
      else ctx.lineTo(getX(i), getY(item.ncaDisbursed));
    });
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    items.forEach((item, i) => {
      const px = getX(i);
      const py = getY(item.ncaDisbursed);
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = '#334155';
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.month, px, plotBottom + 26);
      ctx.textAlign = 'left';
    });

    return canvas.toDataURL('image/png');
  };

  // 4. CANVAS: PROGRESS VS UTILIZATION (EARNED VALUE CHECK)
  const generateProgressVsUtilizationChartImage = (data: typeof projectProgressVsUtilization): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 520;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1200, 520);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    drawRoundRect(ctx, 4, 4, 1192, 512, 16);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Project Progress vs. Fund Utilization (Earned Value Check)', 40, 48);

    ctx.fillStyle = '#64748b';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Comparison of Physical Milestone Completion (%) against Financial Disbursement (%)', 40, 74);

    const legends = [
      { label: 'Physical Progress (%)', color: '#2563eb' },
      { label: 'Fund Utilization (%)', color: '#10b981' },
    ];
    let legX = 720;
    legends.forEach((item) => {
      ctx.fillStyle = item.color;
      drawRoundRect(ctx, legX, 42, 14, 14, 3);
      ctx.fill();

      ctx.fillStyle = '#334155';
      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(item.label, legX + 20, 54);
      legX += 190;
    });

    const plotLeft = 80;
    const plotRight = 1150;
    const plotTop = 110;
    const plotBottom = 430;
    const plotWidth = plotRight - plotLeft;
    const plotHeight = plotBottom - plotTop;

    const items = data.slice(0, 8);
    if (items.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('No project progress data available for selected filters.', plotLeft + 100, plotTop + 150);
      return canvas.toDataURL('image/png');
    }

    const steps = 4;
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'right';

    for (let i = 0; i <= steps; i++) {
      const pct = (100 / steps) * i;
      const yPos = plotBottom - (pct / 100) * plotHeight;

      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(plotLeft, yPos);
      ctx.lineTo(plotRight, yPos);
      ctx.stroke();

      ctx.fillText(`${pct}%`, plotLeft - 12, yPos + 4);
    }
    ctx.textAlign = 'left';

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(plotLeft, plotBottom);
    ctx.lineTo(plotRight, plotBottom);
    ctx.stroke();

    const groupWidth = plotWidth / items.length;
    const barWidth = Math.min(32, (groupWidth - 30) / 2);
    const barGap = 4;

    items.forEach((item, idx) => {
      const groupCenterX = plotLeft + idx * groupWidth + groupWidth / 2;
      const startX = groupCenterX - (barWidth * 2 + barGap) / 2;

      const physicalVal = item['Physical Progress (%)'];
      const utilVal = item['Fund Utilization (%)'];

      const pH = Math.max(2, (physicalVal / 100) * plotHeight);
      const uH = Math.max(2, (utilVal / 100) * plotHeight);

      ctx.fillStyle = '#2563eb';
      drawRoundRect(ctx, startX, plotBottom - pH, barWidth, pH, 4);
      ctx.fill();

      ctx.fillStyle = item.hasDiscrepancy ? '#ef4444' : '#10b981';
      drawRoundRect(ctx, startX + barWidth + barGap, plotBottom - uH, barWidth, uH, 4);
      ctx.fill();

      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      let dName = item.name;
      if (dName.length > 14) dName = dName.substring(0, 12) + '...';
      ctx.fillText(dName, groupCenterX, plotBottom + 24);

      if (item.hasDiscrepancy) {
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('! Discrepancy', groupCenterX, plotBottom + 40);
      } else {
        ctx.fillStyle = '#64748b';
        ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`${physicalVal}% / ${utilVal}%`, groupCenterX, plotBottom + 40);
      }
      ctx.textAlign = 'left';
    });

    return canvas.toDataURL('image/png');
  };

  // ==========================================
  // UNIFIED SINGLE PDF DOWNLOAD (BOTH GRAPHS & TABLES)
  // ==========================================
  const handleExportPDF = () => {
    setIsExportingPDF(true);

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
      });

      const pageWidth = 595.28;
      const margin = 36;
      const contentWidth = pageWidth - margin * 2; // 523.28 pt
      const generatedAt = new Date().toLocaleString('en-PH');
      const preparedBy = `${user?.name || 'Authorized Official'} (${user?.role || 'Municipal Authority'})`;

      // ==========================================
      // PAGE 1: MUNICIPAL HEADER + KPIS + CHARTS 1 & 2
      // ==========================================
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, pageWidth, 68, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('REPUBLIC OF THE PHILIPPINES • PROVINCE OF LAGUNA', margin, 22);

      doc.setFontSize(13);
      doc.text('MUNICIPALITY OF SANTA CRUZ — BAYANLEDGER', margin, 40);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('Official Comprehensive Audit, Visual Analytics & Financial Data Ledger Report', margin, 55);

      // Metadata Box
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, 78, contentWidth, 42, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, 78, contentWidth, 42, 'S');

      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.setFont('helvetica', 'bold');
      doc.text('Report Scope: Official Comprehensive Audit Report (Visual Graphs & Detailed Ledgers)', margin + 8, 91);

      doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${generatedAt}  •  Prepared By: ${preparedBy}`, margin + 8, 103);

      let filterSummary = `Sector: ${selectedCategory}  •  Status: ${selectedStatus}  •  Scope: ${datePreset}  •  Budget: ${budgetFilter}  •  Integrity: ${integrityFilter}`;
      if (searchTerm.trim()) filterSummary += `  •  Search: "${searchTerm}"`;
      doc.text(filterSummary, margin + 8, 114);

      // Executive Summary KPI Cards
      const cardWidth = 122;
      const cardHeight = 44;
      const cardGap = (contentWidth - cardWidth * 4) / 3;
      const cardY = 128;

      const kpiItems = [
        { label: 'APPROVED BUDGET', val: formatPdfPHP(summaryMetrics.totalBudget), fill: [239, 246, 255], border: [191, 219, 254], text: [29, 78, 216] },
        { label: 'SARO ALLOCATED', val: formatPdfPHP(summaryMetrics.totalAllocatedSARO), fill: [254, 243, 199], border: [253, 230, 138], text: [180, 83, 9] },
        { label: 'NCA DISBURSED', val: formatPdfPHP(summaryMetrics.totalDisbursedNCA), fill: [236, 253, 245], border: [167, 243, 208], text: [4, 120, 87] },
        { label: 'UTILIZATION RATE', val: `${summaryMetrics.budgetUtilizationRate.toFixed(1)}%`, fill: [243, 232, 255], border: [216, 180, 254], text: [126, 34, 206] },
      ];

      kpiItems.forEach((kpi, idx) => {
        const x = margin + idx * (cardWidth + cardGap);
        doc.setFillColor(kpi.fill[0], kpi.fill[1], kpi.fill[2]);
        doc.roundedRect(x, cardY, cardWidth, cardHeight, 4, 4, 'F');
        doc.setDrawColor(kpi.border[0], kpi.border[1], kpi.border[2]);
        doc.roundedRect(x, cardY, cardWidth, cardHeight, 4, 4, 'S');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(kpi.label, x + 8, cardY + 14);

        doc.setFontSize(9.5);
        doc.setTextColor(kpi.text[0], kpi.text[1], kpi.text[2]);
        doc.text(kpi.val, x + 8, cardY + 32);
      });

      // Chart 1: Bar Graph (Budget Allocation by Sector)
      const barChartImg = generateBarChartImage(budgetAllocationByCategory);
      if (barChartImg) {
        doc.addImage(barChartImg, 'PNG', margin, 180, contentWidth, 230);
      }

      // Chart 2: Donut Graph (Project Status Distribution)
      const pieChartImg = generatePieChartImage(projectStatusDistribution, filteredProjects.length);
      if (pieChartImg) {
        doc.addImage(pieChartImg, 'PNG', margin, 420, contentWidth, 210);
      }

      // ==========================================
      // PAGE 2: CHARTS 3 & 4 + SECTOR FINANCIAL TABLE
      // ==========================================
      doc.addPage();

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 48, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('REPUBLIC OF THE PHILIPPINES • PROVINCE OF LAGUNA', margin, 18);

      doc.setFontSize(11);
      doc.text('MUNICIPALITY OF SANTA CRUZ — VISUAL TRAJECTORY & EARNED VALUE', margin, 34);

      // Chart 3: Monthly Trajectory Area Chart
      const lineChartImg = generateLineChartImage(monthlyFundReleaseData);
      if (lineChartImg) {
        doc.addImage(lineChartImg, 'PNG', margin, 58, contentWidth, 215);
      }

      // Chart 4: Progress vs Utilization (Earned Value)
      const progressChartImg = generateProgressVsUtilizationChartImage(projectProgressVsUtilization);
      if (progressChartImg) {
        doc.addImage(progressChartImg, 'PNG', margin, 282, contentWidth, 215);
      }

      // Table 1: Sector Financial Breakdown Table
      const currentY = 510;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text('SECTORAL FINANCIAL ALLOCATION & UTILIZATION AUDIT LEDGER', margin, currentY);

      autoTable(doc, {
        startY: currentY + 8,
        margin: { left: margin, right: margin },
        head: [['Sector / Category', 'Projects', 'Approved Budget', 'SARO Allocated', 'NCA Disbursed', 'Remaining Balance', 'Util %']],
        body: budgetAllocationByCategory.map((c) => {
          const bal = Math.max(0, c.totalBudget - c.disbursedNCA);
          const util = c.allocatedSARO > 0 ? (c.disbursedNCA / c.allocatedSARO) * 100 : c.totalBudget > 0 ? (c.disbursedNCA / c.totalBudget) * 100 : 0;
          return [
            c.category,
            c.projectCount.toString(),
            formatPdfPHP(c.totalBudget),
            formatPdfPHP(c.allocatedSARO),
            formatPdfPHP(c.disbursedNCA),
            formatPdfPHP(bal),
            `${util.toFixed(1)}%`,
          ];
        }),
        theme: 'grid',
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontSize: 7.5,
          fontStyle: 'bold',
          halign: 'left',
        },
        bodyStyles: {
          fontSize: 6.5,
          cellPadding: 2.5,
          textColor: [30, 41, 59],
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { cellWidth: 125, halign: 'left' },
          1: { cellWidth: 36, halign: 'center' },
          2: { cellWidth: 72, halign: 'right' },
          3: { cellWidth: 72, halign: 'right' },
          4: { cellWidth: 72, halign: 'right' },
          5: { cellWidth: 72, halign: 'right' },
          6: { cellWidth: 40, halign: 'right', fontStyle: 'bold' },
        },
      });

      // ==========================================
      // PAGE 3: DETAILED PROJECTS LEDGER & TRANSACTIONS & SIGN-OFF
      // ==========================================
      doc.addPage();

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 48, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('REPUBLIC OF THE PHILIPPINES • PROVINCE OF LAGUNA', margin, 18);

      doc.setFontSize(11);
      doc.text('MUNICIPALITY OF SANTA CRUZ — OFFICIAL PROJECTS AUDIT & BLOCKCHAIN LEDGER', margin, 34);

      // Table 2: Filtered Projects Ledger
      autoTable(doc, {
        startY: 58,
        margin: { left: margin, right: margin },
        head: [['Project Name', 'Sector', 'Approved Budget', 'NCA Disbursed', 'Progress', 'Status', 'Integrity']],
        body: filteredProjects.slice(0, 20).map((p) => {
          const isTampered = checkIsTampered(p);
          const isDelayed = isProjectDelayed(p);
          const progress = calculateProgress(p);
          return [
            p.name,
            p.category || 'General',
            formatPdfPHP(p.totalBudget || 0),
            formatPdfPHP(p.disbursedFunds || 0),
            `${progress}%`,
            isDelayed ? 'Delayed' : p.status,
            isTampered ? 'FLAGGED' : 'VERIFIED',
          ];
        }),
        theme: 'striped',
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontSize: 7.5,
          fontStyle: 'bold',
        },
        bodyStyles: {
          fontSize: 6.5,
          cellPadding: 2.5,
          textColor: [51, 65, 85],
        },
        columnStyles: {
          0: { cellWidth: 145, halign: 'left' },
          1: { cellWidth: 75, halign: 'left' },
          2: { cellWidth: 72, halign: 'right' },
          3: { cellWidth: 72, halign: 'right' },
          4: { cellWidth: 42, halign: 'center' },
          5: { cellWidth: 60, halign: 'center' },
          6: { cellWidth: 55, halign: 'center', fontStyle: 'bold' },
        },
      });

      // Table 3: Recent SARO / NCA Transactions
      const finalYProjects = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 300;

      if (filteredTransactions.length > 0 && finalYProjects < 580) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text('BLOCKCHAIN-NOTARIZED SARO & NCA TRANSACTIONS LEDGER', margin, finalYProjects + 16);

        autoTable(doc, {
          startY: finalYProjects + 22,
          margin: { left: margin, right: margin },
          head: [['Transaction ID', 'Project Name', 'Type', 'Amount', 'Status', 'Signatory Role', 'Date']],
          body: filteredTransactions.slice(0, 12).map((tx) => [
            tx.id,
            tx.projectName,
            tx.type,
            formatPdfPHP(tx.amount || 0),
            tx.status,
            tx.recordedByRole,
            tx.date,
          ]),
          theme: 'grid',
          headStyles: {
            fillColor: [30, 41, 59],
            textColor: [255, 255, 255],
            fontSize: 7,
            fontStyle: 'bold',
          },
          bodyStyles: {
            fontSize: 6.5,
            cellPadding: 2,
            textColor: [51, 65, 85],
          },
          columnStyles: {
            0: { cellWidth: 60, halign: 'left' },
            1: { cellWidth: 140, halign: 'left' },
            2: { cellWidth: 75, halign: 'center' },
            3: { cellWidth: 72, halign: 'right' },
            4: { cellWidth: 60, halign: 'center' },
            5: { cellWidth: 58, halign: 'left' },
            6: { cellWidth: 55, halign: 'center' },
          },
        });
      }

      // Official Certification & Sign-off Block
      const finalYTx = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 500;
      const signY = Math.min(finalYTx + 24, doc.internal.pageSize.height - 120);

      doc.setFillColor(248, 250, 252);
      doc.rect(margin, signY, contentWidth, 75, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, signY, contentWidth, 75, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);
      doc.text('OFFICIAL MUNICIPAL AUDIT & IMMUTABLE BLOCKCHAIN CERTIFICATION', margin + 10, signY + 14);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        'This computerized official report is generated from the BayanLedger Immutable Blockchain Ledger of the Municipality of Santa Cruz, Laguna.',
        margin + 10,
        signY + 25
      );
      doc.text(
        'All appropriations, SARO allocations, and NCA disbursements have been validated on-chain via smart contract multi-signature governance.',
        margin + 10,
        signY + 34
      );

      // 3 Official Signature Placeholders
      const signColWidth = contentWidth / 3;
      const sigLineY = signY + 60;

      const signers = [
        { role: 'Municipal Planning (MPDC)', title: 'Physical Progress Verified' },
        { role: 'Municipal Budget Officer', title: 'SARO Appropriations Certified' },
        { role: 'Municipal Treasurer', title: 'NCA Disbursements Concurred' },
      ];

      signers.forEach((s, idx) => {
        const colX = margin + idx * signColWidth + 10;
        doc.setDrawColor(148, 163, 184);
        doc.setLineWidth(0.8);
        doc.line(colX, sigLineY, colX + signColWidth - 25, sigLineY);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(15, 23, 42);
        doc.text(s.role, colX, sigLineY + 9);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.5);
        doc.setTextColor(100, 116, 139);
        doc.text(s.title, colX, sigLineY + 16);
      });

      // Running page numbers on all pages
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Page ${i} of ${totalPages} • BayanLedger Official Comprehensive Audit Report • Municipality of Santa Cruz, Laguna`,
          margin,
          doc.internal.pageSize.height - 18
        );
      }

      const fileName = `BayanLedger_Comprehensive_Audit_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      showToast('Comprehensive PDF Report (Graphs & Tables) downloaded successfully!');
    } catch (err) {
      console.error('Failed to export PDF:', err);
      alert('Failed to generate PDF report: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsExportingPDF(false);
    }
  };

  // =========================================================================
  // ENHANCED GOVERNMENT-STANDARD EXCEL EXPORT (.XLSX)
  // Compliant with DILG FDPP, DBM Local Budget Circular, COA SPA-FS & SAAODB
  // =========================================================================
  const handleExportExcel = () => {
    setIsExportingExcel(true);
    try {
      const generatedAt = new Date().toLocaleString('en-PH');
      const preparedBy = `${user?.name || 'Authorized Official'} (${user?.role || 'Municipal Authority'})`;

      // Helper to auto calculate column widths
      const autoFitColumns = (worksheet: XLSX.WorkSheet, data: any[][]) => {
        const colWidths = data.reduce((acc: number[], row: any[]) => {
          row.forEach((cell: any, colIdx: number) => {
            const cellStr = cell !== null && cell !== undefined ? String(cell) : '';
            const len = cellStr.length;
            acc[colIdx] = Math.max(acc[colIdx] || 10, len);
          });
          return acc;
        }, []);

        worksheet['!cols'] = colWidths.map((w: number) => ({
          wch: Math.min(56, Math.max(12, w + 3)),
        }));
      };

      // -------------------------------------------------------------
      // Sheet 1: Executive Summary & System Benchmarks
      // -------------------------------------------------------------
      const summarySheetData = [
        ['MUNICIPALITY OF SANTA CRUZ, LAGUNA • BAYANLEDGER SYSTEM'],
        ['OFFICIAL MUNICIPAL REPORTS & AUDIT TELEMETRY WORKBOOK'],
        ['Consolidated System Data from Santa Cruz Blockchain Transparency Portal'],
        [''],
        ['1. REPORT & SYSTEM METADATA'],
        ['System Name:', 'BayanLedger (Sta.Cruz Chain)'],
        ['Reporting Entity:', 'Municipality of Santa Cruz, Laguna'],
        ['Report Generation Timestamp:', generatedAt],
        ['Generated By:', preparedBy],
        ['Blockchain Consensus Standard:', 'Sepolia Ethereum Multi-Sig Smart Contracts'],
        ['Cryptographic State:', summaryMetrics.tamperedCount > 0 ? 'ALERT: On-Chain Discrepancy Detected' : '100% Cryptographically Verified On-Chain'],
        ['Total Projects Evaluated:', filteredProjects.length],
        [''],
        ['2. ACTIVE AUDIT FILTER PARAMETERS'],
        ['Search Keyword Filter:', searchTerm || 'All Projects Included'],
        ['Sector / Category Filter:', selectedCategory],
        ['Project Status Filter:', selectedStatus],
        ['Date Range Filter:', datePreset === 'custom' ? `${customStartDate} to ${customEndDate}` : datePreset],
        ['Budget Threshold Tier:', budgetFilter],
        ['Blockchain Integrity Scope:', integrityFilter],
        [''],
        ['3. SYSTEM FINANCIAL ACCOUNTABILITY & TELEMETRY BENCHMARKS'],
        ['Metric / Indicator', 'Amount / Value (PHP)', 'System Description'],
        ['Total Approved Budget', summaryMetrics.totalBudget, 'Total approved capital outlay across evaluated projects'],
        ['Released Funds (SARO - Gate 1)', summaryMetrics.totalAllocatedSARO, 'Total funds released under Special Allotment Release Orders'],
        ['Actual Disbursed Funds (NCA - Gate 2)', summaryMetrics.totalDisbursedNCA, 'Total cash disbursed by Municipal Treasury'],
        ['Remaining Unexpended Balance', summaryMetrics.remainingBalance, 'Unexpended municipal capital reserves'],
        ['Overall Budget Utilization Rate (%)', `${summaryMetrics.budgetUtilizationRate.toFixed(1)}%`, 'NCA Cash Disbursed ÷ SARO Released Funds'],
        ['Total In Progress Projects', summaryMetrics.inProgressCount, 'Currently active projects in implementation stage'],
        ['Completed Municipal Projects', summaryMetrics.completedCount, 'Projects with 100% delivery cleared and completed'],
        ['Delayed Projects (Negative Slippage)', summaryMetrics.delayedCount, summaryMetrics.delayedCount > 0 ? 'Projects that have exceeded milestone target dates' : 'All projects are currently on schedule'],
        ['Fiscal Discrepancy Alerts (>15% Delta)', flaggedVarianceCount, flaggedVarianceCount > 0 ? 'Projects where disbursements outpace physical work' : 'Disbursements match physical accomplishment'],
        ['On-Chain Security / Tamper Breaches', summaryMetrics.tamperedCount, summaryMetrics.tamperedCount > 0 ? 'Database budget differs from Sepolia smart contract' : 'Zero breaches; 100% intact on Sepolia Ethereum'],
        [''],
        ['4. BUDGET ALLOCATION BY CATEGORY SUMMARY'],
        ['Category / Sector', 'Project Count', 'Approved Budget (PHP)', 'Released Funds - SARO (PHP)', 'Disbursed Funds - NCA (PHP)', 'Remaining Balance (PHP)', 'Budget Utilization Rate (%)'],
        ...budgetAllocationByCategory.map((c) => {
          const bal = Math.max(0, c.totalBudget - c.disbursedNCA);
          const utilRate = c.allocatedSARO > 0 ? (c.disbursedNCA / c.allocatedSARO) * 100 : c.totalBudget > 0 ? (c.disbursedNCA / c.totalBudget) * 100 : 0;
          return [
            c.category,
            c.projectCount,
            c.totalBudget,
            c.allocatedSARO,
            c.disbursedNCA,
            bal,
            Number(utilRate.toFixed(1)),
          ];
        }),
        [
          'MUNICIPAL TOTALS',
          filteredProjects.length,
          summaryMetrics.totalBudget,
          summaryMetrics.totalAllocatedSARO,
          summaryMetrics.totalDisbursedNCA,
          summaryMetrics.remainingBalance,
          Number(summaryMetrics.budgetUtilizationRate.toFixed(1)),
        ],
        [''],
        ['5. JOINT MUNICIPAL OFFICIAL CERTIFICATION'],
        ['WE HEREBY CERTIFY that the project execution telemetry and fund disbursement figures presented in this official report are extracted directly from the BayanLedger system database and validated against immutable smart contracts on Sepolia Ethereum.'],
        [''],
        ['Certified Correct by:'],
        ['1. Engr. MPDC Coordinator (Planning & Development)', '2. Municipal Budget Officer (Appropriations & SARO)', '3. Municipal Treasurer (Disbursements & NCA)', '4. Municipal Mayor (Head of Procuring Entity)'],
      ];

      // -------------------------------------------------------------
      // Sheet 2: Projects Ledger (Based Strictly on System Data)
      // -------------------------------------------------------------
      const projectsSheetData = [
        [
          'Item No.',
          'Project ID',
          'Project Title',
          'Description / Scope of Work',
          'Sector / Category',
          'Location',
          'Fund Source',
          'Approved Budget (PHP)',
          'SARO Reference No.',
          'Released Funds - SARO (PHP)',
          'Disbursed Funds - NCA (PHP)',
          'Remaining Balance (PHP)',
          'Financial Utilization (%)',
          'Physical Progress (%)',
          'Variance Delta (%)',
          'Schedule Health',
          'Project Status',
          'Start Date',
          'Target End Date',
          'Assigned Stakeholders',
          'Blockchain Security State',
          'Blockchain Transaction Hash',
          'System Audit Finding',
        ],
        ...filteredProjects.map((p, idx) => {
          const isTampered = checkIsTampered(p);
          const isDelayed = isProjectDelayed(p);
          const progress = calculateProgress(p);
          const utilRate = p.totalBudget > 0 ? ((p.disbursedFunds || 0) / p.totalBudget) * 100 : 0;
          const variance = utilRate - progress;
          const isDiscrepant = variance > 15;

          let auditFinding = 'On track; disbursements aligned with physical delivery';
          if (isTampered) {
            auditFinding = 'CRITICAL: Database budget tampered; differs from Sepolia contract';
          } else if (isDiscrepant) {
            auditFinding = `DISCREPANCY: Disbursed (${utilRate.toFixed(0)}%) ahead of physical work (${progress}%) by +${variance.toFixed(0)}%`;
          } else if (isDelayed) {
            auditFinding = 'SCHEDULE DELAY: Milestone target completion date exceeded';
          } else if (p.status === 'Completed') {
            auditFinding = 'COMPLETED: 100% physically delivered and cleared';
          }

          return [
            idx + 1,
            p.id,
            p.name,
            p.description || 'N/A',
            p.category || 'General',
            p.location || 'Santa Cruz, Laguna',
            p.budgetSource || '20% Development Fund',
            p.totalBudget || 0,
            p.saro || 'N/A',
            p.allocatedFunds || 0,
            p.disbursedFunds || 0,
            Math.max(0, (p.totalBudget || 0) - (p.disbursedFunds || 0)),
            Number(utilRate.toFixed(1)),
            Number(progress.toFixed(0)),
            Number(variance.toFixed(1)),
            isDelayed ? 'DELAYED' : 'ON TRACK',
            p.status,
            p.startDate || p.createdAt || 'N/A',
            p.endDate || 'N/A',
            (p.stakeholders || []).join(', ') || 'Municipal Engineering',
            isTampered ? 'TAMPERED ON-CHAIN' : 'VERIFIED ON SEPOLIA',
            p.blockchainTxHash || 'Pending On-Chain Mining',
            auditFinding,
          ];
        }),
        // Totals Row
        [
          'SUMMARY TOTALS',
          `${filteredProjects.length} Projects`,
          '',
          '',
          '',
          'Municipality of Santa Cruz',
          '',
          summaryMetrics.totalBudget,
          '',
          summaryMetrics.totalAllocatedSARO,
          summaryMetrics.totalDisbursedNCA,
          summaryMetrics.remainingBalance,
          Number(summaryMetrics.budgetUtilizationRate.toFixed(1)),
          Number((filteredProjects.reduce((acc, p) => acc + calculateProgress(p), 0) / (filteredProjects.length || 1)).toFixed(1)),
          '',
          `${summaryMetrics.delayedCount} Delayed PPAs`,
          '',
          '',
          '',
          '',
          summaryMetrics.tamperedCount > 0 ? `${summaryMetrics.tamperedCount} Integrity Alerts` : '100% Cryptographically Verified',
          '',
          '',
        ],
      ];

      // -------------------------------------------------------------
      // Sheet 3: Budget Allocation by Category
      // -------------------------------------------------------------
      const categorySheetData = [
        [
          'Item No.',
          'Category / Sector',
          'Active Projects Count',
          'Approved Budget (PHP)',
          'Released Funds - SARO (PHP)',
          'Disbursed Funds - NCA (PHP)',
          'Remaining Balance (PHP)',
          'Financial Utilization Rate (%)',
        ],
        ...budgetAllocationByCategory.map((c, idx) => {
          const bal = Math.max(0, c.totalBudget - c.disbursedNCA);
          const rate = c.allocatedSARO > 0 ? (c.disbursedNCA / c.allocatedSARO) * 100 : c.totalBudget > 0 ? (c.disbursedNCA / c.totalBudget) * 100 : 0;
          return [
            idx + 1,
            c.category,
            c.projectCount,
            c.totalBudget,
            c.allocatedSARO,
            c.disbursedNCA,
            bal,
            Number(rate.toFixed(1)),
          ];
        }),
        [
          'TOTALS',
          'MUNICIPAL TOTALS',
          filteredProjects.length,
          summaryMetrics.totalBudget,
          summaryMetrics.totalAllocatedSARO,
          summaryMetrics.totalDisbursedNCA,
          summaryMetrics.remainingBalance,
          Number(summaryMetrics.budgetUtilizationRate.toFixed(1)),
        ],
      ];

      // -------------------------------------------------------------
      // Sheet 4: Transactions Ledger (Based on System Transactions)
      // -------------------------------------------------------------
      const totalTxVolume = filteredTransactions.reduce((acc, t) => acc + (t.amount || 0), 0);
      const txSheetData = [
        [
          'Voucher / Transaction ID',
          'Project ID',
          'Project Name',
          'Category',
          'Transaction Type',
          'Amount (PHP)',
          'Status',
          'Recorded By Role',
          'Date',
          'Blockchain Transaction Hash',
          'Multi-Sig Consensus State',
        ],
        ...filteredTransactions.map((tx) => [
          tx.id,
          tx.projectId,
          tx.projectName,
          tx.projectCategory || 'General',
          tx.type,
          tx.amount || 0,
          tx.status,
          tx.recordedByRole || 'Municipal Treasurer',
          tx.date,
          tx.hash || 'On-Chain Pending',
          tx.status === 'Executed' || tx.status === 'Completed' ? '2/2 Signed (Executed On-Chain)' : tx.status === '1/2 Signed' ? '1/2 Signed (Pending Treasurer)' : 'Rejected at Gate',
        ]),
        [
          'TOTAL TRANSACTION VOLUME',
          `${filteredTransactions.length} Transactions`,
          '',
          '',
          '',
          totalTxVolume,
          '',
          '',
          '',
          'Verified by Smart Contract Consensus',
          '',
        ],
      ];

      // -------------------------------------------------------------
      // Sheet 5: Milestones Schedule (Based on System Milestones)
      // -------------------------------------------------------------
      const milestonesSheetData = [
        [
          'Item No.',
          'Project ID',
          'Project Name',
          'Milestone Deliverable',
          'Scope Description',
          'Percentage Weight (%)',
          'Target Due Date',
          'Actual Date Verified',
          'Schedule Health',
          'Verification Status',
          'Verified By Role',
          'Evidence Geotag Hash',
        ],
        ...filteredMilestones.map((m, idx) => {
          const delayed = isMilestoneDelayed(m);
          return [
            idx + 1,
            m.projectId,
            m.projectName,
            m.title,
            m.description || 'N/A',
            m.percentage,
            m.dueDate || 'N/A',
            m.dateVerified || 'Pending Inspection',
            delayed ? 'DELAYED' : 'ON SCHEDULE',
            m.status,
            m.verifiedByRole || 'MPDC Coordinator',
            (m as any).evidenceHash || 'SHA-256 Geotag Verified',
          ];
        }),
      ];

      // -------------------------------------------------------------
      // Sheet 6: Audit & Variance Findings (System Discrepancies)
      // -------------------------------------------------------------
      const auditExceptionSheetData = [
        [
          'Item No.',
          'Project ID',
          'Project Name',
          'Sector & Location',
          'Approved Budget (PHP)',
          'Disbursed Funds (PHP)',
          'Physical Delivery (%)',
          'Financial Utilization Rate (%)',
          'Variance Delta (%)',
          'System Anomaly Category',
          'Risk Level',
          'Audit Finding',
          'Recommended Action',
        ],
        ...auditDiscrepancyProjects.map((row, idx) => [
          idx + 1,
          row.project.id,
          row.project.name,
          `${row.project.category || 'General'} - ${row.project.location || 'Santa Cruz'}`,
          row.project.totalBudget || 0,
          row.project.disbursedFunds || 0,
          row.physicalProgress,
          row.fundUtilization,
          row.variance,
          row.isTampered
            ? 'DATABASE BUDGET TAMPERED'
            : row.isOverDisbursed
              ? 'DISBURSEMENT AHEAD OF DELIVERY (>15%)'
              : row.isDelayed
                ? 'SCHEDULE DELAY'
                : 'COMPLIANT',
          row.riskLevel,
          row.auditFinding,
          row.recommendedAction,
        ]),
        [
          'TOTAL AUDIT FLAGS',
          '',
          `${flaggedVarianceCount} Flagged Projects Requiring Action`,
          '',
          summaryMetrics.totalBudget,
          summaryMetrics.totalDisbursedNCA,
          '',
          '',
          '',
          '',
          '',
          'Extracted from BayanLedger Audit Telemetry',
          '',
        ],
      ];

      const wb = XLSX.utils.book_new();
      const wsSummary = XLSX.utils.aoa_to_sheet(summarySheetData);
      const wsProjects = XLSX.utils.aoa_to_sheet(projectsSheetData);
      const wsCategory = XLSX.utils.aoa_to_sheet(categorySheetData);
      const wsTransactions = XLSX.utils.aoa_to_sheet(txSheetData);
      const wsMilestones = XLSX.utils.aoa_to_sheet(milestonesSheetData);
      const wsAuditExceptions = XLSX.utils.aoa_to_sheet(auditExceptionSheetData);

      // Auto-fit column widths across all sheets
      autoFitColumns(wsSummary, summarySheetData);
      autoFitColumns(wsProjects, projectsSheetData);
      autoFitColumns(wsCategory, categorySheetData);
      autoFitColumns(wsTransactions, txSheetData);
      autoFitColumns(wsMilestones, milestonesSheetData);
      autoFitColumns(wsAuditExceptions, auditExceptionSheetData);

      // Freeze header panes on data tables so column headers stay pinned
      wsProjects['!views'] = [{ state: 'frozen', ySplit: 1 }];
      wsCategory['!views'] = [{ state: 'frozen', ySplit: 1 }];
      wsTransactions['!views'] = [{ state: 'frozen', ySplit: 1 }];
      wsMilestones['!views'] = [{ state: 'frozen', ySplit: 1 }];
      wsAuditExceptions['!views'] = [{ state: 'frozen', ySplit: 1 }];

      // Append sheets based on system data
      XLSX.utils.book_append_sheet(wb, wsSummary, '1. Executive Summary');
      XLSX.utils.book_append_sheet(wb, wsProjects, '2. Projects Ledger');
      XLSX.utils.book_append_sheet(wb, wsCategory, '3. Category Breakdown');
      XLSX.utils.book_append_sheet(wb, wsTransactions, '4. Transactions Ledger');
      XLSX.utils.book_append_sheet(wb, wsMilestones, '5. Milestones Schedule');
      XLSX.utils.book_append_sheet(wb, wsAuditExceptions, '6. Audit & Variance Findings');

      const fileName = `BayanLedger_Municipal_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      showToast('System-based Excel report (.xlsx) downloaded successfully!');
    } catch (err) {
      console.error('Failed to export Excel:', err);
      alert('Failed to generate Excel report from system data.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  return (
    <div className="reports-analytics-page max-w-7xl mx-auto space-y-6 pt-1 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl bg-emerald-600 text-white shadow-xl animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium text-sm">{toastMessage}</span>
        </div>
      )}

      {/* ========================================================
          SECTION HEADER & EXPORT ACTIONS (DASHBOARD-ALIGNED)
      ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-slate-900 via-[#17212b] to-[#1e293b] p-6 rounded-xl text-white shadow-md">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live System Telemetry
            </span>
            <span className="text-xs text-slate-400">• Official Audit Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
            <BarChart3 className="w-7 h-7 text-blue-400" />
            Official Reports & Data Analytics
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            Santa Cruz Municipal Blockchain Transparency, Expenditure Telemetry, Earned Value Variance, and Multi-Sig Audit Ledgers.
          </p>
        </div>

        {/* Action Buttons: 1 Unified PDF Download + Enhanced Excel Export */}
        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          <Button
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-10 px-4 shadow-md transition-all cursor-pointer"
            title="Download unified official PDF report containing all visual graphs and comprehensive data tables"
          >
            {isExportingPDF ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span>{isExportingPDF ? 'Generating 3-Page PDF...' : 'Download PDF'}</span>
          </Button>

          <Button
            onClick={handleExportExcel}
            disabled={isExportingExcel}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-10 px-4 shadow-md transition-all cursor-pointer"
            title="Download enhanced multi-sheet Excel workbook with formatted tables, auto-fitted columns, and formulas"
          >
            {isExportingExcel ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            <span>{isExportingExcel ? 'Exporting...' : 'Export Excel (.xlsx)'}</span>
          </Button>
        </div>
      </div>

      {/* ========================================================
          AUDITOR'S FISCAL INTELLIGENCE & ANOMALY STRIP (DISTINCTIVE FEATURE)
      ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-100 dark:bg-[#141824] p-3.5 rounded-xl border border-slate-200 dark:border-[#1e2334]">
        {/* Discrepancy Alert */}
        <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white dark:bg-[#121520] border border-slate-200 dark:border-[#1e2334]">
          <div className={`p-2 rounded-lg ${flaggedVarianceCount > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'}`}>
            <AlertCircle className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
              <span>{flaggedVarianceCount} Discrepancies</span>
              {flaggedVarianceCount > 0 && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {flaggedVarianceCount > 0 ? 'Cash disbursed ahead of physical work' : 'Disbursements match delivery'}
            </p>
          </div>
        </div>

        {/* Schedule Delay Exposure */}
        <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white dark:bg-[#121520] border border-slate-200 dark:border-[#1e2334]">
          <div className={`p-2 rounded-lg ${summaryMetrics.delayedCount > 0 ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400'}`}>
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-800 dark:text-white">
              {summaryMetrics.delayedCount} Projects Delayed
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {summaryMetrics.delayedCount > 0 ? 'Exceeded milestone due dates' : 'All milestones on schedule'}
            </p>
          </div>
        </div>

        {/* Blockchain Integrity */}
        <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white dark:bg-[#121520] border border-slate-200 dark:border-[#1e2334]">
          <div className={`p-2 rounded-lg ${summaryMetrics.tamperedCount > 0 ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'}`}>
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-800 dark:text-white">
              {summaryMetrics.tamperedCount > 0 ? `${summaryMetrics.tamperedCount} Integrity Breaches` : '100% On-Chain Intact'}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {summaryMetrics.tamperedCount > 0 ? 'Smart contract budget mismatch' : 'Cryptographic hash verified'}
            </p>
          </div>
        </div>

        {/* Unallocated Appropriation Reserves */}
        <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white dark:bg-[#121520] border border-slate-200 dark:border-[#1e2334]">
          <div className="p-2 rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400">
            <Landmark className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-800 dark:text-white truncate">
              {formatCompactPHP(summaryMetrics.remainingBalance)} Reserve
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              Unexpended municipal appropriations
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================
          MULTI-DIMENSIONAL FILTER CONTROLS
      ======================================================== */}
      <Card className="border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#121520] shadow-sm">
        <CardHeader className="pb-3 pt-4 px-5 border-b border-slate-100 dark:border-[#1e2334]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                Multi-Dimensional Dataset Filter
              </CardTitle>
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-bold text-xs">
                  {activeFiltersCount} Active {activeFiltersCount === 1 ? 'Filter' : 'Filters'}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-3">
              {activeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="h-8 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Reset All Filters
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFiltersDrawer(!showFiltersDrawer)}
                className="h-8 w-8 p-0"
              >
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showFiltersDrawer ? 'rotate-180' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>

        {showFiltersDrawer && (
          <CardContent className="p-5 space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search projects by title, ID, barangay location, description, or SARO number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 bg-slate-50 dark:bg-[#181c2b] border-slate-200 dark:border-[#1e2334] text-sm focus-visible:ring-blue-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filter Grids */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Category / Sector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Sector / Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-[#1e2334] bg-slate-50 dark:bg-[#181c2b] text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">All Categories ({projects.length})</option>
                  {availableCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Project Status
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-[#1e2334] bg-slate-50 dark:bg-[#181c2b] text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="In Progress">In Progress / Active</option>
                  <option value="Completed">Completed</option>
                  <option value="Delayed">Schedule Delayed</option>
                  <option value="MPDC Approved">MPDC Approved</option>
                  <option value="SARO Approved - Pending Treasurer">SARO Approved</option>
                  <option value="On Hold">On Hold</option>
                </select>
              </div>

              {/* Date Range Preset */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Date Range Scope
                </label>
                <select
                  value={datePreset}
                  onChange={(e) => setDatePreset(e.target.value as DatePreset)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-[#1e2334] bg-slate-50 dark:bg-[#181c2b] text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Time Records</option>
                  <option value="30days">Last 30 Days</option>
                  <option value="90days">Last 90 Days</option>
                  <option value="thisYear">Current Fiscal Year</option>
                  <option value="custom">Custom Date Range...</option>
                </select>
              </div>

              {/* Budget Threshold */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Budget Threshold
                </label>
                <select
                  value={budgetFilter}
                  onChange={(e) => setBudgetFilter(e.target.value as BudgetFilter)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-[#1e2334] bg-slate-50 dark:bg-[#181c2b] text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Any Budget Amount</option>
                  <option value="under1m">Under ₱1,000,000</option>
                  <option value="1mTo5m">₱1M to ₱5M</option>
                  <option value="5mTo20m">₱5M to ₱20M</option>
                  <option value="above20m">Above ₱20,000,000</option>
                </select>
              </div>

              {/* Integrity & Tampering */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Blockchain Integrity
                </label>
                <select
                  value={integrityFilter}
                  onChange={(e) => setIntegrityFilter(e.target.value as IntegrityFilter)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-[#1e2334] bg-slate-50 dark:bg-[#181c2b] text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Projects</option>
                  <option value="verified">Verified On-Chain Only</option>
                  <option value="tampered">Flagged / Tampered Only</option>
                </select>
              </div>
            </div>

            {/* Custom Date Inputs */}
            {datePreset === 'custom' && (
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-[#1e2334] animate-in fade-in duration-150">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">From:</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="h-8 px-2.5 rounded-md border border-slate-200 dark:border-[#1e2334] bg-slate-50 dark:bg-[#181c2b] text-xs text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">To:</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="h-8 px-2.5 rounded-md border border-slate-200 dark:border-[#1e2334] bg-slate-50 dark:bg-[#181c2b] text-xs text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>
            )}

            {/* Filter Scope Summary */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex flex-wrap items-center gap-2">
                <span>Dataset:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {filteredProjects.length} of {projects.length} Projects
                </span>
                <span>•</span>
                <span>Transactions:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {filteredTransactions.length} records
                </span>
                <span>•</span>
                <span>Milestones:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {filteredMilestones.length} deliverables
                </span>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ========================================================
          1. EXECUTIVE SUMMARY KPIS STRIP (DASHBOARD-ALIGNED)
      ======================================================== */}
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
                {summaryMetrics.totalProjects} Projects Evaluated
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
              Gate 1 Legal & Budget Commitment
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

      {/* ========================================================
          NAVIGATION TABS (WITH AUDIT & VARIANCE FINDINGS TAB)
      ======================================================== */}
      <div className="flex flex-wrap border-b border-slate-200 dark:border-[#1e2334] gap-2">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${activeTab === 'analytics'
            ? 'border-blue-600 text-blue-600 dark:text-blue-400'
            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
        >
          <BarChart3 className="h-4 w-4" />
          Analytics & Visual Telemetry (6 Graphs)
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${activeTab === 'audit'
            ? 'border-amber-600 text-amber-600 dark:text-amber-400'
            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
        >
          <AlertCircle className="h-4 w-4" />
          <span>Audit & Variance Findings</span>
          {flaggedVarianceCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              {flaggedVarianceCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('projects')}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${activeTab === 'projects'
            ? 'border-blue-600 text-blue-600 dark:text-blue-400'
            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
        >
          <Layers className="h-4 w-4" />
          Projects Audit Ledger ({filteredProjects.length})
        </button>

        <button
          onClick={() => setActiveTab('transactions')}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${activeTab === 'transactions'
            ? 'border-blue-600 text-blue-600 dark:text-blue-400'
            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
        >
          <TrendingUp className="h-4 w-4" />
          SARO & NCA Ledger ({filteredTransactions.length})
        </button>

        <button
          onClick={() => setActiveTab('milestones')}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${activeTab === 'milestones'
            ? 'border-blue-600 text-blue-600 dark:text-blue-400'
            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
        >
          <Clock className="h-4 w-4" />
          Milestones Schedule ({filteredMilestones.length})
        </button>
      </div>

      {/* ========================================================
          TAB 1: ANALYTICS & VISUAL TELEMETRY (ALL 6 CHARTS)
      ======================================================== */}
      {activeTab === 'analytics' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* ROW 1: GRAPHS 1 & 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Graph 1: Budget Allocation by Category */}
            <Card className="border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#121520] shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-[#1e2334]">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      1. Municipal Budget Allocation by Category
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Distribution of approved municipal appropriations vs. SARO released funds
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-xs bg-slate-100 dark:bg-[#181c2b] text-slate-700 dark:text-slate-300">
                    {budgetAllocationByCategory.length} Sectors
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {budgetAllocationByCategory.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-slate-400 text-xs italic">
                    No sector budget data available.
                  </div>
                ) : (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={budgetAllocationByCategory} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridLineColor} vertical={false} />
                        <XAxis dataKey="category" tick={{ fontSize: 11, fill: axisTickColor }} interval={0} angle={-15} textAnchor="end" />
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
                    <span>Total Approved Budget (₱)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-amber-500" />
                    <span>SARO Allotment (₱)</span>
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
                      Comparing Allocated Budget, Released (SARO), Actual Disbursed (NCA), and Balance
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                    Fiscal Ledger
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

          {/* ROW 2: GRAPHS 3 & 4 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Graph 3: Monthly Budget Release Trend */}
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

          {/* ROW 3: GRAPHS 5 & 6 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Graph 5: Project Implementation Status */}
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
                  <Badge variant="secondary" className="text-xs bg-slate-100 dark:bg-[#181c2b] text-slate-700 dark:text-slate-300">
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

            {/* Graph 6: Transaction Monitoring & Security Telemetry */}
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

          {/* SMART CONTRACT RELEASES SUMMARY FOOTER */}
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
        </div>
      )}

      {/* ========================================================
          TAB 2: AUDIT & VARIANCE FINDINGS (SPECIAL OVERSIGHT TAB)
      ======================================================== */}
      {activeTab === 'audit' && (
        <Card className="border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#121520] shadow-sm animate-in fade-in duration-200">
          <CardHeader className="border-b border-slate-100 dark:border-[#1e2334] pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  Fiscal Variance & Audit Findings Inspection
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Early detection of projects where financial disbursements outpace physical deliverables or violate on-chain integrity.
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className={`font-semibold text-xs ${flaggedVarianceCount > 0 ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300'}`}
              >
                {flaggedVarianceCount} Requiring Action
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-[#181c2b] text-slate-600 dark:text-slate-400 text-xs uppercase font-semibold border-b border-slate-200 dark:border-[#1e2334]">
                <tr>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Sector</th>
                  <th className="py-3 px-4 text-center">Physical Delivery</th>
                  <th className="py-3 px-4 text-center">Disbursed (NCA)</th>
                  <th className="py-3 px-4 text-center">Variance Delta</th>
                  <th className="py-3 px-4 text-center">Risk Exposure</th>
                  <th className="py-3 px-4">Audit Finding & Recommended Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1e2334]">
                {auditDiscrepancyProjects.map((row) => {
                  return (
                    <tr
                      key={row.project.id}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${row.isTampered
                        ? 'bg-red-50/30 dark:bg-red-950/15'
                        : row.isOverDisbursed
                          ? 'bg-amber-50/30 dark:bg-amber-950/15'
                          : ''
                        }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white leading-tight">
                          {row.project.name}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                          ID: {row.project.id}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                        {row.project.category || 'General'}
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-blue-600 dark:text-blue-400">
                        {row.physicalProgress}%
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-emerald-600 dark:text-emerald-400">
                        {row.fundUtilization}%
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold ${row.variance > 15
                            ? 'border-red-500 text-red-600 bg-red-50 dark:bg-red-950/30'
                            : row.variance < 0
                              ? 'border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
                              : 'border-slate-400 text-slate-600'
                            }`}
                        >
                          {row.variance > 0 ? `+${row.variance}%` : `${row.variance}%`}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] font-bold ${row.riskLevel === 'HIGH'
                            ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                            : row.riskLevel === 'MODERATE'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            }`}
                        >
                          {row.riskLevel}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className={`font-semibold ${row.isTampered ? 'text-red-600 dark:text-red-400' : row.isOverDisbursed ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          {row.auditFinding}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Action: {row.recommendedAction}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* ========================================================
          TAB 3: PROJECTS AUDIT LEDGER (WITH EXPANDABLE DELIVERABLES)
      ======================================================== */}
      {activeTab === 'projects' && (
        <Card className="border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#121520] shadow-sm animate-in fade-in duration-200">
          <CardHeader className="border-b border-slate-100 dark:border-[#1e2334] pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                  Filtered Projects Audit Ledger
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                  Listing of municipal projects matching current filter parameters with expandable milestone evidence.
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-semibold text-xs">
                {filteredProjects.length} Projects Shown
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {filteredProjects.length === 0 ? (
              <div className="py-16 text-center text-slate-500">
                <AlertTriangle className="h-8 w-8 mx-auto text-amber-500 mb-2" />
                <p className="font-medium text-base">No projects match the selected filters</p>
                <p className="text-xs mt-1">Try broadening your search term or filter parameters.</p>
                <Button variant="outline" size="sm" onClick={resetFilters} className="mt-4">
                  Reset All Filters
                </Button>
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-[#181c2b] text-slate-600 dark:text-slate-400 text-xs uppercase font-semibold border-b border-slate-200 dark:border-[#1e2334]">
                  <tr>
                    <th className="py-3 px-4">Project</th>
                    <th className="py-3 px-4">Sector & Location</th>
                    <th className="py-3 px-4 text-right">Approved Budget</th>
                    <th className="py-3 px-4 text-right">NCA Disbursed</th>
                    <th className="py-3 px-4 text-center">Progress</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Integrity</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1e2334]">
                  {filteredProjects.map((p) => {
                    const isTampered = checkIsTampered(p);
                    const isDelayed = isProjectDelayed(p);
                    const progress = calculateProgress(p);
                    const isExpanded = expandedProjectId === p.id;

                    return (
                      <React.Fragment key={p.id}>
                        <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900 dark:text-white leading-tight">
                              {p.name}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                              <span>ID: {p.id}</span>
                              {p.saro && (
                                <>
                                  <span>•</span>
                                  <span className="text-amber-600 dark:text-amber-400 font-mono">SARO: {p.saro}</span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                              {p.category || 'General'}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <MapPin className="h-3 w-3" />
                              {p.location || 'Santa Cruz, Laguna'}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-slate-900 dark:text-white">
                            {formatPHP(p.totalBudget || 0)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="font-medium text-emerald-600 dark:text-emerald-400">
                              {formatPHP(p.disbursedFunds || 0)}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {p.totalBudget > 0 ? `${(((p.disbursedFunds || 0) / p.totalBudget) * 100).toFixed(0)}%` : '0%'}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="w-20 mx-auto">
                              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                {progress}%
                              </div>
                              <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                                <div
                                  className="h-full bg-blue-600 dark:bg-blue-500 rounded-full"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant="outline"
                              className={`text-[11px] ${isDelayed
                                ? 'border-rose-500 text-rose-600 bg-rose-50 dark:bg-rose-950/30'
                                : p.status === 'Completed'
                                  ? 'border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
                                  : 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/30'
                                }`}
                            >
                              {isDelayed ? 'Delayed' : p.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            {isTampered ? (
                              <Badge variant="destructive" className="text-[10px] gap-1 bg-rose-600">
                                <AlertTriangle className="h-3 w-3" /> Tampered
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] gap-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                                <ShieldCheck className="h-3 w-3 text-emerald-600" /> Verified
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setExpandedProjectId(isExpanded ? null : p.id)}
                              className="h-7 px-2.5 text-xs font-medium"
                            >
                              {isExpanded ? 'Hide' : 'Milestones'}
                            </Button>
                          </td>
                        </tr>

                        {/* Expanded Milestones Row */}
                        {isExpanded && (
                          <tr className="bg-slate-50/90 dark:bg-[#181c2b]/50">
                            <td colSpan={8} className="p-4 border-b border-slate-200 dark:border-[#1e2334]">
                              <div className="pl-4 border-l-2 border-blue-500 space-y-2">
                                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                  Milestone Deliverables & Physical Evidence ({p.milestones?.length || 0})
                                </div>
                                {p.milestones && p.milestones.length > 0 ? (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                                    {p.milestones.map((m) => (
                                      <div
                                        key={m.id}
                                        className="p-3 rounded-lg border border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#121520] text-xs space-y-1"
                                      >
                                        <div className="font-semibold text-slate-900 dark:text-white flex items-center justify-between">
                                          <span>{m.title}</span>
                                          <span className="text-blue-600 font-mono font-bold">{m.percentage}%</span>
                                        </div>
                                        <div className="text-slate-500 text-[11px] line-clamp-2">
                                          {m.description || 'No description provided.'}
                                        </div>
                                        <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                                          <span>Due: {m.dueDate || 'N/A'}</span>
                                          <Badge
                                            variant="secondary"
                                            className={`text-[9px] px-1 py-0 ${m.status === 'Verified' || m.status === 'Paid'
                                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                                              }`}
                                          >
                                            {m.status}
                                          </Badge>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-500">No milestones assigned to this project yet.</p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {/* ========================================================
          TAB 4: ALLOTMENTS & DISBURSEMENTS TRANSACTIONS
      ======================================================== */}
      {activeTab === 'transactions' && (
        <Card className="border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#121520] shadow-sm animate-in fade-in duration-200">
          <CardHeader className="border-b border-slate-100 dark:border-[#1e2334] pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                  SARO & NCA Financial Ledger
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                  All blockchain-notarized allotments and disbursement releases for filtered projects.
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-semibold text-xs">
                {filteredTransactions.length} Transactions
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {filteredTransactions.length === 0 ? (
              <div className="py-16 text-center text-slate-500">
                <AlertTriangle className="h-8 w-8 mx-auto text-amber-500 mb-2" />
                <p className="font-medium text-base">No transaction records found</p>
                <p className="text-xs mt-1">Try clearing or relaxing your filter selection.</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-[#181c2b] text-slate-600 dark:text-slate-400 text-xs uppercase font-semibold border-b border-slate-200 dark:border-[#1e2334]">
                  <tr>
                    <th className="py-3 px-4">Transaction ID</th>
                    <th className="py-3 px-4">Project</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Recorded Role</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Blockchain Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1e2334]">
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 dark:text-white">
                        {tx.id}
                      </td>
                      <td className="py-3 px-4 font-medium text-xs text-slate-800 dark:text-slate-200">
                        {tx.projectName}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${tx.type === 'Allocation (SARO)'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                            }`}
                        >
                          {tx.type}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900 dark:text-white">
                        {formatPHP(tx.amount)}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${tx.status === 'Executed' || tx.status === 'Completed'
                            ? 'border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
                            : tx.status?.includes('Rejected')
                              ? 'border-rose-500 text-rose-600 bg-rose-50 dark:bg-rose-950/30'
                              : 'border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/30'
                            }`}
                        >
                          {tx.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">
                        {tx.recordedByRole}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {tx.date}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500" title={tx.hash}>
                        {tx.hash ? `${tx.hash.substring(0, 10)}...${tx.hash.substring(tx.hash.length - 6)}` : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {/* ========================================================
          TAB 5: MILESTONES SCHEDULE & VERIFICATION TRACKER
      ======================================================== */}
      {activeTab === 'milestones' && (
        <Card className="border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#121520] shadow-sm animate-in fade-in duration-200">
          <CardHeader className="border-b border-slate-100 dark:border-[#1e2334] pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                  Physical Milestone Schedule & Verification Tracker
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                  Deliverables, completion percentages, MPDC inspection dates, and payment clearance status.
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-semibold text-xs">
                {filteredMilestones.length} Milestones Tracked
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {filteredMilestones.length === 0 ? (
              <div className="py-16 text-center text-slate-500">
                <AlertTriangle className="h-8 w-8 mx-auto text-amber-500 mb-2" />
                <p className="font-medium text-base">No milestones found for current filter selection</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-[#181c2b] text-slate-600 dark:text-slate-400 text-xs uppercase font-semibold border-b border-slate-200 dark:border-[#1e2334]">
                  <tr>
                    <th className="py-3 px-4">Project</th>
                    <th className="py-3 px-4">Milestone Deliverable</th>
                    <th className="py-3 px-4 text-center">Weight</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4">Schedule Health</th>
                    <th className="py-3 px-4">Verification</th>
                    <th className="py-3 px-4">Verified Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1e2334]">
                  {filteredMilestones.map((m, idx) => {
                    const delayed = isMilestoneDelayed(m);
                    return (
                      <tr key={`${m.projectId}-${idx}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-medium text-xs text-slate-800 dark:text-slate-200">
                          {m.projectName}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-xs text-slate-900 dark:text-white">{m.title}</div>
                          {m.description && (
                            <div className="text-[11px] text-slate-500 line-clamp-1">{m.description}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-semibold text-xs text-blue-600 dark:text-blue-400">
                          {m.percentage}%
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500">
                          {m.dueDate || 'N/A'}
                        </td>
                        <td className="py-3 px-4">
                          {delayed ? (
                            <Badge variant="destructive" className="text-[10px]">
                              Delayed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30">
                              On Track
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant="secondary"
                            className={`text-[10px] ${m.status === 'Verified' || m.status === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                              }`}
                          >
                            {m.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500">
                          {m.dateVerified || 'Pending Inspection'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ReportsAnalytics;
