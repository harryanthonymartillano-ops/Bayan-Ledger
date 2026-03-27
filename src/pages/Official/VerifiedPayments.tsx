import React from 'react';
import { useBlockchain } from '../../context/BlockchainContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { CheckSquare, CheckCircle, Clock } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { format } from 'date-fns';

export const VerifiedPayments = () => {
  const { projects } = useBlockchain();

  // Find milestones that are verified but not yet paid
  const pendingPayments = projects.flatMap(p => 
    p.milestones
      .filter(m => m.status === 'Verified')
      .map(m => ({ ...m, projectId: p.id, projectName: p.name, allocated: p.allocatedFunds, disbursed: p.disbursedFunds }))
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl tracking-tight flex items-center">
          <CheckSquare className="h-8 w-8 mr-3 text-blue-600" />
          Verified Payments
        </h1>
        <p className="mt-2 text-lg text-slate-600">
          A "To-Do" list of projects where the MPDC and Budget Officer have already signed off.
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-xl">Pending Disbursements</CardTitle>
          <CardDescription>Execute payments for verified project milestones.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Milestone</TableHead>
                <TableHead>Verified On</TableHead>
                <TableHead>Amount Due (Est.)</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingPayments.map((m) => {
                // Estimate amount due based on percentage
                const amountDue = (m.allocated * (m.percentage / 100));
                return (
                  <TableRow key={m.id} className="hover:bg-slate-50">
                    <TableCell>
                      <div className="font-medium text-slate-900">{m.projectName}</div>
                      <div className="font-mono text-xs text-slate-500">{m.projectId}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900">{m.title}</div>
                      <Badge variant="outline" className="bg-slate-50 mt-1">{m.percentage}% Complete</Badge>
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {m.dateVerified ? format(new Date(m.dateVerified), 'MMM d, yyyy') : '-'}
                    </TableCell>
                    <TableCell className="font-semibold text-slate-900">
                      ₱{amountDue.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors">
                        Process Payment
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {pendingPayments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                    No verified milestones pending payment.
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
