import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../lib/apiClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Activity, Download, Search, Filter, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const ITEMS_PER_PAGE = 10;

interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  user_id?: string;
  user_email?: string;
  actor_name?: string;
  actor_role?: string;
  resource_type?: string;
  resource_id?: string;
  details?: Record<string, any> | string;
  details_text?: string;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
};

const shortenHash = (hash: string, length: number = 12) => {
  if (!hash || hash.length <= length) return hash;
  return `${hash.substring(0, length)}...`;
};

const describeLogDetails = (log: AuditLog) => {
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
    if (typeof details.status === 'string') parts.push(`Status: ${details.status}`);
  }

  // TRANSACTION & FUND REQUEST ACTIONS
  if (action.includes('TRANSACTION') || action.includes('SARO') || action.includes('FUND')) {
    if (typeof details.projectId === 'string') parts.push(`📋 Project: ${details.projectId}`);
    if (typeof details.amount === 'number') parts.push(`💵 Amount: ${formatCurrency(details.amount)}`);
    if (typeof details.saro === 'string') parts.push(`🔖 SARO: ${details.saro}`);
    if (typeof details.reason === 'string') parts.push(`📝 Reason: ${details.reason}`);
    if (typeof details.transactionHash === 'string') parts.push(`🔗 Hash: ${shortenHash(details.transactionHash)}`);
  }

  // MILESTONE ACTIONS
  if (action.includes('MILESTONE')) {
    if (typeof details.milestoneId === 'string') parts.push(`🎯 Milestone: ${details.milestoneId}`);
    if (typeof details.milestoneName === 'string') parts.push(`📌 Name: ${details.milestoneName}`);
    if (typeof details.photoCount === 'number') parts.push(`📸 Photos: ${details.photoCount}`);
    if (typeof details.status === 'string') parts.push(`Status: ${details.status}`);
  }

  // DOCUMENT ACTIONS
  if (action.includes('DOCUMENT')) {
    if (typeof details.fileName === 'string') parts.push(`📄 File: ${details.fileName}`);
    if (typeof details.documentType === 'string') parts.push(`📋 Type: ${details.documentType}`);
    if (typeof details.fileSize === 'number') parts.push(`📊 Size: ${(details.fileSize / 1024).toFixed(2)} KB`);
  }

  // APPROVAL ACTIONS
  if (action.includes('APPROVAL') || action.includes('APPROVED')) {
    if (typeof details.amount === 'number') parts.push(`💵 Amount: ${formatCurrency(details.amount)}`);
    if (typeof details.approverName === 'string') parts.push(`👤 Approver: ${details.approverName}`);
    if (typeof details.reason === 'string') parts.push(`📝 Reason: ${details.reason}`);
  }

  // SYSTEM ALERTS
  if (action.includes('ALERT') || action.includes('ANOMALY')) {
    if (typeof details.alertType === 'string') parts.push(`⚠️ Type: ${details.alertType}`);
    if (typeof details.severity === 'string') parts.push(`🚨 Severity: ${details.severity}`);
    if (typeof details.message === 'string') parts.push(`📢 Message: ${details.message.substring(0, 50)}`);
  }

  // GENERIC FALLBACK
  if (typeof details.projectId === 'string' && !parts.some(p => p.includes('Project'))) parts.push(`📋 Project: ${details.projectId}`);
  if (typeof details.amount === 'number' && !parts.some(p => p.includes('Amount'))) parts.push(`💰 Amount: ${formatCurrency(details.amount)}`);
  if (typeof details.status === 'string' && !parts.some(p => p.includes('Status'))) parts.push(`Status: ${details.status}`);

  if (parts.length > 0) {
    return parts.join(' | ');
  }

  return log.details_text || 'Recorded in the immutable audit ledger.';
};

export const AuditLogs = () => {
  const { token } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Load audit logs
  useEffect(() => {
    if (!token) return;

    const loadLogs = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await apiClient.getAuditLogs(token) as any;
        setLogs(response.logs || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load audit logs');
      } finally {
        setIsLoading(false);
      }
    };

    loadLogs();
  }, [token]);

  // Get unique values for filters
  const uniqueActions = useMemo(() => {
    const actions = new Set(logs.map(log => log.action).filter(Boolean));
    return Array.from(actions).sort();
  }, [logs]);

  const uniqueUsers = useMemo(() => {
    const users = new Set(logs.map(log => log.actor_name || log.user_email).filter(Boolean));
    return Array.from(users).sort() as string[];
  }, [logs]);

  // Apply filters
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Date range filter
      if (startDate || endDate) {
        const logDate = parseISO(log.timestamp);
        if (startDate && logDate < parseISO(startDate)) return false;
        if (endDate) {
          const endOfDay = new Date(parseISO(endDate));
          endOfDay.setHours(23, 59, 59, 999);
          if (logDate > endOfDay) return false;
        }
      }

      // Action filter
      if (selectedAction && log.action !== selectedAction) return false;

      // User filter
      if (selectedUser) {
        const userIdentifier = log.actor_name || log.user_email || '';
        if (userIdentifier !== selectedUser) return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchFields = [
          log.action,
          log.actor_name,
          log.user_email,
          log.resource_id,
          JSON.stringify(log.details),
        ].filter(Boolean).join(' ').toLowerCase();

        if (!searchFields.includes(query)) return false;
      }

      return true;
    });
  }, [logs, searchQuery, selectedAction, selectedUser, startDate, endDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedAction, selectedUser, startDate, endDate]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / ITEMS_PER_PAGE));
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Timestamp', 'Action', 'User', 'Role', 'Resource Type', 'Details Summary'];
    const rows = filteredLogs.map(log => [
      format(parseISO(log.timestamp), 'yyyy-MM-dd HH:mm:ss'),
      log.action,
      log.actor_name || log.user_email || 'N/A',
      log.actor_role || 'N/A',
      log.resource_type || 'N/A',
      describeLogDetails(log),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `audit-logs-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Clear filters
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedAction('');
    setSelectedUser('');
    setStartDate('');
    setEndDate('');
  };

  const hasActiveFilters = searchQuery || selectedAction || selectedUser || startDate || endDate;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl tracking-tight flex items-center">
          <Activity className="h-8 w-8 mr-3 text-blue-600" />
          System Audit Logs
        </h1>
        <p className="mt-2 text-lg text-slate-600">
          Complete immutable record of all actions and transactions. {filteredLogs.length} of {logs.length} logs shown.
        </p>
      </div>

      {/* Filters Card */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-slate-600" />
              <CardTitle>Filters & Search</CardTitle>
            </div>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {/* Search */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by action, user, resource, or details..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Filters Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Date Range */}
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {/* Action Filter */}
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Action Type</label>
              <select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">All Actions</option>
                {uniqueActions.map(action => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>
            </div>

            {/* User Filter */}
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">User</label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">All Users</option>
                {uniqueUsers.map(user => (
                  <option key={user} value={user}>{user}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export & Stats */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">
          Showing <span className="font-semibold">{filteredLogs.length}</span> of <span className="font-semibold">{logs.length}</span> logs
        </div>
        <Button
          onClick={exportToCSV}
          disabled={filteredLogs.length === 0}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Download className="h-4 w-4 mr-2" />
          Export to CSV
        </Button>
      </div>

      {/* Logs Table */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-xl">Activity Log</CardTitle>
          <CardDescription>Chronological ledger of all system actions.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-slate-600">Loading audit logs...</div>
          ) : error ? (
            <div className="p-6 text-center text-red-600">{error}</div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-6 text-center text-slate-500">No audit logs found matching your criteria.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLogs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-slate-50 dark:hover:bg-[#181c2b] transition-colors border-b border-slate-100 dark:border-[#1e2334]">
                      <TableCell className="text-slate-500 text-sm whitespace-nowrap">
                        {format(parseISO(log.timestamp), 'MMM d, yyyy HH:mm:ss')}
                      </TableCell>
                      <TableCell className="font-medium text-slate-900 max-w-[150px] truncate">
                        {log.action}
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm max-w-[150px] truncate">
                        {log.actor_name || log.user_email || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                          {log.actor_role || 'N/A'}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm max-w-[150px] truncate">
                        {log.resource_type ? `${log.resource_type}${log.resource_id ? `: ${log.resource_id}` : ''}` : 'N/A'}
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">
                        <div className="space-y-2">
                          <div className="font-medium text-slate-900 truncate max-w-xs">
                            {describeLogDetails(log).length > 120
                              ? describeLogDetails(log).substring(0, 120) + '...'
                              : describeLogDetails(log)}
                          </div>
                          {log.details_text && (
                            <details className="text-xs text-slate-500">
                              <summary className="cursor-pointer hover:text-slate-700 font-semibold">
                                ▼ View raw JSON
                              </summary>
                              <pre className="mt-2 p-2 bg-slate-50 rounded text-xs overflow-auto max-h-48 font-mono border border-slate-200">
                                {log.details_text}
                              </pre>
                            </details>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {!isLoading && !error && filteredLogs.length > ITEMS_PER_PAGE && (
            <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200 bg-white px-4 py-4 sm:flex-row">
              <div className="text-sm font-medium text-slate-600">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredLogs.length)} of {filteredLogs.length} logs
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`h-9 min-w-9 rounded-lg px-3 text-sm font-bold transition-colors ${currentPage === page
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
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
