import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  ArrowLeft,
  Banknote,
  Compass,
  Lock,
  Mail,
  LoaderCircle,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

export const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/official/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Invalid email address or account is inactive.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-[#fafaf9] py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {/* Back Link */}
        <div className="mb-4">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Public Portal
          </Link>
        </div>

        <Card className="relative overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
          <CardHeader className="space-y-2 text-center pb-5 pt-8">
            <div className="flex justify-center mb-2">
              <div className="relative flex h-14 w-14 items-center justify-center rounded-xl bg-slate-50 p-2 border border-slate-200 shadow-sm">
                <img
                  src="/logo-bayanledger.png"
                  alt="BayanLedger Logo"
                  className="h-10 w-10 object-contain"
                />
                <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white">
                  <span className="h-1 w-1 rounded-full bg-white" />
                </span>
              </div>
            </div>

            <CardTitle className="text-xl font-bold tracking-tight text-slate-900">Official Portal Login</CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Authorized municipal access for Santa Cruz officers & administrators
            </CardDescription>

            {/* Officer Role Badges Strip */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-1.5 text-[11px] font-medium">
              <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-sky-800 border border-sky-200">
                <Compass className="h-3 w-3 text-sky-700" /> MPDO
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-amber-800 border border-amber-200">
                <Banknote className="h-3 w-3 text-amber-700" /> Budget
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-800 border border-emerald-200">
                <ShieldCheck className="h-3 w-3 text-emerald-700" /> Treasury
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-slate-700 border border-slate-200">
                <UserCheck className="h-3 w-3" /> Admin
              </span>
            </div>
          </CardHeader>

          <CardContent className="pt-2">
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="p-3 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg animate-in fade-in duration-150">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Official Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type="email"
                    placeholder="name@santacruz.gov.ph"
                    className="h-10 rounded-lg pl-9 text-xs border-slate-200 bg-slate-50 focus-visible:ring-slate-400"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type="password"
                    placeholder="••••••••••••"
                    className="h-10 rounded-lg pl-9 text-xs border-slate-200 bg-slate-50 focus-visible:ring-slate-400"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full rounded-lg bg-slate-900 hover:bg-slate-800 text-white h-10 text-xs font-semibold shadow-sm transition-colors"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Authenticating Credentials...
                    </span>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </div>

              <div className="pt-1 text-center">
                <p className="text-[11px] text-slate-400">
                  Role-based permissions & cryptographic smart contracts protect municipal actions.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
