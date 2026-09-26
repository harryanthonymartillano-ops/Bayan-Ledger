import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useBlockchain } from '../../context/BlockchainContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Input } from '../../components/ui/input';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Calendar,
  Check,
  CheckCircle,
  CircleDot,
  Clock,
  Copy,
  ExternalLink,
  FileCheck2,
  FileSignature,
  FileText,
  ImagePlus,
  Landmark,
  MapPin,
  MessageSquare,
  Receipt,
  Send,
  ShieldCheck,
  SmilePlus,
  Sticker,
  User,
} from 'lucide-react';
import { format } from 'date-fns';
import apiClient, { API_BASE_URL } from '../../lib/apiClient';
import { DatabaseBreachAlert } from '../../components/security/DatabaseBreachAlert';
import { TamperingDetectedBadge } from '../../components/security/TamperingDetectedBadge';
import { MediaLightbox, MediaLightboxItem } from '../../components/MediaLightbox';
import { getContract, getReadOnlyWeb3Provider } from '../../lib/web3';
import { isProjectTampered } from '../../lib/projectIntegrity';
import { censorProfanity } from '../../lib/profanityFilter';
import { isMilestoneDelayed, isProjectDelayed } from '../../lib/scheduleStatus';
import { getStoredChainBudget, updateStoredChainBudget } from '../../lib/chainBudgetCache';
import { getStoredProjectById } from '../../lib/projectCache';

type TransparencyStage = {
  phase: string;
  title: string;
  status: 'Completed' | 'Pending' | 'Rejected' | 'Locked' | 'Ready' | 'In Progress';
  statusLabel: string;
  actorRole: string;
  actorWallet?: string | null;
  timestamp?: string | null;
  reference?: string | null;
  amount?: number;
  notes?: string;
};

type TransparencySummary = {
  projectId: string;
  name: string;
  status: string;
  metadataHash?: string | null;
  createdByWallet?: string | null;
  budgetOfficerWallet?: string | null;
  treasurerWallet?: string | null;
  treasurySealHash?: string | null;
  saroRef?: string | null;
  latestDisbursementRef?: string | null;
  rejectionReason?: string | null;
  stages: TransparencyStage[];
};

const deriveTransparencySummaryFromProject = (proj: any): TransparencySummary | null => {
  if (!proj || !proj.id) return null;

  const milestones = Array.isArray(proj.milestones) ? proj.milestones : [];
  const transactions = Array.isArray(proj.transactions) ? proj.transactions : [];
  const publicDocuments = (proj.documents || []).filter(
    (document: any) => !document.milestone_id && !document.milestoneId
  );

  const allocationTransaction = transactions.find((transaction: any) => {
    const type = String(transaction.type || '').toLowerCase();
    return type === 'allocation (saro)' || type === 'allocation';
  }) || null;

  const verifiedMilestones = milestones.filter(
    (milestone: any) => milestone.status === 'Verified' || milestone.status === 'Paid'
  ).length;
  const paidMilestones = milestones.filter((milestone: any) => milestone.status === 'Paid').length;

  const stages: TransparencyStage[] = [
    {
      phase: 'PHASE 1',
      title: 'MPDC Creates Approved Project',
      status: 'Completed',
      statusLabel: 'MPDC Approved',
      actorRole: 'MPDC (Planning)',
      actorWallet: proj.blockchain_created_by_wallet || proj.createdByWallet || null,
      timestamp: proj.created_at || proj.createdAt || null,
      notes: 'Project was created directly as an approved municipal project.',
    },
    {
      phase: 'GATE 1',
      title: 'Budget Officer Allocation (SARO)',
      status:
        proj.status === 'Rejected - Budget Officer'
          ? 'Rejected'
          : allocationTransaction
            ? 'Completed'
            : 'Pending',
      statusLabel:
        proj.status === 'Rejected - Budget Officer'
          ? 'Rejected - Budget Officer'
          : allocationTransaction
            ? 'SARO Approved - Pending Treasurer'
            : 'Pending Budget Officer Review',
      actorRole: 'Budget Officer',
      actorWallet: proj.budget_officer_wallet || proj.budgetOfficerWallet || null,
      timestamp: proj.budget_officer_signed_at || proj.budgetOfficerSignedAt || null,
      reference: proj.saro || allocationTransaction?.saro || null,
      amount: allocationTransaction ? Number(allocationTransaction.amount || 0) : Number(proj.allocatedFunds || 0),
      notes:
        proj.status === 'Rejected - Budget Officer'
          ? proj.rejectionReason || 'Budget Officer rejected this project.'
          : allocationTransaction
            ? 'SARO created and first signature recorded.'
            : 'Awaiting SARO allocation review.',
    },
    {
      phase: 'GATE 2',
      title: 'Treasurer Approval & Execution',
      status:
        proj.status === 'Rejected - Treasurer'
          ? 'Rejected'
          : ['ACTIVE', 'In Progress', 'Completed'].includes(proj.status)
            ? 'Completed'
            : 'Pending',
      statusLabel:
        proj.status === 'Rejected - Treasurer'
          ? 'Rejected - Treasurer'
          : ['ACTIVE', 'In Progress', 'Completed'].includes(proj.status)
            ? 'Ready'
            : 'Pending',
      actorRole: 'Treasurer',
      actorWallet: proj.treasurer_wallet || proj.treasurerWallet || null,
      timestamp: proj.treasurer_signed_at || proj.treasurerSignedAt || null,
      reference: proj.treasury_seal_hash || proj.treasurySealHash || null,
      amount: allocationTransaction ? Number(allocationTransaction.amount || 0) : Number(proj.allocatedFunds || 0),
      notes:
        proj.status === 'Rejected - Treasurer'
          ? proj.rejectionReason || 'Treasurer rejected this project.'
          : ['ACTIVE', 'In Progress', 'Completed'].includes(proj.status)
            ? 'Treasury activation complete. Digital seal of truth issued.'
            : proj.status === 'SARO Approved - Pending Treasurer'
              ? 'Awaiting Treasurer review and execution.'
              : 'Treasurer action is not available yet.',
    },
    {
      phase: 'PHASE 2',
      title: 'Project Execution',
      status:
        proj.status === 'Completed'
          ? 'Completed'
          : proj.status === 'In Progress'
            ? 'In Progress'
            : proj.status === 'ACTIVE'
              ? 'Ready'
              : 'Locked',
      statusLabel:
        proj.status === 'Completed'
          ? 'Completed'
          : proj.status === 'In Progress'
            ? 'In Progress'
            : proj.status === 'ACTIVE'
              ? 'ACTIVE'
              : 'Locked Until Both Gates Pass',
      actorRole: 'MPDC / Treasurer / Public',
      actorWallet: null,
      timestamp: proj.activated_at || proj.activatedAt || null,
      reference: proj.latest_disbursement_ref || proj.latestDisbursementRef || null,
      amount: Number(proj.disbursedFunds || 0),
      notes:
        proj.status === 'Completed'
          ? `All milestones and disbursements are complete. Paid milestones: ${paidMilestones}/${milestones.length}.`
          : proj.status === 'In Progress'
            ? `Execution is live. Verified milestones: ${verifiedMilestones}/${milestones.length}.`
            : proj.status === 'ACTIVE'
              ? 'Execution is unlocked and ready for milestone evidence, verification, and disbursement requests.'
              : 'Execution remains locked until Budget Officer and Treasurer approvals are complete.',
    },
  ];

  return {
    projectId: proj.id,
    name: proj.name,
    status: proj.status,
    metadataHash: proj.metadataHash || null,
    createdByWallet: proj.createdByWallet || null,
    budgetOfficerWallet: proj.budgetOfficerWallet || null,
    treasurerWallet: proj.treasurerWallet || null,
    treasurySealHash: proj.treasurySealHash || null,
    saroRef: proj.saro || null,
    latestDisbursementRef: proj.latestDisbursementRef || null,
    rejectionReason: proj.rejectionReason || null,
    stages,
  };
};

type PublicCommentPhoto = {
  id: string;
  url: string;
};

type PublicComment = {
  id: string;
  display_name: string;
  content: string;
  created_at: string;
  photos?: PublicCommentPhoto[];
};

export const ProjectDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { projects, chainBudgets } = useBlockchain();
  const [summary, setSummary] = useState<TransparencySummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [attemptedLoad, setAttemptedLoad] = useState(false);
  const [previewItems, setPreviewItems] = useState<MediaLightboxItem[]>([]);
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState<number | null>(null);
  const [comments, setComments] = useState<PublicComment[]>(() => {
    if (!id || typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(`sta-cruz-comments-${id}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentDisplayName, setCommentDisplayName] = useState('Anonymous');
  const [commentContent, setCommentContent] = useState('');
  const [commentPhotos, setCommentPhotos] = useState<File[]>([]);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [blockchainPrice, setBlockchainPrice] = useState<number | null>(() => {
    if (!id) return null;
    if (chainBudgets && typeof chainBudgets[id] === 'number') {
      return chainBudgets[id];
    }
    return getStoredChainBudget(id);
  });

  useEffect(() => {
    if (!id || !chainBudgets) return;
    const fromContext = chainBudgets[id];
    if (typeof fromContext === 'number') {
      setBlockchainPrice(fromContext);
    }
  }, [id, chainBudgets]);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const project = projects.find((item) => item.id === id) || (id ? getStoredProjectById(id) : null);
  const displayProject = (project || {
    id,
    name: summary?.name || 'Project',
    status: summary?.status || 'Unknown',
    description: '',
    location: '',
    category: '',
    budgetSource: '',
    stakeholders: [],
    locationPhotos: [],
    totalBudget: 0,
    allocatedFunds: 0,
    disbursedFunds: 0,
    milestones: [],
    documents: [],
    transactions: [],
    saro: '',
    startDate: '',
    endDate: '',
    metadataHash: '',
    treasurySealHash: '',
  }) as any;

  const projectTransactionHash = displayProject.transactions?.find((transaction: any) => transaction.hash)?.hash || displayProject.blockchainTxHash || null;
  const tamperingDetected = blockchainPrice !== null && isProjectTampered(displayProject.totalBudget, blockchainPrice);
  const activePreview = selectedPreviewIndex !== null ? previewItems[selectedPreviewIndex] : null;
  const effectiveSummary = summary || deriveTransparencySummaryFromProject(displayProject);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: Number.isInteger(amount || 0) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  const getPercent = (value: number, total: number) => {
    if (!total || total <= 0) return 0;
    return Math.min(100, Math.round((value / total) * 100));
  };

  const safeFormatDate = (dateString: string | undefined | null, formatStr: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? 'Invalid Date' : format(date, formatStr);
  };

  const getTransactionHash = (transaction: any) =>
    transaction.hash || transaction.blockchainTxHash || transaction.requestTxHash || transaction.digitalSealHash || '';

  const getTransactionExplorerUrl = (transaction: any) => {
    const hash = getTransactionHash(transaction);
    return hash ? `https://sepolia.etherscan.io/tx/${hash}` : '';
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

  const openPreview = (items: MediaLightboxItem[], index = 0) => {
    setPreviewItems(items);
    setSelectedPreviewIndex(index);
  };

  const closePreview = () => {
    setSelectedPreviewIndex(null);
    setPreviewItems([]);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Completed':
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100"><CheckCircle className="mr-1 h-3 w-3" />Completed</Badge>;
      case 'In Progress':
        return <Badge className="bg-[#eff6fb] text-[#315b7d] hover:bg-[#eff6fb]"><Activity className="mr-1 h-3 w-3" />Ongoing</Badge>;
      case 'ACTIVE':
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100"><CheckCircle className="mr-1 h-3 w-3" />Active</Badge>;
      case 'SARO Approved - Pending Treasurer':
        return <Badge className="bg-[#fff8e5] text-[#71591d] hover:bg-[#fff8e5]"><Clock className="mr-1 h-3 w-3" />Pending Treasurer</Badge>;
      case 'MPDC Approved':
        return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100"><Clock className="mr-1 h-3 w-3" />MPDC Approved</Badge>;
      case 'Rejected - Budget Officer':
        return <Badge variant="destructive">Rejected by Budget</Badge>;
      case 'Rejected - Treasurer':
        return <Badge variant="destructive">Rejected by Treasury</Badge>;
      case 'On Hold':
        return <Badge variant="destructive">On Hold</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStageBadge = (status: TransparencyStage['status']) => {
    switch (status) {
      case 'Completed':
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Completed</Badge>;
      case 'Ready':
      case 'In Progress':
        return <Badge className="bg-[#eff6fb] text-[#315b7d] hover:bg-[#eff6fb]">{status}</Badge>;
      case 'Pending':
        return <Badge className="bg-[#fff8e5] text-[#71591d] hover:bg-[#fff8e5]">Pending</Badge>;
      case 'Rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">Locked</Badge>;
    }
  };

  const getOfficerBadge = (role: string) => {
    const normalized = (role || '').toLowerCase();
    if (normalized.includes('mpdc') || normalized.includes('planning') || normalized.includes('mpdo')) {
      return (
        <Badge className="border border-[#c8d8e6] bg-[#eff6fb] text-[#315b7d] hover:bg-[#eff6fb]">
          MPDO (Planning)
        </Badge>
      );
    }
    if (normalized.includes('budget')) {
      return (
        <Badge className="border border-[#d8c38f] bg-[#fff8e5] text-[#71591d] hover:bg-[#fff8e5]">
          Budget Officer
        </Badge>
      );
    }
    if (normalized.includes('treasurer') || normalized.includes('treasury')) {
      return (
        <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50">
          Treasurer
        </Badge>
      );
    }
    return <Badge variant="secondary">{role || 'System'}</Badge>;
  };

  const pageMetrics = useMemo(() => {
    const verifiedMilestones = displayProject.milestones.filter((milestone: any) => milestone.status === 'Verified' || milestone.status === 'Paid').length;
    const allocationRate = getPercent(displayProject.allocatedFunds, displayProject.totalBudget);
    const disbursementRate = getPercent(displayProject.disbursedFunds, displayProject.allocatedFunds);
    const evidenceCount = displayProject.milestones.reduce((sum: number, milestone: any) => sum + (milestone.photos?.length || 0), 0);
    const delayedMilestones = displayProject.milestones.filter(isMilestoneDelayed).length;

    return {
      verifiedMilestones,
      allocationRate,
      disbursementRate,
      evidenceCount,
      delayedMilestones,
    };
  }, [displayProject]);

  useEffect(() => {
    if (summary || summaryError) {
      setAttemptedLoad(true);
    }
  }, [summary, summaryError]);

  useEffect(() => {
    let cancelled = false;

    const loadSummary = async () => {
      if (!id) return;

      try {
        setSummaryError(null);
        const response = await apiClient.getProjectTransparencySummary(id) as { summary: TransparencySummary };
        if (!cancelled) {
          setSummary(response.summary);
        }
      } catch (error: any) {
        if (!cancelled) {
          setSummaryError(error?.message || 'Failed to load transparency summary.');
        }
      }
    };

    loadSummary();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    const loadBlockchainPrice = async () => {
      if (!id) return;

      const provider = getReadOnlyWeb3Provider();
      if (!provider) return;

      try {
        const contract = await getContract(provider);
        const chainProject = await contract.projects(id);
        const exists = Boolean(chainProject.exists ?? chainProject[14]);
        if (!exists) {
          if (!cancelled) {
            setBlockchainPrice(null);
          }
          return;
        }

        const chainBudget = Number(chainProject.totalBudget ?? chainProject[2] ?? 0);
        updateStoredChainBudget(id, chainBudget);

        if (!cancelled) {
          setBlockchainPrice(chainBudget);
        }
      } catch (error) {
        console.warn('Unable to verify project integrity against Sepolia.', error);
      }
    };

    loadBlockchainPrice();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    const loadComments = async () => {
      if (!id) return;

      try {
        setCommentsLoading(true);
        setCommentsError(null);
        const response = await apiClient.getProjectComments(id) as { comments: PublicComment[] };
        if (!cancelled) {
          const freshComments = (response.comments || []).map((comment) => ({
            ...comment,
            display_name: censorProfanity(comment.display_name || 'Anonymous'),
            content: censorProfanity(comment.content || ''),
          }));
          setComments(freshComments);
          if (typeof window !== 'undefined') {
            try {
              window.localStorage.setItem(`sta-cruz-comments-${id}`, JSON.stringify(freshComments));
            } catch {}
          }
        }
      } catch (error: any) {
        if (!cancelled) {
          setCommentsError(error?.message || 'Failed to load public comments.');
        }
      } finally {
        if (!cancelled) {
          setCommentsLoading(false);
        }
      }
    };

    loadComments();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleCommentPhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).slice(0, 4);
    setCommentPhotos(files);
  };

  const handleSubmitComment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!id || !commentContent.trim()) return;

    try {
      setIsSubmittingComment(true);
      setCommentsError(null);

      const formData = new FormData();
      formData.append('displayName', censorProfanity(commentDisplayName.trim() || 'Anonymous'));
      formData.append('content', censorProfanity(commentContent.trim()));
      commentPhotos.forEach((photo) => formData.append('photos', photo));

      const response = await apiClient.createProjectComment(id, formData) as { comment: PublicComment };
      setComments((prev) => [{
        ...response.comment,
        display_name: censorProfanity(response.comment.display_name || 'Anonymous'),
        content: censorProfanity(response.comment.content || ''),
      }, ...prev]);
      setCommentContent('');
      setCommentPhotos([]);
      setCommentDisplayName('Anonymous');
    } catch (error: any) {
      setCommentsError(error?.message || 'Failed to post comment.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  if (attemptedLoad && !project && !summary) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <h2 className="text-2xl font-black text-slate-900">Project Not Found</h2>
        <p className="mt-2 text-slate-500">{summaryError || 'The project you are looking for does not exist or has been removed.'}</p>
        <Link to="/projects" className="mt-5 inline-flex items-center font-semibold text-[#315b7d] hover:text-[#264966]">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Projects
        </Link>
      </div>
    );
  }

  const projectDelayed = isProjectDelayed(displayProject);
  const detailStats = [
    { label: 'SARO allocation', value: `${pageMetrics.allocationRate}%`, detail: formatCurrency(displayProject.allocatedFunds), icon: Landmark },
    { label: 'NCA disbursement', value: `${pageMetrics.disbursementRate}%`, detail: formatCurrency(displayProject.disbursedFunds), icon: Banknote },
    { label: 'Verified milestones', value: `${pageMetrics.verifiedMilestones}/${displayProject.milestones.length}`, detail: `${pageMetrics.evidenceCount} proof photo${pageMetrics.evidenceCount === 1 ? '' : 's'}`, icon: FileCheck2 },
    {
      label: 'Schedule health',
      value: projectDelayed ? 'Delayed' : 'On track',
      detail: pageMetrics.delayedMilestones > 0
        ? `${pageMetrics.delayedMilestones} overdue milestone${pageMetrics.delayedMilestones === 1 ? '' : 's'}`
        : displayProject.endDate
          ? `Target ${safeFormatDate(displayProject.endDate, 'MMM dd, yyyy')}`
          : 'No overdue dates',
      icon: AlertTriangle,
    },
    { label: 'Blockchain check', value: tamperingDetected ? 'Flagged' : 'Ready', detail: blockchainPrice === null ? 'Awaiting chain read' : 'Budget matched', icon: ShieldCheck },
  ];

  return (
    <div className="bg-[#fafaf9]">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <Link to="/projects" className="inline-flex items-center text-xs font-semibold text-sky-700 transition-colors hover:text-sky-900">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Projects Registry
          </Link>

          <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_0.36fr] lg:items-end">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {projectDelayed && (
                  <Badge variant="destructive" className="text-[10px]">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    Delayed
                  </Badge>
                )}
                {tamperingDetected && (
                  <TamperingDetectedBadge visible={true} />
                )}
                {getStatusBadge(displayProject.status)}
                <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-600">ID: {displayProject.id}</span>
                {displayProject.category && <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">{displayProject.category}</span>}
              </div>
              <h1 className="max-w-4xl text-3xl font-extrabold leading-tight text-slate-900 sm:text-4xl">{displayProject.name}</h1>
              {displayProject.description && (
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">{displayProject.description}</p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500">
                <span className="inline-flex items-center">
                  <MapPin className="mr-1 h-3.5 w-3.5 text-slate-400" />
                  {displayProject.location || 'Location pending'}
                </span>
                <span className="inline-flex items-center">
                  <Calendar className="mr-1 h-3.5 w-3.5 text-slate-400" />
                  Created {safeFormatDate(displayProject.createdAt, 'MMM dd, yyyy')}
                </span>
                {displayProject.endDate && (
                  <span className={projectDelayed ? 'inline-flex items-center font-bold text-red-700' : 'inline-flex items-center'}>
                    <Clock className="mr-1 h-3.5 w-3.5" />
                    Target end {safeFormatDate(displayProject.endDate, 'MMM dd, yyyy')}
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Project Budget</p>
              <p className="mt-1 text-3xl font-extrabold text-slate-900">{formatCurrency(displayProject.totalBudget)}</p>
              <p className="mt-1 text-xs text-slate-500">{displayProject.budgetSource || 'Municipal Budget Allocation'}</p>
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {detailStats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className={`rounded-xl border bg-white p-4 shadow-sm ${stat.value === 'Delayed' ? 'border-red-200 bg-red-50/50' : 'border-slate-200'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{stat.label}</p>
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${stat.value === 'Delayed' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-3 text-xl font-extrabold text-slate-900">{stat.value}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{stat.detail}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {tamperingDetected && (
          <div className="mb-8">
            <DatabaseBreachAlert
              databasePrice={displayProject.totalBudget}
              blockchainPrice={blockchainPrice}
              transactionHash={projectTransactionHash}
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <Card className="rounded-lg border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl font-black text-[#17212b]">Fund Movement</CardTitle>
                <CardDescription>SARO allocation and NCA disbursement recorded for public verification.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-[#fbfaf6] p-4">
                    <p className="text-sm font-semibold text-slate-500">Total Budget</p>
                    <p className="mt-2 text-xl font-black text-slate-950">{formatCurrency(displayProject.totalBudget)}</p>
                  </div>
                  <div className="rounded-lg border border-[#c8d8e6] bg-[#eff6fb] p-4">
                    <p className="text-sm font-semibold text-[#315b7d]">Allocated (SARO)</p>
                    <p className="mt-2 text-xl font-black text-[#315b7d]">{formatCurrency(displayProject.allocatedFunds)}</p>
                    <div className="mt-3 h-2 rounded-full bg-white">
                      <div className="h-2 rounded-full bg-[#315b7d]" style={{ width: `${pageMetrics.allocationRate}%` }} />
                    </div>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm font-semibold text-emerald-700">Disbursed (NCA)</p>
                    <p className="mt-2 text-xl font-black text-emerald-800">{formatCurrency(displayProject.disbursedFunds)}</p>
                    <div className="mt-3 h-2 rounded-full bg-white">
                      <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${pageMetrics.disbursementRate}%` }} />
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="flex items-center text-lg font-black text-[#17212b]">
                      <ShieldCheck className="mr-2 h-5 w-5 text-[#315b7d]" />
                      Immutable Receipts & Officer Ledger
                    </h3>
                    <Link
                      to={`/transactions?search=${encodeURIComponent(displayProject.name || displayProject.id)}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#c8d8e6] bg-[#eff6fb] px-3 py-1.5 text-xs font-bold text-[#315b7d] transition-colors hover:bg-white"
                    >
                      <Receipt className="h-3.5 w-3.5" />
                      View in Transaction Receipts &rarr;
                    </Link>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-[#fbfaf6]">
                          <TableHead className="font-bold">Date & Time</TableHead>
                          <TableHead className="font-bold">Type</TableHead>
                          <TableHead className="font-bold">Amount</TableHead>
                          <TableHead className="font-bold">Officer In-Charge</TableHead>
                          <TableHead className="font-bold">Tx Hash & Verification</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayProject.transactions.length > 0 ? (
                          displayProject.transactions.map((tx: any) => {
                            const txHash = getTransactionHash(tx);
                            const explorerUrl = getTransactionExplorerUrl(tx);
                            const isCopied = copiedHash === txHash;

                            return (
                              <TableRow key={tx.id} className="hover:bg-slate-50/70">
                                <TableCell className="whitespace-nowrap text-xs font-semibold text-slate-600">
                                  {safeFormatDate(tx.date, 'MMM dd, yyyy HH:mm')}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    className={
                                      tx.type.includes('NCA')
                                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 font-bold'
                                        : 'bg-[#eff6fb] text-[#315b7d] hover:bg-[#eff6fb] font-bold'
                                    }
                                  >
                                    {tx.type}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-black text-slate-900">
                                  {formatCurrency(tx.amount)}
                                </TableCell>
                                <TableCell>
                                  {getOfficerBadge(tx.recordedByRole)}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600 border border-slate-200"
                                      title={txHash || 'Pending'}
                                    >
                                      {txHash ? `${txHash.substring(0, 10)}...${txHash.substring(txHash.length - 6)}` : 'Pending'}
                                    </span>
                                    {txHash && (
                                      <button
                                        type="button"
                                        onClick={() => handleCopyHash(txHash)}
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition-colors"
                                        title="Copy Transaction Hash"
                                      >
                                        {isCopied ? (
                                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                                        ) : (
                                          <Copy className="h-3.5 w-3.5" />
                                        )}
                                      </button>
                                    )}
                                    {explorerUrl ? (
                                      <a
                                        href={explorerUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center rounded-md border border-[#c8d8e6] bg-[#eff6fb] px-2.5 py-1 text-xs font-bold text-[#315b7d] transition-colors hover:bg-white"
                                      >
                                        <ExternalLink className="mr-1 h-3 w-3" />
                                        Verify
                                      </a>
                                    ) : (
                                      <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-400">
                                        Pending
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell colSpan={5} className="py-8 text-center text-sm text-slate-500">
                              No financial transactions recorded yet.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>

            {displayProject.locationPhotos && displayProject.locationPhotos.length > 0 && (
              <Card className="rounded-lg border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-2xl font-black text-[#17212b]">Location Photos</CardTitle>
                  <CardDescription>Site images attached to the public project record.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {displayProject.locationPhotos.map((photoUrl: string, index: number) => (
                      <button
                        key={photoUrl}
                        type="button"
                        className="group overflow-hidden rounded-lg border border-slate-200 bg-slate-100 text-left shadow-sm"
                        onClick={() => openPreview(
                          (displayProject.locationPhotos || []).map((url: string, itemIndex: number) => ({
                            type: 'image',
                            url: resolveAssetUrl(url),
                            title: `Location photo ${itemIndex + 1}`,
                          })),
                          index
                        )}
                      >
                        <img src={resolveAssetUrl(photoUrl)} alt={`Location photo ${index + 1}`} className="h-64 w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]" />
                        <div className="p-3 text-sm font-semibold text-slate-700">Location photo {index + 1}</div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="rounded-lg border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl font-black text-[#17212b]">Project Milestones</CardTitle>
                <CardDescription>Progress checkpoints, reports, and verification photos.</CardDescription>
              </CardHeader>
              <CardContent>
                {displayProject.milestones.length > 0 ? (
                  <div className="space-y-5">
                    {displayProject.milestones.map((milestone: any, index: number) => {
                      const milestoneReports = displayProject.documents?.filter((doc: any) => doc.milestoneId === milestone.id) || [];
                      const milestonePhotos = milestone.photos || [];
                      const milestoneDelayed = isMilestoneDelayed(milestone);

                      return (
                        <div key={milestone.id} className="rounded-lg border border-slate-200 bg-white p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-xs font-black uppercase tracking-wider text-[#b9973e]">Milestone {index + 1}</div>
                              <h4 className="mt-1 text-lg font-black text-[#17212b]">{milestone.title}</h4>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {milestoneDelayed && (
                                <Badge variant="destructive">
                                  <AlertTriangle className="mr-1 h-3 w-3" />
                                  Delayed
                                </Badge>
                              )}
                              <Badge className={milestone.status === 'Verified' || milestone.status === 'Paid' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' : 'bg-[#fff8e5] text-[#71591d] hover:bg-[#fff8e5]'}>
                                {milestone.status} | {milestone.percentage}%
                              </Badge>
                            </div>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-slate-600">{milestone.description}</p>
                          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500">
                            <span className={milestoneDelayed ? 'inline-flex items-center font-bold text-red-700' : 'inline-flex items-center'}>
                              <Calendar className="mr-1 h-3 w-3" />
                              {milestone.dueDate ? `Target ${safeFormatDate(milestone.dueDate, 'MMM dd, yyyy')}` : 'Target date pending'}
                            </span>
                            <span>{milestone.dateVerified ? `Verified ${safeFormatDate(milestone.dateVerified, 'MMM dd, yyyy')}` : 'Pending verification'}</span>
                          </div>

                          {(milestonePhotos.length > 0 || milestoneReports.length > 0) && (
                            <div className="mt-5 grid gap-4 lg:grid-cols-2">
                              {milestonePhotos.length > 0 && (
                                <div>
                                  <div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Verification Photos</div>
                                  <div className="grid grid-cols-2 gap-3">
                                    {milestonePhotos.map((photo: any, photoIndex: number) => (
                                      <button
                                        key={photo.id}
                                        type="button"
                                        onClick={() => openPreview(
                                          milestonePhotos.map((item: any, itemIndex: number) => ({
                                            type: 'image',
                                            url: resolveAssetUrl(item.url),
                                            title: item.description || `${milestone.title} photo ${itemIndex + 1}`,
                                          })),
                                          photoIndex
                                        )}
                                        className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-left"
                                      >
                                        <img src={resolveAssetUrl(photo.url)} alt={photo.description || milestone.title} className="h-28 w-full object-cover" />
                                        <div className="p-2 text-xs text-slate-600">
                                          <div className="font-bold capitalize text-slate-700">{photo.type}</div>
                                          {photo.description && <div className="mt-1 line-clamp-2">{photo.description}</div>}
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {milestoneReports.length > 0 && (
                                <div>
                                  <div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Attached Reports</div>
                                  <div className="space-y-2">
                                    {milestoneReports.map((doc: any) => (
                                      <button
                                        key={doc.id}
                                        type="button"
                                        onClick={() => openPreview([{ type: 'document', url: resolveAssetUrl(doc.url), title: doc.title }])}
                                        className="flex w-full items-start rounded-lg border border-slate-200 bg-[#fbfaf6] p-3 text-left transition-colors hover:bg-white"
                                      >
                                        <FileText className="mr-3 mt-0.5 h-4 w-4 text-[#315b7d]" />
                                        <div>
                                          <div className="text-sm font-bold text-[#315b7d]">{doc.title}</div>
                                          <div className="mt-1 text-xs text-slate-500">{safeFormatDate(doc.dateUploaded, 'MMM dd, yyyy')}</div>
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-slate-300 bg-[#fbfaf6] py-8 text-center text-sm text-slate-500">No milestones recorded yet.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-8">
            <Card className="rounded-lg border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-black text-[#17212b]">Project Details</CardTitle>
                <CardDescription>Category and funding information.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {displayProject.category && (
                  <div className="rounded-lg border border-slate-200 bg-[#fbfaf6] p-3">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Category</p>
                    <p className="mt-2 font-bold text-slate-900">{displayProject.category}</p>
                  </div>
                )}
                {displayProject.budgetSource && (
                  <div className="rounded-lg border border-[#d8c38f] bg-[#fff8e5] p-3">
                    <p className="text-xs font-black uppercase tracking-wide text-[#71591d]">Budget Source</p>
                    <p className="mt-2 font-bold text-[#71591d]">{displayProject.budgetSource}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-lg border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-black text-[#17212b]">Gate Audit Trail</CardTitle>
                <CardDescription>Public view of creation, SARO approval, Treasury activation, and execution readiness.</CardDescription>
              </CardHeader>
              <CardContent>
                {effectiveSummary ? (
                  <div className="space-y-4">
                    {effectiveSummary.stages.map((stage, index) => (
                      <div key={`${stage.phase}-${stage.title}`} className="relative rounded-lg border border-slate-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs font-black uppercase tracking-wide text-[#b9973e]">Step {index + 1} | {stage.phase}</div>
                            <div className="mt-1 font-black text-slate-900">{stage.title}</div>
                          </div>
                          {getStageBadge(stage.status)}
                        </div>
                        <div className="mt-3 space-y-1 text-sm text-slate-600">
                          <div><span className="font-bold text-slate-700">Status:</span> {stage.statusLabel}</div>
                          <div><span className="font-bold text-slate-700">Actor:</span> {stage.actorRole}</div>
                          {stage.actorWallet && <div><span className="font-bold text-slate-700">Wallet:</span> <span className="font-mono text-xs break-all">{stage.actorWallet}</span></div>}
                          {stage.reference && <div><span className="font-bold text-slate-700">Reference:</span> <span className="font-mono text-xs break-all">{stage.reference}</span></div>}
                          {typeof stage.amount === 'number' && stage.amount > 0 && <div><span className="font-bold text-slate-700">Amount:</span> {formatCurrency(stage.amount)}</div>}
                          {stage.timestamp && <div><span className="font-bold text-slate-700">Recorded:</span> {safeFormatDate(stage.timestamp, 'MMM dd, yyyy HH:mm')}</div>}
                          {stage.notes && <div className="pt-1 text-slate-500">{stage.notes}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : summaryError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{summaryError}</div>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-[#fbfaf6] p-4 text-sm text-slate-500">Loading transparency summary...</div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-lg border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-black text-[#17212b]">Blockchain Anchors</CardTitle>
                <CardDescription>Key immutable references tied to this project.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-lg border border-slate-200 bg-[#fbfaf6] p-3">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <FileSignature className="h-4 w-4 text-[#315b7d]" />
                    Metadata Hash
                  </div>
                  <div className="mt-2 break-all font-mono text-xs text-slate-600">{summary?.metadataHash || displayProject.metadataHash || 'Pending sync'}</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-[#fbfaf6] p-3">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <Landmark className="h-4 w-4 text-[#315b7d]" />
                    SARO Reference
                  </div>
                  <div className="mt-2 font-mono text-xs text-slate-600">{summary?.saroRef || displayProject.saro || 'Not issued yet'}</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-[#fbfaf6] p-3">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <ShieldCheck className="h-4 w-4 text-[#315b7d]" />
                    Treasury Seal
                  </div>
                  <div className="mt-2 break-all font-mono text-xs text-slate-600">{summary?.treasurySealHash || displayProject.treasurySealHash || 'Not issued yet'}</div>
                </div>
              </CardContent>
            </Card>

            {displayProject.stakeholders && displayProject.stakeholders.length > 0 && (
              <Card className="rounded-lg border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl font-black text-[#17212b]">Stakeholders</CardTitle>
                  <CardDescription>Key parties involved in this project.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {displayProject.stakeholders.map((stakeholder: string, index: number) => (
                      <div key={index} className="flex items-center rounded-lg border border-slate-200 bg-[#fbfaf6] p-3">
                        <div className="mr-3 h-2 w-2 rounded-full bg-[#315b7d]" />
                        <span className="text-sm font-medium text-slate-700">{stakeholder}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <Card className="mt-8 rounded-lg border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-black text-[#17212b]">Public Comments</CardTitle>
            <CardDescription>Anyone visiting this page can read the discussion and post a public comment without signing in.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmitComment} className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d8c38f] bg-[#fff8e5] shadow-sm">
                  <User className="h-5 w-5 text-[#71591d]" />
                </div>
                <div className="flex-1 rounded-lg bg-[#fbfaf6] px-4 py-3 ring-1 ring-slate-200">
                  <textarea
                    value={commentContent}
                    onChange={(event) => setCommentContent(event.target.value)}
                    maxLength={2000}
                    required
                    placeholder="Write a public comment..."
                    className="min-h-[80px] w-full resize-none border-0 bg-transparent px-0 py-0 text-base text-slate-700 outline-none placeholder:text-slate-500 focus:ring-0"
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
                    <div className="flex items-center gap-2 text-slate-500">
                      <label className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition hover:bg-white hover:text-slate-700" title="Add photo">
                        <ImagePlus className="h-4 w-4" />
                        <input type="file" accept="image/*" multiple onChange={handleCommentPhotoChange} className="hidden" />
                      </label>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-white hover:text-slate-700" title="Reaction style">
                        <SmilePlus className="h-4 w-4" />
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-white hover:text-slate-700" title="Sticker style">
                        <Sticker className="h-4 w-4" />
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-white hover:text-slate-700" title="Visibility">
                        <CircleDot className="h-4 w-4" />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmittingComment || !commentContent.trim()}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#315b7d] text-white transition hover:bg-[#264966] disabled:cursor-not-allowed disabled:opacity-60"
                      title="Post comment"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 pl-14 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">Public Name</label>
                  <Input
                    value={commentDisplayName}
                    onChange={(event) => setCommentDisplayName(event.target.value)}
                    maxLength={60}
                    placeholder="Anonymous"
                    className="max-w-xs rounded-lg border-slate-200 bg-white"
                  />
                </div>
                <div className="text-xs text-slate-400">{commentContent.length}/2000</div>
              </div>

              {commentPhotos.length > 0 && (
                <div className="grid grid-cols-2 gap-2 pl-14 sm:grid-cols-4">
                  {commentPhotos.map((photo, index) => (
                    <div key={`${photo.name}-${index}`} className="rounded-lg border border-slate-200 bg-[#fbfaf6] px-3 py-2 text-xs text-slate-600">
                      <div className="truncate font-bold text-slate-700">{photo.name}</div>
                      <div>{Math.round(photo.size / 1024)} KB</div>
                    </div>
                  ))}
                </div>
              )}

              {commentsError && <div className="ml-14 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{commentsError}</div>}
              <p className="pl-14 text-xs text-slate-500">Everyone can see other citizens&apos; comments on this page. Leave the name as Anonymous or customize it.</p>
            </form>

            <div className="space-y-4">
              {commentsLoading ? (
                <div className="rounded-lg border border-slate-200 bg-[#fbfaf6] p-4 text-sm text-slate-500">Loading public comments...</div>
              ) : comments.length > 0 ? (
                comments.map((comment) => (
                  <div key={comment.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-bold text-slate-900">{censorProfanity(comment.display_name || 'Anonymous')}</div>
                        <div className="text-xs text-slate-500">{safeFormatDate(comment.created_at, 'MMM dd, yyyy HH:mm')}</div>
                      </div>
                      <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">Citizen Post</Badge>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{censorProfanity(comment.content)}</p>
                    {comment.photos && comment.photos.length > 0 && (
                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {comment.photos.map((photo, photoIndex) => (
                          <button
                            key={photo.id}
                            type="button"
                            onClick={() => openPreview(
                              (comment.photos || []).map((item, itemIndex) => ({
                                type: 'image',
                                url: resolveAssetUrl(item.url),
                                title: `Citizen comment attachment ${itemIndex + 1}`,
                              })),
                              photoIndex
                            )}
                            className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                          >
                            <img src={resolveAssetUrl(photo.url)} alt="Citizen comment attachment" className="h-48 w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 bg-[#fbfaf6] p-6 text-center">
                  <MessageSquare className="mx-auto h-6 w-6 text-slate-400" />
                  <p className="mt-3 text-sm font-bold text-slate-700">No comments yet</p>
                  <p className="mt-1 text-sm text-slate-500">Be the first citizen to share an update about this project.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      {activePreview && selectedPreviewIndex !== null && (
        <MediaLightbox
          items={previewItems}
          index={selectedPreviewIndex}
          onClose={closePreview}
          onIndexChange={setSelectedPreviewIndex}
        />
      )}
    </div>
  );
};
