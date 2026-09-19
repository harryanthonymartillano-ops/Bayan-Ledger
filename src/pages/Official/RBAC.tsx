import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import {
  Shield,
  Check,
  Minus,
  Users,
  Lock,
  ArrowRight,
  FileCheck,
  Landmark,
  Wallet,
  ShieldAlert,
} from 'lucide-react';

export const RBAC = () => {
  const roleCards = [
    {
      name: 'MPDC (Planning)',
      color: 'blue',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: FileCheck,
      iconBg: 'bg-blue-50 text-blue-600',
      responsibilities: [
        'Creates approved municipal projects directly on the ledger',
        'Uploads project specifications, blueprints, and cost estimates',
        'Performs on-site inspections and verifies completed milestone deliverables',
      ],
      gateAuthority: 'Originator & Field Verifier',
    },
    {
      name: 'Budget Officer',
      color: 'amber',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      icon: Landmark,
      iconBg: 'bg-amber-50 text-amber-600',
      responsibilities: [
        'Reviews project budget requests against municipal appropriations',
        'Issues official Special Allotment Release Orders (SARO)',
        'Performs Gate 1 financial commitment and first multi-sig sign-off',
      ],
      gateAuthority: 'Gate 1 (SARO Commitment)',
    },
    {
      name: 'Treasurer',
      color: 'emerald',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: Wallet,
      iconBg: 'bg-emerald-50 text-emerald-600',
      responsibilities: [
        'Performs Gate 2 final treasury review and activation',
        'Executes Notice of Cash Allocation (NCA) payments on-chain',
        'Generates cryptographic Digital Seals of Truth for disbursed funds',
      ],
      gateAuthority: 'Gate 2 (NCA Payout & Seal)',
    },
    {
      name: 'Admin',
      color: 'purple',
      badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
      icon: Shield,
      iconBg: 'bg-purple-50 text-purple-600',
      responsibilities: [
        'Manages system credentials and on-chain wallet registrations',
        'Grants and revokes Smart Contract role-based permissions',
        'Monitors anomaly alerts and investigates security breaches',
      ],
      gateAuthority: 'Governance & Security',
    },
  ];

  const permissionsMatrix = [
    {
      role: 'MPDC (Planning)',
      roleBadge: 'bg-blue-50 text-blue-700 border-blue-200',
      viewProjects: true,
      createProjects: true,
      verifyMilestones: true,
      createPaymentRequest: true,
      signSaro: false,
      finalDisbursement: false,
      manageUsers: false,
    },
    {
      role: 'Budget Officer',
      roleBadge: 'bg-amber-50 text-amber-800 border-amber-200',
      viewProjects: true,
      createProjects: false,
      verifyMilestones: false,
      createPaymentRequest: false,
      signSaro: true,
      finalDisbursement: false,
      manageUsers: false,
    },
    {
      role: 'Treasurer',
      roleBadge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      viewProjects: true,
      createProjects: false,
      verifyMilestones: false,
      createPaymentRequest: false,
      signSaro: false,
      finalDisbursement: true,
      manageUsers: false,
    },
    {
      role: 'Admin',
      roleBadge: 'bg-purple-50 text-purple-700 border-purple-200',
      viewProjects: true,
      createProjects: false,
      verifyMilestones: false,
      createPaymentRequest: false,
      signSaro: false,
      finalDisbursement: false,
      manageUsers: true,
    },
  ];

  const renderBadge = (allowed: boolean) => {
    if (allowed) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <Check className="w-3 h-3 text-emerald-600" />
          Allowed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center justify-center w-6 h-5 text-slate-300">
        <Minus className="w-4 h-4" />
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto pb-8 space-y-6">
      {/* ========================================================== */}
      {/* 1. HEADER */}
      {/* ========================================================== */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-200/60 shadow-xs">
              <Shield className="h-5 w-5" />
            </div>
            Role-Based Access Control (RBAC) Matrix
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-3xl">
            Formal separation of powers governing project creation, multi-sig financial signatures, and smart contract authorizations.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            to="/official/users"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-xs transition-colors"
          >
            <Users className="h-3.5 w-3.5 text-slate-500" />
            <span>User Management</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* ========================================================== */}
      {/* 2. MULTI-SIG SECURITY CALLOUT BANNER */}
      {/* ========================================================== */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-5 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-700">
        <div className="flex items-start gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-[#c7a64b]/20 text-[#e9d69e] border border-[#c7a64b]/40 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-[#c7a64b]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">Multi-Signature Separation of Duties</h3>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              No single municipal official can independently disburse public funds. Payouts require physical deliverable verification (MPDC), Special Allotment Release Order sign-off (Budget Officer), and final cryptographic execution with Digital Seal (Treasurer).
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-semibold">
            On-Chain Enforced
          </span>
        </div>
      </div>

      {/* ========================================================== */}
      {/* 3. ROLE RESPONSIBILITY CARDS */}
      {/* ========================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {roleCards.map((rc) => {
          const Icon = rc.icon;
          return (
            <Card key={rc.name} className="border-slate-200 dark:border-[#1e2334] shadow-xs bg-white dark:bg-[#121520] hover:shadow-sm transition-shadow">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className={`h-8 w-8 rounded-lg ${rc.iconBg} flex items-center justify-center`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${rc.badgeClass}`}>
                      {rc.gateAuthority}
                    </span>
                  </div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">{rc.name}</h3>
                  <ul className="mt-2.5 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    {rc.responsibilities.map((resp, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-slate-400 mt-0.5">•</span>
                        <span>{resp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ========================================================== */}
      {/* 4. PERMISSIONS MATRIX TABLE */}
      {/* ========================================================== */}
      <Card className="border-slate-200 dark:border-[#1e2334] shadow-sm overflow-hidden bg-white dark:bg-[#121520]">
        <CardHeader className="border-b border-slate-100 dark:border-[#1e2334] bg-slate-50/50 dark:bg-[#141824] p-4 sm:p-5">
          <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Cryptographic Permission Matrix</CardTitle>
          <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Operational capabilities and blockchain transaction rights assigned to each official role.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-[#151926]">
              <TableRow className="border-b border-slate-200">
                <TableHead className="text-xs font-bold text-slate-700 py-3.5">Official Role</TableHead>
                <TableHead className="text-center text-xs font-bold text-slate-700 py-3.5">View Projects</TableHead>
                <TableHead className="text-center text-xs font-bold text-slate-700 py-3.5">Create Projects</TableHead>
                <TableHead className="text-center text-xs font-bold text-slate-700 py-3.5">Verify Milestones</TableHead>
                <TableHead className="text-center text-xs font-bold text-slate-700 py-3.5">Payment Request</TableHead>
                <TableHead className="text-center text-xs font-bold text-slate-700 py-3.5">Sign SARO (Gate 1)</TableHead>
                <TableHead className="text-center text-xs font-bold text-slate-700 py-3.5">Execute NCA (Gate 2)</TableHead>
                <TableHead className="text-center text-xs font-bold text-slate-700 py-3.5">Manage Users</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissionsMatrix.map((r, idx) => (
                <TableRow key={idx} className="hover:bg-slate-50/80 dark:hover:bg-[#181c2b] transition-colors border-b border-slate-100 dark:border-[#1e2334]">
                  <TableCell className="py-3.5 font-semibold text-slate-900 text-sm">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border ${r.roleBadge}`}>
                      {r.role}
                    </span>
                  </TableCell>
                  <TableCell className="py-3.5 text-center">{renderBadge(r.viewProjects)}</TableCell>
                  <TableCell className="py-3.5 text-center">{renderBadge(r.createProjects)}</TableCell>
                  <TableCell className="py-3.5 text-center">{renderBadge(r.verifyMilestones)}</TableCell>
                  <TableCell className="py-3.5 text-center">{renderBadge(r.createPaymentRequest)}</TableCell>
                  <TableCell className="py-3.5 text-center">{renderBadge(r.signSaro)}</TableCell>
                  <TableCell className="py-3.5 text-center">{renderBadge(r.finalDisbursement)}</TableCell>
                  <TableCell className="py-3.5 text-center">{renderBadge(r.manageUsers)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
