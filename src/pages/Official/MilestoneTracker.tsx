import React from 'react';
import { useBlockchain } from '../../context/BlockchainContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Map, CheckCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

export const MilestoneTracker = () => {
  const { projects } = useBlockchain();

  // Flatten milestones for easier display
  const allMilestones = projects.flatMap(p => 
    p.milestones.map(m => ({ ...m, projectId: p.id, projectName: p.name }))
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl tracking-tight flex items-center">
          <Map className="h-8 w-8 mr-3 text-blue-600" />
          Milestone Tracker
        </h1>
        <p className="mt-2 text-lg text-slate-600">
          Track physical progress and verification status of project phases.
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-xl">All Milestones</CardTitle>
          <CardDescription>Comprehensive list of project phases requiring MPDC verification.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Milestone</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Verification Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allMilestones.map((m) => (
                <TableRow key={m.id} className="hover:bg-slate-50">
                  <TableCell>
                    <div className="font-medium text-slate-900">{m.projectName}</div>
                    <div className="font-mono text-xs text-slate-500">{m.projectId}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-900">{m.title}</div>
                    <div className="text-xs text-slate-500 truncate max-w-[200px]">{m.description}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-slate-50">{m.percentage}%</Badge>
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    {m.dateVerified ? format(new Date(m.dateVerified), 'MMM d, yyyy') : '-'}
                  </TableCell>
                  <TableCell>
                    {m.status === 'Paid' ? (
                      <Badge className="bg-emerald-500"><CheckCircle className="w-3 h-3 mr-1"/> Paid</Badge>
                    ) : m.status === 'Verified' ? (
                      <Badge className="bg-purple-500"><CheckCircle className="w-3 h-3 mr-1"/> Verified</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-slate-200 text-slate-700"><Clock className="w-3 h-3 mr-1"/> Pending</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {allMilestones.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                    No milestones found.
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
