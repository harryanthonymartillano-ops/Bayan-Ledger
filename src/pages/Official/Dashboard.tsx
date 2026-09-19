import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { useBlockchain } from '../../context/BlockchainContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { MapPin, CheckCircle, Activity, Clock, Plus, FileText, FileCheck, FileSignature, Landmark, ArrowLeft, AlertTriangle, ShieldCheck, Building2, CalendarRange, CircleDollarSign, ListChecks, Users, LoaderCircle, Database, RefreshCw, ShieldAlert, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { format } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import { PROJECT_CATEGORIES } from '../../lib/projectCategories';
import { BUDGET_SOURCES, FLAT_BUDGET_SOURCES, LGU_SUB_FUNDS } from '../../lib/budgetSources';
import { MediaLightbox, MediaLightboxItem } from '../../components/MediaLightbox';
import apiClient, { API_BASE_URL } from '../../lib/apiClient';
import { clearResolvedProjectBudgetOverride, readBreachResolutionOverrides, setResolvedProjectBudgetOverride } from '../../lib/breachDetection';
import { isProjectTampered } from '../../lib/projectIntegrity';
import { getContract, getReadOnlyWeb3Provider } from '../../lib/web3';
import { isMilestoneDelayed, isProjectDelayed } from '../../lib/scheduleStatus';
import { OfficialAnalyticsDashboard } from '../../components/OfficialAnalyticsDashboard';
import { readStoredChainBudgets, updateStoredChainBudget } from '../../lib/chainBudgetCache';

type DashboardProject = ReturnType<typeof useBlockchain>['projects'][number];
type ProjectMilestonePlan = {
  title: string;
  description: string;
  deliverables: string[];
  percentage: number;
  dueDate?: string;
};
type DashboardEvidencePhoto = {
  type: 'before' | 'after' | 'proof';
  url: string;
  photoHash: string;
  timestamp: string;
  description?: string;
  uploadedBy: string;
};
type DashboardEvidenceDocument = {
  title: string;
  type: 'Procurement' | 'Contract' | 'Personnel' | 'Other' | 'Report' | 'Invoice';
  url: string;
  fileFormat?: 'PDF' | 'JPEG' | 'PNG' | 'DOCX' | 'OTHER';
  uploadedBy: string;
  dateUploaded: string;
  size: number;
  version: number;
  verified: boolean;
};
type CreateProjectPayload = {
  name: string;
  description: string;
  location: string;
  category: string;
  budgetSource?: string;
  locationPhotos?: string[];
  startDate?: string;
  endDate?: string;
  stakeholders?: string[];
  totalBudget: number;
  milestones: ProjectMilestonePlan[];
};

const createEmptyMilestonePlan = (): ProjectMilestonePlan => ({
  title: '',
  description: '',
  deliverables: [''],
  percentage: 0,
  dueDate: '',
});

const getMilestoneTargetDate = (milestone: { dueDate?: string; due_date?: string }) =>
  milestone.dueDate || milestone.due_date;

const OVERVIEW_ITEMS_PER_PAGE = 10;

export const Dashboard = () => {
  const { user, token } = useAuth();
  const {
    projects,
    alerts,
    resolveAlert,
    addMilestone,
    verifyMilestone,
    processPayment,
    addTransaction,
    createDisbursementRequest,
    signDisbursementRequest,
    addDocument,
    addProject,
    activateProject,
    rejectProjectBudget,
    rejectProjectTreasury,
    uploadDocumentWithHash: uploadDocumentWithHashRaw,
    addMilestonePhoto: addMilestonePhotoRaw,
    refreshProjectFromChain,
    chainBudgets: contextChainBudgets,
  } = useBlockchain();
  const [chainBudgets, setChainBudgets] = useState<Record<string, number>>(() => readStoredChainBudgets());

  useEffect(() => {
    if (!contextChainBudgets) return;
    setChainBudgets((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [id, budget] of Object.entries(contextChainBudgets)) {
        if (typeof budget === 'number' && next[id] !== budget) {
          next[id] = budget;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [contextChainBudgets]);

  const [resolvedBudgetOverrides, setResolvedBudgetOverrides] = useState<Record<string, number>>(() => readBreachResolutionOverrides());
  const [isForceSyncing, setIsForceSyncing] = useState(false);
  const [showBreachLogModal, setShowBreachLogModal] = useState(false);
  const uploadDocumentWithHash = async (
    projectId: string,
    document: DashboardEvidenceDocument,
    file: File,
    milestoneId?: string
  ) => {
    return (uploadDocumentWithHashRaw as unknown as (
      projectId: string,
      document: DashboardEvidenceDocument,
      file: File,
      milestoneId?: string
    ) => Promise<void>)(projectId, document, file, milestoneId);
  };
  const addMilestonePhoto = async (
    projectId: string,
    milestoneId: string,
    photo: DashboardEvidencePhoto,
    file: File
  ) => {
    return (addMilestonePhotoRaw as unknown as (
      projectId: string,
      milestoneId: string,
      photo: DashboardEvidencePhoto,
      file: File
    ) => Promise<void>)(projectId, milestoneId, photo, file);
  };
  const [selectedProjectPhotoIndex, setSelectedProjectPhotoIndex] = useState<number | null>(null);
  const [selectedProjectPreviewItems, setSelectedProjectPreviewItems] = useState<MediaLightboxItem[]>([]);
  const [selectedProjectPreviewIndex, setSelectedProjectPreviewIndex] = useState<number | null>(null);
  const [selectedMilestoneEvidenceFiles, setSelectedMilestoneEvidenceFiles] = useState<File[]>([]);
  const [isSubmittingMilestoneEvidence, setIsSubmittingMilestoneEvidence] = useState(false);
  const [isSubmittingDisbursementRequest, setIsSubmittingDisbursementRequest] = useState(false);
  const [isSubmittingFirstSignatureSARO, setIsSubmittingFirstSignatureSARO] = useState(false);
  const [isSubmittingFirstSignatureBudget, setIsSubmittingFirstSignatureBudget] = useState(false);
  const [isExecutingDisbursement, setIsExecutingDisbursement] = useState(false);
  const [isActivatingProject, setIsActivatingProject] = useState(false);
  const [isRejectingProject, setIsRejectingProject] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [overviewPage, setOverviewPage] = useState(1);
  const [overviewSearchTerm, setOverviewSearchTerm] = useState('');

  if (!user) {
    return <div className="p-8 text-center text-red-500 font-bold">Unauthorized access. Please login.</div>;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
  };

  const projectIdsFingerprint = projects.map((project) => `${project.id}:${project.totalBudget}`).join('|');
  const selectedProjectIdFromQuery = searchParams.get('projectId');
  const selectedProjectRecord = useMemo(
    () => selectedProjectIdFromQuery
      ? projects.find((project) => project.id === selectedProjectIdFromQuery) || null
      : null,
    [projects, selectedProjectIdFromQuery]
  );
  const selectedProject = selectedProjectRecord?.id || null;
  const selectedProjectPhotos = selectedProjectRecord?.locationPhotos || [];

  const getEffectiveBudget = (project: DashboardProject) => resolvedBudgetOverrides[project.id] ?? project.totalBudget;

  const selectedProjectChainBudget = selectedProjectRecord ? chainBudgets[selectedProjectRecord.id] ?? null : null;
  const selectedProjectDisplayBudget = selectedProjectRecord ? getEffectiveBudget(selectedProjectRecord) : 0;
  const isAdminUser = user.role === 'Admin';
  const selectedProjectTampered = Boolean(
    selectedProjectRecord &&
    typeof selectedProjectChainBudget === 'number' &&
    isProjectTampered(selectedProjectDisplayBudget, selectedProjectChainBudget)
  );
  const selectedProjectDelayed = Boolean(selectedProjectRecord && isProjectDelayed(selectedProjectRecord));
  const selectedProjectAllocationRate = selectedProjectRecord && selectedProjectDisplayBudget > 0
    ? Math.min(100, Math.round(((selectedProjectRecord.allocatedFunds || 0) / selectedProjectDisplayBudget) * 100))
    : 0;
  const selectedProjectDisbursementRate = selectedProjectRecord && (selectedProjectRecord.allocatedFunds || 0) > 0
    ? Math.min(100, Math.round(((selectedProjectRecord.disbursedFunds || 0) / (selectedProjectRecord.allocatedFunds || 0)) * 100))
    : 0;
  const selectedProjectVerifiedMilestones = selectedProjectRecord
    ? selectedProjectRecord.milestones.filter((milestone) => milestone.status === 'Verified' || milestone.status === 'Paid').length
    : 0;
  const selectedProjectPaidMilestones = selectedProjectRecord
    ? selectedProjectRecord.milestones.filter((milestone) => milestone.status === 'Paid').length
    : 0;
  const selectedProjectDelayedMilestones = selectedProjectRecord
    ? selectedProjectRecord.milestones.filter(isMilestoneDelayed).length
    : 0;
  const delayedProjectsCount = projects.filter(isProjectDelayed).length;
  const filteredOverviewProjects = useMemo(() => {
    const query = overviewSearchTerm.trim().toLowerCase();
    if (!query) return projects;

    return projects.filter((project) =>
      [
        project.id,
        project.name,
        project.description,
        project.location,
        project.category,
        project.status,
        project.saro,
        project.budgetSource,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [projects, overviewSearchTerm]);
  const overviewTotalPages = Math.max(1, Math.ceil(filteredOverviewProjects.length / OVERVIEW_ITEMS_PER_PAGE));
  const overviewProjects = filteredOverviewProjects.slice((overviewPage - 1) * OVERVIEW_ITEMS_PER_PAGE, overviewPage * OVERVIEW_ITEMS_PER_PAGE);

  const shortenHash = (hash?: string) => hash ? `${hash.substring(0, 10)}...${hash.slice(-6)}` : 'Pending';

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Completed': return <Badge variant="default" className="bg-emerald-500"><CheckCircle className="w-3 h-3 mr-1"/> Completed</Badge>;
      case 'In Progress': return <Badge variant="default" className="bg-blue-500"><Activity className="w-3 h-3 mr-1"/> In Progress</Badge>;
      case 'ACTIVE': return <Badge variant="default" className="bg-emerald-600"><ShieldCheck className="w-3 h-3 mr-1"/> ACTIVE</Badge>;
      case 'SARO Approved - Pending Treasurer': return <Badge variant="default" className="bg-amber-500"><Landmark className="w-3 h-3 mr-1"/> Pending Treasurer</Badge>;
      case 'MPDC Approved': return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1"/> MPDC Approved</Badge>;
      case 'Rejected - Budget Officer': return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1"/> Rejected by Budget</Badge>;
      case 'Rejected - Treasurer': return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1"/> Rejected by Treasurer</Badge>;
      case 'On Hold': return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1"/> On Hold</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const safeFormatDate = (dateString: string | undefined, formatStr: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? 'Invalid Date' : format(date, formatStr);
  };

  const resolveAssetUrl = (url?: string | null) => {
    if (!url) return '';

    try {
      const apiOrigin = new URL(API_BASE_URL).origin;
      const apiBaseUrl = new URL(API_BASE_URL);
      const assetUrl = new URL(url, apiOrigin);
      const isLocalApiHost = ['localhost', '127.0.0.1'].includes(apiBaseUrl.hostname);
      const browserHost = typeof window !== 'undefined' ? window.location.hostname : '';
      const shouldUseBrowserHost = Boolean(browserHost) && !['localhost', '127.0.0.1'].includes(browserHost);

      if (assetUrl.pathname.startsWith('/uploads/')) {
        const resolvedUrl = new URL(`${apiOrigin}${assetUrl.pathname}`);
        if (isLocalApiHost && shouldUseBrowserHost) {
          resolvedUrl.hostname = browserHost;
        }
        return resolvedUrl.toString();
      }

      if (isLocalApiHost && shouldUseBrowserHost && ['localhost', '127.0.0.1'].includes(assetUrl.hostname)) {
        assetUrl.hostname = browserHost;
      }

      return assetUrl.toString();
    } catch {
      return url;
    }
  };

  const openSelectedProjectPreview = (items: MediaLightboxItem[], index = 0) => {
    setSelectedProjectPreviewItems(items);
    setSelectedProjectPreviewIndex(index);
  };

  const closeSelectedProjectPreview = () => {
    setSelectedProjectPreviewIndex(null);
    setSelectedProjectPreviewItems([]);
  };

  const resetOfficialScrollPosition = () => {
    const scrollRoot = document.querySelector('[data-scroll-root]');
    if (scrollRoot instanceof HTMLElement) {
      scrollRoot.scrollTo({ top: 0, behavior: 'auto' });
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  const getSelectedEvidenceSummary = (files: File[]) => {
    const photos = files.filter((file) => file.type.startsWith('image/'));
    const reports = files.filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));

    return {
      photos,
      reports,
      photoCount: photos.length,
      reportCount: reports.length
    };
  };

  const resetMilestoneEvidenceSelection = () => {
    setSelectedMilestoneEvidenceFiles([]);
  };

  useEffect(() => {
    if (!selectedProject) return;
    refreshProjectFromChain(selectedProject).catch(() => undefined);
  }, [selectedProject, refreshProjectFromChain]);

  useEffect(() => {
    let isMounted = true;

    const loadChainBudgets = async () => {
      if (projects.length === 0) {
        if (isMounted) {
          setChainBudgets({});
        }
        return;
      }

      const provider = getReadOnlyWeb3Provider();
      if (!provider) {
        return;
      }

      try {
        const contract = await getContract(provider);
        const snapshots = await Promise.all(projects.map(async (project) => {
          try {
            const chainProject = await contract.projects(project.id);
            const exists = Boolean(chainProject.exists ?? chainProject[14]);
            if (!exists) return [project.id, null] as const;
            return [project.id, Number(chainProject.totalBudget ?? chainProject[2] ?? 0)] as const;
          } catch {
            return [project.id, null] as const;
          }
        }));

        if (!isMounted) return;

        setChainBudgets((prev) => {
          const next = { ...prev };

          for (const [projectId, budget] of snapshots) {
            if (typeof budget === 'number' && Number.isFinite(budget)) {
              next[projectId] = budget;
              updateStoredChainBudget(projectId, budget);
            }
          }

          return next;
        });
      } catch (error) {
        console.warn('Unable to compare dashboard projects against Sepolia.', error);
      }
    };

    loadChainBudgets();

    return () => {
      isMounted = false;
    };
  }, [projectIdsFingerprint]);

  useEffect(() => {
    setOverviewPage((page) => Math.min(page, overviewTotalPages));
  }, [overviewTotalPages]);

  const handleOverviewSearchChange = (value: string) => {
    setOverviewSearchTerm(value);
    setOverviewPage(1);
  };

  const openProjectDetails = (projectId: string) => {
    resetOfficialScrollPosition();
    setSearchParams({ projectId });
  };

  const closeProjectDetails = () => {
    resetOfficialScrollPosition();
    setSelectedProjectPhotoIndex(null);
    closeSelectedProjectPreview();
    setShowBreachLogModal(false);
    setSearchParams({}, { replace: true });
  };

  useEffect(() => {
    const nextOverrides = { ...resolvedBudgetOverrides };
    let didChange = false;

    for (const project of projects) {
      const chainBudget = chainBudgets[project.id];
      if (typeof chainBudget !== 'number') continue;

      if (project.totalBudget === chainBudget && typeof nextOverrides[project.id] === 'number') {
        delete nextOverrides[project.id];
        didChange = true;
      }
    }

    if (didChange) {
      setResolvedBudgetOverrides(nextOverrides);
      Object.keys(resolvedBudgetOverrides).forEach((projectId) => {
        if (!(projectId in nextOverrides)) {
          clearResolvedProjectBudgetOverride(projectId);
        }
      });
    }
  }, [chainBudgets, projects, resolvedBudgetOverrides]);

  const handleForceSyncDatabase = async (project: DashboardProject) => {
    if (!token) {
      alert('Your session has expired. Please sign in again.');
      return;
    }

    if (!isAdminUser) {
      alert('Only Admin can force sync the database with the blockchain.');
      return;
    }

    const blockchainBudget = chainBudgets[project.id];
    if (typeof blockchainBudget !== 'number') {
      alert('Live blockchain budget could not be confirmed for this project.');
      return;
    }

    try {
      setIsForceSyncing(true);
      await apiClient.resolveProjectBreach(token, project.id, {
        tamperedBudget: project.totalBudget,
        blockchainBudget,
        notes: 'Admin forced database reconciliation using blockchain ledger as the source of truth.',
      });

      const nextOverrides = setResolvedProjectBudgetOverride(project.id, blockchainBudget);
      setResolvedBudgetOverrides(nextOverrides);
      updateStoredChainBudget(project.id, blockchainBudget);
      await refreshProjectFromChain(project.id).catch(() => undefined);

      alerts
        .filter((alertItem) => alertItem.projectId === project.id && alertItem.status === 'Unresolved')
        .forEach((alertItem) => resolveAlert(alertItem.id));
    } catch (error: any) {
      alert(error?.message || 'Failed to sync the database back to the blockchain value.');
    } finally {
      setIsForceSyncing(false);
    }
  };

  const handleViewDatabaseAccessLogs = () => {
    setShowBreachLogModal(true);
  };

  const renderRoleSpecificActions = (project: DashboardProject) => {
    switch (user.role) {
      case 'MPDC (Planning)': {
        const pendingMilestones = project.milestones.filter(m => m.status === 'Pending');
        const selectedEvidenceSummary = getSelectedEvidenceSummary(selectedMilestoneEvidenceFiles);
        const isProjectOperational = project.status === 'ACTIVE' || project.status === 'In Progress' || project.status === 'Completed';
        const verifiedMilestonesReadyForRequest = project.milestones.filter((milestone) => {
          if (milestone.status !== 'Verified') return false;
          return !project.transactions.some((transaction) =>
            transaction.milestoneId === milestone.id &&
            ['Pending Transaction', '1/2 Signed', 'Executed'].includes(transaction.status)
          );
        });

        if (project.status === 'Rejected - Budget Officer' || project.status === 'Rejected - Treasurer') {
          return (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
              This project is in a terminal state: <strong>{project.status}</strong>.
              {project.rejectionReason ? ` Reason: ${project.rejectionReason}` : ''}
            </div>
          );
        }

        if (!isProjectOperational) {
          return (
            <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg text-center text-slate-600">
              MPDC has already approved this project. Milestone verification and disbursement requests unlock only after both gates pass and the Treasurer marks the project as <strong>ACTIVE</strong>.
            </div>
          );
        }

        return (
          <div className="mt-4 space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2 flex items-center"><MapPin className="w-4 h-4 mr-2" /> Verify Progress Milestone</h4>
              <p className="text-sm text-blue-700 mb-4">
                Upload all required proof in one action before signing the milestone. The smart contract validates this signature only after the evidence package is complete.
                <strong> This file is permanently attached to the blockchain record and visible to the public for transparency.</strong>
              </p>
              {pendingMilestones.length > 0 ? (
                <form className="space-y-3" onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const formData = new FormData(form);
                  const milestoneId = formData.get('milestoneId') as string;
                  const selectedFiles = selectedMilestoneEvidenceFiles;

                  const { photos, reports, photoCount, reportCount } = getSelectedEvidenceSummary(selectedFiles);

                  if (!milestoneId) {
                    alert('Select a milestone to verify.');
                    return;
                  }

                  if (photoCount < 1 || reportCount < 1) {
                    alert('Please upload at least 1 photo and 1 PDF report in one action before verification.');
                    return;
                  }

                  const milestone = project.milestones.find((m) => m.id === milestoneId);
                  if (!milestone) {
                    alert('Selected milestone was not found.');
                    return;
                  }

                  setIsSubmittingMilestoneEvidence(true);

                  try {
                    const evidenceHash = `evidence-${Date.now()}-${project.id}-${milestoneId}`;
                    const reportHash = reports.map((file) => file.name).join('|') || 'report-batch-empty';

                    // First, verify milestone on blockchain - if this fails, no files are uploaded
                    const primaryPhotoUrl = URL.createObjectURL(photos[0]);
                    await verifyMilestone(project.id, milestoneId, user.id, primaryPhotoUrl, {
                      evidenceHash,
                      reportHash,
                      photoCount,
                      reportCount
                    });

                    // Only upload files after blockchain transaction succeeds
                    for (const [index, file] of photos.entries()) {
                      const photoType: 'before' | 'after' | 'proof' =
                        photos.length === 1 ? 'proof' : index === 0 ? 'before' : index === 1 ? 'after' : 'proof';

                      await addMilestonePhoto(project.id, milestoneId, {
                        type: photoType,
                        url: '',
                        photoHash: `upload-${Date.now()}-${index}-${file.name}`,
                        timestamp: new Date().toISOString(),
                        description: `${photoType === 'proof' ? (photos.length === 1 ? 'Milestone' : 'Additional') : photoType.charAt(0).toUpperCase() + photoType.slice(1)} evidence uploaded for ${milestone.title}`,
                        uploadedBy: user.id
                      }, file);
                    }

                    for (const [, file] of reports.entries()) {
                      await uploadDocumentWithHash(project.id, {
                        title: file.name,
                        type: 'Report',
                        url: URL.createObjectURL(file),
                        fileFormat: 'PDF',
                        uploadedBy: user.id,
                        dateUploaded: new Date().toISOString(),
                        size: file.size,
                        version: 1,
                        verified: false
                      }, file, milestoneId);
                    }

                    form.reset();
                    resetMilestoneEvidenceSelection();
                    alert(`Milestone verified successfully with ${photoCount} photo(s) and ${reportCount} PDF report(s).`);
                  } catch (error: any) {
                    alert(error?.message || 'Failed to upload the full evidence package and verify the milestone.');
                  } finally {
                    setIsSubmittingMilestoneEvidence(false);
                  }
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
                  <div className="space-y-2">
                    <Input
                      type="file"
                      accept="image/*,.pdf,application/pdf"
                      multiple
                      className="cursor-pointer"
                      required
                      onChange={(event) => {
                        const files = Array.from(event.target.files || []);
                        setSelectedMilestoneEvidenceFiles(files);
                      }}
                    />
                    <div className="rounded-lg border border-blue-200 bg-white p-3 text-sm text-slate-700">
                      <p className="font-medium text-slate-900">Required in one upload action</p>
                      <p className="mt-1">Minimum: 1 photo and 1 PDF report.</p>
                      <p className="mt-2 text-xs text-slate-500">
                        Selected now: {selectedEvidenceSummary.photoCount} photo(s), {selectedEvidenceSummary.reportCount} PDF report(s)
                      </p>
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isSubmittingMilestoneEvidence}>
                    {isSubmittingMilestoneEvidence ? 'Uploading Evidence & Verifying...' : 'Upload Evidence & Verify Milestone'}
                  </Button>
                </form>
              ) : (
                <div className="rounded-lg border border-blue-200 bg-white p-4 text-center text-slate-600">
                  This project is operational, but there are no pending milestones ready for verification.
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <h4 className="font-semibold text-slate-900 mb-2 flex items-center"><FileSignature className="w-4 h-4 mr-2" /> Create Disbursement Request</h4>
              <p className="text-sm text-slate-600 mb-4">
                Once a milestone is verified, MPDC can create the pending disbursement request that Budget Officer and Treasurer will sign on chain.
              </p>
              {verifiedMilestonesReadyForRequest.length > 0 ? (
                <form className="space-y-3" onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const formData = new FormData(form);
                  const milestoneId = String(formData.get('requestMilestoneId') || '');
                  const contractorAddress = String(formData.get('contractorAddress') || '').trim();

                  try {
                    setIsSubmittingDisbursementRequest(true);
                    await createDisbursementRequest(project.id, milestoneId, contractorAddress);
                    form.reset();
                    alert('Pending disbursement request created successfully.');
                  } catch (error: any) {
                    alert(error?.message || 'Failed to create the pending disbursement request.');
                  } finally {
                    setIsSubmittingDisbursementRequest(false);
                  }
                }}>
                  <select name="requestMilestoneId" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" required disabled={isSubmittingDisbursementRequest}>
                    <option value="">Select verified milestone...</option>
                    {verifiedMilestonesReadyForRequest.map((milestone) => (
                      <option key={milestone.id} value={milestone.id}>
                        {milestone.title} ({milestone.percentage}%)
                      </option>
                    ))}
                  </select>
                  <Input name="contractorAddress" placeholder="Contractor wallet address" required disabled={isSubmittingDisbursementRequest} />
                  <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800" disabled={isSubmittingDisbursementRequest}>
                    {isSubmittingDisbursementRequest ? (
                      <>
                        <LoaderCircle className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      'Create Pending Transaction Request'
                    )}
                  </Button>
                </form>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-white p-4 text-center text-slate-500">
                  No verified milestone is ready for a new disbursement request.
                </div>
              )}
            </div>
          </div>
        );
      }
      case 'Budget Officer':
        const pendingAllocation = project.transactions.find(
          (tx) => tx.type === 'Allocation (SARO)' && tx.status === '1/2 Signed'
        );
        const pendingBudgetRequest = project.transactions.find(
          (tx) => tx.type === 'Disbursement (NCA)' && tx.status === 'Pending Transaction'
        );

        if (project.milestones.length === 0) {
          return (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-lg text-amber-900">
              Allocation is blocked until MPDC sets up at least one milestone for this project.
            </div>
          );
        }

        if (project.status === 'Rejected - Budget Officer' || project.status === 'Rejected - Treasurer') {
          return (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
              This project is in a terminal state: <strong>{project.status}</strong>.
              {project.rejectionReason ? ` Reason: ${project.rejectionReason}` : ''}
            </div>
          );
        }

        if (project.status === 'MPDC Approved') {
          return (
            <div className="mt-4 space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg">
                <h4 className="font-semibold text-amber-900 mb-2 flex items-center"><FileSignature className="w-4 h-4 mr-2" /> Gate 1: Create SARO</h4>
                <p className="text-sm text-amber-700 mb-4">Review budget feasibility, confirm funding, and apply the first signature. This moves the project to <strong>SARO Approved - Pending Treasurer</strong>.</p>
                <form className="space-y-3" onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const formData = new FormData(form);
                  try {
                    setIsSubmittingFirstSignatureSARO(true);
                    await addTransaction(project.id, {
                      amount: project.totalBudget,
                      type: 'Allocation (SARO)',
                      date: new Date().toISOString(),
                      recordedBy: user.id,
                      recordedByRole: user.role,
                      description: `SARO Allocation: ${formData.get('saro')}`,
                    }, formData.get('saro') as string);
                    form.reset();
                    alert('SARO created successfully. Project is now pending Treasurer approval.');
                  } catch (error: any) {
                    alert(error?.message || 'SARO allocation failed.');
                  } finally {
                    setIsSubmittingFirstSignatureSARO(false);
                  }
                }}>
                  <Input name="saro" placeholder="SARO Reference No. (e.g., SARO-2026-XXX)" required disabled={isSubmittingFirstSignatureSARO} />
                  <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700" disabled={isSubmittingFirstSignatureSARO}>
                    {isSubmittingFirstSignatureSARO ? (
                      <>
                        <LoaderCircle className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      'Create SARO & Apply First Signature'
                    )}
                  </Button>
                </form>
              </div>

              <div className="p-4 bg-white border border-red-200 rounded-lg">
                <h4 className="font-semibold text-red-800 mb-2">Reject At Gate 1</h4>
                <form className="space-y-3" onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const formData = new FormData(form);
                  const reason = String(formData.get('budgetRejectionReason') || '').trim();
                  try {
                    await rejectProjectBudget(project.id, reason);
                    form.reset();
                    alert('Project rejected by Budget Officer.');
                  } catch (error: any) {
                    alert(error?.message || 'Budget rejection failed.');
                  }
                }}>
                  <Input name="budgetRejectionReason" placeholder="Rejection reason" required />
                  <Button type="submit" variant="destructive" className="w-full">Reject Project</Button>
                </form>
              </div>
            </div>
          );
        }

        if (project.status === 'SARO Approved - Pending Treasurer' && pendingAllocation) {
          return (
            <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-600">
              Gate 1 is complete. SARO <strong>{project.saro || pendingAllocation.description}</strong> is waiting for the Treasurer to execute the second signature and activate the project.
            </div>
          );
        }

        if (pendingBudgetRequest) {
          return (
            <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl">
              <h4 className="font-semibold text-amber-900 dark:text-amber-300 mb-2 flex items-center"><FileSignature className="w-4 h-4 mr-2" /> Validate Transaction Request</h4>
              <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
                MPDC has initiated a pending transaction request. Sign it to move the status to <span className="font-semibold">1/2 Signed</span>.
              </p>
              <div className="rounded-lg bg-white dark:bg-[#121727] border border-amber-200/80 dark:border-amber-900/40 p-3 mb-3 text-sm text-slate-700 dark:text-slate-300">
                <div className="font-medium text-slate-900 dark:text-white">{pendingBudgetRequest.description}</div>
                <div className="mt-1 text-slate-700 dark:text-slate-300">Amount: {formatCurrency(pendingBudgetRequest.amount)}</div>
                <div className="mt-1 text-slate-700 dark:text-slate-300">Contractor: <span className="font-mono text-xs text-slate-900 dark:text-slate-200">{pendingBudgetRequest.contractorAddress || 'N/A'}</span></div>
              </div>
              <form className="space-y-3" onSubmit={async (e) => {
                e.preventDefault();
                try {
                  setIsSubmittingFirstSignatureBudget(true);
                  await signDisbursementRequest(project.id, pendingBudgetRequest.id);
                  alert('Transaction request validated. Status updated to 1/2 Signed.');
                } catch (error: any) {
                  alert(error?.message || 'Budget validation failed.');
                } finally {
                  setIsSubmittingFirstSignatureBudget(false);
                }
              }}>
                <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl" disabled={isSubmittingFirstSignatureBudget}>
                  {isSubmittingFirstSignatureBudget ? (
                    <>
                      <LoaderCircle className="w-4 h-4 mr-2 animate-spin" />
                      Applying First Signature...
                    </>
                  ) : (
                    'Apply First Signature'
                  )}
                </Button>
              </form>
            </div>
          );
        }

        return (
          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg text-center text-slate-500">
            No Budget Officer action is pending right now.
          </div>
        );
      case 'Treasurer':
        const pendingAllocationApproval = project.transactions.find(
          (tx) => tx.type === 'Allocation (SARO)' && tx.status === '1/2 Signed'
        ) || (project.status === 'SARO Approved - Pending Treasurer' && project.saro ? {
          id: `tx-alloc-${project.id}`,
          projectId: project.id,
          type: 'Allocation (SARO)' as const,
          amount: project.allocatedFunds || project.totalBudget,
          date: project.createdAt,
          description: `SARO Allocation: ${project.saro}`,
          recordedBy: 'Budget Officer',
          recordedByRole: 'Budget Officer' as const,
          status: '1/2 Signed' as const,
          hash: project.blockchainTxHash,
        } : undefined);
        const verifiedMilestone = project.milestones.find(m => m.status === 'Verified');
        const hasSaro = !!project.saro;
        const signedTransactionRequest = project.transactions.find(
          (tx) => tx.type === 'Disbursement (NCA)' && tx.status === '1/2 Signed'
        );
        const pendingTransactionRequest = project.transactions.find(
          (tx) => tx.type === 'Disbursement (NCA)' && tx.status === 'Pending Transaction'
        );
        const isReadyForDisbursement = hasSaro && !!signedTransactionRequest;
        const trancheAmount = signedTransactionRequest?.amount || (verifiedMilestone ? project.totalBudget * (verifiedMilestone.percentage / 100) : 0);

        if (project.status === 'Rejected - Budget Officer' || project.status === 'Rejected - Treasurer') {
          return (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
              This project is in a terminal state: <strong>{project.status}</strong>.
              {project.rejectionReason ? ` Reason: ${project.rejectionReason}` : ''}
            </div>
          );
        }

        if (project.status === 'MPDC Approved') {
          return (
            <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-600">
              Treasury action is not available yet. Wait for the Budget Officer to create the SARO first.
            </div>
          );
        }

        if (project.status === 'SARO Approved - Pending Treasurer' && pendingAllocationApproval) {
          return (
            <div className="mt-4 space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-lg">
                <h4 className="font-semibold text-emerald-900 mb-2 flex items-center"><ShieldCheck className="w-4 h-4 mr-2" /> Gate 2: Treasury Activation</h4>
                <p className="text-sm text-emerald-700 mb-4">
                  Verify the SARO, confirm treasury availability, and apply the second signature. This generates the project-level digital seal of truth and activates the project.
                </p>
                <div className="rounded-lg bg-white border border-emerald-200 p-3 mb-3 text-sm text-slate-700">
                  <div className="font-medium text-slate-900">{pendingAllocationApproval.description}</div>
                  <div className="mt-1">Amount: {formatCurrency(pendingAllocationApproval.amount)}</div>
                  <div className="mt-1">SARO: <span className="font-mono text-xs">{project.saro || 'N/A'}</span></div>
                </div>
                <Button type="button" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={isActivatingProject} onClick={async () => {
                  try {
                    setIsActivatingProject(true);
                    await activateProject(project.id);
                    alert('Project is now ACTIVE. Treasury seal of truth issued.');
                  } catch (error: any) {
                    alert(error?.message || 'Treasury activation failed.');
                  } finally {
                    setIsActivatingProject(false);
                  }
                }}>
                  {isActivatingProject ? (
                    <>
                      <LoaderCircle className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Execute SARO & Activate Project'
                  )}
                </Button>
              </div>

              <div className="p-4 bg-white border border-red-200 rounded-lg">
                <h4 className="font-semibold text-red-800 mb-2">Reject At Gate 2</h4>
                <form className="space-y-3" onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const formData = new FormData(form);
                  const reason = String(formData.get('treasuryRejectionReason') || '').trim();
                  try {
                    setIsRejectingProject(true);
                    await rejectProjectTreasury(project.id, pendingAllocationApproval.id, reason);
                    form.reset();
                    alert('Project rejected by Treasurer.');
                  } catch (error: any) {
                    alert(error?.message || 'Treasury rejection failed.');
                  } finally {
                    setIsRejectingProject(false);
                  }
                }}>
                  <Input name="treasuryRejectionReason" placeholder="Rejection reason" required disabled={isRejectingProject} />
                  <Button type="submit" variant="destructive" className="w-full" disabled={isRejectingProject}>
                    {isRejectingProject ? (
                      <>
                        <LoaderCircle className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      'Reject Project'
                    )}
                  </Button>
                </form>
              </div>
            </div>
          );
        }

        return (
          <div className={`mt-4 p-4 rounded-lg ${isReadyForDisbursement ? 'bg-emerald-50 border border-emerald-100' : 'bg-slate-50 border border-slate-200'}`}>
            <h4 className="font-semibold text-emerald-900 mb-2 flex items-center"><Landmark className="w-4 h-4 mr-2" /> Fund Disbursement (NCA)</h4>
            <p className={`text-sm mb-4 ${isReadyForDisbursement ? 'text-emerald-700' : 'text-slate-500'}`}>
              {isReadyForDisbursement
                ? 'The request already has the Budget Officer signature. Your final signature will trigger disbursement and generate the digital seal of truth.'
                : 'Disbursement stays blocked until MPDC creates a pending request and the Budget Officer moves it to 1/2 Signed.'
              }
            </p>
            {!hasSaro && (
              <div className="mb-3 rounded-lg bg-amber-50 border border-amber-100 p-3 text-amber-800">
                Budget approval missing: SARO has not been signed by the Budget Officer.
              </div>
            )}
            {!signedTransactionRequest && pendingTransactionRequest && (
              <div className="mb-3 rounded-lg bg-amber-50 border border-amber-100 p-3 text-amber-800">
                Waiting for Budget Officer signature. Current request status: Pending Transaction.
              </div>
            )}
            {!signedTransactionRequest && !pendingTransactionRequest && (
              <div className="mb-3 rounded-lg bg-amber-50 border border-amber-100 p-3 text-amber-800">
                MPDC approval missing: no 1/2 signed transaction request is available yet.
              </div>
            )}
            <form className="space-y-3" onSubmit={async (e) => {
              e.preventDefault();
              try {
                if (!signedTransactionRequest?.milestoneId) {
                  throw new Error('Payment blocked: waiting for a 1/2 signed request from the Budget Officer.');
                }
                setIsExecutingDisbursement(true);
                await processPayment(project.id, signedTransactionRequest.milestoneId);
                alert('Disbursement executed successfully. Digital Seal of Truth generated.');
              } catch (error: any) {
                alert(error?.message || 'Disbursement blocked by blockchain.');
              } finally {
                setIsExecutingDisbursement(false);
              }
            }}>
              <div className={`bg-white p-3 rounded ${isReadyForDisbursement ? 'border border-emerald-200' : 'border border-slate-200'} mb-3`}>
                <div className="text-xs font-semibold uppercase tracking-wider mb-1">Suggested Tranche Amount</div>
                <div className="text-lg font-bold text-slate-900">
                  {signedTransactionRequest ? formatCurrency(trancheAmount) : 'N/A'}
                </div>
              </div>
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={isExecutingDisbursement}>
                {isExecutingDisbursement ? (
                  <>
                    <LoaderCircle className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Execute Disbursement'
                )}
              </Button>
            </form>
          </div>
        );
      case 'Admin':
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
          </div>
        );
      default:
        return null;
    }
  };

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isMilestoneWarningOpen, setIsMilestoneWarningOpen] = useState(false);
  const [milestoneWarningMessage, setMilestoneWarningMessage] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBudgetSource, setSelectedBudgetSource] = useState('');
  const [selectedLguSubFund, setSelectedLguSubFund] = useState('');
  const [locationPhotoFiles, setLocationPhotoFiles] = useState<File[]>([]);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [projectMilestones, setProjectMilestones] = useState<ProjectMilestonePlan[]>([createEmptyMilestonePlan()]);
  const milestoneAllocationTotal = Number(projectMilestones.reduce((sum, milestone) => sum + Number(milestone.percentage || 0), 0).toFixed(2));

  const openCreateModal = () => {
    setSelectedCategory('');
    setSelectedBudgetSource('');
    setSelectedLguSubFund('');
    setLocationPhotoFiles([]);
    setProjectMilestones([createEmptyMilestonePlan()]);
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    if (isCreatingProject) return;
    setIsCreateModalOpen(false);
    setIsMilestoneWarningOpen(false);
    setSelectedCategory('');
    setSelectedBudgetSource('');
    setSelectedLguSubFund('');
    setLocationPhotoFiles([]);
    setProjectMilestones([createEmptyMilestonePlan()]);
  };

  const handleCreateProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isCreatingProject) return;

    if (Math.abs(milestoneAllocationTotal - 100) > 0.01) {
      setMilestoneWarningMessage(
        `Milestone allocations currently total ${milestoneAllocationTotal}%. Total milestone distribution must equal exactly 100% before the project can be created.`
      );
      setIsMilestoneWarningOpen(true);
      return;
    }

    const formData = new FormData(e.currentTarget);
    const category = formData.get('category') as string;
    const customCategory = (formData.get('customCategory') as string) || '';
    const finalCategory = category === 'Other' ? customCategory.trim() : category;
    const finalLocation = formData.get('location') as string;
    const budgetSource = (formData.get('budgetSource') as string) || '';
    const lguSubFund = (formData.get('lguSubFund') as string) || '';
    const customBudgetSource = (formData.get('customBudgetSource') as string) || '';
    let finalBudgetSource = budgetSource.trim();
    if (budgetSource === 'Other') {
      finalBudgetSource = customBudgetSource.trim();
    } else if (budgetSource === 'Local Government Unit (LGU)' && lguSubFund) {
      finalBudgetSource = `LGU - ${lguSubFund.trim()}`;
    }
    const stakeholders = String(formData.get('stakeholders') || '')
      .split(/\r?\n|,/)
      .map((stakeholder) => stakeholder.trim())
      .filter(Boolean);
    
    // Convert location photos to data URLs for now
    const locationPhotos: string[] = [];
    for (const file of locationPhotoFiles) {
      const reader = new FileReader();
      await new Promise<void>((resolve) => {
        reader.onload = () => {
          locationPhotos.push(reader.result as string);
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }

    const milestones = projectMilestones
      .map((milestone) => {
        const cleanedDeliverables = milestone.deliverables.map((deliverable) => deliverable.trim()).filter(Boolean);
        return {
          title: milestone.title.trim(),
          description: milestone.description.trim(),
          deliverables: cleanedDeliverables.length > 0 ? cleanedDeliverables : [milestone.title.trim() || 'Milestone deliverables and verification report'],
          percentage: Number(milestone.percentage || 0),
          dueDate: milestone.dueDate || undefined,
        };
      })
      .filter((milestone) => milestone.title || milestone.description || milestone.deliverables.length > 0 || milestone.percentage > 0 || milestone.dueDate);

    const parsedTotalBudget = parseFloat(String(formData.get('totalBudget') || '0').replace(/,/g, ''));
    if (!Number.isFinite(parsedTotalBudget) || parsedTotalBudget <= 0) {
      alert('Please enter a valid total budget greater than 0.');
      return;
    }

    try {
      setIsCreatingProject(true);
      await (addProject as (project: CreateProjectPayload) => Promise<void>)({
        name: formData.get('name') as string,
        description: formData.get('description') as string,
        location: finalLocation,
        category: finalCategory,
        budgetSource: finalBudgetSource || undefined,
        locationPhotos: locationPhotos.length > 0 ? locationPhotos : undefined,
        startDate: (formData.get('startDate') as string) || undefined,
        endDate: (formData.get('endDate') as string) || undefined,
        stakeholders,
        totalBudget: parsedTotalBudget,
        milestones,
      });
      setIsCreateModalOpen(false);
      setIsMilestoneWarningOpen(false);
      setSelectedCategory('');
      setSelectedBudgetSource('');
      setLocationPhotoFiles([]);
      setProjectMilestones([createEmptyMilestonePlan()]);
      alert('Approved project created successfully. Status is now "MPDC Approved" and the metadata hash has been anchored on chain.');
    } catch (error: any) {
      const msg = error?.message || 'Project creation failed on blockchain.';
      if (msg.includes('100%') || msg.toLowerCase().includes('milestone percentage') || (msg.toLowerCase().includes('milestone') && milestoneAllocationTotal !== 100)) {
        setMilestoneWarningMessage(msg);
        setIsMilestoneWarningOpen(true);
      } else {
        alert(msg);
      }
    } finally {
      setIsCreatingProject(false);
    }
  };



  const renderMultiSigIndicator = (project: DashboardProject) => {
    const isMpdcApproved = ['MPDC Approved', 'SARO Approved - Pending Treasurer', 'ACTIVE', 'In Progress', 'Completed'].includes(project.status);
    const isBudgetApproved = project.status !== 'MPDC Approved' && project.status !== 'Rejected - Budget Officer';
    const isTreasuryApproved = ['ACTIVE', 'In Progress', 'Completed'].includes(project.status);
    const hasExecutionActivity = project.milestones.some(m => m.status === 'Verified' || m.status === 'Paid') || project.disbursedFunds > 0;
    const isFullyPaid = project.allocatedFunds > 0 && project.disbursedFunds >= project.allocatedFunds;

    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-8">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 flex items-center">
          <ShieldCheck className="w-4 h-4 mr-2 text-blue-600" />
          Blockchain Multi-Sig Status
        </h3>
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          <div className={`flex-1 p-4 rounded-lg border ${isMpdcApproved ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center mb-2">
              {isMpdcApproved ? <CheckCircle className="w-5 h-5 text-emerald-500 mr-2" /> : <Clock className="w-5 h-5 text-slate-400 mr-2" />}
              <span className={`font-medium ${isMpdcApproved ? 'text-emerald-900' : 'text-slate-600'}`}>MPDC</span>
            </div>
            <p className={`text-sm ${isMpdcApproved ? 'text-emerald-700' : 'text-slate-500'}`}>
              {isMpdcApproved ? 'Project created directly as MPDC Approved' : 'Pending MPDC project creation'}
            </p>
          </div>

          <div className={`flex-1 p-4 rounded-lg border ${isBudgetApproved ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center mb-2">
              {isBudgetApproved ? <CheckCircle className="w-5 h-5 text-emerald-500 mr-2" /> : <Clock className="w-5 h-5 text-slate-400 mr-2" />}
              <span className={`font-medium ${isBudgetApproved ? 'text-emerald-900' : 'text-slate-600'}`}>Budget Officer</span>
            </div>
            <p className={`text-sm ${isBudgetApproved ? 'text-emerald-700' : 'text-slate-500'}`}>
              {isBudgetApproved ? 'SARO created and first signature applied' : 'Pending Gate 1 review'}
            </p>
          </div>

          <div className={`flex-1 p-4 rounded-lg border ${isTreasuryApproved ? 'bg-emerald-50 border-emerald-200' : project.status === 'SARO Approved - Pending Treasurer' ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center mb-2">
              {isTreasuryApproved ? <CheckCircle className="w-5 h-5 text-emerald-500 mr-2" /> : project.status === 'SARO Approved - Pending Treasurer' ? <AlertTriangle className="w-5 h-5 text-amber-500 mr-2" /> : <Clock className="w-5 h-5 text-slate-400 mr-2" />}
              <span className={`font-medium ${isTreasuryApproved ? 'text-emerald-900' : project.status === 'SARO Approved - Pending Treasurer' ? 'text-amber-900' : 'text-slate-600'}`}>Treasurer</span>
            </div>
            <p className={`text-sm ${isTreasuryApproved ? 'text-emerald-700' : project.status === 'SARO Approved - Pending Treasurer' ? 'text-amber-700' : 'text-slate-500'}`}>
              {isFullyPaid
                ? 'Treasury approval complete and project fully paid'
                : hasExecutionActivity
                  ? 'Project activated and already in execution'
                  : isTreasuryApproved
                    ? 'Treasury seal issued and project is ACTIVE'
                    : project.status === 'SARO Approved - Pending Treasurer'
                      ? 'Waiting for Gate 2 Treasury sign-off'
                      : 'Pending Treasury activation'}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto">
      {isMilestoneWarningOpen && createPortal((
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-amber-300 dark:border-amber-700/80 bg-white dark:bg-[#121624] p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  {milestoneAllocationTotal !== 100 ? 'Milestone Allocation Incomplete' : 'Milestone Verification Notice'}
                </h3>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {milestoneWarningMessage || 'Milestone budget allocations must total exactly 100% before the project can be created and anchored on-chain.'}
                </p>
              </div>
            </div>

            {milestoneAllocationTotal !== 100 && (
              <div className="rounded-xl border border-slate-200 dark:border-[#1e2438] bg-slate-50 dark:bg-[#151928] p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-600 dark:text-slate-400">Current Total Allocation:</span>
                  <span className="font-mono text-sm font-black text-amber-600 dark:text-amber-400">
                    {milestoneAllocationTotal}% / 100%
                  </span>
                </div>

                <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      milestoneAllocationTotal > 100
                        ? 'bg-red-500'
                        : 'bg-amber-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, milestoneAllocationTotal))}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  <span>Target: 100%</span>
                  <span className="font-semibold text-amber-700 dark:text-amber-400">
                    {milestoneAllocationTotal < 100
                      ? `${100 - milestoneAllocationTotal}% remaining to allocate`
                      : `${milestoneAllocationTotal - 100}% over-allocated`}
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                onClick={() => setIsMilestoneWarningOpen(false)}
                className="w-full bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white font-semibold text-xs py-2.5"
              >
                Review & Adjust Milestones
              </Button>
            </div>
          </div>
        </div>
      ), document.body)}

      {isCreateModalOpen && createPortal((
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 sm:p-6 transition-all animate-in fade-in duration-200">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white dark:bg-[#101422] border border-slate-200 dark:border-[#1e2438] shadow-2xl transition-all">
            {/* Modal Header */}
            <div className="shrink-0 border-b border-slate-100 dark:border-[#1a2035] bg-white dark:bg-[#101422] px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20 shadow-2xs">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Create Project</h3>
                    <p className="mt-0.5 max-w-2xl text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                      Record the project as MPDC Approved and anchor its cryptographic metadata on chain before Gate 1 review.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={isCreatingProject}
                  className="rounded-xl p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1a2035] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Close create project modal"
                >
                  <span className="text-xl leading-none">&times;</span>
                </button>
              </div>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateProject} className="flex-1 overflow-y-auto bg-slate-50/60 dark:bg-[#0c0f1a] p-6">
              <div className="space-y-5">
                {/* Project Profile */}
                <section className="rounded-xl border border-slate-200/90 dark:border-[#1e2438] bg-white dark:bg-[#121727] p-5 shadow-2xs">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Project Profile</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Core information displayed in official and public project records.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Project Name *</label>
                      <Input
                        name="name"
                        placeholder="e.g., Pagsawitan Drainage Repair"
                        required
                        className="h-10 rounded-lg bg-slate-50/70 dark:bg-[#0e1220] border-slate-200 dark:border-[#222840] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-blue-500/20"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Description *</label>
                      <textarea
                        name="description"
                        placeholder="Brief project description and objectives"
                        rows={3}
                        required
                        className="flex min-h-[90px] w-full rounded-lg border border-slate-200 dark:border-[#222840] bg-slate-50/70 dark:bg-[#0e1220] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 ring-offset-background placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:ring-offset-2"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Location *</label>
                      <Input
                        name="location"
                        placeholder="Barangay / sitio / landmark / address"
                        required
                        className="h-10 rounded-lg bg-slate-50/70 dark:bg-[#0e1220] border-slate-200 dark:border-[#222840] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-blue-500/20"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Category *</label>
                      <select
                        name="category"
                        className="flex h-10 w-full rounded-lg border border-slate-200 dark:border-[#222840] bg-slate-50/70 dark:bg-[#0e1220] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 dark:[&>option]:bg-[#101422] dark:[&>option]:text-slate-100"
                        required
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                      >
                        <option value="">Select category...</option>
                        {PROJECT_CATEGORIES.map((categoryOption) => (
                          <option key={categoryOption} value={categoryOption}>
                            {categoryOption}
                          </option>
                        ))}
                      </select>
                    </div>
                    {selectedCategory === 'Other' && (
                      <div className="md:col-span-2 space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Custom Category *</label>
                        <Input
                          name="customCategory"
                          placeholder="Enter custom category name"
                          required
                          className="h-10 rounded-lg bg-slate-50/70 dark:bg-[#0e1220] border-slate-200 dark:border-[#222840] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-blue-500/20"
                        />
                      </div>
                    )}
                  </div>
                </section>

                {/* Funding and Schedule */}
                <section className="rounded-xl border border-slate-200/90 dark:border-[#1e2438] bg-white dark:bg-[#121727] p-5 shadow-2xs">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                      <CircleDollarSign className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Funding and Schedule</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Budget source, authorized allocation, and delivery timeframe.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Budget Source</label>
                      <select
                        name="budgetSource"
                        className="flex h-10 w-full rounded-lg border border-slate-200 dark:border-[#222840] bg-slate-50/70 dark:bg-[#0e1220] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 dark:[&>option]:bg-[#101422] dark:[&>option]:text-slate-100 dark:[&>optgroup]:bg-[#101422] dark:[&>optgroup]:text-slate-300"
                        value={selectedBudgetSource}
                        onChange={(e) => {
                          setSelectedBudgetSource(e.target.value);
                          if (e.target.value !== 'Local Government Unit (LGU)') {
                            setSelectedLguSubFund('');
                          }
                        }}
                      >
                        <option value="">Select funding source...</option>
                        {BUDGET_SOURCES.map((categoryGroup) => (
                          <optgroup key={categoryGroup.category} label={categoryGroup.category}>
                            {categoryGroup.sources.map((source) => (
                              <option key={source} value={source}>
                                {source}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    {selectedBudgetSource === 'Local Government Unit (LGU)' && (
                      <div className="space-y-1.5 animate-in fade-in duration-150">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          LGU Sub-Source Fund Category *
                        </label>
                        <select
                          name="lguSubFund"
                          required
                          value={selectedLguSubFund}
                          onChange={(e) => setSelectedLguSubFund(e.target.value)}
                          className="flex h-10 w-full rounded-lg border border-slate-200 dark:border-[#222840] bg-slate-50/70 dark:bg-[#0e1220] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 dark:[&>option]:bg-[#101422] dark:[&>option]:text-slate-100"
                        >
                          <option value="">Select LGU sub-fund category...</option>
                          {LGU_SUB_FUNDS.map((subFund) => (
                            <option key={subFund} value={subFund}>
                              {subFund}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {selectedBudgetSource === 'Other' && (
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Custom Budget Source *</label>
                        <Input
                          name="customBudgetSource"
                          placeholder="Enter custom budget source"
                          required
                          className="h-10 rounded-lg bg-slate-50/70 dark:bg-[#0e1220] border-slate-200 dark:border-[#222840] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-blue-500/20"
                        />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Total Budget (PHP) *</label>
                      <Input
                        name="totalBudget"
                        type="number"
                        step="any"
                        min="0.01"
                        placeholder="e.g., 500000.00"
                        required
                        className="h-10 rounded-lg bg-slate-50/70 dark:bg-[#0e1220] border-slate-200 dark:border-[#222840] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-blue-500/20"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Start Date *</label>
                      <Input
                        name="startDate"
                        type="date"
                        required
                        className="h-10 rounded-lg bg-slate-50/70 dark:bg-[#0e1220] border-slate-200 dark:border-[#222840] text-slate-900 dark:text-slate-100 focus-visible:ring-blue-500/20"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">End Date *</label>
                      <Input
                        name="endDate"
                        type="date"
                        required
                        className="h-10 rounded-lg bg-slate-50/70 dark:bg-[#0e1220] border-slate-200 dark:border-[#222840] text-slate-900 dark:text-slate-100 focus-visible:ring-blue-500/20"
                      />
                    </div>
                  </div>
                </section>

                {/* Evidence and Participants */}
                <section className="rounded-xl border border-slate-200/90 dark:border-[#1e2438] bg-white dark:bg-[#121727] p-5 shadow-2xs">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Evidence and Participants</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Upload site documentation and specify designated stakeholders.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Location Photos (Multiple)</label>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Upload on-site images for transparency and verification.</p>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="flex min-h-10 w-full rounded-lg border border-dashed border-slate-300 dark:border-[#252c44] bg-slate-50/70 dark:bg-[#0e1220] px-3 py-2 text-xs text-slate-600 dark:text-slate-300 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:hover:bg-blue-700 dark:file:bg-blue-600 dark:file:hover:bg-blue-500 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white transition-colors cursor-pointer"
                        onChange={(e) => setLocationPhotoFiles(Array.from(e.target.files || []))}
                      />
                      {locationPhotoFiles.length > 0 && (
                        <div className="mt-2 rounded-lg border border-blue-100 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-950/40 p-2.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                          Selected: {locationPhotoFiles.length} photo(s)
                        </div>
                      )}
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Stakeholders *</label>
                      <textarea
                        name="stakeholders"
                        placeholder="One stakeholder or agency per line, or comma-separated"
                        rows={3}
                        required
                        className="flex min-h-[84px] w-full rounded-lg border border-slate-200 dark:border-[#222840] bg-slate-50/70 dark:bg-[#0e1220] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 ring-offset-background placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20"
                      />
                    </div>
                  </div>
                </section>

                {/* Milestone Setup */}
                <section className="space-y-4 rounded-xl border border-slate-200/90 dark:border-[#1e2438] bg-white dark:bg-[#121727] p-5 shadow-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                        <ListChecks className="h-4 w-4" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-900 dark:text-white">Milestone Setup</label>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Define phased deliverables for verification and payments. Total must equal 100%.</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-lg border-slate-200 dark:border-[#252c44] bg-white dark:bg-[#161a2b] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1c2238] font-medium text-xs h-8 px-3 transition-colors shadow-2xs"
                      onClick={() => setProjectMilestones((prev) => [...prev, createEmptyMilestonePlan()])}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add Phase
                    </Button>
                  </div>

                  <div
                    className={`rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm font-medium transition-colors ${
                      milestoneAllocationTotal === 100
                        ? 'border-emerald-200 bg-emerald-50/80 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300'
                        : 'border-amber-200 bg-amber-50/80 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300'
                    }`}
                  >
                    Milestone allocation total: <strong className="font-bold">{milestoneAllocationTotal}%</strong>. The project can only be created when all milestone shares total exactly 100%.
                  </div>

                  <div className="space-y-3">
                    {projectMilestones.map((milestone, index) => (
                      <div key={`project-milestone-${index}`} className="rounded-xl border border-slate-200/80 dark:border-[#1e2438] bg-slate-50/50 dark:bg-[#0c0f1a]/60 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60 px-2.5 py-1 text-xs font-bold">
                            Phase {index + 1}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-xs text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg px-2 py-1 transition-colors disabled:opacity-40"
                            disabled={projectMilestones.length === 1}
                            onClick={() => setProjectMilestones((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                          >
                            Remove
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div className="space-y-1">
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Milestone Title *</label>
                            <Input
                              placeholder="e.g., Ground preparation and earthworks"
                              value={milestone.title}
                              onChange={(event) =>
                                setProjectMilestones((prev) =>
                                  prev.map((item, itemIndex) => (itemIndex === index ? { ...item, title: event.target.value } : item))
                                )
                              }
                              required
                              className="h-9 rounded-lg bg-white dark:bg-[#121727] border-slate-200 dark:border-[#222840] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-blue-500/20 text-xs sm:text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Budget Share (%) *</label>
                            <Input
                              type="number"
                              min="0.01"
                              max="100"
                              step="any"
                              placeholder="Completion % (e.g., 25)"
                              value={milestone.percentage || ''}
                              onChange={(event) =>
                                setProjectMilestones((prev) =>
                                  prev.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, percentage: Number(event.target.value) } : item
                                  )
                                )
                              }
                              required
                              className="h-9 rounded-lg bg-white dark:bg-[#121727] border-slate-200 dark:border-[#222840] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-blue-500/20 text-xs sm:text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Target Date (Optional)</label>
                            <Input
                              type="date"
                              value={milestone.dueDate || ''}
                              onChange={(event) =>
                                setProjectMilestones((prev) =>
                                  prev.map((item, itemIndex) => (itemIndex === index ? { ...item, dueDate: event.target.value } : item))
                                )
                              }
                              className="h-9 rounded-lg bg-white dark:bg-[#121727] border-slate-200 dark:border-[#222840] text-slate-900 dark:text-slate-100 focus-visible:ring-blue-500/20 text-xs sm:text-sm"
                            />
                          </div>
                          <div className="space-y-1 md:col-span-2">
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Milestone Description</label>
                            <Input
                              placeholder="Detailed scope for this project phase"
                              value={milestone.description}
                              onChange={(event) =>
                                setProjectMilestones((prev) =>
                                  prev.map((item, itemIndex) => (itemIndex === index ? { ...item, description: event.target.value } : item))
                                )
                              }
                              className="h-9 rounded-lg bg-white dark:bg-[#121727] border-slate-200 dark:border-[#222840] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-blue-500/20 text-xs sm:text-sm"
                            />
                          </div>
                          <div className="space-y-1 md:col-span-2">
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Deliverables *</label>
                            <textarea
                              placeholder="One deliverable per line"
                              value={milestone.deliverables.join('\n')}
                              onChange={(event) =>
                                setProjectMilestones((prev) =>
                                  prev.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          deliverables: event.target.value.split(/\r?\n/),
                                        }
                                      : item
                                  )
                                )
                              }
                              className="flex min-h-[76px] w-full rounded-lg border border-slate-200 dark:border-[#222840] bg-white dark:bg-[#121727] px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 ring-offset-background placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20"
                              required
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-[#1a2035] pt-5 mt-5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeCreateModal}
                  disabled={isCreatingProject}
                  className="rounded-xl border-slate-200 dark:border-[#222840] bg-white dark:bg-[#141828] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1c2238] font-medium text-sm h-10 px-4 transition-colors"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-semibold text-sm shadow-xs transition-colors flex items-center gap-2"
                  disabled={isCreatingProject}
                >
                  {isCreatingProject ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Anchoring project on chain...
                    </>
                  ) : (
                    'Create Project'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ), document.body)}

        {!selectedProject ? (
          <div className="space-y-6">
            <OfficialAnalyticsDashboard />
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 pb-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <CardTitle className="text-2xl">Municipal Projects Registry</CardTitle>
                  <CardDescription>Manage approved municipal projects from MPDC creation through Budget Officer and Treasurer gates.</CardDescription>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative w-full sm:w-80">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={overviewSearchTerm}
                      onChange={(event) => handleOverviewSearchChange(event.target.value)}
                      placeholder="Search projects..."
                      className="h-11 border-slate-200 pl-10"
                    />
                  </div>
                  {user.role === 'MPDC (Planning)' && (
                    <Button onClick={openCreateModal} className="h-11 bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" /> Create Project
                    </Button>
                  )}
                </div>
              </div>
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
                {overviewProjects.map(project => {
                  const effectiveBudget = getEffectiveBudget(project);
                  const chainBudget = chainBudgets[project.id];
                  const isTampered = typeof chainBudget === 'number' && isProjectTampered(effectiveBudget, chainBudget);
                  const projectDelayed = isProjectDelayed(project);

                  return (
                    <TableRow 
                      key={project.id} 
                      className={`cursor-pointer transition-colors ${isTampered ? 'bg-[#FEF2F2] dark:bg-red-950/20 hover:bg-red-100/80 dark:hover:bg-red-950/40' : 'hover:bg-slate-50 dark:hover:bg-[#181c2b]'}`}
                      onClick={() => openProjectDetails(project.id)}
                    >
                      <TableCell className="font-mono text-xs text-slate-500">{project.id}</TableCell>
                      <TableCell className="font-medium text-slate-900">{project.name}</TableCell>
                      <TableCell className="text-slate-600">{project.location}</TableCell>
                      <TableCell className={`font-medium ${isTampered ? 'text-[#DC2626]' : 'text-slate-900'}`}>
                        <span className="inline-flex items-center gap-2">
                          {formatCurrency(effectiveBudget)}
                          {isTampered && <AlertTriangle className="h-4 w-4 text-[#DC2626]" />}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          {projectDelayed && (
                            <Badge variant="destructive">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Delayed
                            </Badge>
                          )}
                          {getStatusBadge(project.status)}
                          {isTampered && (
                            <span className="inline-flex animate-pulse items-center rounded-full border border-red-300 bg-red-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm">
                              🚨 TAMPERED
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openProjectDetails(project.id); }}>
                          Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredOverviewProjects.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                      {overviewSearchTerm ? 'No projects match your search.' : 'No projects found.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {filteredOverviewProjects.length > OVERVIEW_ITEMS_PER_PAGE && (
              <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200 bg-white px-4 py-4 sm:flex-row">
                <div className="text-sm font-medium text-slate-600">
                  Showing {(overviewPage - 1) * OVERVIEW_ITEMS_PER_PAGE + 1}-{Math.min(overviewPage * OVERVIEW_ITEMS_PER_PAGE, filteredOverviewProjects.length)} of {filteredOverviewProjects.length} projects
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setOverviewPage((page) => Math.max(1, page - 1))}
                    disabled={overviewPage === 1}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </button>
                  {Array.from({ length: overviewTotalPages }, (_, index) => index + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setOverviewPage(page)}
                      className={`h-9 min-w-9 rounded-lg px-3 text-sm font-bold ${overviewPage === page ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setOverviewPage((page) => Math.min(overviewTotalPages, page + 1))}
                    disabled={overviewPage === overviewTotalPages}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      ) : (
        <div className="official-detail-enter space-y-6">
          <Button variant="ghost" className="mb-2 -ml-4" onClick={closeProjectDetails}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Projects List
          </Button>
          
          <Card className="overflow-hidden border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#121520] shadow-sm">
            <CardHeader className="border-b border-slate-200 dark:border-[#1e2334] bg-gradient-to-br from-white via-slate-50 to-blue-50/60 dark:from-[#121520] dark:via-[#141824] dark:to-[#161c2b] pb-6">
              {selectedProjectRecord && selectedProjectTampered && (
                <div className="mb-6 rounded-2xl border border-slate-700 bg-[#1E293B] px-5 py-4 shadow-lg">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-amber-400/15 p-3 text-amber-300">
                        <ShieldAlert className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
                          ADMIN RESOLUTION PROTOCOL: DATA COMPROMISE DETECTED
                        </p>
                        <p className="mt-2 text-sm text-slate-200">
                          Reconcile the compromised local record against the immutable blockchain ledger before any further role action.
                        </p>
                      </div>
                    </div>
                    <div className="inline-flex animate-pulse items-center rounded-full border border-amber-400/60 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-300">
                      System Status: Desynchronized
                    </div>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <span className="w-fit rounded-md bg-white dark:bg-[#181c2b] dark:border dark:border-[#1e2334] dark:text-slate-300 px-2 py-1 font-mono text-xs font-semibold text-slate-500 shadow-sm">ID: {selectedProject}</span>
                <div className="flex flex-wrap justify-end gap-2">
                  {selectedProjectDelayed && (
                    <Badge variant="destructive">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Delayed
                    </Badge>
                  )}
                  {getStatusBadge(selectedProjectRecord?.status || '')}
                </div>
              </div>
              <CardTitle className="mt-5 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
                {selectedProjectRecord?.name}
              </CardTitle>
              <CardDescription className="mt-4 flex flex-wrap items-center gap-3 text-slate-600 dark:text-slate-300">
                <MapPin className="h-4 w-4 mr-1 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                <span>{selectedProjectRecord?.location}</span>
                <span className="mx-2">|</span>
                <span>{selectedProjectRecord?.category}</span>
                {selectedProjectRecord?.saro && (
                  <>
                    <span className="mx-2">|</span>
                    <span className="font-mono text-xs bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 px-2 py-1 rounded-md border border-amber-200 dark:border-amber-800">
                      {selectedProjectRecord?.saro}
                    </span>
                  </>
                )}
              </CardDescription>
              {selectedProjectRecord?.description && (
                <p className="mt-5 max-w-4xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {selectedProjectRecord.description}
                </p>
              )}
            </CardHeader>
            <CardContent className="bg-white dark:bg-[#121520] p-6">
              <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-blue-100 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/30 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">SARO Allocation</p>
                    <CircleDollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="mt-3 text-2xl font-black text-blue-900 dark:text-blue-200">{selectedProjectAllocationRate}%</p>
                  <p className="mt-1 text-sm text-blue-800 dark:text-blue-300">{formatCurrency(selectedProjectRecord?.allocatedFunds || 0)} allocated</p>
                  <div className="mt-4 h-2 rounded-full bg-white dark:bg-slate-800">
                    <div className="h-2 rounded-full bg-blue-600" style={{ width: `${selectedProjectAllocationRate}%` }} />
                  </div>
                </div>
                <div className="rounded-lg border border-emerald-100 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">NCA Disbursement</p>
                    <Landmark className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="mt-3 text-2xl font-black text-emerald-900 dark:text-emerald-200">{selectedProjectDisbursementRate}%</p>
                  <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-300">{formatCurrency(selectedProjectRecord?.disbursedFunds || 0)} released</p>
                  <div className="mt-4 h-2 rounded-full bg-white dark:bg-slate-800">
                    <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${selectedProjectDisbursementRate}%` }} />
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-[#1e2334] bg-slate-50 dark:bg-[#141824] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Milestones</p>
                    <ListChecks className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                  </div>
                  <p className="mt-3 text-2xl font-black text-slate-950 dark:text-white">
                    {selectedProjectVerifiedMilestones}/{selectedProjectRecord?.milestones.length || 0}
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{selectedProjectPaidMilestones} paid milestone{selectedProjectPaidMilestones === 1 ? '' : 's'}</p>
                </div>
                <div className={`rounded-lg border p-5 ${selectedProjectDelayed ? 'border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30' : 'border-slate-200 dark:border-[#1e2334] bg-slate-50 dark:bg-[#141824]'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className={`text-xs font-bold uppercase tracking-wider ${selectedProjectDelayed ? 'text-red-700 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>Schedule Health</p>
                    <AlertTriangle className={`h-5 w-5 ${selectedProjectDelayed ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`} />
                  </div>
                  <p className={`mt-3 text-2xl font-black ${selectedProjectDelayed ? 'text-red-900 dark:text-red-200' : 'text-slate-950 dark:text-white'}`}>
                    {selectedProjectDelayed ? 'Delayed' : 'On Track'}
                  </p>
                  <p className={`mt-1 text-sm ${selectedProjectDelayed ? 'text-red-800 dark:text-red-300' : 'text-slate-600 dark:text-slate-400'}`}>
                    {selectedProjectDelayedMilestones} overdue milestone{selectedProjectDelayedMilestones === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              <div className="mb-8">
                <div className="rounded-lg border border-slate-200 dark:border-[#1e2334] bg-slate-50/70 dark:bg-[#141824] p-5">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <h3 className="flex items-center text-lg font-black text-slate-950 dark:text-white">
                        <MapPin className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
                        Site Evidence
                      </h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Location photos attached to the official project record.</p>
                    </div>
                    <Badge variant="outline" className="bg-white dark:bg-[#181c2b] dark:text-slate-300 dark:border-[#1e2334]">{selectedProjectPhotos.length} photo{selectedProjectPhotos.length === 1 ? '' : 's'}</Badge>
                  </div>
                  {selectedProjectPhotos.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {selectedProjectPhotos.slice(0, 4).map((photoUrl, index) => (
                        <button
                          key={index}
                          type="button"
                          className="group relative overflow-hidden rounded-lg border border-slate-200 dark:border-[#1e2334] bg-slate-100 dark:bg-[#181c2b] text-left shadow-sm aspect-video"
                          onClick={() => setSelectedProjectPhotoIndex(index)}
                        >
                          <img
                            src={photoUrl}
                            alt={`Location photo ${index + 1}`}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                            <p className="text-xs font-bold text-white">Photo {index + 1}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-slate-300 dark:border-[#1e2334] bg-white dark:bg-[#181c2b] text-sm text-slate-500 dark:text-slate-400">
                      No location photos uploaded yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-8 rounded-lg border border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#121520] p-5 shadow-sm">
                <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-xl font-black text-slate-950 dark:text-white">Complete Project Information</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Full official record, including governance, blockchain, schedule, and evidence details.</p>
                  </div>
                  <Badge variant="outline" className="w-fit bg-slate-50 dark:bg-[#181c2b] dark:text-slate-300 dark:border-[#1e2334]">Full Details</Badge>
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 dark:border-[#1e2334] bg-slate-50/70 dark:bg-[#141824] p-4">
                    <h4 className="mb-4 flex items-center text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      <Building2 className="mr-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
                      Project Profile
                    </h4>
                    <dl className="grid gap-3 text-sm">
                      <div>
                        <dt className="font-semibold text-slate-500 dark:text-slate-400">Project Name</dt>
                        <dd className="mt-1 font-bold text-slate-950 dark:text-white">{selectedProjectRecord?.name || 'N/A'}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-500 dark:text-slate-400">Description</dt>
                        <dd className="mt-1 leading-6 text-slate-700 dark:text-slate-300">{selectedProjectRecord?.description || 'No description provided.'}</dd>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <dt className="font-semibold text-slate-500 dark:text-slate-400">Project ID</dt>
                          <dd className="mt-1 break-all font-mono text-xs font-bold text-slate-900 dark:text-slate-200">{selectedProjectRecord?.id || 'N/A'}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-slate-500 dark:text-slate-400">Status</dt>
                          <dd className="mt-1">{getStatusBadge(selectedProjectRecord?.status || '')}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-slate-500 dark:text-slate-400">Category</dt>
                          <dd className="mt-1 font-bold text-slate-900 dark:text-slate-200">{selectedProjectRecord?.category || 'N/A'}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-slate-500 dark:text-slate-400">Location</dt>
                          <dd className="mt-1 font-bold text-slate-900 dark:text-slate-200">{selectedProjectRecord?.location || 'N/A'}</dd>
                        </div>
                      </div>
                    </dl>
                  </div>

                  <div className="rounded-lg border border-slate-200 dark:border-[#1e2334] bg-slate-50/70 dark:bg-[#141824] p-4">
                    <h4 className="mb-4 flex items-center text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      <CalendarRange className="mr-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
                      Schedule And Status
                    </h4>
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="font-semibold text-slate-500 dark:text-slate-400">Created At</dt>
                        <dd className="mt-1 font-bold text-slate-900 dark:text-slate-200">{safeFormatDate(selectedProjectRecord?.createdAt, 'MMM dd, yyyy HH:mm')}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-500 dark:text-slate-400">Start Date</dt>
                        <dd className="mt-1 font-bold text-slate-900 dark:text-slate-200">{safeFormatDate(selectedProjectRecord?.startDate, 'MMM dd, yyyy')}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-500 dark:text-slate-400">End Date</dt>
                        <dd className={`mt-1 font-bold ${selectedProjectDelayed ? 'text-red-700 dark:text-red-400' : 'text-slate-900 dark:text-slate-200'}`}>{safeFormatDate(selectedProjectRecord?.endDate, 'MMM dd, yyyy')}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-500 dark:text-slate-400">Activated At</dt>
                        <dd className="mt-1 font-bold text-slate-900 dark:text-slate-200">{safeFormatDate(selectedProjectRecord?.activatedAt, 'MMM dd, yyyy HH:mm')}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-500 dark:text-slate-400">Schedule Health</dt>
                        <dd className={`mt-1 font-bold ${selectedProjectDelayed ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{selectedProjectDelayed ? 'Delayed' : 'On Track'}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-500 dark:text-slate-400">Delayed Milestones</dt>
                        <dd className="mt-1 font-bold text-slate-900 dark:text-slate-200">{selectedProjectDelayedMilestones}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="rounded-lg border border-slate-200 dark:border-[#1e2334] bg-slate-50/70 dark:bg-[#141824] p-4">
                    <h4 className="mb-4 flex items-center text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      <CircleDollarSign className="mr-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
                      Funding And Budget
                    </h4>
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="font-semibold text-slate-500 dark:text-slate-400">Budget Source</dt>
                        <dd className="mt-1 font-bold text-slate-900 dark:text-slate-200">{selectedProjectRecord?.budgetSource || 'N/A'}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-500 dark:text-slate-400">SARO Reference</dt>
                        <dd className="mt-1 font-mono text-xs font-bold text-amber-800 dark:text-amber-400">{selectedProjectRecord?.saro || 'Pending'}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-500 dark:text-slate-400">Total Budget</dt>
                        <dd className={`mt-1 font-bold ${selectedProjectTampered ? 'text-red-700 dark:text-red-400' : 'text-slate-900 dark:text-slate-200'}`}>{formatCurrency(selectedProjectDisplayBudget || 0)}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-500 dark:text-slate-400">Allocated Funds</dt>
                        <dd className="mt-1 font-bold text-blue-800 dark:text-blue-400">{formatCurrency(selectedProjectRecord?.allocatedFunds || 0)}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-500 dark:text-slate-400">Disbursed Funds</dt>
                        <dd className="mt-1 font-bold text-emerald-800 dark:text-emerald-400">{formatCurrency(selectedProjectRecord?.disbursedFunds || 0)}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-500 dark:text-slate-400">Latest Disbursement Ref</dt>
                        <dd className="mt-1 break-all font-mono text-xs font-bold text-slate-900 dark:text-slate-200">{selectedProjectRecord?.latestDisbursementRef || 'N/A'}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="rounded-lg border border-slate-200 dark:border-[#1e2334] bg-slate-50/70 dark:bg-[#141824] p-4">
                    <h4 className="mb-4 flex items-center text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      <ShieldCheck className="mr-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
                      Blockchain And Governance
                    </h4>
                    <dl className="grid gap-3 text-sm">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <dt className="font-semibold text-slate-500 dark:text-slate-400">Metadata Hash</dt>
                          <dd className="mt-1 break-all font-mono text-xs font-bold text-slate-900 dark:text-slate-200" title={selectedProjectRecord?.metadataHash}>{shortenHash(selectedProjectRecord?.metadataHash)}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-slate-500 dark:text-slate-400">Project Tx Hash</dt>
                          <dd className="mt-1 break-all font-mono text-xs font-bold text-slate-900 dark:text-slate-200" title={selectedProjectRecord?.blockchainTxHash}>{shortenHash(selectedProjectRecord?.blockchainTxHash)}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-slate-500 dark:text-slate-400">Treasury Seal Hash</dt>
                          <dd className="mt-1 break-all font-mono text-xs font-bold text-slate-900 dark:text-slate-200" title={selectedProjectRecord?.treasurySealHash}>{shortenHash(selectedProjectRecord?.treasurySealHash)}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-slate-500 dark:text-slate-400">On-chain Synced At</dt>
                          <dd className="mt-1 font-bold text-slate-900 dark:text-slate-200">{safeFormatDate(selectedProjectRecord?.onChainSyncedAt, 'MMM dd, yyyy HH:mm')}</dd>
                        </div>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-500 dark:text-slate-400">Created By Wallet</dt>
                        <dd className="mt-1 break-all font-mono text-xs font-bold text-slate-900 dark:text-slate-200">{selectedProjectRecord?.createdByWallet || 'N/A'}</dd>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <dt className="font-semibold text-slate-500 dark:text-slate-400">Budget Officer Wallet</dt>
                          <dd className="mt-1 break-all font-mono text-xs font-bold text-slate-900 dark:text-slate-200">{selectedProjectRecord?.budgetOfficerWallet || 'N/A'}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-slate-500 dark:text-slate-400">Budget Officer Signed At</dt>
                          <dd className="mt-1 font-bold text-slate-900 dark:text-slate-200">{safeFormatDate(selectedProjectRecord?.budgetOfficerSignedAt, 'MMM dd, yyyy HH:mm')}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-slate-500 dark:text-slate-400">Treasurer Wallet</dt>
                          <dd className="mt-1 break-all font-mono text-xs font-bold text-slate-900 dark:text-slate-200">{selectedProjectRecord?.treasurerWallet || 'N/A'}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-slate-500 dark:text-slate-400">Treasurer Signed At</dt>
                          <dd className="mt-1 font-bold text-slate-900 dark:text-slate-200">{safeFormatDate(selectedProjectRecord?.treasurerSignedAt, 'MMM dd, yyyy HH:mm')}</dd>
                        </div>
                      </div>
                    </dl>
                  </div>
                </div>

                <div className="mt-5 grid gap-5 xl:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 dark:border-[#1e2334] bg-slate-50/70 dark:bg-[#141824] p-4">
                    <h4 className="mb-3 flex items-center text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      <Users className="mr-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
                      Stakeholders
                    </h4>
                    {selectedProjectRecord?.stakeholders?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedProjectRecord.stakeholders.map((stakeholder) => (
                          <Badge key={stakeholder} variant="outline" className="bg-white dark:bg-[#181c2b] dark:text-slate-300 dark:border-[#1e2334]">{stakeholder}</Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 dark:text-slate-400">No stakeholders listed.</p>
                    )}
                  </div>

                  <div className="rounded-lg border border-slate-200 dark:border-[#1e2334] bg-slate-50/70 dark:bg-[#141824] p-4">
                    <h4 className="mb-3 flex items-center text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      <FileCheck className="mr-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
                      Records Count
                    </h4>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-white dark:bg-[#181c2b] p-3">
                        <p className="text-xl font-black text-slate-950 dark:text-white">{selectedProjectRecord?.milestones.length || 0}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Milestones</p>
                      </div>
                      <div className="rounded-lg bg-white dark:bg-[#181c2b] p-3">
                        <p className="text-xl font-black text-slate-950 dark:text-white">{selectedProjectRecord?.documents.length || 0}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Documents</p>
                      </div>
                      <div className="rounded-lg bg-white dark:bg-[#181c2b] p-3">
                        <p className="text-xl font-black text-slate-950 dark:text-white">{selectedProjectRecord?.transactions.length || 0}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Ledger</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 dark:border-[#1e2334] bg-slate-50/70 dark:bg-[#141824] p-4">
                    <h4 className="mb-3 flex items-center text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      <AlertTriangle className="mr-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
                      Exceptions
                    </h4>
                    <dl className="grid gap-2 text-sm">
                      <div>
                        <dt className="font-semibold text-slate-500 dark:text-slate-400">Rejection Role</dt>
                        <dd className="mt-1 font-bold text-slate-900 dark:text-slate-200">{selectedProjectRecord?.rejectedByRole || 'N/A'}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-500 dark:text-slate-400">Rejection Reason</dt>
                        <dd className="mt-1 text-slate-700 dark:text-slate-300">{selectedProjectRecord?.rejectionReason || 'N/A'}</dd>
                      </div>
                    </dl>
                  </div>
                </div>

                {(selectedProjectRecord?.departmentBudget || selectedProjectRecord?.complianceScore || selectedProjectRecord?.approvalStages?.length) && (
                  <div className="mt-5 grid gap-5 xl:grid-cols-3">
                    {selectedProjectRecord?.departmentBudget && (
                      <div className="rounded-lg border border-slate-200 dark:border-[#1e2334] bg-slate-50/70 dark:bg-[#141824] p-4">
                        <h4 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">Department Budget</h4>
                        <dl className="grid gap-2 text-sm">
                          <div className="flex justify-between gap-4"><dt className="text-slate-500 dark:text-slate-400">Department</dt><dd className="font-bold text-slate-900 dark:text-slate-200">{selectedProjectRecord.departmentBudget.department}</dd></div>
                          <div className="flex justify-between gap-4"><dt className="text-slate-500 dark:text-slate-400">Allocated</dt><dd className="font-bold text-slate-900 dark:text-slate-200">{formatCurrency(selectedProjectRecord.departmentBudget.allocatedBudget)}</dd></div>
                          <div className="flex justify-between gap-4"><dt className="text-slate-500 dark:text-slate-400">Spent</dt><dd className="font-bold text-slate-900 dark:text-slate-200">{formatCurrency(selectedProjectRecord.departmentBudget.spentBudget)}</dd></div>
                          <div className="flex justify-between gap-4"><dt className="text-slate-500 dark:text-slate-400">Projects</dt><dd className="font-bold text-slate-900 dark:text-slate-200">{selectedProjectRecord.departmentBudget.projectCount}</dd></div>
                        </dl>
                      </div>
                    )}
                    {selectedProjectRecord?.complianceScore && (
                      <div className="rounded-lg border border-slate-200 dark:border-[#1e2334] bg-slate-50/70 dark:bg-[#141824] p-4">
                        <h4 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">Compliance Score</h4>
                        <dl className="grid grid-cols-2 gap-2 text-sm">
                          <div><dt className="text-slate-500 dark:text-slate-400">Total</dt><dd className="font-bold text-slate-900 dark:text-slate-200">{selectedProjectRecord.complianceScore.totalScore}%</dd></div>
                          <div><dt className="text-slate-500 dark:text-slate-400">Documents</dt><dd className="font-bold text-slate-900 dark:text-slate-200">{selectedProjectRecord.complianceScore.documentScore}%</dd></div>
                          <div><dt className="text-slate-500 dark:text-slate-400">Milestones</dt><dd className="font-bold text-slate-900 dark:text-slate-200">{selectedProjectRecord.complianceScore.milestoneScore}%</dd></div>
                          <div><dt className="text-slate-500 dark:text-slate-400">Budget</dt><dd className="font-bold text-slate-900 dark:text-slate-200">{selectedProjectRecord.complianceScore.budgetScore}%</dd></div>
                          <div><dt className="text-slate-500 dark:text-slate-400">Audit</dt><dd className="font-bold text-slate-900 dark:text-slate-200">{selectedProjectRecord.complianceScore.auditScore}%</dd></div>
                          <div><dt className="text-slate-500 dark:text-slate-400">Updated</dt><dd className="font-bold text-slate-900 dark:text-slate-200">{safeFormatDate(selectedProjectRecord.complianceScore.lastUpdated, 'MMM dd, yyyy')}</dd></div>
                        </dl>
                      </div>
                    )}
                    {selectedProjectRecord?.approvalStages?.length ? (
                      <div className="rounded-lg border border-slate-200 dark:border-[#1e2334] bg-slate-50/70 dark:bg-[#141824] p-4">
                        <h4 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">Approval Stages</h4>
                        <div className="space-y-2">
                          {selectedProjectRecord.approvalStages.map((stage) => (
                            <div key={stage.id} className="rounded-lg bg-white dark:bg-[#181c2b] p-3 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-bold text-slate-900 dark:text-white">{stage.stage}</p>
                                <Badge variant={stage.status === 'Rejected' ? 'destructive' : 'outline'} className="dark:border-[#1e2334]">{stage.status}</Badge>
                              </div>
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{stage.approvedByRole} | {safeFormatDate(stage.timestamp, 'MMM dd, yyyy HH:mm')}</p>
                              {stage.comments && <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{stage.comments}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {selectedProjectRecord && selectedProjectTampered && selectedProjectChainBudget !== null && (
                <div className="mb-8 rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-6 shadow-sm">
                  <p className="text-lg font-semibold text-red-900 dark:text-red-200">
                    The local server budget display has been corrupted. Variance Loss Accounted: {formatCurrency(selectedProjectDisplayBudget - selectedProjectChainBudget)}.
                  </p>
                  <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-5">
                      <p className="text-sm font-semibold text-red-700 dark:text-red-400">Database Record (Compromised Data)</p>
                      <p className="mt-3 text-3xl font-bold text-red-900 dark:text-red-200">{formatCurrency(selectedProjectDisplayBudget)}</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 p-5">
                      <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Blockchain Ledger (Immutable / Real Price)</p>
                      <p className="mt-3 text-3xl font-bold text-emerald-800 dark:text-emerald-300">{formatCurrency(selectedProjectChainBudget)}</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedProjectRecord && renderMultiSigIndicator(selectedProjectRecord)}

              <div className="rounded-lg border border-slate-200 dark:border-[#1e2334] bg-slate-50/70 dark:bg-[#141824] p-5">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-xl font-black text-slate-950 dark:text-white">Role Actions</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Available controls for the active official role.</p>
                  </div>
                  <Badge variant="outline" className="w-fit bg-white dark:bg-[#181c2b] dark:text-slate-300 dark:border-[#1e2334]">{user.role}</Badge>
                </div>
                {selectedProjectTampered && selectedProjectRecord && selectedProjectChainBudget !== null && (
                  <div className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-auto min-h-12 justify-center border-slate-300 dark:border-[#1e2334] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#181c2b]"
                      onClick={handleViewDatabaseAccessLogs}
                    >
                      <Database className="mr-2 h-4 w-4" />
                      View Database Access Logs
                    </Button>
                    {isAdminUser ? (
                    <Button
                      type="button"
                      className="h-auto min-h-12 justify-center bg-emerald-600 text-white hover:bg-emerald-700"
                      onClick={() => handleForceSyncDatabase(selectedProjectRecord)}
                      disabled={isForceSyncing}
                    >
                      {isForceSyncing ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Syncing database with blockchain...
                        </>
                      ) : (
                        'Force Sync Database with Blockchain'
                      )}
                    </Button>
                    ) : null}
                  </div>
                )}
                {selectedProjectRecord && renderRoleSpecificActions(selectedProjectRecord)}
              </div>

              <div className="mt-8 rounded-lg border border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#121520] p-5 shadow-sm">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-xl font-black text-slate-950 dark:text-white">Project Milestones</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Progress checkpoints, target dates, verification, and payment state.</p>
                  </div>
                  <Badge variant="outline" className="w-fit bg-slate-50 dark:bg-[#181c2b] dark:text-slate-300 dark:border-[#1e2334]">
                    {selectedProjectVerifiedMilestones}/{selectedProjectRecord?.milestones.length || 0} verified
                  </Badge>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  {selectedProjectRecord?.milestones.length ? (
                    selectedProjectRecord.milestones.map(m => {
                      const milestoneDelayed = isMilestoneDelayed(m);
                      const milestonePhotos = m.photos || [];
                      const milestoneReports =
                        selectedProjectRecord.documents?.filter((doc: DashboardEvidenceDocument & { id?: string; milestoneId?: string }) => doc.milestoneId === m.id) || [];
                      const milestonePhotoItems: MediaLightboxItem[] = milestonePhotos.map((photo, photoIndex) => ({
                        type: 'image',
                        url: resolveAssetUrl(photo.url),
                        title: photo.description || `${m.title} photo ${photoIndex + 1}`,
                      }));

                      return (
                        <div key={m.id} className={`flex min-h-40 flex-col justify-between rounded-lg border p-4 shadow-sm ${milestoneDelayed ? 'border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30' : 'border-slate-200 dark:border-[#1e2334] bg-slate-50/60 dark:bg-[#141824]'}`}>
                          <div>
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <h4 className="font-semibold text-slate-900 dark:text-white">{m.title}</h4>
                              {milestoneDelayed && (
                                <Badge variant="destructive">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Delayed
                                </Badge>
                              )}
                              <Badge variant="outline" className="bg-slate-50 dark:bg-[#181c2b] dark:text-slate-300 dark:border-[#1e2334]">{m.percentage}%</Badge>
                              {m.status === 'Verified' && <Badge className="bg-purple-500">Verified</Badge>}
                              {m.status === 'Paid' && <Badge className="bg-emerald-500">Paid</Badge>}
                              {m.status === 'Pending' && <Badge variant="secondary" className="dark:bg-[#181c2b] dark:text-slate-300">Pending</Badge>}
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{m.description}</p>
                            {getMilestoneTargetDate(m as { dueDate?: string; due_date?: string }) && (
                              <p className={`mt-1 text-xs ${milestoneDelayed ? 'font-semibold text-red-700 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>Target date: {safeFormatDate(getMilestoneTargetDate(m as { dueDate?: string; due_date?: string }), 'MMM dd, yyyy')}</p>
                            )}
                          </div>
                          {(milestonePhotos.length > 0 || milestoneReports.length > 0) && (
                            <div className="mt-4 border-t border-slate-200 dark:border-[#1e2334] pt-4">
                              <div className="mb-3 flex items-center justify-between gap-2">
                                <p className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">Verification files</p>
                                <Badge variant="outline" className="bg-white dark:bg-[#181c2b] dark:text-slate-300 dark:border-[#1e2334] text-xs">
                                  {milestonePhotos.length + milestoneReports.length} file{milestonePhotos.length + milestoneReports.length === 1 ? '' : 's'}
                                </Badge>
                              </div>
                              <div className="grid gap-3 lg:grid-cols-2">
                                {milestonePhotos.length > 0 && (
                                  <div>
                                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Photos</p>
                                    <div className="grid grid-cols-2 gap-2">
                                      {milestonePhotos.map((photo, photoIndex) => (
                                        <button
                                          key={`${m.id}-photo-${photoIndex}`}
                                          type="button"
                                          onClick={() => openSelectedProjectPreview(milestonePhotoItems, photoIndex)}
                                          className="group overflow-hidden rounded-lg border border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#181c2b] text-left shadow-sm transition-colors hover:border-blue-300"
                                        >
                                          <div className="aspect-video overflow-hidden bg-slate-100 dark:bg-slate-800">
                                            <img
                                              src={resolveAssetUrl(photo.url)}
                                              alt={photo.description || `${m.title} photo ${photoIndex + 1}`}
                                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                            />
                                          </div>
                                          <div className="p-2">
                                            <p className="text-xs font-bold capitalize text-slate-700 dark:text-slate-300">{photo.type || 'Proof'}</p>
                                            {photo.description && (
                                              <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{photo.description}</p>
                                            )}
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {milestoneReports.length > 0 && (
                                  <div>
                                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Reports</p>
                                    <div className="space-y-2">
                                      {milestoneReports.map((doc, docIndex) => (
                                        <button
                                          key={`${m.id}-report-${doc.id || doc.url || docIndex}`}
                                          type="button"
                                          onClick={() =>
                                            openSelectedProjectPreview(
                                              [{
                                                type: 'document',
                                                url: resolveAssetUrl(doc.url),
                                                title: doc.title,
                                                fileFormat: doc.fileFormat,
                                              }],
                                              0
                                            )
                                          }
                                          className="flex w-full items-start rounded-lg border border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#181c2b] p-3 text-left shadow-sm transition-colors hover:border-blue-300 dark:hover:bg-[#1f2638]"
                                        >
                                          <FileText className="mr-3 mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                                          <span className="min-w-0">
                                            <span className="block truncate text-sm font-bold text-blue-700 dark:text-blue-400">{doc.title}</span>
                                            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                              {safeFormatDate(doc.dateUploaded, 'MMM dd, yyyy')}
                                            </span>
                                          </span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          {m.dateVerified && (
                            <div className="mt-4 border-t border-slate-200 dark:border-[#1e2334] pt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                              Verified: {safeFormatDate(m.dateVerified, 'MMM dd, yyyy')}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-300 dark:border-[#1e2334] bg-slate-50 dark:bg-[#141824] p-4 text-center text-slate-500 dark:text-slate-400">
                      No milestones have been set up for this project yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8 rounded-lg border border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#121520] p-5 shadow-sm">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-xl font-black text-slate-950 dark:text-white">Recent Ledger Entries</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Latest blockchain-backed project transactions.</p>
                  </div>
                  <Badge variant="outline" className="w-fit bg-slate-50 dark:bg-[#181c2b] dark:text-slate-300 dark:border-[#1e2334]">{selectedProjectRecord?.transactions.length || 0} entries</Badge>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-[#1e2334]">
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-[#141824]">
                      <TableRow className="dark:border-[#1e2334]">
                        <TableHead className="dark:text-slate-400">Date</TableHead>
                        <TableHead className="dark:text-slate-400">Type</TableHead>
                        <TableHead className="dark:text-slate-400">Amount/Details</TableHead>
                        <TableHead className="dark:text-slate-400">Tx Hash</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedProjectRecord?.transactions.slice(-5).reverse().map((tx) => (
                        <TableRow key={tx.id} className="dark:border-[#1e2334]">
                          <TableCell className="whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                            {safeFormatDate(tx.date, 'MMM dd, yyyy HH:mm')}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{tx.type}</span>
                          </TableCell>
                          <TableCell className="font-medium text-sm text-slate-900 dark:text-white">
                            {formatCurrency(tx.amount)}
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">{tx.description}</div>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#181c2b] px-2 py-1 rounded border border-slate-100 dark:border-[#1e2334]" title={tx.hash || 'Pending'}>
                              {shortenHash(tx.hash)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                      {selectedProjectRecord?.transactions.length === 0 && (
                        <TableRow className="dark:border-[#1e2334]">
                          <TableCell colSpan={4} className="h-24 text-center text-slate-500 dark:text-slate-400">
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

          {showBreachLogModal && selectedProjectRecord && createPortal((
            <div className="fixed inset-0 z-[9999] flex h-screen w-screen flex-col overflow-hidden bg-slate-50 dark:bg-[#0c0e14] text-slate-900 dark:text-white">
              <div className="shrink-0 border-b border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/40 px-5 py-4 shadow-sm sm:px-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-400">
                      Database Access Logs
                    </p>
                    <h4 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
                      Tamper Explanation for {selectedProjectRecord.id}
                    </h4>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      Full-screen review of the detected database and blockchain budget mismatch.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-slate-300 dark:border-[#1e2334] bg-white dark:bg-[#181c2b] dark:text-white sm:w-auto"
                    onClick={() => setShowBreachLogModal(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8 lg:px-10">
                <div className="mx-auto grid w-full max-w-7xl gap-6 xl:grid-cols-[1.25fr_0.75fr]">
                  <section className="rounded-lg border border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#121520] p-6 shadow-sm">
                    <div className="mb-5 flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                        <ShieldAlert className="h-5 w-5" />
                      </div>
                      <div>
                        <h5 className="text-xl font-black text-slate-950 dark:text-white">Access Log Explanation</h5>
                        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                          The local database budget was changed outside the normal blockchain-backed approval flow.
                          This means a direct local update likely happened after the project was already anchored on chain,
                          which caused the blockchain value and database value to become desynchronized.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-5">
                        <p className="text-sm font-semibold text-red-700 dark:text-red-400">Compromised Database Value</p>
                        <p className="mt-3 text-3xl font-black text-red-900 dark:text-red-200">
                          {formatCurrency(selectedProjectDisplayBudget)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 p-5">
                        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Immutable Blockchain Value</p>
                        <p className="mt-3 text-3xl font-black text-emerald-800 dark:text-emerald-300">
                          {formatCurrency(selectedProjectChainBudget || 0)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 p-5">
                      <p className="text-sm font-bold text-amber-900 dark:text-amber-300">Recommended Action</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
                        Report the incident to an Admin, then use the force sync action once the mismatch has been reviewed.
                      </p>
                    </div>
                  </section>

                  <aside className="rounded-lg border border-slate-200 dark:border-[#1e2334] bg-white dark:bg-[#121520] p-6 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Project Snapshot</p>
                    <div className="mt-5 space-y-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Project ID</p>
                        <p className="mt-1 break-all font-mono text-sm font-bold text-slate-900 dark:text-slate-200">{selectedProjectRecord.id}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Project Name</p>
                        <p className="mt-1 text-base font-bold text-slate-900 dark:text-white">{selectedProjectRecord.name}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Status</p>
                        <div className="mt-2">{getStatusBadge(selectedProjectRecord.status)}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 dark:border-[#1e2334] bg-slate-50 dark:bg-[#141824] p-4">
                        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Variance Loss Accounted</p>
                        <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
                          {formatCurrency(selectedProjectDisplayBudget - (selectedProjectChainBudget || 0))}
                        </p>
                      </div>
                    </div>
                  </aside>
                </div>
              </div>
            </div>
          ), document.body)}

          {selectedProjectPhotoIndex !== null && selectedProjectPhotos[selectedProjectPhotoIndex] && (
            <MediaLightbox
              items={selectedProjectPhotos.map((photoUrl, index) => ({
                type: 'image',
                url: resolveAssetUrl(photoUrl),
                title: `Location photo ${index + 1}`,
              }))}
              index={selectedProjectPhotoIndex}
              onClose={() => setSelectedProjectPhotoIndex(null)}
              onIndexChange={setSelectedProjectPhotoIndex}
            />
          )}
          {selectedProjectPreviewIndex !== null && selectedProjectPreviewItems[selectedProjectPreviewIndex] && (
            <MediaLightbox
              items={selectedProjectPreviewItems}
              index={selectedProjectPreviewIndex}
              onClose={closeSelectedProjectPreview}
              onIndexChange={setSelectedProjectPreviewIndex}
            />
          )}
        </div>
      )}
    </div>
  );
};
