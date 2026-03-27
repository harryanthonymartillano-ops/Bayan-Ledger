import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Shield, Check, X } from 'lucide-react';

export const RBAC = () => {
  const roles = [
    { name: 'MPDC (Planning)', view: true, signMilestone: true, signSaro: false, signNca: false, manageUsers: false },
    { name: 'Budget Officer', view: true, signMilestone: false, signSaro: true, signNca: false, manageUsers: false },
    { name: 'Treasurer', view: true, signMilestone: false, signSaro: false, signNca: true, manageUsers: false },
    { name: 'Admin / HR', view: true, signMilestone: false, signSaro: false, signNca: false, manageUsers: true },
  ];

  const renderIcon = (hasPermission: boolean) => {
    return hasPermission ? (
      <Check className="w-5 h-5 text-emerald-500 mx-auto" />
    ) : (
      <X className="w-5 h-5 text-slate-300 mx-auto" />
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl tracking-tight flex items-center">
          <Shield className="h-8 w-8 mr-3 text-blue-600" />
          RBAC Permissions
        </h1>
        <p className="mt-2 text-lg text-slate-600">
          Fine-tune who can "view" versus "sign" specific documents.
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-xl">Role-Based Access Control Matrix</CardTitle>
          <CardDescription>Overview of system permissions assigned to each official role.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead className="text-center">View Projects</TableHead>
                <TableHead className="text-center">Sign Milestones</TableHead>
                <TableHead className="text-center">Sign SARO</TableHead>
                <TableHead className="text-center">Sign NCA</TableHead>
                <TableHead className="text-center">Manage Users</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((r, idx) => (
                <TableRow key={idx} className="hover:bg-slate-50">
                  <TableCell className="font-medium text-slate-900">{r.name}</TableCell>
                  <TableCell>{renderIcon(r.view)}</TableCell>
                  <TableCell>{renderIcon(r.signMilestone)}</TableCell>
                  <TableCell>{renderIcon(r.signSaro)}</TableCell>
                  <TableCell>{renderIcon(r.signNca)}</TableCell>
                  <TableCell>{renderIcon(r.manageUsers)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
