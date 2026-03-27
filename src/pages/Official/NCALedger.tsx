import React from 'react';
import { useBlockchain } from '../../context/BlockchainContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { CreditCard, CheckCircle, Clock } from 'lucide-react';

export const NCALedger = () => {
  const { projects } = useBlockchain();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl tracking-tight flex items-center">
          <CreditCard className="h-8 w-8 mr-3 text-blue-600" />
          Disbursement Ledger (NCA)
        </h1>
        <p className="mt-2 text-lg text-slate-600">
          Notice of Cash Allocation (NCA) tracking and payment execution.
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-xl">Payment Executions</CardTitle>
          <CardDescription>Monitor disbursed funds and payment statuses across projects.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Project ID</TableHead>
                <TableHead>Project Name</TableHead>
                <TableHead>Allocated (SARO)</TableHead>
                <TableHead>Disbursed (NCA)</TableHead>
                <TableHead>Remaining Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => {
                const remaining = p.allocatedFunds - p.disbursedFunds;
                return (
                  <TableRow key={p.id} className="hover:bg-slate-50">
                    <TableCell className="font-mono text-xs text-slate-500">{p.id}</TableCell>
                    <TableCell className="font-medium text-slate-900">{p.name}</TableCell>
                    <TableCell>₱{p.allocatedFunds.toLocaleString()}</TableCell>
                    <TableCell className="text-emerald-600 font-semibold">₱{p.disbursedFunds.toLocaleString()}</TableCell>
                    <TableCell className={remaining > 0 ? "text-amber-600" : "text-slate-500"}>
                      ₱{remaining.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {p.disbursedFunds > 0 && p.disbursedFunds >= p.allocatedFunds ? (
                        <Badge className="bg-emerald-500"><CheckCircle className="w-3 h-3 mr-1"/> Fully Paid</Badge>
                      ) : p.disbursedFunds > 0 ? (
                        <Badge className="bg-blue-500"><Clock className="w-3 h-3 mr-1"/> Partially Paid</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-slate-200 text-slate-700"><Clock className="w-3 h-3 mr-1"/> Unpaid</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {projects.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                    No projects found.
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
