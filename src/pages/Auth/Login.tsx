import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, Role } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Shield, Lock, Mail } from 'lucide-react';

export const Login = () => {
  const { login, registeredUsers } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Find user by email
    const user = registeredUsers.find(u => u.email === email && u.status === 'Active');

    if (user) {
      // In a real app, we would verify the password here
      login(user.role);
      navigate('/official/dashboard');
    } else {
      setError('Invalid email address or account is inactive.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md shadow-xl border-slate-200">
        <CardHeader className="space-y-1 text-center pb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-50 p-3 rounded-full">
              <img src="https://upload.wikimedia.org/wikipedia/commons/8/88/Santa_Cruz_Laguna_Seal.png" alt="Santa Cruz Logo" className="h-16 w-16 object-contain" referrerPolicy="no-referrer" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Official Login</CardTitle>
          <CardDescription>
            Secure access to the Sta. Cruz Chain Internal Workflow
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none text-slate-700">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  type="email" 
                  placeholder="name@stacruz.gov.ph" 
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none text-slate-700">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  type="password" 
                  placeholder="••••••••" 
                  className="pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="pt-2">
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11">
                Sign In to Blockchain Network
              </Button>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col border-t border-slate-100 pt-6 bg-slate-50/50 rounded-b-xl">
          <div className="text-sm text-slate-500 mb-2 font-medium">Demo Accounts:</div>
          <div className="grid grid-cols-1 gap-2 w-full text-xs text-slate-600">
            <div className="flex justify-between items-center bg-white p-2 rounded border border-slate-200 cursor-pointer hover:bg-slate-50" onClick={() => setEmail('maria.santos@stacruz.gov.ph')}>
              <span className="font-medium">MPDC:</span>
              <span className="font-mono text-blue-600">maria.santos@stacruz.gov.ph</span>
            </div>
            <div className="flex justify-between items-center bg-white p-2 rounded border border-slate-200 cursor-pointer hover:bg-slate-50" onClick={() => setEmail('juan.delacruz@stacruz.gov.ph')}>
              <span className="font-medium">Budget:</span>
              <span className="font-mono text-blue-600">juan.delacruz@stacruz.gov.ph</span>
            </div>
            <div className="flex justify-between items-center bg-white p-2 rounded border border-slate-200 cursor-pointer hover:bg-slate-50" onClick={() => setEmail('elena.reyes@stacruz.gov.ph')}>
              <span className="font-medium">Treasurer:</span>
              <span className="font-mono text-blue-600">elena.reyes@stacruz.gov.ph</span>
            </div>
            <div className="flex justify-between items-center bg-white p-2 rounded border border-slate-200 cursor-pointer hover:bg-slate-50" onClick={() => setEmail('admin@stacruz.gov.ph')}>
              <span className="font-medium">Admin:</span>
              <span className="font-mono text-blue-600">admin@stacruz.gov.ph</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-4 text-center">
            Any password will work for the demo.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};
