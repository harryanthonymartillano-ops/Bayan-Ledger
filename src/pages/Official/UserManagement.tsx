import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth, Role } from '../../context/AuthContext';
import { useBlockchain } from '../../context/BlockchainContext';
import apiClient from '../../lib/apiClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import {
  Users,
  UserPlus,
  LoaderCircle,
  Edit2,
  Lock,
  ToggleRight,
  ShieldCheck,
  Wallet,
  Mail,
  UserRound,
  KeyRound,
  Eye,
  EyeOff,
  Search,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Layers,
  Shield,
  UserCheck,
} from 'lucide-react';
import { flashToast } from '../../components/ui/flash-toast';

interface UserRow {
  id: string;
  email?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  role: string;
  walletAddress?: string;
  status?: string;
}

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  'MPDC (Planning)': 'Creates approved projects directly and verifies milestone completion.',
  'Budget Officer': 'Performs Gate 1 SARO allocation review and first financial signature.',
  Treasurer: 'Performs Gate 2 treasury approval, activation, and payment execution.',
  Admin: 'Manages platform access, chain roles, and governance controls.',
};

export const UserManagement = () => {
  const { user, registeredUsers, token, addRegisteredUser, refreshUsers } = useAuth();
  const { grantRole, revokeRole, isWeb3Connected, connectToWeb3, hasRole } = useBlockchain();
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);
  const [showRegistrationPassword, setShowRegistrationPassword] = useState(false);
  const [showResetPasswords, setShowResetPasswords] = useState(false);
  const [onchainVerification, setOnchainVerification] = useState<Record<string, boolean | undefined>>({});
  const [selectedRole, setSelectedRole] = useState<Role | ''>('');
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [copiedWallet, setCopiedWallet] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const copyWallet = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedWallet(address);
    setTimeout(() => setCopiedWallet(null), 2000);
  };

  const summary = useMemo(() => {
    const total = registeredUsers.length;
    const active = registeredUsers.filter((u) => u.status !== 'Inactive').length;
    const onchainVerified = Object.values(onchainVerification).filter(Boolean).length;
    const withWallet = registeredUsers.filter((u) => Boolean(u.walletAddress)).length;
    return { total, active, onchainVerified, withWallet };
  }, [registeredUsers, onchainVerification]);

  const filteredUsers = useMemo(() => {
    return registeredUsers.filter((u) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const fullName = `${u.firstName || ''} ${u.middleName || ''} ${u.lastName || ''}`.toLowerCase();
        const matchesName = fullName.includes(query);
        const matchesEmail = (u.email || '').toLowerCase().includes(query);
        const matchesWallet = (u.walletAddress || '').toLowerCase().includes(query);
        const matchesRole = (u.role || '').toLowerCase().includes(query);
        return matchesName || matchesEmail || matchesWallet || matchesRole;
      }
      return true;
    });
  }, [registeredUsers, roleFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / ITEMS_PER_PAGE));
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'MPDC':
      case 'MPDC (Planning)':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Budget Officer':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'Treasurer':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Admin':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  useEffect(() => {
    const checkAllRoles = async () => {
      if (!isWeb3Connected || !registeredUsers.length) {
        setOnchainVerification({});
        return;
      }

      const entries: Record<string, boolean | undefined> = {};

      for (const currentUser of registeredUsers) {
        if (!currentUser.walletAddress) {
          entries[currentUser.id] = undefined;
          continue;
        }

        try {
          entries[currentUser.id] = await hasRole(currentUser.role, currentUser.walletAddress);
        } catch {
          entries[currentUser.id] = false;
        }
      }

      setOnchainVerification(entries);
    };

    checkAllRoles().catch((error) => {
      console.warn('Failed to verify on-chain roles:', error);
    });
  }, [registeredUsers, isWeb3Connected, hasRole]);

  if (!user || user.role !== 'Admin') {
    return <div className="p-8 text-center text-red-500 font-bold">Unauthorized access. Admin privileges required.</div>;
  }

  const persistChainRoleStatus = async (userId: string, chainRoleGranted: boolean, walletAddress?: string) => {
    if (!token) {
      throw new Error('You must be logged in to update blockchain role status.');
    }

    await apiClient.updateUserChainRole(token, userId, {
      chainRoleGranted,
      walletAddress,
    });
  };

  const syncOnchainVerification = async (userId: string, role: Role, walletAddress: string) => {
    const verified = await hasRole(role, walletAddress);
    setOnchainVerification((prev) => ({ ...prev, [userId]: verified }));
    return verified;
  };

  const ensureWeb3Connection = async () => {
    if (!isWeb3Connected) {
      await connectToWeb3();
    }
  };

  const grantRoleForUser = async (userId: string, role: Role, walletAddress: string) => {
    await ensureWeb3Connection();
    const txHash = await grantRole(role, walletAddress);
    await persistChainRoleStatus(userId, true, walletAddress);
    await syncOnchainVerification(userId, role, walletAddress);
    return txHash;
  };

  const revokeRoleForUser = async (userId: string, role: Role, walletAddress: string) => {
    await ensureWeb3Connection();
    const txHash = await revokeRole(role, walletAddress);
    await persistChainRoleStatus(userId, false, walletAddress);
    await syncOnchainVerification(userId, role, walletAddress);
    return txHash;
  };

  const handleAddUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmittingUser) return;

    const formData = new FormData(e.currentTarget);
    const firstName = formData.get('firstName') as string;
    const middleName = (formData.get('middleName') as string) || undefined;
    const lastName = formData.get('lastName') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const role = formData.get('role') as Role;
    const walletAddress = (formData.get('walletAddress') as string).trim().toLowerCase();
    let shouldCloseModal = false;
    let roleGrantedOnChain = false;
    let rollbackSucceeded = false;

    try {
      if (!/^0x[a-f0-9]{40}$/i.test(walletAddress)) {
        throw new Error('Enter a valid EVM wallet address before provisioning the official.');
      }

      setIsSubmittingUser(true);
      await ensureWeb3Connection();
      const chainRoleGrantTxHash = await grantRole(role, walletAddress);
      roleGrantedOnChain = true;

      const verified = await hasRole(role, walletAddress);
      if (!verified) {
        throw new Error('Role grant transaction completed, but the account role could not be verified on chain.');
      }

      const createdUser = await addRegisteredUser({
        firstName,
        middleName,
        lastName,
        email,
        password,
        role,
        walletAddress,
        chainRoleGranted: true,
        chainRoleGrantTxHash,
      });

      setOnchainVerification((prev) => ({ ...prev, [createdUser.id]: true }));
      await refreshUsers();
      shouldCloseModal = true;
      flashToast.success('Account Created', 'Official account created and blockchain role granted successfully.');
    } catch (error: any) {
      console.error('User creation error:', error);

      if (roleGrantedOnChain) {
        try {
          await revokeRole(role, walletAddress);
          rollbackSucceeded = true;
        } catch (rollbackError) {
          console.warn('Failed to revoke blockchain role after registration error:', rollbackError);
        }
      }

      const fallbackMessage = rollbackSucceeded
        ? ' The on-chain role grant was rolled back, so no orphaned access remains.'
        : ' The account was not finalized, but the on-chain role rollback needs manual review.';

      flashToast.error('Account Creation Failed', (error.message || 'Failed to create official account.') + fallbackMessage);
    } finally {
      setIsSubmittingUser(false);
    }

    if (shouldCloseModal) {
      setIsAddingUser(false);
      setSelectedRole('');
      setShowRegistrationPassword(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmittingUser || !selectedUser || !token) return;

    const formData = new FormData(e.currentTarget);
    const firstName = formData.get('firstName') as string;
    const middleName = (formData.get('middleName') as string) || undefined;
    const lastName = formData.get('lastName') as string;
    const email = formData.get('email') as string;
    const walletAddress = (formData.get('walletAddress') as string)?.trim().toLowerCase();
    const role = formData.get('role') as string;

    try {
      if (walletAddress && !/^0x[a-f0-9]{40}$/i.test(walletAddress)) {
        throw new Error('Enter a valid EVM wallet address or leave blank.');
      }

      setIsSubmittingUser(true);
      await apiClient.updateUser(token, selectedUser.id, {
        firstName,
        middleName,
        lastName,
        email,
        walletAddress,
        role,
      });

      await refreshUsers();
      setIsEditingUser(false);
      setSelectedUser(null);
      flashToast.success('User Updated', 'User details updated successfully.');
    } catch (error: any) {
      flashToast.error('Update Failed', `Failed to update user: ${error.message || error}`);
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmittingUser || !selectedUser || !token) return;

    const formData = new FormData(e.currentTarget);
    const newPassword = formData.get('newPassword') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (!newPassword || !confirmPassword) {
      flashToast.warning('Missing Fields', 'Please enter and confirm the new password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      flashToast.warning('Password Mismatch', 'Passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      flashToast.warning('Password Too Short', 'Password must be at least 8 characters long.');
      return;
    }

    try {
      setIsSubmittingUser(true);
      await apiClient.resetUserPassword(token, selectedUser.id, newPassword);
      setShowResetPasswords(false);
      setIsResettingPassword(false);
      setSelectedUser(null);
      flashToast.success('Password Reset', `Password reset successfully for ${selectedUser.email}`);
    } catch (error: any) {
      flashToast.error('Reset Failed', `Failed to reset password: ${error.message || error}`);
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: string) => {
    if (!token) return;

    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';

    try {
      if (!window.confirm(`Are you sure you want to ${newStatus.toLowerCase()} this user?`)) return;

      await apiClient.updateUserStatus(token, userId, newStatus as 'Active' | 'Inactive');
      await refreshUsers();
      flashToast.success('Status Updated', `User status changed to ${newStatus}`);
    } catch (error: any) {
      flashToast.error('Update Failed', `Failed to update status: ${error.message || error}`);
    }
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
              <Users className="h-5 w-5" />
            </div>
            User & Governance Management
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-3xl">
            Manage municipal accounts, credential access, on-chain wallet bindings, and Smart Contract role assignments.
          </p>
        </div>

        <Button onClick={() => setIsAddingUser(true)} className="bg-blue-600 hover:bg-blue-700 h-9 px-4 text-xs font-semibold shadow-xs">
          <UserPlus className="w-4 h-4 mr-2" /> Provision Official
        </Button>
      </div>

      {/* ========================================================== */}
      {/* 2. GOVERNANCE KPI CARDS */}
      {/* ========================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Officials */}
        <Card
          onClick={() => { setRoleFilter('ALL'); setCurrentPage(1); }}
          className={`cursor-pointer transition-all border shadow-xs hover:shadow-sm ${roleFilter === 'ALL'
              ? 'ring-2 ring-purple-500 bg-purple-50/80 border-purple-300 dark:bg-purple-950/40 dark:border-purple-500 dark:ring-purple-400'
              : 'border-slate-200 bg-white hover:border-slate-300 dark:border-[#1e2334] dark:bg-[#121520] dark:hover:border-slate-700'
            }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${roleFilter === 'ALL' ? 'text-purple-700 dark:text-purple-200' : 'text-slate-500 dark:text-slate-400'
                }`}>
                Registered Officials
              </span>
              <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${roleFilter === 'ALL'
                  ? 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-200'
                  : 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400'
                }`}>
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className={`mt-2 text-2xl font-black ${roleFilter === 'ALL' ? 'text-purple-950 dark:text-white' : 'text-slate-900 dark:text-white'
              }`}>
              {summary.total}
            </div>
            <p className={`text-[11px] mt-0.5 ${roleFilter === 'ALL' ? 'text-purple-700/80 dark:text-purple-200/80' : 'text-slate-500 dark:text-slate-400'
              }`}>
              Municipal governance accounts
            </p>
          </CardContent>
        </Card>

        {/* Active Accounts */}
        <Card className="border border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#121520] shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Active Logins</span>
              <div className="h-7 w-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <UserCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-emerald-900 dark:text-emerald-300">{summary.active}</div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">Operational portal access</p>
          </CardContent>
        </Card>

        {/* On-Chain Verified Wallets */}
        <Card className="border border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#121520] shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">On-Chain Verified</span>
              <div className="h-7 w-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-blue-900 dark:text-blue-300">{summary.onchainVerified}</div>
            <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">Active smart contract roles</p>
          </CardContent>
        </Card>

        {/* Wallets Bound */}
        <Card className="border border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#121520] shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Wallets Linked</span>
              <div className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{summary.withWallet}</div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">EVM addresses provisioned</p>
          </CardContent>
        </Card>
      </div>

      {isAddingUser && createPortal((
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 sm:p-6 transition-all animate-in fade-in duration-200">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white dark:bg-[#101422] border border-slate-200 dark:border-[#1e2438] shadow-2xl transition-all">
            {/* Modal Header */}
            <div className="shrink-0 border-b border-slate-100 dark:border-[#1a2035] bg-white dark:bg-[#101422] px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20 shadow-2xs">
                    <UserPlus className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Register New Official</h3>
                    <p className="mt-0.5 max-w-xl text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                      Role grant is anchored directly on chain. If the blockchain transaction fails, the portal account will not be created.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowRegistrationPassword(false);
                    setIsAddingUser(false);
                  }}
                  className="rounded-xl p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1a2035] transition-colors"
                  aria-label="Close register official modal"
                >
                  <span className="text-xl leading-none">&times;</span>
                </button>
              </div>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddUser} className="flex-1 overflow-y-auto bg-slate-50/60 dark:bg-[#0c0f1a] p-6">
              <div className="space-y-5">
                {/* Official Identity */}
                <section className="rounded-xl border border-slate-200/90 dark:border-[#1e2438] bg-white dark:bg-[#121727] p-5 shadow-2xs">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                      <UserRound className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Official Identity</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Legal name shown in approval records, disbursement sign-offs, and audit trails.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">First Name *</label>
                      <Input
                        name="firstName"
                        placeholder="Juan"
                        required
                        className="h-10 rounded-lg bg-slate-50/70 dark:bg-[#0e1220] border-slate-200 dark:border-[#222840] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-blue-500/20"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Middle Name <span className="font-normal text-slate-400 dark:text-slate-500">(Optional)</span>
                      </label>
                      <Input
                        name="middleName"
                        placeholder="Dela"
                        className="h-10 rounded-lg bg-slate-50/70 dark:bg-[#0e1220] border-slate-200 dark:border-[#222840] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-blue-500/20"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Last Name *</label>
                      <Input
                        name="lastName"
                        placeholder="Santos"
                        required
                        className="h-10 rounded-lg bg-slate-50/70 dark:bg-[#0e1220] border-slate-200 dark:border-[#222840] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-blue-500/20"
                      />
                    </div>
                  </div>
                </section>

                {/* Access Assignment */}
                <section className="rounded-xl border border-slate-200/90 dark:border-[#1e2438] bg-white dark:bg-[#121727] p-5 shadow-2xs">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Access Assignment</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Portal credentials and smart contract governance role must align.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Role *</label>
                      <select
                        name="role"
                        className="flex h-10 w-full rounded-lg border border-slate-200 dark:border-[#222840] bg-slate-50/70 dark:bg-[#0e1220] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 dark:[&>option]:bg-[#101422] dark:[&>option]:text-slate-100"
                        required
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value as Role)}
                      >
                        <option value="">Select role</option>
                        <option value="MPDC">MPDC</option>
                        <option value="Budget Officer">Budget Officer</option>
                        <option value="Treasurer">Treasurer</option>
                        <option value="Admin">Admin</option>
                      </select>
                    </div>
                    <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-950/30 p-3.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">Role Scope</p>
                      <p className="mt-1 text-xs leading-relaxed text-blue-900/80 dark:text-blue-200/90">
                        {selectedRole ? ROLE_DESCRIPTIONS[selectedRole] : 'Choose a role to preview the municipal responsibilities and privileges.'}
                      </p>
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Official Email *</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                        <Input
                          name="email"
                          type="email"
                          placeholder="official@stacruz.gov.ph"
                          required
                          className="h-10 rounded-lg bg-slate-50/70 dark:bg-[#0e1220] border-slate-200 dark:border-[#222840] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 pl-10 focus-visible:ring-blue-500/20"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Initial Password *</label>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                        <Input
                          name="password"
                          type={showRegistrationPassword ? 'text' : 'password'}
                          placeholder="Create a strong password"
                          required
                          className="h-10 rounded-lg bg-slate-50/70 dark:bg-[#0e1220] border-slate-200 dark:border-[#222840] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 pl-10 pr-11 focus-visible:ring-blue-500/20"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegistrationPassword((current) => !current)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-[#1a2035] focus:outline-none transition-colors"
                          aria-label={showRegistrationPassword ? 'Hide password' : 'Show password'}
                        >
                          {showRegistrationPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Blockchain Wallet */}
                <section className="rounded-xl border border-slate-200/90 dark:border-[#1e2438] bg-white dark:bg-[#121727] p-5 shadow-2xs">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                      <Wallet className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Blockchain Wallet</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">The Ethereum / EVM address that will receive on-chain governance authority.</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Wallet Address (0x...) *</label>
                    <Input
                      name="walletAddress"
                      placeholder="0x1234...abcd"
                      required
                      className="h-10 rounded-lg bg-slate-50/70 dark:bg-[#0e1220] border-slate-200 dark:border-[#222840] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-mono text-xs sm:text-sm focus-visible:ring-blue-500/20"
                    />
                  </div>
                </section>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-[#1a2035] pt-5 mt-5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowRegistrationPassword(false);
                    setIsAddingUser(false);
                  }}
                  disabled={isSubmittingUser}
                  className="rounded-xl border-slate-200 dark:border-[#222840] bg-white dark:bg-[#141828] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1c2238] font-medium text-sm h-10 px-4 transition-colors"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-semibold text-sm shadow-xs transition-colors flex items-center gap-2"
                  disabled={isSubmittingUser}
                >
                  {isSubmittingUser ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Granting role and creating official...
                    </>
                  ) : (
                    'Grant Role and Create Official'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ), document.body)}

      {isEditingUser && selectedUser && createPortal((
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 sm:p-6 transition-all animate-in fade-in duration-200">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white dark:bg-[#101422] border border-slate-200 dark:border-[#1e2438] shadow-2xl transition-all">
            {/* Modal Header */}
            <div className="border-b border-slate-100 dark:border-[#1a2035] bg-white dark:bg-[#101422] px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20 shadow-2xs">
                    <Edit2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Edit Official Details</h3>
                    <p className="mt-0.5 max-w-xl text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                      Update the official identity, access role, and wallet address used in approval records.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsEditingUser(false)}
                  className="rounded-xl p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1a2035] transition-colors"
                  aria-label="Close edit official modal"
                >
                  <span className="text-xl leading-none">&times;</span>
                </button>
              </div>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleEditUser} className="max-h-[calc(90vh-108px)] overflow-y-auto bg-slate-50/60 dark:bg-[#0c0f1a] p-6 space-y-5">
              <section className="rounded-xl border border-slate-200/90 dark:border-[#1e2438] bg-white dark:bg-[#121727] p-5 shadow-2xs">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                    <UserRound className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Official Identity</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Name and contact email recorded in municipal logs.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">First Name *</label>
                    <Input
                      name="firstName"
                      defaultValue={selectedUser.firstName || ''}
                      required
                      className="h-10 rounded-lg bg-slate-50/70 dark:bg-[#0e1220] border-slate-200 dark:border-[#222840] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-blue-500/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Middle Name <span className="font-normal text-slate-400 dark:text-slate-500">(Optional)</span>
                    </label>
                    <Input
                      name="middleName"
                      defaultValue={selectedUser.middleName || ''}
                      className="h-10 rounded-lg bg-slate-50/70 dark:bg-[#0e1220] border-slate-200 dark:border-[#222840] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-blue-500/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Last Name *</label>
                    <Input
                      name="lastName"
                      defaultValue={selectedUser.lastName || ''}
                      required
                      className="h-10 rounded-lg bg-slate-50/70 dark:bg-[#0e1220] border-slate-200 dark:border-[#222840] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-blue-500/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Email *</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                      <Input
                        name="email"
                        type="email"
                        defaultValue={selectedUser.email || ''}
                        required
                        className="h-10 rounded-lg bg-slate-50/70 dark:bg-[#0e1220] border-slate-200 dark:border-[#222840] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 pl-10 focus-visible:ring-blue-500/20"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200/90 dark:border-[#1e2438] bg-white dark:bg-[#121727] p-5 shadow-2xs">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Access and Wallet</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Portal role and blockchain wallet for official actions.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Role *</label>
                    <select
                      name="role"
                      className="flex h-10 w-full rounded-lg border border-slate-200 dark:border-[#222840] bg-slate-50/70 dark:bg-[#0e1220] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 dark:[&>option]:bg-[#101422] dark:[&>option]:text-slate-100"
                      required
                      defaultValue={selectedUser.role}
                    >
                      <option value="MPDC">MPDC</option>
                      <option value="Budget Officer">Budget Officer</option>
                      <option value="Treasurer">Treasurer</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Wallet Address</label>
                    <div className="relative">
                      <Wallet className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                      <Input
                        name="walletAddress"
                        defaultValue={selectedUser.walletAddress || ''}
                        className="h-10 rounded-lg bg-slate-50/70 dark:bg-[#0e1220] border-slate-200 dark:border-[#222840] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 pl-10 font-mono text-xs sm:text-sm focus-visible:ring-blue-500/20"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-[#1a2035] pt-5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditingUser(false)}
                  disabled={isSubmittingUser}
                  className="rounded-xl border-slate-200 dark:border-[#222840] bg-white dark:bg-[#141828] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1c2238] font-medium text-sm h-10 px-4 transition-colors"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-semibold text-sm shadow-xs transition-colors flex items-center gap-2"
                  disabled={isSubmittingUser}
                >
                  {isSubmittingUser ? <LoaderCircle className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      ), document.body)}

      {isResettingPassword && selectedUser && createPortal((
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 sm:p-6 transition-all animate-in fade-in duration-200">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white dark:bg-[#101422] border border-slate-200 dark:border-[#1e2438] shadow-2xl transition-all">
            {/* Modal Header */}
            <div className="border-b border-slate-100 dark:border-[#1a2035] bg-white dark:bg-[#101422] px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20 shadow-2xs">
                    <Lock className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Reset Password</h3>
                    <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">Set a new access password for {selectedUser.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowResetPasswords(false);
                    setIsResettingPassword(false);
                  }}
                  className="rounded-xl p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1a2035] transition-colors"
                  aria-label="Close reset password modal"
                >
                  <span className="text-xl leading-none">&times;</span>
                </button>
              </div>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleResetPassword} className="bg-slate-50/60 dark:bg-[#0c0f1a] p-6 space-y-5">
              <section className="rounded-xl border border-slate-200/90 dark:border-[#1e2438] bg-white dark:bg-[#121727] p-5 shadow-2xs">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">New Credentials</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Choose a secure password of at least 8 characters.</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">New Password *</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                      <Input
                        name="newPassword"
                        type={showResetPasswords ? 'text' : 'password'}
                        placeholder="Enter new password"
                        required
                        className="h-10 rounded-lg bg-slate-50/70 dark:bg-[#0e1220] border-slate-200 dark:border-[#222840] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 pl-10 pr-11 focus-visible:ring-blue-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetPasswords((current) => !current)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-[#1a2035] focus:outline-none transition-colors"
                        aria-label={showResetPasswords ? 'Hide passwords' : 'Show passwords'}
                      >
                        {showResetPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Confirm Password *</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                      <Input
                        name="confirmPassword"
                        type={showResetPasswords ? 'text' : 'password'}
                        placeholder="Confirm new password"
                        required
                        className="h-10 rounded-lg bg-slate-50/70 dark:bg-[#0e1220] border-slate-200 dark:border-[#222840] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 pl-10 pr-11 focus-visible:ring-blue-500/20"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-950/30 p-3.5">
                <p className="text-xs leading-relaxed text-blue-900/80 dark:text-blue-200/90">
                  <strong>Notice:</strong> Please securely communicate the updated credentials to the official.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-[#1a2035] pt-5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowResetPasswords(false);
                    setIsResettingPassword(false);
                  }}
                  disabled={isSubmittingUser}
                  className="rounded-xl border-slate-200 dark:border-[#222840] bg-white dark:bg-[#141828] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1c2238] font-medium text-sm h-10 px-4 transition-colors"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="h-10 px-5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm shadow-xs transition-colors flex items-center gap-2"
                  disabled={isSubmittingUser}
                >
                  {isSubmittingUser ? <LoaderCircle className="h-4 w-4 animate-spin mr-2" /> : null}
                  Reset Password
                </Button>
              </div>
            </form>
          </div>
        </div>
      ), document.body)}

      <Card className="border-slate-200 dark:border-[#1e2334] shadow-sm overflow-hidden bg-white dark:bg-[#121520]">
        <CardHeader className="border-b border-slate-100 dark:border-[#1e2334] bg-slate-50/50 dark:bg-[#141824] p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Provisioned Officials</CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Authorized government operators with cryptographic Smart Contract sign-off capabilities.
              </CardDescription>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* Search input */}
              <div className="relative min-w-[240px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search name, email, wallet..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 h-9 text-xs bg-white dark:bg-[#121520] dark:border-[#212638] dark:text-white"
                />
              </div>

              {/* Role filter chips */}
              <div className="flex items-center gap-1 overflow-x-auto bg-slate-100 dark:bg-[#161a26] p-1 rounded-lg border border-slate-200 dark:border-[#212638]">
                {['ALL', 'MPDC (Planning)', 'Budget Officer', 'Treasurer', 'Admin'].map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      setRoleFilter(r);
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap ${roleFilter === r
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-white dark:text-slate-950 font-bold'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                      }`}
                  >
                    {r === 'ALL' ? 'All Roles' : r === 'MPDC (Planning)' ? 'MPDC' : r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="border-b border-slate-200">
                <TableHead className="text-xs font-bold text-slate-600 py-3">Official</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 py-3">Role Authority</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 py-3">Email Address</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 py-3">Status</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 py-3">Wallet Address</TableHead>
                <TableHead className="text-xs font-bold text-slate-600 py-3">On-Chain State</TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-600 py-3">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedUsers.map((currentUser) => {
                const fullName = `${currentUser.firstName || ''} ${currentUser.middleName ? `${currentUser.middleName.charAt(0)}. ` : ''}${currentUser.lastName || ''}`.trim() || 'Unnamed Official';
                const initial = (currentUser.firstName?.charAt(0) || currentUser.email?.charAt(0) || 'U').toUpperCase();
                const isSelf = user.id === currentUser.id;

                return (
                  <TableRow key={currentUser.id} className="hover:bg-slate-50/80 dark:hover:bg-[#181c2b] transition-colors border-b border-slate-100 dark:border-[#1e2334]">
                    {/* Name & Avatar */}
                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
                          {initial}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                            <span>{fullName}</span>
                            {isSelf && <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.2 rounded font-medium">You</span>}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">ID: {currentUser.id.substring(0, 10)}...</div>
                        </div>
                      </div>
                    </TableCell>

                    {/* Role */}
                    <TableCell className="py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${getRoleColor(currentUser.role)}`}>
                        {currentUser.role}
                      </span>
                    </TableCell>

                    {/* Email */}
                    <TableCell className="py-3 text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{currentUser.email}</span>
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-3">
                      <Badge variant={currentUser.status === 'Active' ? 'default' : 'secondary'} className={`text-[10px] font-semibold ${currentUser.status === 'Active' || !currentUser.status
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                        {currentUser.status || 'Active'}
                      </Badge>
                    </TableCell>

                    {/* Wallet */}
                    <TableCell className="py-3">
                      {currentUser.walletAddress ? (
                        <div className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                          <Wallet className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{currentUser.walletAddress.substring(0, 6)}...{currentUser.walletAddress.substring(currentUser.walletAddress.length - 4)}</span>
                          <button
                            type="button"
                            onClick={() => copyWallet(currentUser.walletAddress!)}
                            title="Copy Wallet Address"
                            className="text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            {copiedWallet === currentUser.walletAddress ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">No Wallet</span>
                      )}
                    </TableCell>

                    {/* On-chain Role */}
                    <TableCell className="py-3">
                      {onchainVerification[currentUser.id] ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <Check className="w-3 h-3 text-emerald-600" />
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          Pending Sync
                        </span>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right py-3">
                      {isSelf ? (
                        <span className="text-xs text-slate-400 italic">Self Account</span>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => { setSelectedUser(currentUser); setIsEditingUser(true); }}
                            title="Edit Official"
                            className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1e2334] hover:text-slate-800 dark:hover:text-white transition-colors border border-slate-200/80 dark:border-[#1e2334] shadow-xs"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => { setSelectedUser(currentUser); setIsResettingPassword(true); }}
                            title="Reset Password"
                            className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1e2334] hover:text-slate-800 dark:hover:text-white transition-colors border border-slate-200/80 dark:border-[#1e2334] shadow-xs"
                          >
                            <Lock className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleUserStatus(currentUser.id, currentUser.status || 'Active')}
                            title="Toggle Active Status"
                            className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1e2334] hover:text-slate-800 dark:hover:text-white transition-colors border border-slate-200/80 dark:border-[#1e2334] shadow-xs"
                          >
                            <ToggleRight className="h-3.5 w-3.5" />
                          </button>

                          {onchainVerification[currentUser.id] ? (
                            <button
                              type="button"
                              onClick={async () => {
                                if (!currentUser.walletAddress) return flashToast.error('Error', 'No wallet address');
                                try {
                                  await revokeRoleForUser(currentUser.id, currentUser.role as Role, currentUser.walletAddress);
                                  await refreshUsers();
                                  flashToast.success('Role Revoked', 'Blockchain role revoked');
                                } catch (error: any) {
                                  flashToast.error('Revoke Failed', error.message || 'Failed to revoke role');
                                }
                              }}
                              className="px-2 py-1 text-[11px] font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors"
                            >
                              Revoke
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={async () => {
                                if (!currentUser.walletAddress) return flashToast.error('Error', 'No wallet address');
                                try {
                                  await grantRoleForUser(currentUser.id, currentUser.role as Role, currentUser.walletAddress);
                                  await refreshUsers();
                                  flashToast.success('Role Granted', 'Blockchain role granted');
                                } catch (error: any) {
                                  flashToast.error('Grant Failed', error.message || 'Failed to grant role');
                                }
                              }}
                              className="px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors"
                            >
                              Grant
                            </button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}

              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-36 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Users className="h-6 w-6 text-slate-300" />
                      <p className="text-sm font-medium text-slate-600">No officials found matching your filters.</p>
                      <button
                        onClick={() => {
                          setSearchTerm('');
                          setRoleFilter('ALL');
                        }}
                        className="text-xs text-blue-600 hover:underline font-semibold"
                      >
                        Reset filters
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {filteredUsers.length > ITEMS_PER_PAGE && (
            <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200 bg-white px-5 py-3.5 sm:flex-row">
              <div className="text-xs font-medium text-slate-600">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length} officials
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`h-8 min-w-8 rounded-md px-2 text-xs font-bold transition-colors ${currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
