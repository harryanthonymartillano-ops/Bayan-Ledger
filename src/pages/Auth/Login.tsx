import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, Role } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Shield, Lock } from 'lucide-react';

export const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<Role | ''>('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRole) {
      login(selectedRole as Role);
      navigate('/official/dashboard');
    }
  };

  const roles: { role: Role; desc: string }[] = [
    { role: 'MPDC (Planning)', desc: 'Encodes project milestones and geo-tagged progress.' },
    { role: 'Budget Officer', desc: 'Records official budget allocations and SAROs on-chain.' },
    { role: 'Treasurer', desc: 'Logs actual cash disbursements (NCAs).' },
    { role: 'Admin / HR', desc: 'Ensures procurement documents and personnel expenditures are uploaded.' },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-lg shadow-xl border-slate-200">
        <CardHeader className="space-y-1 text-center pb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-100 p-3 rounded-full">
              <Shield className="h-10 w-10 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Official Login</CardTitle>
          <CardDescription>
            Secure access to the Sta. Cruz Chain Internal Workflow
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Select Role
              </label>
              <div className="grid grid-cols-1 gap-3">
                {roles.map(({ role, desc }) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setSelectedRole(role)}
                    className={`flex flex-col px-4 py-3 border rounded-lg text-left transition-all ${
                      selectedRole === role
                        ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                        : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`font-medium ${selectedRole === role ? 'text-blue-900' : 'text-slate-700'}`}>
                        {role}
                      </span>
                      {selectedRole === role && <Lock className="h-4 w-4 text-blue-600" />}
                    </div>
                    <span className="text-xs text-slate-500 mt-1">{desc}</span>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="pt-4">
              <Button type="submit" className="w-full" disabled={!selectedRole} size="lg">
                Sign In to Blockchain Network
              </Button>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-slate-100 pt-6">
          <p className="text-xs text-slate-500 text-center">
            This is a secure portal. All actions are recorded on the immutable ledger.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};
