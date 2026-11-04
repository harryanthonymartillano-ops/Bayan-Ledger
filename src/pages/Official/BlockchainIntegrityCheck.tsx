import React, { useEffect, useState, useRef } from 'react';
import { useBlockchain, Project } from '../../context/BlockchainContext';
import { AlertCircle, CheckCircle2, AlertTriangle, ShieldCheck, Database, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { getContract, getReadOnlyWeb3Provider, withRpcFallback } from '../../lib/web3';
import { isProjectTampered } from '../../lib/projectIntegrity';
import { readStoredChainBudgets, getStoredChainBudget, updateStoredChainBudget } from '../../lib/chainBudgetCache';

interface IntegrityResult {
  projectId: string;
  dbBudget: number;
  chainBudget: number;
  dbDisbursed: number;
  chainDisbursed: number;
  dbMilestones: Array<{ id: string; status: string; onChainPaid?: boolean }>;
  chainMilestones: Array<{ id: string; isPaid: boolean }>;
  tampered: boolean;
  details: string[];
  errors: string[];
}

function withTimeout<T>(promise: Promise<T>, ms = 10000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('RPC call timeout')), ms)),
  ]);
}

async function mapConcurrent<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

const buildInitialChecks = (projectList: Project[]): IntegrityResult[] => {
  const cachedBudgets = readStoredChainBudgets();
  return projectList.map((project) => {
    const chainBudget = cachedBudgets[project.id] ?? Math.round(project.totalBudget);
    const dbBudget = project.totalBudget;
    const dbDisbursed = project.disbursedFunds || 0;
    const chainDisbursed = project.disbursedFunds || 0;
    const tampered = isProjectTampered(dbBudget, chainBudget) || isProjectTampered(dbDisbursed, chainDisbursed);

    return {
      projectId: project.id,
      dbBudget,
      chainBudget,
      dbDisbursed,
      chainDisbursed,
      dbMilestones: project.milestones || [],
      chainMilestones: [],
      tampered,
      details: tampered
        ? [`TOTAL BUDGET MISMATCH: Database=₱${dbBudget.toLocaleString()}, Blockchain=₱${chainBudget.toLocaleString()}`]
        : ['No discrepancies detected'],
      errors: [],
    };
  });
};

export const BlockchainIntegrityCheck: React.FC = () => {
  const { projects, contract, isWeb3Connected, connectToWeb3 } = useBlockchain();
  const [results, setResults] = useState<IntegrityResult[]>(() => buildInitialChecks(projects));
  const [loading, setLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const isAuditingRef = useRef(false);

  // Instantly populate results as soon as projects load
  useEffect(() => {
    if (projects.length > 0 && results.length === 0) {
      setResults(buildInitialChecks(projects));
    }
  }, [projects]);

  const checkIntegrity = async () => {
    if (isAuditingRef.current) return;
    isAuditingRef.current = true;
    setLoading(true);

    try {
      let activeContract: any = null;
      try {
        activeContract = await withRpcFallback(async (provider) => getContract(provider));
      } catch (e) {
        console.warn('Failed to initialize read-only contract, falling back to wallet', e);
      }

      if (!activeContract) {
        activeContract = contract;
      }

      if (!activeContract) {
        setConnectionError('Unable to connect to blockchain node. Please verify internet connection or connect wallet.');
        return;
      }

      setConnectionError(null);

      // Verify projects concurrently in batches of 4 to avoid browser RPC socket starvation
      const checks = await mapConcurrent(projects, 4, async (project) => {
        const errors: string[] = [];
        let chainDetails: any = null;
        const chainMilestones: any[] = [];
        let tampered = false;
        const details: string[] = [];

        try {
          try {
            if (typeof activeContract.projects === 'function') {
              chainDetails = await withTimeout(activeContract.projects(project.id), 10000);
            } else if (typeof activeContract.getProjectDetails === 'function') {
              chainDetails = await withTimeout(activeContract.getProjectDetails(project.id), 10000);
            }
          } catch (fetchErr: any) {
            console.error(`Blockchain query error for project ${project.id}:`, fetchErr);
            errors.push('Could not fetch project from blockchain');
          }

          const projectExists = Boolean(chainDetails?.exists ?? chainDetails?.[14] ?? false);

          if (projectExists && Array.isArray(project.milestones) && project.milestones.length > 0) {
            const relevantMilestones = project.milestones.filter(
              (m) => m.status === 'Paid' || m.status === 'Verified' || (project.disbursedFunds || 0) > 0
            );

            if (relevantMilestones.length > 0) {
              const msChecks = await Promise.all(
                relevantMilestones.map(async (m) => {
                  try {
                    let chainM: any = null;
                    if (typeof activeContract.projectMilestones === 'function') {
                      chainM = await withTimeout(activeContract.projectMilestones(project.id, m.id), 8000);
                    }
                    if (chainM) {
                      return { id: m.id, isPaid: Boolean(chainM.isPaid ?? chainM[3]) };
                    }
                  } catch {
                    // Fallback
                  }
                  return null;
                })
              );

              for (const mc of msChecks) {
                if (mc) chainMilestones.push(mc);
              }
            }
          } else if (chainDetails && Object.keys(chainDetails).length > 0 && !projectExists) {
            errors.push('Project not anchored on chain');
          }
        } catch (e) {
          errors.push('Blockchain fetch error: ' + (e as Error).message);
        }

        // Compare total budget
        const dbBudget = project.totalBudget;
        const rawBudget = chainDetails?.totalBudget ?? chainDetails?.[2];
        let chainBudget = getStoredChainBudget(project.id) ?? Math.round(project.totalBudget);
        if (rawBudget !== undefined && rawBudget !== null) {
          chainBudget = rawBudget.toNumber ? rawBudget.toNumber() : Number(rawBudget.toString());
          updateStoredChainBudget(project.id, chainBudget);
        }
        const projectExists = Boolean(chainDetails?.exists ?? chainDetails?.[14] ?? false);

        if (projectExists && isProjectTampered(dbBudget, chainBudget)) {
          tampered = true;
          details.push(`TOTAL BUDGET MISMATCH: Database=₱${dbBudget.toLocaleString()}, Blockchain=₱${chainBudget.toLocaleString()}`);
        }

        // Compare disbursed funds
        const dbDisbursed = project.disbursedFunds;
        const rawDisbursed = chainDetails?.disbursedFunds ?? chainDetails?.[4];
        const chainDisbursed =
          rawDisbursed !== undefined && rawDisbursed !== null
            ? (rawDisbursed.toNumber ? rawDisbursed.toNumber() : Number(rawDisbursed.toString()))
            : project.disbursedFunds;
        if (projectExists && isProjectTampered(dbDisbursed, chainDisbursed)) {
          tampered = true;
          details.push(`DISBURSED FUNDS MISMATCH: Database=₱${dbDisbursed.toLocaleString()}, Blockchain=₱${chainDisbursed.toLocaleString()}`);
        }

        // Compare milestones
        for (const dbM of project.milestones || []) {
          const chainM = chainMilestones.find((c) => c.id === dbM.id);
          if (chainM) {
            const dbIsPaid = dbM.status === 'Paid';
            if (dbIsPaid && !chainM.isPaid) {
              tampered = true;
              details.push(`MILESTONE ${dbM.id}: Marked Paid in DB but NOT on-chain`);
            } else if (!dbIsPaid && chainM.isPaid) {
              tampered = true;
              details.push(`MILESTONE ${dbM.id}: Paid on-chain but NOT marked in DB`);
            }
          }
        }

        if (errors.length === 0 && details.length === 0) {
          details.push('No discrepancies detected');
        }

        return {
          projectId: project.id,
          dbBudget,
          chainBudget,
          dbDisbursed,
          chainDisbursed,
          dbMilestones: project.milestones || [],
          chainMilestones,
          tampered,
          details,
          errors,
        };
      });

      setResults(checks);
    } finally {
      setLoading(false);
      isAuditingRef.current = false;
    }
  };

  useEffect(() => {
    if (projects.length > 0) {
      checkIntegrity();
    }
  }, [projects.length, contract, isWeb3Connected]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-800/60 shadow-xs">
              <ShieldCheck className="h-5 w-5" />
            </div>
            Blockchain Integrity Check
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
            Real-time cryptographic audit verifying that off-chain database records and immutable smart contract state are synchronized.
          </p>
        </div>

        <Button
          onClick={checkIntegrity}
          disabled={loading}
          variant="outline"
          className="h-9 px-4 text-xs font-semibold border-slate-200 dark:border-[#212638] bg-white dark:bg-[#141722] text-slate-700 dark:text-slate-200 shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Auditing...' : 'Re-verify Integrity'}
        </Button>
      </div>

      {/* Wallet Connection Warning */}
      {connectionError && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/80 dark:bg-red-950/40 p-4 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-red-900 dark:text-red-200">Connection Required</p>
            <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">{connectionError}</p>
          </div>
          {!isWeb3Connected && (
            <Button size="sm" onClick={connectToWeb3} className="bg-red-600 hover:bg-red-700 text-white shrink-0 text-xs">
              Connect Wallet
            </Button>
          )}
        </div>
      )}

      {/* Main Table Card */}
      <Card className="border-slate-200 dark:border-[#1e2334] shadow-sm overflow-hidden bg-white dark:bg-[#121520]">
        <CardHeader className="border-b border-slate-100 dark:border-[#1e2334] bg-slate-50/50 dark:bg-[#141824] p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                Ledger Verification Records
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Comparing local SQL database figures with live Sepolia Smart Contract storage.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {loading && results.length > 0 && (
                <Badge variant="outline" className="text-xs font-semibold border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400 animate-pulse flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Live Auditing...
                </Badge>
              )}
              {results.length > 0 && (
                <Badge variant="outline" className="text-xs font-semibold border-slate-200 dark:border-[#212638] text-slate-600 dark:text-slate-400">
                  {results.length} Projects Checked
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading && results.length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400">
              <RefreshCw className="w-7 h-7 mx-auto mb-3 animate-spin text-blue-600 dark:text-blue-400" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Querying Blockchain Nodes...</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Cross-referencing database transactions with smart contract storage.</p>
            </div>
          ) : results.length === 0 && !connectionError ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400">
              <p className="text-sm font-semibold">No projects available to verify.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-[#151926]">
                  <TableRow className="border-b border-slate-200 dark:border-[#1e2334]">
                    <TableHead className="text-xs font-bold text-slate-600 dark:text-slate-400 py-3.5 pl-6">Project ID</TableHead>
                    <TableHead className="text-right text-xs font-bold text-slate-600 dark:text-slate-400 py-3.5">Database Budget</TableHead>
                    <TableHead className="text-right text-xs font-bold text-slate-600 dark:text-slate-400 py-3.5">Chain Budget</TableHead>
                    <TableHead className="text-right text-xs font-bold text-slate-600 dark:text-slate-400 py-3.5">Database Disbursed</TableHead>
                    <TableHead className="text-right text-xs font-bold text-slate-600 dark:text-slate-400 py-3.5">Chain Disbursed</TableHead>
                    <TableHead className="text-center text-xs font-bold text-slate-600 dark:text-slate-400 py-3.5">Integrity State</TableHead>
                    <TableHead className="text-left text-xs font-bold text-slate-600 dark:text-slate-400 py-3.5 pr-6">Audit Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r) => {
                    const rowStatusBg = r.tampered
                      ? 'bg-red-50/50 dark:bg-red-950/20 hover:bg-red-50/80 dark:hover:bg-red-950/30 border-b border-red-200/60 dark:border-red-900/40'
                      : r.errors.length > 0
                        ? 'bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-50/80 dark:hover:bg-amber-950/30 border-b border-amber-200/60 dark:border-amber-900/40'
                        : 'hover:bg-slate-50/80 dark:hover:bg-[#181c2b] border-b border-slate-100 dark:border-[#1e2334]';

                    return (
                      <TableRow key={r.projectId} className={`transition-colors ${rowStatusBg}`}>
                        {/* Project ID */}
                        <TableCell className="py-3.5 pl-6 font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {r.projectId}
                        </TableCell>

                        {/* DB Budget */}
                        <TableCell className="py-3.5 text-right font-mono text-xs font-bold text-slate-900 dark:text-white">
                          ₱{r.dbBudget.toLocaleString()}
                        </TableCell>

                        {/* Chain Budget */}
                        <TableCell className={`py-3.5 text-right font-mono text-xs font-bold ${isProjectTampered(r.dbBudget, r.chainBudget) ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                          ₱{r.chainBudget.toLocaleString()}
                        </TableCell>

                        {/* DB Disbursed */}
                        <TableCell className="py-3.5 text-right font-mono text-xs font-bold text-slate-900 dark:text-white">
                          ₱{r.dbDisbursed.toLocaleString()}
                        </TableCell>

                        {/* Chain Disbursed */}
                        <TableCell className={`py-3.5 text-right font-mono text-xs font-bold ${isProjectTampered(r.dbDisbursed, r.chainDisbursed) ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                          ₱{r.chainDisbursed.toLocaleString()}
                        </TableCell>

                        {/* Status Badge */}
                        <TableCell className="py-3.5 text-center">
                          {r.tampered ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-700">
                              <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                              Desynced
                            </span>
                          ) : r.errors.length > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                              Sync Gap
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              Synchronized
                            </span>
                          )}
                        </TableCell>

                        {/* Audit Details */}
                        <TableCell className="py-3.5 pr-6">
                          <div className="space-y-1">
                            {r.details.map((d, i) => (
                              <div
                                key={i}
                                className={`text-xs font-medium ${r.tampered
                                    ? 'text-red-700 dark:text-red-300'
                                    : 'text-emerald-700 dark:text-emerald-300'
                                  }`}
                              >
                                {d}
                              </div>
                            ))}
                            {r.errors.map((e, i) => (
                              <div key={`err-${i}`} className="text-xs text-amber-700 dark:text-amber-300">
                                ℹ️ {e}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Guide Banner */}
      <div className="rounded-2xl border border-blue-200/80 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-950/30 p-4 text-xs sm:text-sm text-blue-900 dark:text-blue-200 space-y-2 shadow-2xs">
        <p className="font-bold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          How to Interpret Integrity Results:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-xs text-blue-800 dark:text-blue-300">
          <li><strong className="text-emerald-700 dark:text-emerald-400">Synchronized:</strong> Local database records match on-chain smart contract state (sub-peso centavo precision difference under ₱1.00 tolerated for integer blockchain storage).</li>
          <li><strong className="text-amber-700 dark:text-amber-400">Sync Gap:</strong> Unable to pull blockchain status for this item. Ensure your wallet has active RPC connection to Sepolia.</li>
          <li><strong className="text-red-700 dark:text-red-400">Desynced:</strong> Direct database modification detected bypassing multi-signature authority. Requires administrative review.</li>
        </ul>
      </div>
    </div>
  );
};

export default BlockchainIntegrityCheck;
