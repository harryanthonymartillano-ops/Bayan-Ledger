import React from 'react';
import { useBlockchain } from '../../context/BlockchainContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Users, ThumbsUp, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Badge } from '../../components/ui/badge';

export const CitizenProposals = () => {
  const { proposals, updateProposalStatus } = useBlockchain();

  // Sort by votes descending
  const sortedProposals = [...proposals].sort((a, b) => b.votes - a.votes);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl tracking-tight flex items-center">
          <Users className="h-8 w-8 mr-3 text-blue-600" />
          Citizen Proposals
        </h1>
        <p className="mt-2 text-lg text-slate-600">
          Dashboard for viewing and prioritizing project requests from the public.
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-xl">Community Requests</CardTitle>
          <CardDescription>Review and prioritize proposals submitted by citizens.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Proposal ID</TableHead>
                <TableHead>Title & Description</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Votes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedProposals.map((p) => (
                <TableRow key={p.id} className="hover:bg-slate-50">
                  <TableCell className="font-mono text-xs text-slate-500">{p.id}</TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-900">{p.title}</div>
                    <div className="text-sm text-slate-500 truncate max-w-xs">{p.description}</div>
                  </TableCell>
                  <TableCell>{p.author}</TableCell>
                  <TableCell>
                    <div className="flex items-center text-emerald-600 font-medium">
                      <ThumbsUp className="w-4 h-4 mr-1" />
                      {p.votes}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      p.status === 'Approved for Planning' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                      p.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                      p.status === 'Under Review' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      'bg-slate-50 text-slate-700'
                    }>
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {p.status === 'Pending' && (
                      <button 
                        onClick={() => updateProposalStatus(p.id, 'Under Review')}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Review
                      </button>
                    )}
                    {p.status === 'Under Review' && (
                      <>
                        <button 
                          onClick={() => updateProposalStatus(p.id, 'Approved for Planning')}
                          className="text-emerald-600 hover:text-emerald-800 text-sm font-medium"
                        >
                          Approve
                        </button>
                        <button 
                          onClick={() => updateProposalStatus(p.id, 'Rejected')}
                          className="text-red-600 hover:text-red-800 text-sm font-medium ml-2"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
