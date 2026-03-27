import React from 'react';
import { useBlockchain } from '../../context/BlockchainContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { FileText, CheckCircle, Clock } from 'lucide-react';

export const SARORegistry = () => {
  const { projects } = useBlockchain();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl tracking-tight flex items-center">
          <FileText className="h-8 w-8 mr-3 text-blue-600" />
          Allotment Registry (SARO)
        </h1>
        <p className="mt-2 text-lg text-slate-600">
          Special Allotment Release Order (SARO) tracking and budget allocation.
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-xl">Budget Allocations</CardTitle>
          <CardDescription>Monitor locked funds and SARO issuance across projects.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Project ID</TableHead>
                <TableHead>Project Name</TableHead>
                <TableHead>Total Budget</TableHead>
                <TableHead>Allocated Funds</TableHead>
                <TableHead>SARO Number</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => (
                <TableRow key={p.id} className="hover:bg-slate-50">
                  <TableCell className="font-mono text-xs text-slate-500">{p.id}</TableCell>
                  <TableCell className="font-medium text-slate-900">{p.name}</TableCell>
                  <TableCell>₱{p.totalBudget.toLocaleString()}</TableCell>
                  <TableCell className="text-blue-600 font-semibold">₱{p.allocatedFunds.toLocaleString()}</TableCell>
                  <TableCell>
                    {p.saro ? (
                      <span className="font-mono text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded border border-amber-200">
                        {p.saro}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-sm italic">Not Issued</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.allocatedFunds >= p.totalBudget ? (
                      <Badge className="bg-emerald-500"><CheckCircle className="w-3 h-3 mr-1"/> Fully Allocated</Badge>
                    ) : p.allocatedFunds > 0 ? (
                      <Badge className="bg-blue-500"><Clock className="w-3 h-3 mr-1"/> Partially Allocated</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-slate-200 text-slate-700"><Clock className="w-3 h-3 mr-1"/> Pending</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
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
