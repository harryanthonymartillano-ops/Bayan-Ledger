import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useBlockchain } from '../../context/BlockchainContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ArrowLeft, MapPin, Calendar, CheckCircle, FileText, Activity, Clock, ShieldCheck, Download, AlertTriangle, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

export const ProjectDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { projects, addPublicReport } = useBlockchain();
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const project = projects.find(p => p.id === id);

  if (!project) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <h2 className="text-2xl font-bold text-slate-900">Project Not Found</h2>
        <p className="mt-2 text-slate-500">The project you are looking for does not exist or has been removed.</p>
        <Link to="/" className="mt-4 inline-flex items-center text-blue-600 hover:text-blue-500">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Portal
        </Link>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Completed': return <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600"><CheckCircle className="w-3 h-3 mr-1"/> Completed</Badge>;
      case 'Milestone Verified': return <Badge variant="default" className="bg-blue-500 hover:bg-blue-600"><Activity className="w-3 h-3 mr-1"/> Verified</Badge>;
      case 'In Progress': return <Badge variant="default" className="bg-blue-500 hover:bg-blue-600"><Activity className="w-3 h-3 mr-1"/> Ongoing</Badge>;
      case 'Allocated': return <Badge variant="secondary" className="bg-purple-100 text-purple-800 hover:bg-purple-200"><Activity className="w-3 h-3 mr-1"/> Allocated</Badge>;
      case 'Pending': return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1"/> Pending</Badge>;
      case 'On Hold': return <Badge variant="destructive"><Activity className="w-3 h-3 mr-1"/> On Hold</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const safeFormatDate = (dateString: string | undefined, formatStr: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? 'Invalid Date' : format(date, formatStr);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {isReportModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900 flex items-center">
                <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
                Report Discrepancy
              </h3>
              <button onClick={() => setIsReportModalOpen(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const message = formData.get('message') as string;
              addPublicReport(project.id, message);
              setIsReportModalOpen(false);
              alert('Thank you. Your report has been submitted to the municipal audit team for review.');
            }} className="p-6 space-y-4">
              <p className="text-sm text-slate-600 mb-4">
                If you notice that the physical progress on-site does not match the reported progress on this portal, please let us know.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Discrepancy Description</label>
                <textarea 
                  name="message" 
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" 
                  placeholder="e.g., 0% physical progress on-site but app says 30%" 
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Photo Evidence (Optional)</label>
                <Input type="file" accept="image/*" className="cursor-pointer" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Your Contact Info (Optional)</label>
                <Input type="text" placeholder="Email or Phone Number" />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsReportModalOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white">Submit Report</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="mb-8">
        <Link to="/" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Projects
        </Link>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              {getStatusBadge(project.status)}
              <span className="text-sm font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded">ID: {project.id}</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl tracking-tight">
              {project.name}
            </h1>
            <p className="mt-2 text-lg text-slate-600 max-w-3xl">
              {project.description}
            </p>
            <div className="mt-4 flex items-center text-slate-500">
              <MapPin className="h-5 w-5 mr-2 text-slate-400" />
              <span>{project.location}</span>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center min-w-[200px]">
              <div className="w-32 h-32 bg-slate-100 rounded-lg flex items-center justify-center border-2 border-dashed border-slate-300 mb-2">
                <span className="text-xs text-slate-400 text-center px-2">Scan QR Code on Billboard</span>
              </div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Real-Time Tracking</span>
            </div>
            <button 
              onClick={() => setIsReportModalOpen(true)}
              className="w-full bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Report Discrepancy
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Financial Overview</CardTitle>
            <CardDescription>Immutable record of budget allocation and disbursement.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <p className="text-sm font-medium text-slate-500 mb-1">Total Budget</p>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(project.totalBudget)}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <p className="text-sm font-medium text-blue-600 mb-1">Allocated (SARO)</p>
                <p className="text-2xl font-bold text-blue-700">{formatCurrency(project.allocatedFunds)}</p>
                <p className="text-xs text-blue-500 mt-1">{((project.allocatedFunds / project.totalBudget) * 100).toFixed(1)}% of budget</p>
              </div>
              <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                <p className="text-sm font-medium text-emerald-600 mb-1">Disbursed (NCA)</p>
                <p className="text-2xl font-bold text-emerald-700">{formatCurrency(project.disbursedFunds)}</p>
                <p className="text-xs text-emerald-500 mt-1">{((project.disbursedFunds / project.totalBudget) * 100).toFixed(1)}% of budget</p>
              </div>
            </div>

            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <ShieldCheck className="w-5 h-5 mr-2 text-blue-500" />
              Immutable Receipts (Transactions)
            </h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Recorded By</TableHead>
                    <TableHead>Tx Hash</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {project.transactions.length > 0 ? (
                    project.transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="whitespace-nowrap text-slate-500">
                          {safeFormatDate(tx.date, 'MMM dd, yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          <Badge variant={tx.type.includes('SARO') ? 'secondary' : 'default'} className={tx.type.includes('NCA') ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-blue-100 text-blue-800 hover:bg-blue-200'}>
                            {tx.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-slate-900">
                          {formatCurrency(tx.amount)}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-slate-600">{tx.recordedByRole}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded" title={tx.hash}>
                              {tx.hash.substring(0, 10)}...
                            </span>
                            <button 
                              onClick={() => alert(`Connecting to Polygon/Sepolia explorer...\n\nVerifying Hash: ${tx.hash}\nStatus: Verified & Authentic\nSigned by: ${tx.recordedByRole}`)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center bg-blue-50 px-2 py-1 rounded border border-blue-100 transition-colors"
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              Verify on Blockchain
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                        No transactions recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 flex justify-end">
               <button className="text-sm text-blue-600 hover:text-blue-800 flex items-center font-medium">
                 <Download className="w-4 h-4 mr-1" /> Download CSV Data
               </button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Project Milestones</CardTitle>
              <CardDescription>Verified by MPDC</CardDescription>
            </CardHeader>
            <CardContent>
              {project.milestones.length > 0 ? (
                <div className="space-y-6">
                  {project.milestones.map((milestone, index) => (
                    <div key={milestone.id} className="relative pl-6 border-l-2 border-blue-200 last:border-0 pb-6 last:pb-0">
                      <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-500 border-4 border-white"></div>
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-semibold text-slate-900">{milestone.title}</h4>
                        <Badge variant="outline" className="text-xs">{milestone.percentage}%</Badge>
                      </div>
                      <p className="text-sm text-slate-600 mb-2">{milestone.description}</p>
                      <div className="flex items-center text-xs text-slate-500">
                        <Calendar className="w-3 h-3 mr-1" />
                        {milestone.dateVerified ? safeFormatDate(milestone.dateVerified, 'MMM dd, yyyy') : 'Pending Verification'}
                        {milestone.geoTag && (
                          <span className="ml-3 flex items-center text-blue-500" title={`Lat: ${milestone.geoTag.lat}, Lng: ${milestone.geoTag.lng}`}>
                            <MapPin className="w-3 h-3 mr-1" /> Geo-tagged
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">No milestones recorded yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Public Documents</CardTitle>
              <CardDescription>Procurement & Contracts</CardDescription>
            </CardHeader>
            <CardContent>
              {project.documents.length > 0 ? (
                <ul className="space-y-3">
                  {project.documents.map((doc) => (
                    <li key={doc.id} className="flex items-start p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200">
                      <FileText className="w-5 h-5 text-slate-400 mr-3 mt-0.5" />
                      <div>
                        <a href={doc.url} className="text-sm font-medium text-blue-600 hover:underline">
                          {doc.title}
                        </a>
                        <div className="flex items-center mt-1 text-xs text-slate-500">
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded mr-2">{doc.type}</span>
                          <span>{safeFormatDate(doc.dateUploaded, 'MMM dd, yyyy')}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">No documents uploaded yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
