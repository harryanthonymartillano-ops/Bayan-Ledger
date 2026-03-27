import React from 'react';
import { useBlockchain } from '../../context/BlockchainContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { FileText, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

export const PaymentHashes = () => {
  const { auditLogs } = useBlockchain();

  // Filter audit logs for transactions only
  const transactionLogs = auditLogs.filter(log => log.action === 'Disbursement (NCA)' || log.action === 'Allocation (SARO)');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl tracking-tight flex items-center">
          <FileText className="h-8 w-8 mr-3 text-blue-600" />
          Payment Hashes
        </h1>
        <p className="mt-2 text-lg text-slate-600">
          A history of all successfully executed blockchain transaction receipts.
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-xl">Transaction Receipts</CardTitle>
          <CardDescription>Cryptographic proof of all municipal disbursements.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Executed By</TableHead>
                <TableHead>Transaction Hash</TableHead>
                <TableHead className="text-right">Explorer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactionLogs.map((log) => (
                <TableRow key={log.id} className="hover:bg-slate-50">
                  <TableCell className="text-slate-500 text-sm">
                    {format(new Date(log.timestamp), 'MMM d, yyyy HH:mm')}
                  </TableCell>
                  <TableCell className="font-medium text-slate-900">{log.details}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                      {log.userRole}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-blue-600">
                    {log.hash}
                  </TableCell>
                  <TableCell className="text-right">
                    <button className="text-slate-400 hover:text-blue-600 transition-colors">
                      <ExternalLink className="w-4 h-4 inline" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
              {transactionLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                    No payment transactions recorded yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
