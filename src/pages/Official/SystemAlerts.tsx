import React from 'react';
import { useBlockchain } from '../../context/BlockchainContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

export const SystemAlerts = () => {
  const { alerts } = useBlockchain();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl tracking-tight flex items-center">
          <AlertTriangle className="h-8 w-8 mr-3 text-amber-500" />
          System Alerts
        </h1>
        <p className="mt-2 text-lg text-slate-600">
          Flags, discrepancies, and public reports requiring administrative review.
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-xl">Active & Resolved Alerts</CardTitle>
          <CardDescription>Monitor and track system-generated flags and public feedback.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Project ID</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((alert) => (
                <TableRow key={alert.id} className="hover:bg-slate-50">
                  <TableCell className="text-slate-500 text-sm">
                    {format(new Date(alert.date), 'MMM d, yyyy HH:mm')}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">{alert.projectId}</TableCell>
                  <TableCell className="text-slate-900 max-w-md">{alert.message}</TableCell>
                  <TableCell>
                    {alert.status === 'Resolved' ? (
                      <Badge className="bg-emerald-500"><CheckCircle className="w-3 h-3 mr-1"/> Resolved</Badge>
                    ) : (
                      <Badge className="bg-amber-500"><AlertTriangle className="w-3 h-3 mr-1"/> Unresolved</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {alerts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-slate-500">
                    No system alerts found.
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
