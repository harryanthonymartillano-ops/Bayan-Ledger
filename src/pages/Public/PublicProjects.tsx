import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBlockchain, ProjectStatus } from '../../context/BlockchainContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Database,
  FileCheck2,
  FolderGit2,
  MapPin,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { TamperingDetectedBadge } from '../../components/security/TamperingDetectedBadge';
import { getContract, getReadOnlyWeb3Provider } from '../../lib/web3';
import { isProjectTampered } from '../../lib/projectIntegrity';
import { isProjectDelayed } from '../../lib/scheduleStatus';
import { readStoredChainBudgets, updateStoredChainBudget } from '../../lib/chainBudgetCache';

const ITEMS_PER_PAGE = 9;

type ChainBudgetSnapshot = {
  totalBudget: number;
};

export const PublicProjects = () => {
  const { projects, chainBudgets: contextChainBudgets } = useBlockchain();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [chainBudgets, setChainBudgets] = useState<Record<string, ChainBudgetSnapshot>>(() => {
    const cached = readStoredChainBudgets();
    return Object.entries(cached).reduce<Record<string, ChainBudgetSnapshot>>((acc, [id, totalBudget]) => {
      acc[id] = { totalBudget };
      return acc;
    }, {});
  });

  useEffect(() => {
    if (!contextChainBudgets) return;
    setChainBudgets((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [id, totalBudget] of Object.entries(contextChainBudgets)) {
        if (typeof totalBudget === 'number' && (!next[id] || next[id].totalBudget !== totalBudget)) {
          next[id] = { totalBudget };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [contextChainBudgets]);

  const usedCategories = useMemo(() => {
    return Array.from(
      new Set(
        projects
          .map((project) => project.category?.trim())
          .filter((category): category is string => Boolean(category))
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [projects]);

  const categoryOptions = useMemo(() => ['All', ...usedCategories], [usedCategories]);

  const filteredProjects = projects.filter((project) => {
    const normalizedSearch = searchTerm.toLowerCase();
    const matchesSearch =
      project.name.toLowerCase().includes(normalizedSearch) ||
      project.location.toLowerCase().includes(normalizedSearch) ||
      project.id.toLowerCase().includes(normalizedSearch);
    const matchesCategory = selectedCategory === 'All' || project.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const totalPages = Math.ceil(filteredProjects.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentProjects = filteredProjects.slice(startIndex, endIndex);
  const visibleProjectIds = currentProjects.map((project) => project.id).join('|');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatCompactCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
  };

  const getPercent = (value: number, total: number) => {
    if (total <= 0) return 0;
    return Math.min(100, Math.round((value / total) * 100));
  };

  const portalMetrics = useMemo(() => {
    const totalBudget = filteredProjects.reduce((sum, project) => sum + project.totalBudget, 0);
    const allocatedFunds = filteredProjects.reduce((sum, project) => sum + project.allocatedFunds, 0);
    const disbursedFunds = filteredProjects.reduce((sum, project) => sum + project.disbursedFunds, 0);
    const activeProjects = filteredProjects.filter((project) =>
      ['ACTIVE', 'In Progress'].includes(project.status)
    ).length;
    const delayedProjects = filteredProjects.filter(isProjectDelayed).length;
    const verifiedMilestones = filteredProjects.reduce(
      (sum, project) =>
        sum +
        project.milestones.filter(
          (milestone) => milestone.status === 'Verified' || milestone.status === 'Paid'
        ).length,
      0
    );

    return {
      totalBudget,
      allocatedFunds,
      disbursedFunds,
      activeProjects,
      delayedProjects,
      verifiedMilestones,
      allocationRate: getPercent(allocatedFunds, totalBudget),
      disbursementRate: getPercent(disbursedFunds, allocatedFunds),
    };
  }, [filteredProjects]);

  const tamperedProjects = useMemo(() => {
    return projects.filter((project) => {
      const chainSnapshot = chainBudgets[project.id];
      if (!chainSnapshot) return false;
      return isProjectTampered(project.totalBudget, chainSnapshot.totalBudget);
    });
  }, [projects, chainBudgets]);

  useEffect(() => {
    let isMounted = true;

    const loadChainBudgets = async () => {
      if (projects.length === 0) {
        if (isMounted) {
          setChainBudgets({});
        }
        return;
      }

      const provider = getReadOnlyWeb3Provider();
      if (!provider) {
        return;
      }

      try {
        const contract = await getContract(provider);
        const snapshots = await Promise.all(
          projects.map(async (project) => {
            try {
              const chainProject = await contract.projects(project.id);
              const exists = Boolean(chainProject.exists ?? chainProject[14]);
              if (!exists) {
                return [project.id, null] as const;
              }

              const totalBudget = Number(chainProject.totalBudget ?? chainProject[2] ?? 0);
              return [project.id, { totalBudget }] as const;
            } catch {
              return [project.id, null] as const;
            }
          })
        );

        if (!isMounted) {
          return;
        }

        setChainBudgets((prev) => {
          const next = { ...prev };

          for (const [projectId, snapshot] of snapshots) {
            if (snapshot) {
              next[projectId] = snapshot;
              updateStoredChainBudget(projectId, snapshot.totalBudget);
            }
          }

          return next;
        });
      } catch (error) {
        console.warn('Unable to verify project budgets against Sepolia.', error);
      }
    };

    loadChainBudgets();

    return () => {
      isMounted = false;
    };
  }, [projects]);

  useEffect(() => {
    if (selectedCategory !== 'All' && !usedCategories.includes(selectedCategory)) {
      setSelectedCategory('All');
      setCurrentPage(1);
    }
  }, [selectedCategory, usedCategories]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    setCurrentPage(1);
  };

  const getStatusBadge = (status: ProjectStatus) => {
    switch (status) {
      case 'Completed':
        return <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-50">Completed</Badge>;
      case 'In Progress':
        return <Badge className="bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-50">Ongoing</Badge>;
      case 'ACTIVE':
        return <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-50">Active</Badge>;
      case 'SARO Approved - Pending Treasurer':
        return <Badge className="bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-50">Pending Treasurer</Badge>;
      case 'MPDC Approved':
        return <Badge className="bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100">MPDC Approved</Badge>;
      case 'Rejected - Budget Officer':
        return <Badge variant="destructive">Rejected by Budget</Badge>;
      case 'Rejected - Treasurer':
        return <Badge variant="destructive">Rejected by Treasury</Badge>;
      case 'On Hold':
        return <Badge variant="destructive">On Hold</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const registryStats = [
    {
      label: 'Visible Budget',
      value: formatCompactCurrency(portalMetrics.totalBudget),
      detail: `${filteredProjects.length} project${filteredProjects.length === 1 ? '' : 's'} in view`,
      icon: Banknote,
    },
    {
      label: 'SARO Obligated',
      value: `${portalMetrics.allocationRate}%`,
      detail: formatCompactCurrency(portalMetrics.allocatedFunds),
      icon: ShieldCheck,
    },
    {
      label: 'NCA Disbursed',
      value: `${portalMetrics.disbursementRate}%`,
      detail: formatCompactCurrency(portalMetrics.disbursedFunds),
      icon: Activity,
    },
    {
      label: 'Verified Milestones',
      value: portalMetrics.verifiedMilestones.toString(),
      detail:
        portalMetrics.delayedProjects > 0
          ? `${portalMetrics.delayedProjects} delayed project${portalMetrics.delayedProjects === 1 ? '' : 's'}`
          : `${portalMetrics.activeProjects} active or ongoing`,
      icon: FileCheck2,
    },
  ];

  return (
    <div className="bg-[#fafaf9] min-h-[calc(100vh-4rem)]">
      {/* Clean Naga-Inspired Page Header */}
      <section className="border-b border-slate-200 bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                <FolderGit2 className="h-4 w-4 text-sky-700" />
                <span>Annual Budget Registry</span>
              </div>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Public Projects & Budget Allocation
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                This registry lists the Municipality of Santa Cruz's programs, projects, and activities —
                what each is for, which office runs it, how much it costs, and the cryptographic receipts
                verifying contractor disbursements.
              </p>
            </div>

            {/* Scope Badge */}
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-right">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Projects</p>
                <p className="text-2xl font-extrabold text-slate-900">{projects.length}</p>
              </div>
            </div>
          </div>

          {/* Clean Metric Cards Cluster */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {registryStats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{stat.label}</p>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900">{stat.value}</p>
                  <p className="mt-1 text-xs text-slate-500">{stat.detail}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Filter and List Section */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Clean Filter Toolbar */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder="Search by project title, ID, or barangay location..."
                className="h-10 w-full rounded-lg border-slate-200 bg-slate-50 pl-9 pr-8 text-xs font-medium focus-visible:ring-slate-400"
                value={searchTerm}
                onChange={(event) => handleSearch(event.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => handleSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700"
                  aria-label="Clear Search"
                >
                  <span className="text-xs font-bold">✕</span>
                </button>
              )}
            </div>

            {/* Category Dropdown */}
            <select
              className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 outline-none transition-colors focus:border-slate-400 sm:w-56"
              value={selectedCategory}
              onChange={(event) => handleCategoryChange(event.target.value)}
            >
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category === 'All' ? 'All Priority Sectors' : category}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>Showing <strong className="text-slate-900">{filteredProjects.length}</strong> project{filteredProjects.length === 1 ? '' : 's'}</span>
            {searchTerm && <span>matching "<strong className="text-slate-900">{searchTerm}</strong>"</span>}
            {selectedCategory !== 'All' && <span>in sector <strong className="text-slate-900">{selectedCategory}</strong></span>}
          </div>
        </div>

        {/* Tampering Detection Alert Banner */}
        {tamperedProjects.length > 0 && (
          <div className="mt-6 rounded-2xl border-2 border-red-500 bg-red-50/90 p-5 shadow-sm text-red-950">
            <div className="flex items-start gap-3.5">
              <div className="rounded-xl bg-red-600 p-2.5 text-white shrink-0 mt-0.5 shadow-xs animate-pulse">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-black uppercase tracking-wider text-red-900">
                    Public Integrity Alert: Database Tampering Detected
                  </h3>
                  <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-bold uppercase text-white animate-pulse">
                    {tamperedProjects.length} Incident{tamperedProjects.length === 1 ? '' : 's'} Active
                  </span>
                </div>
                <p className="mt-1 text-xs text-red-800 leading-relaxed max-w-4xl">
                  A cryptographic verification mismatch was identified between the local municipal server records and the decentralized Sepolia blockchain ledger.
                  Direct database modifications bypassing multi-sig verification gates have been flagged.
                  The blockchain ledger value remains the authoritative public reference.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {tamperedProjects.map((tp) => (
                    <Link
                      key={tp.id}
                      to={`/project/${tp.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1 text-xs font-bold text-red-700 shadow-2xs hover:bg-red-50 transition-colors"
                    >
                      <span>{tp.name}</span>
                      <span className="text-[10px] font-mono text-red-500">({tp.id})</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Project Cards Grid */}
        {currentProjects.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {currentProjects.map((project) => {
              const allocationPercent = getPercent(project.allocatedFunds, project.totalBudget);
              const disbursementPercent = getPercent(project.disbursedFunds, project.allocatedFunds);
              const verifiedMilestones = project.milestones.filter(
                (milestone) => milestone.status === 'Verified' || milestone.status === 'Paid'
              ).length;
              const budgetIsTampered = isProjectTampered(
                project.totalBudget,
                chainBudgets[project.id]?.totalBudget ?? project.totalBudget
              );
              const projectDelayed = isProjectDelayed(project);

              return (
                <Link to={`/project/${project.id}`} key={project.id} className="group flex flex-col">
                  <Card
                    className={`relative flex-1 flex flex-col justify-between rounded-xl bg-white p-5 shadow-sm transition-all hover:shadow-md ${budgetIsTampered
                        ? 'border-2 border-red-500 ring-2 ring-red-100 bg-red-50/10'
                        : 'border border-slate-200 hover:border-slate-300'
                      }`}
                  >
                    <div className="space-y-3">
                      {/* Tampering Warning Banner clearly visible inside the tampered project card */}
                      {budgetIsTampered && (
                        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-800 animate-pulse">
                          <span className="flex items-center gap-1.5">
                            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                            <span>Tampering Detected: Budget Mismatch</span>
                          </span>
                          <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] uppercase font-bold text-white">
                            Alert
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-400">
                          {project.id}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {budgetIsTampered && (
                            <TamperingDetectedBadge visible={true} />
                          )}
                          {projectDelayed && (
                            <Badge variant="destructive" className="text-[10px] font-bold">
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              Delayed
                            </Badge>
                          )}
                          {getStatusBadge(project.status)}
                        </div>
                      </div>

                      <div>
                        <h3 className="line-clamp-2 text-base font-bold text-slate-900 group-hover:text-sky-700 transition-colors">
                          {project.name}
                        </h3>
                        <div className="mt-1.5 flex items-center text-xs text-slate-500">
                          <MapPin className="mr-1 h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="truncate">{project.location || 'Santa Cruz, Laguna'}</span>
                        </div>
                      </div>

                      {/* Clean Financial Progress Section */}
                      <div className="rounded-lg border border-slate-100 bg-[#fafaf9] p-3 space-y-2.5">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Budget</span>
                          <span className="text-sm font-extrabold text-slate-900">{formatCurrency(project.totalBudget)}</span>
                        </div>

                        {/* SARO Progress Bar */}
                        <div>
                          <div className="mb-1 flex justify-between text-[11px]">
                            <span className="text-slate-500">SARO Obligated</span>
                            <span className="font-semibold text-sky-700">{allocationPercent}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-sky-700 transition-all duration-300"
                              style={{ width: `${allocationPercent}%` }}
                            />
                          </div>
                        </div>

                        {/* NCA Progress Bar */}
                        <div>
                          <div className="mb-1 flex justify-between text-[11px]">
                            <span className="text-slate-500">NCA Disbursed</span>
                            <span className="font-semibold text-emerald-700">{disbursementPercent}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                              style={{ width: `${disbursementPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Clean Stats Ticker */}
                      <div className="grid grid-cols-3 gap-2 text-center pt-1">
                        <div className="rounded-md bg-slate-50 p-2">
                          <p className="text-xs font-bold text-slate-900">
                            {verifiedMilestones}/{project.milestones.length}
                          </p>
                          <p className="text-[10px] text-slate-400">Milestones</p>
                        </div>
                        <div className="rounded-md bg-slate-50 p-2">
                          <p className="text-xs font-bold text-slate-900">{project.documents.length}</p>
                          <p className="text-[10px] text-slate-400">Evidence</p>
                        </div>
                        <div className="rounded-md bg-slate-50 p-2">
                          <p className="text-xs font-bold text-slate-900">{project.transactions.length}</p>
                          <p className="text-[10px] text-slate-400">Receipts</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                      <span className="truncate max-w-[65%] text-slate-500 font-medium">
                        {project.category || project.budgetSource || 'Municipal Project'}
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-sky-700 group-hover:text-sky-900">
                        View Project <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : projects.length === 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-64 rounded-xl border border-slate-200 bg-white p-5 animate-pulse">
                <div className="h-4 w-1/3 bg-slate-200 rounded mb-4" />
                <div className="h-6 w-3/4 bg-slate-200 rounded mb-3" />
                <div className="h-4 w-1/2 bg-slate-100 rounded mb-6" />
                <div className="h-20 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-slate-400" />
            <p className="mt-3 text-lg font-bold text-slate-900">No projects match your filter</p>
            <p className="mt-1 text-xs text-slate-500">
              Try adjusting your search query or selecting "All Priority Sectors".
            </p>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('All');
                  setCurrentPage(1);
                }}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Reset Filters
              </button>
            </div>
          </div>
        )}

        {/* Clean Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-8 flex flex-col items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row">
            <p className="text-xs text-slate-500">
              Showing page <strong className="text-slate-900">{currentPage}</strong> of <strong className="text-slate-900">{totalPages}</strong>
            </p>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Prev</span>
              </button>

              {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`h-8 min-w-8 rounded-md px-2 text-xs font-semibold transition-colors ${currentPage === page
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  {page}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
