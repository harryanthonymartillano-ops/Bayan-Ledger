import React, { useState } from 'react';
import { useAuth, Role } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Users, UserPlus, Mail, Shield, CheckCircle, XCircle } from 'lucide-react';

export const UserManagement = () => {
  const { user, registeredUsers, addRegisteredUser, updateUserStatus } = useAuth();
  const [isAddingUser, setIsAddingUser] = useState(false);

  if (!user || user.role !== 'Admin / HR') {
    return <div className="p-8 text-center text-red-500 font-bold">Unauthorized access. Admin privileges required.</div>;
  }

  const handleAddUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const role = formData.get('role') as Role;

    addRegisteredUser({
      name,
      email,
      role,
      status: 'Active'
    });

    setIsAddingUser(false);
    alert('User account created successfully.');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl tracking-tight flex items-center">
            <Users className="h-8 w-8 mr-3 text-blue-600" />
            User Management
          </h1>
          <p className="mt-2 text-lg text-slate-600">
            Manage official accounts and access control for the Sta. Cruz Chain.
          </p>
        </div>
        {!isAddingUser && (
          <Button onClick={() => setIsAddingUser(true)} className="bg-blue-600 hover:bg-blue-700">
            <UserPlus className="w-4 h-4 mr-2" /> Add Official
          </Button>
        )}
      </div>

      {isAddingUser && (
        <Card className="mb-8 border-blue-200 shadow-md">
          <CardHeader className="bg-blue-50 border-b border-blue-100 pb-4">
            <CardTitle className="text-lg text-blue-900">Register New Official</CardTitle>
            <CardDescription className="text-blue-700">Create a new account with specific role permissions.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Full Name</label>
                  <Input name="name" placeholder="e.g. Juan Dela Cruz" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Email Address</label>
                  <Input name="email" type="email" placeholder="e.g. official@stacruz.gov.ph" required />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Official Role</label>
                  <select name="role" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" required>
                    <option value="">Select a role...</option>
                    <option value="MPDC (Planning)">MPDC (Planning)</option>
                    <option value="Budget Officer">Budget Officer</option>
                    <option value="Treasurer">Treasurer</option>
                    <option value="Admin / HR">Admin / HR</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsAddingUser(false)}>Cancel</Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Create Account</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-xl">Registered Officials</CardTitle>
          <CardDescription>List of all authorized personnel on the blockchain network.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registeredUsers.map((u) => (
                <TableRow key={u.id} className="hover:bg-slate-50 transition-colors">
                  <TableCell className="font-medium text-slate-900">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold mr-3 text-slate-600">
                        {u.name.charAt(0)}
                      </div>
                      {u.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200 flex w-fit items-center">
                      <Shield className="w-3 h-3 mr-1" />
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-600">
                    <div className="flex items-center">
                      <Mail className="w-3 h-3 mr-2 text-slate-400" />
                      {u.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    {u.status === 'Active' ? (
                      <Badge variant="default" className="bg-emerald-500"><CheckCircle className="w-3 h-3 mr-1"/> Active</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-slate-200 text-slate-600"><XCircle className="w-3 h-3 mr-1"/> Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {u.status === 'Active' ? (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          if (confirm(`Are you sure you want to deactivate ${u.name}'s account?`)) {
                            updateUserStatus(u.id, 'Inactive');
                          }
                        }}
                        disabled={u.id === user.id} // Prevent self-deactivation
                      >
                        Deactivate
                      </Button>
                    ) : (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        onClick={() => updateUserStatus(u.id, 'Active')}
                      >
                        Activate
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {registeredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                    No users found.
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
