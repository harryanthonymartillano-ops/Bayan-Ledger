import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBlockchain, Project, Milestone } from '../../context/BlockchainContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { MapPin, CheckCircle, Activity, Clock, Plus, FileText, FileCheck, FileSignature, Landmark, ArrowLeft, AlertTriangle, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';

export const Dashboard = () => {
  const { user } = useAuth();
  const { projects, alerts, resolveAlert, addMilestone, verifyMilestone, addTransaction, addDocument, addProject } = useBlockchain();
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  if (!user) {
    return <div className="p-8 text-center text-red-500 font-bold">Unauthorized access. Please login.</div>;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Completed': return <Badge variant="default" className="bg-emerald-500"><CheckCircle className="w-3 h-3 mr-1"/> Completed</Badge>;
      case 'In Progress': return <Badge variant="default" className="bg-blue-500"><Activity className="w-3 h-3 mr-1"/> In Progress</Badge>;
      case 'Milestone Verified': return <Badge variant="default" className="bg-purple-500"><CheckCircle className="w-3 h-3 mr-1"/> Milestone Verified</Badge>;
      case 'Allocated': return <Badge variant="default" className="bg-amber-500"><Landmark className="w-3 h-3 mr-1"/> Allocated</Badge>;
      case 'Pending': return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1"/> Pending</Badge>;
      case 'On Hold': return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1"/> On Hold</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const safeFormatDate = (dateString: string | undefined, formatStr: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? 'Invalid Date' : format(date, formatStr);
  };

  const renderRoleSpecificActions = (project: Project) => {
    switch (user.role) {
      case 'MPDC (Planning)':
        const pendingMilestones = project.milestones.filter(m => m.status === 'Pending');
        return (
          <div className="mt-4 space-y-4">
            {pendingMilestones.length > 0 ? (
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2 flex items-center"><MapPin className="w-4 h-4 mr-2" /> Verify Progress Milestone</h4>
                <p className="text-sm text-blue-700 mb-4">
                  Upload a photo/report to sign and verify that the contractor has hit the milestone. The smart contract validates this signature. 
                  <strong> This file is permanently attached to the blockchain record and visible to the public for transparency.</strong>
                </p>
                <form className="space-y-3" onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const milestoneId = formData.get('milestoneId') as string;
                  verifyMilestone(project.id, milestoneId, user.id, 'https://picsum.photos/seed/verified/400/300');
                  e.currentTarget.reset();
                  alert('Milestone verified and signed on the blockchain successfully.');
                }}>
                  <select name="milestoneId" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" required>
                    <option value="">Select milestone to verify...</option>
                    {project.milestones.map((m, index) => {
                      if (m.status !== 'Pending') return null;
                      const isPreviousVerified = index === 0 || project.milestones[index - 1].status === 'Verified' || project.milestones[index - 1].status === 'Paid';
                      return (
                        <option key={m.id} value={m.id} disabled={!isPreviousVerified}>
                          {m.title} ({m.percentage}%) {!isPreviousVerified ? '(Previous milestone incomplete)' : ''}
                        </option>
                      );
                    })}
                  </select>
                  <Input type="file" accept="image/*" className="cursor-pointer" required />
                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Verify & Sign Milestone</Button>
                </form>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center text-slate-500">
                No pending milestones to verify.
              </div>
            )}
          </div>
        );
      case 'Budget Officer':
        if (project.status !== 'Pending') {
          return (
            <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg text-center text-slate-500">
              Budget already allocated for this project.
            </div>
          );
        }
        return (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-lg">
            <h4 className="font-semibold text-amber-900 mb-2 flex items-center"><FileSignature className="w-4 h-4 mr-2" /> Budget Tagging (SARO)</h4>
            <p className="text-sm text-amber-700 mb-4">Attach the digital SARO (Special Allotment) to the Project ID. Funds will be "locked" to this project.</p>
            <form className="space-y-3" onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              addTransaction(project.id, {
                amount: project.totalBudget, // Usually allocates the full budget
                type: 'Allocation (SARO)',
                date: new Date().toISOString(),
                recordedBy: user.id,
                recordedByRole: user.role,
                description: `SARO Allocation: ${formData.get('saro')}`,
              }, formData.get('saro') as string);
              e.currentTarget.reset();
              alert('Funds locked and SARO recorded to blockchain successfully.');
            }}>
              <Input name="saro" placeholder="SARO Reference No. (e.g., SARO-2026-XXX)" required />
              <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700">Lock Funds & Allocate</Button>
            </form>
          </div>
        );
      case 'Treasurer':
        if (project.status !== 'Milestone Verified') {
          return (
            <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg text-center text-slate-500">
              Waiting for MPDC to verify a milestone before funds can be disbursed.
            </div>
          );
        }
        
        const verifiedMilestone = project.milestones.find(m => m.status === 'Verified');
        const trancheAmount = verifiedMilestone ? (project.totalBudget * (verifiedMilestone.percentage / 100)) - project.disbursedFunds : 0;

        return (
          <div className="mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-lg">
            <h4 className="font-semibold text-emerald-900 mb-2 flex items-center"><Landmark className="w-4 h-4 mr-2" /> Fund Disbursement (NCA)</h4>
            <p className="text-sm text-emerald-700 mb-4">MPDC has verified a milestone. Execute the NCA for this tranche.</p>
            <form className="space-y-3" onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const amount = Number(formData.get('amount'));
              
              try {
                addTransaction(project.id, {
                  amount,
                  type: 'Disbursement (NCA)',
                  date: new Date().toISOString(),
                  recordedBy: user.id,
                  recordedByRole: user.role,
                  description: `NCA Disbursement for ${verifiedMilestone?.title}`,
                });
                e.currentTarget.reset();
                alert('NCA recorded and SHA-256 Hash generated successfully.');
              } catch (error: any) {
                alert(error.message);
              }
            }}>
              <div className="bg-white p-3 rounded border border-emerald-200 mb-3">
                <div className="text-xs text-emerald-600 font-semibold uppercase tracking-wider mb-1">Suggested Tranche Amount</div>
                <div className="text-lg font-bold text-slate-900">{formatCurrency(trancheAmount)}</div>
              </div>
              <Input name="amount" type="number" min="1" defaultValue={trancheAmount} placeholder="Amount (PHP)" required />
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700">Execute Disbursement</Button>
            </form>
          </div>
        );
      case 'Admin / HR':
        const projectAlerts = alerts.filter(a => a.projectId === project.id);
        const unresolvedAlerts = projectAlerts.filter(a => a.status === 'Unresolved');

        return (
          <div className="mt-4 p-4 bg-purple-50 border border-purple-100 rounded-lg">
            <h4 className="font-semibold text-purple-900 mb-2 flex items-center"><AlertTriangle className="w-4 h-4 mr-2" /> System Oversight</h4>
            <p className="text-sm text-purple-700 mb-4">Monitor the dashboard for red flags. The Alert System automatically freezes transactions if disbursements exceed allocations.</p>
            <div className="bg-white p-4 rounded border border-purple-200 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-slate-700">Budget Integrity Status</span>
                {project.disbursedFunds <= project.allocatedFunds ? (
                  <Badge className="bg-emerald-500">Secure</Badge>
                ) : (
                  <Badge variant="destructive">Violation Detected</Badge>
                )}
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2.5 mt-2">
                <div className={`h-2.5 rounded-full ${project.disbursedFunds > project.allocatedFunds ? 'bg-red-600' : 'bg-emerald-600'}`} style={{ width: `${Math.min(100, (project.disbursedFunds / (project.allocatedFunds || 1)) * 100)}%` }}></div>
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>Disbursed: {formatCurrency(project.disbursedFunds)}</span>
                <span>Allocated: {formatCurrency(project.allocatedFunds)}</span>
              </div>
            </div>

            {projectAlerts.length > 0 && (
              <div className="space-y-3">
                <h5 className="font-semibold text-sm text-slate-900">System Alerts & Public Reports</h5>
                {projectAlerts.map(alert => (
                  <div key={alert.id} className={`p-3 rounded border text-sm flex justify-between items-start ${alert.status === 'Unresolved' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                    <div>
                      <div className="font-medium mb-1">{alert.message}</div>
                      <div className="text-xs opacity-70">{safeFormatDate(alert.date, 'MMM dd, yyyy HH:mm')}</div>
                    </div>
                    {alert.status === 'Unresolved' && (
                      <Button size="sm" variant="outline" className="text-xs shrink-0 ml-4" onClick={() => resolveAlert(alert.id)}>
                        Mark Resolved
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');

  const renderDashboardWidgets = () => {
    switch (user.role) {
      case 'MPDC (Planning)':
        const pendingMilestonesCount = projects.reduce((acc, p) => acc + p.milestones.filter(m => m.status === 'Pending').length, 0);
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="border-blue-200 bg-blue-50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-800 uppercase tracking-wider">Pending Milestones</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-900">{pendingMilestonesCount}</div>
                <p className="text-xs text-blue-600 mt-1">Awaiting verification</p>
              </CardContent>
            </Card>
          </div>
        );
      case 'Budget Officer':
        const totalAllotment = projects.reduce((acc, p) => acc + p.allocatedFunds, 0);
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="border-amber-200 bg-amber-50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-amber-800 uppercase tracking-wider">Total Allotment (SARO)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-900">{formatCurrency(totalAllotment)}</div>
                <p className="text-xs text-amber-600 mt-1">Locked funds across all projects</p>
              </CardContent>
            </Card>
          </div>
        );
      case 'Treasurer':
        const totalDisbursed = projects.reduce((acc, p) => acc + p.disbursedFunds, 0);
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="border-emerald-200 bg-emerald-50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-emerald-800 uppercase tracking-wider">Total Disbursed (NCA)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-900">{formatCurrency(totalDisbursed)}</div>
                <p className="text-xs text-emerald-600 mt-1">Released funds across all projects</p>
              </CardContent>
            </Card>
          </div>
        );
      case 'Admin / HR':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card className="border-purple-200 bg-purple-50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-purple-800 uppercase tracking-wider">Active Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-900">4</div>
                <p className="text-xs text-purple-600 mt-1">Registered officials</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-800 uppercase tracking-wider flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2 text-amber-500" /> Active Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">{alerts.filter(a => a.status === 'Unresolved').length}</div>
                <p className="text-xs text-slate-500 mt-1">Requiring admin review</p>
              </CardContent>
            </Card>
          </div>
        );
      default:
        return null;
    }
  };

  const renderMultiSigIndicator = (project: Project) => {
    const isBudgetAllocated = project.allocatedFunds > 0;
    const isMilestoneVerified = project.milestones.some(m => m.status === 'Verified' || m.status === 'Paid');
    const isPaymentPending = isMilestoneVerified && project.disbursedFunds < project.allocatedFunds;
    const isFullyPaid = project.allocatedFunds > 0 && project.disbursedFunds >= project.allocatedFunds;
    const isPartiallyPaid = project.disbursedFunds > 0 && project.disbursedFunds < project.allocatedFunds;

    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-8">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 flex items-center">
          <ShieldCheck className="w-4 h-4 mr-2 text-blue-600" />
          Blockchain Multi-Sig Status
        </h3>
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          <div className={`flex-1 p-4 rounded-lg border ${isBudgetAllocated ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center mb-2">
              {isBudgetAllocated ? <CheckCircle className="w-5 h-5 text-emerald-500 mr-2" /> : <Clock className="w-5 h-5 text-slate-400 mr-2" />}
              <span className={`font-medium ${isBudgetAllocated ? 'text-emerald-900' : 'text-slate-600'}`}>Budget Officer</span>
            </div>
            <p className={`text-sm ${isBudgetAllocated ? 'text-emerald-700' : 'text-slate-500'}`}>
              {isBudgetAllocated ? 'Allotted Funds (Digital Signature Found)' : 'Pending Allocation'}
            </p>
          </div>

          <div className={`flex-1 p-4 rounded-lg border ${isMilestoneVerified ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center mb-2">
              {isMilestoneVerified ? <CheckCircle className="w-5 h-5 text-emerald-500 mr-2" /> : <Clock className="w-5 h-5 text-slate-400 mr-2" />}
              <span className={`font-medium ${isMilestoneVerified ? 'text-emerald-900' : 'text-slate-600'}`}>MPDC</span>
            </div>
            <p className={`text-sm ${isMilestoneVerified ? 'text-emerald-700' : 'text-slate-500'}`}>
              {isMilestoneVerified ? 'Verified Milestone (Digital Signature Found)' : 'Pending Verification'}
            </p>
          </div>

          <div className={`flex-1 p-4 rounded-lg border ${isFullyPaid ? 'bg-emerald-50 border-emerald-200' : isPaymentPending ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center mb-2">
              {isFullyPaid ? <CheckCircle className="w-5 h-5 text-emerald-500 mr-2" /> : isPaymentPending ? <AlertTriangle className="w-5 h-5 text-amber-500 mr-2" /> : <Clock className="w-5 h-5 text-slate-400 mr-2" />}
              <span className={`font-medium ${isFullyPaid ? 'text-emerald-900' : isPaymentPending ? 'text-amber-900' : 'text-slate-600'}`}>Treasurer</span>
            </div>
            <p className={`text-sm ${isFullyPaid ? 'text-emerald-700' : isPaymentPending ? 'text-amber-700' : 'text-slate-500'}`}>
              {isFullyPaid ? 'Fully Paid (Digital Signature Found)' : isPartiallyPaid ? 'Partially Paid (Pending Signatures)' : isPaymentPending ? 'Payment Pending (Waiting for Signature)' : 'Pending Payment'}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto">
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">Initiate New Project</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const category = formData.get('category') as string;
              const customCategory = formData.get('customCategory') as string;
              const finalCategory = category === 'Other' ? customCategory : category;
              
              const barangay = formData.get('barangay') as string;
              const specificLocation = formData.get('specificLocation') as string;
              const finalLocation = `${specificLocation}, ${barangay}`;

              addProject({
                name: formData.get('name') as string,
                description: formData.get('description') as string,
                location: finalLocation,
                category: finalCategory,
                totalBudget: Number(formData.get('totalBudget')),
              });
              setIsCreateModalOpen(false);
              setSelectedCategory('');
              alert('Project created successfully. The smart contract has generated a unique Project ID and set status to "Pending".');
            }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project Name</label>
                <Input name="name" placeholder="e.g., Pagsawitan Drainage Repair" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <Input name="description" placeholder="Brief project description" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Barangay</label>
                  <select name="barangay" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" required>
                    <option value="">Select Barangay...</option>
                    <option value="Pagsawitan">Pagsawitan</option>
                    <option value="Poblacion">Poblacion</option>
                    <option value="San Pablo">San Pablo</option>
                    <option value="Santo Angel">Santo Angel</option>
                    <option value="Gatid">Gatid</option>
                    <option value="Bagumbayan">Bagumbayan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Specific Location</label>
                  <Input name="specificLocation" placeholder="e.g., Purok 4, Rizal St." required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select 
                  name="category" 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" 
                  required
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="">Select category...</option>
                  <option value="Infrastructure">Infrastructure</option>
                  <option value="Health">Health</option>
                  <option value="Education">Education</option>
                  <option value="Social Services">Social Services</option>
                  <option value="Other">Other (Add New)</option>
                </select>
              </div>
              {selectedCategory === 'Other' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Custom Category</label>
                  <Input name="customCategory" placeholder="e.g., Environmental" required />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Total Budget (PHP)</label>
                <Input name="totalBudget" type="number" min="1" placeholder="e.g., 500000" required />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => { setIsCreateModalOpen(false); setSelectedCategory(''); }}>Cancel</Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Create Project</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!selectedProject ? (
        <>
          {renderDashboardWidgets()}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-6">
            <div>
              <CardTitle className="text-2xl">Projects Overview</CardTitle>
              <CardDescription>Manage and track all municipal projects.</CardDescription>
            </div>
            {user.role === 'MPDC (Planning)' && (
              <Button onClick={() => setIsCreateModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" /> Project Initiation
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[100px]">ID</TableHead>
                  <TableHead>Project Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map(project => (
                  <TableRow 
                    key={project.id} 
                    className="cursor-pointer hover:bg-slate-50 transition-colors" 
                    onClick={() => setSelectedProject(project.id)}
                  >
                    <TableCell className="font-mono text-xs text-slate-500">{project.id}</TableCell>
                    <TableCell className="font-medium text-slate-900">{project.name}</TableCell>
                    <TableCell className="text-slate-600">{project.location}</TableCell>
                    <TableCell className="font-medium text-slate-900">{formatCurrency(project.totalBudget)}</TableCell>
                    <TableCell>{getStatusBadge(project.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedProject(project.id); }}>
                        Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {projects.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                      No projects found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        </>
      ) : (
        <div className="space-y-6">
          <Button variant="ghost" className="mb-2 -ml-4" onClick={() => setSelectedProject(null)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Projects List
          </Button>
          
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-6">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded">ID: {selectedProject}</span>
                {getStatusBadge(projects.find(p => p.id === selectedProject)?.status || '')}
              </div>
              <CardTitle className="text-2xl">
                {projects.find(p => p.id === selectedProject)?.name}
              </CardTitle>
              <CardDescription className="flex items-center mt-2 text-slate-500">
                <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
                <span>{projects.find(p => p.id === selectedProject)?.location}</span>
                <span className="mx-2">•</span>
                <span>{projects.find(p => p.id === selectedProject)?.category}</span>
                {projects.find(p => p.id === selectedProject)?.saro && (
                  <>
                    <span className="mx-2">•</span>
                    <span className="font-mono text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                      {projects.find(p => p.id === selectedProject)?.saro}
                    </span>
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-sm font-medium text-slate-500 mb-1">Total Budget</p>
                  <p className="text-2xl font-bold text-slate-900">{formatCurrency(projects.find(p => p.id === selectedProject)?.totalBudget || 0)}</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <p className="text-sm font-medium text-blue-600 mb-1">Allocated (SARO)</p>
                  <p className="text-2xl font-bold text-blue-700">{formatCurrency(projects.find(p => p.id === selectedProject)?.allocatedFunds || 0)}</p>
                </div>
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                  <p className="text-sm font-medium text-emerald-600 mb-1">Disbursed (NCA)</p>
                  <p className="text-2xl font-bold text-emerald-700">{formatCurrency(projects.find(p => p.id === selectedProject)?.disbursedFunds || 0)}</p>
                </div>
              </div>

              {renderMultiSigIndicator(projects.find(p => p.id === selectedProject)!)}

              <div className="border-t border-slate-200 pt-8">
                <h3 className="text-xl font-semibold mb-4 text-slate-900">Role Actions</h3>
                {renderRoleSpecificActions(projects.find(p => p.id === selectedProject)!)}
              </div>

              <div className="border-t border-slate-200 pt-8 mt-8">
                <h3 className="text-xl font-semibold mb-4 text-slate-900">Project Milestones</h3>
                <div className="space-y-4">
                  {projects.find(p => p.id === selectedProject)?.milestones.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-slate-900">{m.title}</h4>
                          <Badge variant="outline" className="bg-slate-50">{m.percentage}%</Badge>
                          {m.status === 'Verified' && <Badge className="bg-purple-500">Verified</Badge>}
                          {m.status === 'Paid' && <Badge className="bg-emerald-500">Paid</Badge>}
                          {m.status === 'Pending' && <Badge variant="secondary">Pending</Badge>}
                        </div>
                        <p className="text-sm text-slate-500">{m.description}</p>
                      </div>
                      {m.dateVerified && (
                        <div className="text-right text-xs text-slate-400">
                          Verified: {safeFormatDate(m.dateVerified, 'MMM dd, yyyy')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-200 pt-8 mt-8">
                <h3 className="text-xl font-semibold mb-4 text-slate-900">Recent Ledger Entries</h3>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount/Details</TableHead>
                        <TableHead>Tx Hash</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projects.find(p => p.id === selectedProject)?.transactions.slice(-5).reverse().map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="whitespace-nowrap text-sm text-slate-500">
                            {safeFormatDate(tx.date, 'MMM dd, yyyy HH:mm')}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-medium text-slate-700">{tx.type}</span>
                          </TableCell>
                          <TableCell className="font-medium text-sm text-slate-900">
                            {formatCurrency(tx.amount)}
                            <div className="text-xs text-slate-500 font-normal mt-0.5">{tx.description}</div>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100" title={tx.hash}>
                              {tx.hash.substring(0, 10)}...
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                      {projects.find(p => p.id === selectedProject)?.transactions.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center text-slate-500">
                            No ledger entries found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
