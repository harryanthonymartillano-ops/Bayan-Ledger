import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBlockchain } from '../../context/BlockchainContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Input } from '../../components/ui/input';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Search,
  Copy,
  Check,
  ShieldCheck,
  Hash,
  Activity,
  ArrowRight,
  Coins,
} from 'lucide-react';
import { format } from 'date-fns';

const ITEMS_PER_PAGE = 10;

type ReceiptRow = {
  id: string;
  date: string;
  details: string;
  executedBy: string;
  type: string;
  hash: string;
  sealHash?: string;
};

type FilterType = 'ALL' | 'DISBURSEMENT' | 'ALLOCATION' | 'SEAL';

export const PaymentHashes = () => {
  const { projects, auditLogs } = useBlockchain();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<FilterType>('ALL');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const receiptRows = useMemo<ReceiptRow[]>(() => {
    const transactionReceipts = projects.flatMap((project) =>
      project.transactions
        .filter((transaction) =>
          ['Executed', 'Completed', '1/2 Signed'].includes(transaction.status) &&
          Boolean(transaction.hash || transaction.requestTxHash || transaction.digitalSealHash)
        )
        .map((transaction) => ({
          id: `tx-${transaction.id}`,
          date: transaction.treasurerSignedAt || transaction.budgetSignedAt || transaction.date,
          details: `${project.name} | ${transaction.type} | ${new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(transaction.amount)}`,
          executedBy: transaction.recordedByRole,
          type: transaction.type,
          hash: transaction.hash || transaction.requestTxHash || transaction.digitalSealHash || '',
          sealHash: transaction.digitalSealHash,
        }))
    );

    const knownHashes = new Set(transactionReceipts.map((receipt) => receipt.hash).filter(Boolean));
    const auditReceipts = auditLogs
      .filter((log) =>
        [
          'Disbursement (NCA)',
          'Allocation (SARO)',
          'Funds Allocated',
          'Funds Disbursed',
          'Pending Transaction Created',
          'Digital Seal of Truth Generated',
          'Project Activated',
        ].includes(log.action) &&
        Boolean(log.hash) &&
        !knownHashes.has(log.hash)
      )
      .map((log) => {
        let role = log.userRole;
        if (!role || role.toLowerCase() === 'system') {
          if (log.action.includes('Disbursement') || log.action.includes('NCA') || log.action.includes('Seal')) {
            role = 'Treasurer';
          } else if (log.action.includes('Allocation') || log.action.includes('SARO')) {
            role = 'Budget Officer';
          } else {
            role = 'MPDC (Planning)';
          }
        }
        return {
          id: `audit-${log.id}`,
          date: log.timestamp,
          details: String(log.details || log.action),
          executedBy: role,
          type: log.action,
          hash: log.hash,
        };
      });

    return [...transactionReceipts, ...auditReceipts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [projects, auditLogs]);

  // KPI Metrics
  const summary = useMemo(() => {
    const totalReceipts = receiptRows.length;
    const digitalSeals = receiptRows.filter((r) => Boolean(r.sealHash) || r.type.includes('Seal')).length;
    const disbursements = receiptRows.filter((r) => r.type.toLowerCase().includes('disbursement') || r.type.toLowerCase().includes('nca')).length;
    const latestDate = receiptRows.length > 0 ? receiptRows[0].date : null;

    return {
      totalReceipts,
      digitalSeals,
      disbursements,
      latestDate,
    };
  }, [receiptRows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return receiptRows.filter((row) => {
      const typeLower = row.type.toLowerCase();
      if (typeFilter === 'DISBURSEMENT' && !typeLower.includes('disbursement') && !typeLower.includes('nca')) return false;
      if (typeFilter === 'ALLOCATION' && !typeLower.includes('allocation') && !typeLower.includes('saro')) return false;
      if (typeFilter === 'SEAL' && !row.sealHash && !typeLower.includes('seal')) return false;

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesHash = row.hash.toLowerCase().includes(query);
        const matchesDetails = row.details.toLowerCase().includes(query);
        const matchesActor = (row.executedBy || '').toLowerCase().includes(query);
        return matchesHash || matchesDetails || matchesActor;
      }

      return true;
    });
  }, [receiptRows, typeFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ITEMS_PER_PAGE));
  const paginatedRows = filteredRows.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleTypeSelect = (type: FilterType) => {
    setTypeFilter(typeFilter === type ? 'ALL' : type);
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
              <Hash className="h-5 w-5" />
            </div>
            Payment Hashes & Blockchain Receipts
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-3xl">
            Cryptographic ledger receipts, transaction hashes, and Digital Seals of Truth verified on the Ethereum Sepolia network.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            to="/official/nca"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-xs transition-colors"
          >
            <span>Disbursement Ledger</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* ========================================================== */}
      {/* 2. CRYPTOGRAPHIC KPI CARDS */}
      {/* ========================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Signed Receipts */}
        <Card
          onClick={() => handleTypeSelect('ALL')}
          className={`cursor-pointer transition-all border shadow-xs hover:shadow-sm ${
            typeFilter === 'ALL' ? 'ring-2 ring-blue-500 bg-blue-50/40 border-blue-300' : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Signed Receipts</span>
              <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Hash className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">{summary.totalReceipts}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Immutable on-chain transactions</p>
          </CardContent>
        </Card>

        {/* Digital Seals */}
        <Card
          onClick={() => handleTypeSelect('SEAL')}
          className={`cursor-pointer transition-all border shadow-xs hover:shadow-sm ${
            typeFilter === 'SEAL' ? 'ring-2 ring-purple-500 bg-purple-50/40 border-purple-300' : 'border-slate-200 bg-white hover:border-purple-200'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Digital Seals of Truth</span>
              <div className="h-7 w-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-purple-900">{summary.digitalSeals}</div>
            <p className="text-[11px] text-purple-600 mt-0.5">Dual-sign cryptographic locks</p>
          </CardContent>
        </Card>

        {/* Disbursements */}
        <Card
          onClick={() => handleTypeSelect('DISBURSEMENT')}
          className={`cursor-pointer transition-all border shadow-xs hover:shadow-sm ${
            typeFilter === 'DISBURSEMENT' ? 'ring-2 ring-emerald-500 bg-emerald-50/40 border-emerald-300' : 'border-slate-200 bg-white hover:border-emerald-200'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">NCA Disbursements</span>
              <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Coins className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-emerald-900">{summary.disbursements}</div>
            <p className="text-[11px] text-emerald-600 mt-0.5">Executed payouts on ledger</p>
          </CardContent>
        </Card>

        {/* Blockchain Network Status */}
        <Card className="border border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Network Consensus</span>
              <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Activity className="h-4 w-4 animate-pulse" />
              </div>
            </div>
            <div className="mt-2 text-base font-black text-slate-900 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              <span>Sepolia Testnet</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {summary.latestDate ? `Latest: ${format(new Date(summary.latestDate), 'MMM d, HH:mm')}` : 'Online'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ========================================================== */}
      {/* 3. TABLE CONTROLS & HASH TABLE */}
      {/* ========================================================== */}
      <Card className="border-slate-200 dark:border-[#1e2334] shadow-sm overflow-hidden bg-white dark:bg-[#121520]">
        <CardHeader className="border-b border-slate-100 dark:border-[#1e2334] bg-slate-50/50 dark:bg-[#141824] p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Receipts & Explorer Hashes</CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Verifiable cryptographic records with immutable block explorers.
              </CardDescription>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* Search input */}
              <div className="relative min-w-[240px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search hash, project, or role..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 h-9 text-xs bg-white"
                />
              </div>

              {/* Type filter chips */}
              <div className="flex items-center gap-1 overflow-x-auto bg-slate-100 p-1 rounded-lg border border-slate-200">
                {(['ALL', 'DISBURSEMENT', 'ALLOCATION', 'SEAL'] as FilterType[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => handleTypeSelect(st)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                      typeFilter === st
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st === 'ALL'
                      ? 'All'
                      : st === 'DISBURSEMENT'
                      ? 'Disbursement'
                      : st === 'ALLOCATION'
                      ? 'Allocation'
                      : 'Seal'}
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
                <TableHead className="text-xs font-bold text-slate-600 py-3">Timestamp</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 py-3">Transaction Details</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 py-3">Signer Role</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 py-3">Transaction Hash</TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-600 py-3">Explorer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRows.map((row) => (
                <TableRow key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-[#181c2b] transition-colors border-b border-slate-100 dark:border-[#1e2334]">
                  {/* Date */}
                  <TableCell className="py-3 whitespace-nowrap text-xs text-slate-600">
                    {format(new Date(row.date), 'MMM d, yyyy')}
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {format(new Date(row.date), 'HH:mm:ss')}
                    </div>
                  </TableCell>

                  {/* Details */}
                  <TableCell className="py-3">
                    <div className="font-semibold text-slate-900 text-sm">{row.details}</div>
                    {row.sealHash && (
                      <div className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 w-fit">
                        <ShieldCheck className="w-3 h-3 text-purple-600" />
                        <span>Seal: {row.sealHash.substring(0, 16)}...</span>
                      </div>
                    )}
                  </TableCell>

                  {/* Signer */}
                  <TableCell className="py-3">
                    <Badge variant="secondary" className="bg-slate-100 text-slate-700 text-[11px] font-medium border-slate-200">
                      {row.executedBy || 'Smart Contract'}
                    </Badge>
                  </TableCell>

                  {/* Hash with copy button */}
                  <TableCell className="py-3 max-w-xs">
                    <div className="inline-flex items-center gap-1.5 font-mono text-xs text-blue-600 bg-blue-50/60 px-2 py-1 rounded border border-blue-200/60 max-w-full">
                      <span className="truncate">{row.hash}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(row.hash)}
                        title="Copy Transaction Hash"
                        className="text-blue-500 hover:text-blue-700 transition-colors shrink-0"
                      >
                        {copiedHash === row.hash ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </TableCell>

                  {/* Etherscan Explorer */}
                  <TableCell className="text-right py-3">
                    <a
                      href={`https://sepolia.etherscan.io/tx/${row.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 items-center gap-1 justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-blue-600 hover:border-blue-200 shadow-xs"
                    >
                      <span>Sepolia</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                  </TableCell>
                </TableRow>
              ))}

              {filteredRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-36 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <FileText className="h-6 w-6 text-slate-300" />
                      <p className="text-sm font-medium text-slate-600">No payment receipts found matching your search.</p>
                      <button
                        onClick={() => {
                          setSearchTerm('');
                          setTypeFilter('ALL');
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
          {filteredRows.length > ITEMS_PER_PAGE && (
            <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200 bg-white px-5 py-3.5 sm:flex-row">
              <div className="text-xs font-medium text-slate-600">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredRows.length)} of {filteredRows.length} receipts
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
