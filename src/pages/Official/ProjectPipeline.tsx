import React from 'react';
import { useBlockchain } from '../../context/BlockchainContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { List, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

export const ProjectPipeline = () => {
  const { projects } = useBlockchain();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Completed': return <Badge className="bg-emerald-500"><CheckCircle className="w-3 h-3 mr-1"/> Completed</Badge>;
      case 'In Progress': return <Badge className="bg-blue-500"><Clock className="w-3 h-3 mr-1"/> In Progress</Badge>;
      case 'Pending': return <Badge variant="secondary" className="bg-slate-200 text-slate-700"><Clock className="w-3 h-3 mr-1"/> Pending</Badge>;
      case 'Allocated': return <Badge className="bg-amber-500"><Clock className="w-3 h-3 mr-1"/> Allocated</Badge>;
      case 'Milestone Verified': return <Badge className="bg-purple-500"><CheckCircle className="w-3 h-3 mr-1"/> Verified</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl tracking-tight flex items-center">
          <List className="h-8 w-8 mr-3 text-blue-600" />
          Project Pipeline
        </h1>
        <p className="mt-2 text-lg text-slate-600">
          Overview of all municipal projects and their current status.
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-xl">All Projects</CardTitle>
          <CardDescription>Comprehensive list of infrastructure and development projects.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Project ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Financial Progress</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => {
                const progress = p.totalBudget > 0 ? (p.disbursedFunds / p.totalBudget) * 100 : 0;
                return (
                  <TableRow key={p.id} className="hover:bg-slate-50">
                    <TableCell className="font-mono text-xs text-slate-500">{p.id}</TableCell>
                    <TableCell className="font-medium text-slate-900">{p.name}</TableCell>
                    <TableCell>{p.category}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-full bg-slate-200 rounded-full h-2.5 max-w-[150px]">
                          <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                        </div>
                        <span className="text-xs text-slate-500">{progress.toFixed(0)}%</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(p.status)}</TableCell>
                  </TableRow>
                );
              })}
              {projects.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-slate-500">
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
