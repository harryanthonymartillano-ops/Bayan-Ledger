import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Shield, Activity, Lock, Database, ArrowRight } from 'lucide-react';

export const Home = () => {
  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Hero Section */}
      <section className="bg-slate-900 text-white py-24 flex-1 flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-sm font-medium mb-8 border border-blue-500/20">
            <Shield className="w-4 h-4" />
            <span>Official Municipal Transparency Portal</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
            Transparent Governance <br className="hidden md:block" />
            via <span className="text-blue-400">Blockchain</span>
          </h1>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-12 leading-relaxed">
            Sta. Cruz Chain brings immutable, real-time tracking to municipal projects. Every peso allocated, disbursed, and utilized is recorded on a public ledger for complete accountability.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link to="/projects">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white h-14 px-8 text-lg w-full sm:w-auto">
                View Public Projects <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="text-slate-900 bg-white hover:bg-slate-100 border-transparent h-14 px-8 text-lg w-full sm:w-auto">
                Official Portal
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900">How It Works</h2>
            <p className="mt-4 text-xl text-slate-600">A modern approach to local government accountability.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="text-center p-6 rounded-2xl bg-slate-50 border border-slate-100 transition-all hover:shadow-md">
              <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6 transform -rotate-3">
                <Database className="h-10 w-10 text-blue-600" />
              </div>
              <h3 className="text-2xl font-semibold mb-4 text-slate-900">Immutable Ledger</h3>
              <p className="text-slate-600 leading-relaxed">All financial transactions (SARO, NCA) are hashed and stored permanently. They cannot be altered or deleted quietly.</p>
            </div>
            <div className="text-center p-6 rounded-2xl bg-slate-50 border border-slate-100 transition-all hover:shadow-md">
              <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6 transform rotate-3">
                <Activity className="h-10 w-10 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-semibold mb-4 text-slate-900">Real-Time Tracking</h3>
              <p className="text-slate-600 leading-relaxed">Citizens can track the progress of infrastructure projects, from planning to completion, with geo-tagged milestones.</p>
            </div>
            <div className="text-center p-6 rounded-2xl bg-slate-50 border border-slate-100 transition-all hover:shadow-md">
              <div className="w-20 h-20 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-6 transform -rotate-3">
                <Lock className="h-10 w-10 text-purple-600" />
              </div>
              <h3 className="text-2xl font-semibold mb-4 text-slate-900">Role-Based Security</h3>
              <p className="text-slate-600 leading-relaxed">Strict access controls ensure that only authorized officials (MPDC, Budget Officer, Treasurer) can encode specific data.</p>
            </div>
          </div>
        </div>
      </section>

      {/* System Overview Section */}
      <section className="py-24 bg-slate-50 border-t border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-sm font-medium mb-6 border border-amber-200">
              <span>Note: This is currently a frontend prototype. Blockchain integration and backend are pending.</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Summary of Workflow Triggers</h2>
            <p className="mt-4 text-xl text-slate-600">The end-to-end flow of accountability and transparency.</p>
          </div>

          <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-lg">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-center p-4 bg-slate-800 rounded-xl w-full">
                <div className="text-blue-400 font-bold mb-1">Step 1</div>
                <div className="font-medium">MPDC</div>
                <div className="text-sm text-slate-400">(Proposal)</div>
              </div>
              <ArrowRight className="hidden md:block text-slate-600 flex-shrink-0" />
              <div className="text-center p-4 bg-slate-800 rounded-xl w-full">
                <div className="text-amber-400 font-bold mb-1">Step 2</div>
                <div className="font-medium">Budget</div>
                <div className="text-sm text-slate-400">(Funding)</div>
              </div>
              <ArrowRight className="hidden md:block text-slate-600 flex-shrink-0" />
              <div className="text-center p-4 bg-slate-800 rounded-xl w-full">
                <div className="text-blue-400 font-bold mb-1">Step 3</div>
                <div className="font-medium">MPDC</div>
                <div className="text-sm text-slate-400">(Verification)</div>
              </div>
              <ArrowRight className="hidden md:block text-slate-600 flex-shrink-0" />
              <div className="text-center p-4 bg-slate-800 rounded-xl w-full">
                <div className="text-emerald-400 font-bold mb-1">Step 4</div>
                <div className="font-medium">Treasurer</div>
                <div className="text-sm text-slate-400">(Payment)</div>
              </div>
              <ArrowRight className="hidden md:block text-slate-600 flex-shrink-0" />
              <div className="text-center p-4 bg-slate-800 rounded-xl w-full">
                <div className="text-purple-400 font-bold mb-1">Step 5</div>
                <div className="font-medium">Public</div>
                <div className="text-sm text-slate-400">(Audit)</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
