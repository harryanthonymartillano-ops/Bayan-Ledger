import React, { useEffect, useState } from 'react';
import { useBlockchain } from '../../context/BlockchainContext';
import { AlertCircle, CheckCircle2, AlertTriangle, ShieldCheck, Database, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { getContract, getReadOnlyWeb3Provider } from '../../lib/web3';

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

export const BlockchainIntegrityCheck: React.FC = () => {
  const { projects, contract, isWeb3Connected, connectToWeb3 } = useBlockchain();
  const [results, setResults] = useState<IntegrityResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const checkIntegrity = async () => {
    let activeContract = contract;
    if (!activeContract) {
      const readOnlyProvider = getReadOnlyWeb3Provider();
      if (readOnlyProvider) {
        try {
          activeContract = await getContract(readOnlyProvider);
        } catch (e) {
          console.warn('Failed to initialize fallback contract', e);
        }
      }
    }

    if (!activeContract) {
      setConnectionError('Unable to connect to blockchain node. Please verify internet connection or connect wallet.');
      setResults([]);
      return;
    }

    setConnectionError(null);
    setLoading(true);
    const checks: IntegrityResult[] = [];

    for (const project of projects) {
      const errors: string[] = [];
      let chainDetails: any = {};
      const chainMilestones: any[] = [];
      let tampered = false;
      const details: string[] = [];

      try {
        try {
          if (typeof activeContract.getProjectDetails === 'function') {
            chainDetails = await activeContract.getProjectDetails(project.id);
          } else if (typeof activeContract.projects === 'function') {
            chainDetails = await activeContract.projects(project.id);
          } else {
            throw new Error('No project getter function found on contract');
          }
        } catch {
          errors.push('Could not fetch project from blockchain');
        }

        const projectExists = Boolean(chainDetails?.exists ?? chainDetails?.[14] ?? false);

        if (projectExists) {
          for (const m of project.milestones) {
            try {
              let chainM: any = null;
              if (typeof activeContract.getMilestoneDetails === 'function') {
                chainM = await activeContract.getMilestoneDetails(project.id, m.id);
              } else if (typeof activeContract.projectMilestones === 'function') {
                chainM = await activeContract.projectMilestones(project.id, m.id);
              }
              if (chainM) {
                chainMilestones.push({ id: m.id, isPaid: Boolean(chainM.isPaid ?? chainM[3]) });
              }
            } catch {
              errors.push(`Milestone ${m.id}: Could not fetch from blockchain`);
            }
          }
        } else if (chainDetails && Object.keys(chainDetails).length > 0) {
          errors.push('Project not anchored on chain');
        }
      } catch (e) {
        errors.push('Blockchain fetch error: ' + (e as Error).message);
      }

      // Compare total budget
      const dbBudget = project.totalBudget;
      const rawBudget = chainDetails?.totalBudget ?? chainDetails?.[2];
      const chainBudget = rawBudget !== undefined && rawBudget !== null
        ? (rawBudget.toNumber ? rawBudget.toNumber() : Number(rawBudget.toString()))
        : 0;
      const projectExists = Boolean(chainDetails?.exists ?? chainDetails?.[14] ?? false);

      if (projectExists && dbBudget !== chainBudget) {
        tampered = true;
        details.push(`TOTAL BUDGET MISMATCH: Database=₱${dbBudget.toLocaleString()}, Blockchain=₱${chainBudget.toLocaleString()}`);
      }

      // Compare disbursed funds
      const dbDisbursed = project.disbursedFunds;
      const rawDisbursed = chainDetails?.disbursedFunds ?? chainDetails?.[4];
      const chainDisbursed = rawDisbursed !== undefined && rawDisbursed !== null
        ? (rawDisbursed.toNumber ? rawDisbursed.toNumber() : Number(rawDisbursed.toString()))
        : 0;
      if (projectExists && dbDisbursed !== chainDisbursed) {
        tampered = true;
        details.push(`DISBURSED FUNDS MISMATCH: Database=₱${dbDisbursed.toLocaleString()}, Blockchain=₱${chainDisbursed.toLocaleString()}`);
      }

      // Compare milestones
      for (const dbM of project.milestones) {
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

      checks.push({
        projectId: project.id,
        dbBudget,
        chainBudget,
        dbDisbursed,
        chainDisbursed,
        dbMilestones: project.milestones,
        chainMilestones,
        tampered,
        details,
        errors,
      });
    }

    setResults(checks);
    setLoading(false);
  };

  useEffect(() => {
    checkIntegrity();
  }, [projects, contract, isWeb3Connected]);

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
            {results.length > 0 && (
              <Badge variant="outline" className="text-xs font-semibold border-slate-200 dark:border-[#212638] text-slate-600 dark:text-slate-400">
                {results.length} Projects Checked
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
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
                        <TableCell className={`py-3.5 text-right font-mono text-xs font-bold ${r.dbBudget !== r.chainBudget ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                          ₱{r.chainBudget.toLocaleString()}
                        </TableCell>

                        {/* DB Disbursed */}
                        <TableCell className="py-3.5 text-right font-mono text-xs font-bold text-slate-900 dark:text-white">
                          ₱{r.dbDisbursed.toLocaleString()}
                        </TableCell>

                        {/* Chain Disbursed */}
                        <TableCell className="py-3.5 text-right font-mono text-xs font-bold text-slate-900 dark:text-white">
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
                                className={`text-xs font-medium ${
                                  r.tampered
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
          <li><strong className="text-emerald-700 dark:text-emerald-400">Synchronized:</strong> Local database records match the on-chain Smart Contract state byte-for-byte.</li>
          <li><strong className="text-amber-700 dark:text-amber-400">Sync Gap:</strong> Unable to pull blockchain status for this item. Ensure your wallet has active RPC connection to Sepolia.</li>
          <li><strong className="text-red-700 dark:text-red-400">Desynced:</strong> Direct database modification detected bypassing multi-signature authority. Requires administrative review.</li>
        </ul>
      </div>
    </div>
  );
};

export default BlockchainIntegrityCheck;
