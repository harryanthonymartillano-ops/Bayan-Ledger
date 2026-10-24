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
  ThumbsUp,
  Lightbulb,
  Search,
  Filter,
  Flag,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  SlidersHorizontal,
} from 'lucide-react';
import { format } from 'date-fns';
import { flashToast } from '../../components/ui/flash-toast';
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
import { ProjectImageThumbnail } from '../../components/ProjectImageThumbnail';

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
  totalBudget?: number;
  allocatedFunds?: number;
  disbursedFunds?: number;
  createdAt?: string | null;
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
      amount: allocationTransaction ? Number(allocationTransaction.amount || 0) : Number(proj.allocatedFunds ?? proj.allocated_funds ?? 0),
      notes:
        proj.status === 'Rejected - Budget Officer'
          ? proj.rejectionReason || proj.rejection_reason || 'Budget Officer rejected this project.'
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
      amount: allocationTransaction ? Number(allocationTransaction.amount || 0) : Number(proj.allocatedFunds ?? proj.allocated_funds ?? 0),
      notes:
        proj.status === 'Rejected - Treasurer'
          ? proj.rejectionReason || proj.rejection_reason || 'Treasurer rejected this project.'
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
      amount: Number(proj.disbursedFunds ?? proj.disbursed_funds ?? 0),
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
    metadataHash: proj.metadataHash || proj.metadata_hash || null,
    createdByWallet: proj.createdByWallet || proj.blockchain_created_by_wallet || null,
    budgetOfficerWallet: proj.budgetOfficerWallet || proj.budget_officer_wallet || null,
    treasurerWallet: proj.treasurerWallet || proj.treasurer_wallet || null,
    treasurySealHash: proj.treasurySealHash || proj.treasury_seal_hash || null,
    saroRef: proj.saro || proj.saro_ref || proj.latest_saro_ref || null,
    latestDisbursementRef: proj.latestDisbursementRef || proj.latest_disbursement_ref || null,
    rejectionReason: proj.rejectionReason || proj.rejection_reason || null,
    stages,
    totalBudget: Number(proj.totalBudget ?? proj.total_budget ?? 0),
    allocatedFunds: Number(proj.allocatedFunds ?? proj.allocated_funds ?? 0),
    disbursedFunds: Number(proj.disbursedFunds ?? proj.disbursed_funds ?? 0),
    createdAt: proj.createdAt || proj.created_at || null,
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

const normalizeProjectDetails = (raw: any): any => {
  if (!raw) return null;

  const rawMilestones = Array.isArray(raw.milestones) ? raw.milestones : [];
  const rawTransactions = Array.isArray(raw.transactions) ? raw.transactions : [];
  const rawDocuments = Array.isArray(raw.documents) ? raw.documents : [];

  const transactions = rawTransactions.map((tx: any) => ({
    ...tx,
    id: tx.id,
    type: tx.type || 'Disbursement (NCA)',
    amount: Number(tx.amount || 0),
    status: tx.status || 'Completed',
    date: tx.date || tx.created_at || tx.createdAt,
    recordedBy: tx.recorded_by || tx.recordedBy || 'System',
    recordedByRole: tx.recorded_by_role || tx.recordedByRole || 'Treasurer',
    recorded_by_role: tx.recorded_by_role || tx.recordedByRole || 'Treasurer',
    hash: tx.hash || tx.blockchain_tx_hash || tx.blockchainTxHash || tx.request_tx_hash || tx.requestTxHash || tx.digital_seal_hash || tx.digitalSealHash || '',
    blockchainTxHash: tx.blockchain_tx_hash || tx.blockchainTxHash || tx.hash || '',
    saro: tx.saro || '',
  }));

  let totalBudget = Number(raw.total_budget ?? raw.totalBudget ?? 0);
  let allocatedFunds = Number(raw.allocated_funds ?? raw.allocatedFunds ?? 0);
  let disbursedFunds = Number(raw.disbursed_funds ?? raw.disbursedFunds ?? 0);

  // If allocatedFunds is 0 but we have SARO transactions, recover amount
  if (allocatedFunds === 0 && transactions.length > 0) {
    const saroTx = transactions.find((t: any) => {
      const type = String(t.type || '').toLowerCase();
      return type.includes('allocation') || type.includes('saro');
    });
    if (saroTx && Number(saroTx.amount) > 0) {
      allocatedFunds = Number(saroTx.amount);
    }
  }

  // If disbursedFunds is 0 but we have executed NCA transactions, recover amount
  if (disbursedFunds === 0 && transactions.length > 0) {
    const ncaSum = transactions
      .filter((t: any) => {
        const type = String(t.type || '').toLowerCase();
        const status = String(t.status || '').toLowerCase();
        return (type.includes('disbursement') || type.includes('nca')) && (status === 'executed' || status === 'completed');
      })
      .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
    if (ncaSum > 0) {
      disbursedFunds = ncaSum;
    }
  }

  // If totalBudget is 0 but allocatedFunds > 0, fallback to allocatedFunds
  if (totalBudget === 0 && allocatedFunds > 0) {
    totalBudget = allocatedFunds;
  }

  const milestones = rawMilestones.map((m: any) => {
    const rawPhotos = Array.isArray(m.photos) ? m.photos : [];
    const photos = rawPhotos.map((p: any) => ({
      ...p,
      id: p.id,
      url: p.url,
      type: p.photo_type || p.type || 'proof',
      photo_type: p.photo_type || p.type || 'proof',
      description: p.description || '',
      photoHash: p.photo_hash || p.photoHash || '',
    }));

    const rawReports = [
      ...(Array.isArray(m.reports) ? m.reports : []),
      ...(Array.isArray(m.documents) ? m.documents : []),
    ];

    const reports = rawReports.map((d: any) => ({
      ...d,
      id: d.id,
      title: d.title || d.name || 'Milestone Report',
      url: d.url,
      fileFormat: d.file_format || d.fileFormat || (d.url?.toLowerCase().endsWith('.pdf') ? 'PDF' : undefined),
      size: Number(d.size || 0),
      dateUploaded: d.date_uploaded || d.dateUploaded || d.created_at,
    }));

    return {
      ...m,
      id: m.id,
      title: m.title || '',
      description: m.description || '',
      percentage: Number(m.percentage || 0),
      status: m.status || 'Pending',
      budget: Number(m.budget || 0),
      deliverables: Array.isArray(m.deliverables) ? m.deliverables : [],
      dueDate: m.due_date || m.dueDate || undefined,
      due_date: m.due_date || m.dueDate || undefined,
      dateVerified: m.date_verified || m.dateVerified || undefined,
      date_verified: m.date_verified || m.dateVerified || undefined,
      verifiedBy: m.verified_by || m.verifiedBy || undefined,
      verified_by: m.verified_by || m.verifiedBy || undefined,
      photoUrl: m.photo_url || m.photoUrl || (photos[0]?.url || undefined),
      photo_url: m.photo_url || m.photoUrl || (photos[0]?.url || undefined),
      photos,
      reports,
      documents: reports,
    };
  });

  const locationPhotos = Array.isArray(raw.location_photos)
    ? raw.location_photos
    : Array.isArray(raw.locationPhotos)
      ? raw.locationPhotos
      : [];

  const documents = rawDocuments.map((d: any) => ({
    ...d,
    id: d.id,
    title: d.title || d.name || 'Project Document',
    url: d.url,
    fileFormat: d.file_format || d.fileFormat || (d.url?.toLowerCase().endsWith('.pdf') ? 'PDF' : undefined),
    size: Number(d.size || 0),
    dateUploaded: d.date_uploaded || d.dateUploaded || d.created_at,
  }));

  const stakeholders = Array.isArray(raw.stakeholders) ? raw.stakeholders : [];

  return {
    ...raw,
    id: String(raw.id || ''),
    name: raw.name || 'Unnamed Project',
    description: raw.description || '',
    location: raw.location || '',
    category: raw.category || '',
    budgetSource: raw.budget_source || raw.budgetSource || undefined,
    budget_source: raw.budget_source || raw.budgetSource || undefined,
    startDate: raw.start_date || raw.startDate || undefined,
    start_date: raw.start_date || raw.startDate || undefined,
    endDate: raw.end_date || raw.endDate || undefined,
    end_date: raw.end_date || raw.endDate || undefined,
    createdAt: raw.created_at || raw.createdAt || undefined,
    created_at: raw.created_at || raw.createdAt || undefined,
    totalBudget,
    total_budget: totalBudget,
    allocatedFunds,
    allocated_funds: allocatedFunds,
    disbursedFunds,
    disbursed_funds: disbursedFunds,
    status: raw.status || 'In Progress',
    saro: raw.saro || raw.latest_saro_ref || raw.latestSaroRef || undefined,
    metadataHash: raw.metadata_hash || raw.metadataHash || undefined,
    metadata_hash: raw.metadata_hash || raw.metadataHash || undefined,
    treasurySealHash: raw.treasury_seal_hash || raw.treasurySealHash || undefined,
    treasury_seal_hash: raw.treasury_seal_hash || raw.treasurySealHash || undefined,
    blockchainTxHash: raw.blockchain_tx_hash || raw.blockchainTxHash || undefined,
    blockchain_tx_hash: raw.blockchain_tx_hash || raw.blockchainTxHash || undefined,
    latestDisbursementRef: raw.latest_disbursement_ref || raw.latestDisbursementRef || undefined,
    latest_disbursement_ref: raw.latest_disbursement_ref || raw.latestDisbursementRef || undefined,
    createdByWallet: raw.blockchain_created_by_wallet || raw.createdByWallet || undefined,
    blockchain_created_by_wallet: raw.blockchain_created_by_wallet || raw.createdByWallet || undefined,
    budgetOfficerWallet: raw.budget_officer_wallet || raw.budgetOfficerWallet || undefined,
    budget_officer_wallet: raw.budget_officer_wallet || raw.budgetOfficerWallet || undefined,
    budgetOfficerSignedAt: raw.budget_officer_signed_at || raw.budgetOfficerSignedAt || undefined,
    budget_officer_signed_at: raw.budget_officer_signed_at || raw.budgetOfficerSignedAt || undefined,
    treasurerWallet: raw.treasurer_wallet || raw.treasurerWallet || undefined,
    treasurer_wallet: raw.treasurer_wallet || raw.treasurerWallet || undefined,
    treasurerSignedAt: raw.treasurer_signed_at || raw.treasurerSignedAt || undefined,
    treasurer_signed_at: raw.treasurer_signed_at || raw.treasurerSignedAt || undefined,
    activatedAt: raw.activated_at || raw.activatedAt || undefined,
    activated_at: raw.activated_at || raw.activatedAt || undefined,
    rejectionReason: raw.rejection_reason || raw.rejectionReason || undefined,
    rejection_reason: raw.rejection_reason || raw.rejectionReason || undefined,
    locationPhotos,
    location_photos: locationPhotos,
    stakeholders,
    milestones,
    transactions,
    documents,
  };
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
  const [commentTopic, setCommentTopic] = useState('General Feedback');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [commentSearch, setCommentSearch] = useState('');
  const [commentFilter, setCommentFilter] = useState('all');
  const [commentSort, setCommentSort] = useState<'newest' | 'helpful' | 'oldest'>('newest');
  const [visibleCommentsCount, setVisibleCommentsCount] = useState(6);
  const [userReactions, setUserReactions] = useState<Record<string, { helpful?: boolean; insightful?: boolean }>>(() => {
    if (!id || typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(`sta-cruz-reactions-${id}`);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [reportedComments, setReportedComments] = useState<string[]>(() => {
    if (!id || typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(`sta-cruz-reported-comments-${id}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

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

  const [fetchedProject, setFetchedProject] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;

    const loadProject = async () => {
      if (!id) return;
      try {
        const response = (await apiClient.getProject(id)) as { project?: any };
        if (!cancelled && response?.project) {
          setFetchedProject(normalizeProjectDetails(response.project));
        }
      } catch (err) {
        console.warn('Could not load project directly by id:', err);
      }
    };

    loadProject();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const baseProject = useMemo(() => {
    const fromContext = projects.find((item) => item.id === id);
    if (fromContext) return normalizeProjectDetails(fromContext);
    if (id) {
      const stored = getStoredProjectById(id);
      if (stored) return normalizeProjectDetails(stored);
    }
    return null;
  }, [projects, id]);

  const rawProject = fetchedProject || baseProject;
  const displayProject = useMemo(() => {
    const normalized = normalizeProjectDetails(rawProject);
    if (normalized) {
      if (normalized.totalBudget === 0 && summary?.totalBudget) {
        normalized.totalBudget = summary.totalBudget;
        normalized.total_budget = summary.totalBudget;
      }
      if (normalized.allocatedFunds === 0 && summary?.allocatedFunds) {
        normalized.allocatedFunds = summary.allocatedFunds;
        normalized.allocated_funds = summary.allocatedFunds;
      }
      if (normalized.disbursedFunds === 0 && summary?.disbursedFunds) {
        normalized.disbursedFunds = summary.disbursedFunds;
        normalized.disbursed_funds = summary.disbursedFunds;
      }
      if (!normalized.createdAt && summary?.createdAt) {
        normalized.createdAt = summary.createdAt;
        normalized.created_at = summary.createdAt;
      }
      return normalized;
    }

    return {
      id: id || '',
      name: summary?.name || 'Project',
      status: summary?.status || 'Unknown',
      description: '',
      location: '',
      category: '',
      budgetSource: '',
      stakeholders: [],
      locationPhotos: [],
      totalBudget: summary?.totalBudget || 0,
      allocatedFunds: summary?.allocatedFunds || 0,
      disbursedFunds: summary?.disbursedFunds || 0,
      milestones: [],
      documents: [],
      transactions: [],
      saro: summary?.saroRef || '',
      startDate: '',
      endDate: '',
      createdAt: summary?.createdAt || '',
      metadataHash: summary?.metadataHash || '',
      treasurySealHash: summary?.treasurySealHash || '',
    };
  }, [rawProject, summary, id]);

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
      const isCloudFrontend = Boolean(browserHost) && (
        browserHost.endsWith('.vercel.app') ||
        browserHost.includes('vercel') ||
        browserHost.endsWith('.pages.dev') ||
        browserHost.endsWith('.netlify.app')
      );
      const shouldUseBrowserHost = Boolean(browserHost) && !['localhost', '127.0.0.1'].includes(browserHost) && !isCloudFrontend;

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

  const MIN_COMMENT_WORDS = 3;
  const MAX_COMMENT_WORDS = 250;
  const MIN_COMMENT_CHARS = 10;
  const MAX_COMMENT_CHARS = 1500;

  const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

  const parseCommentContent = (rawContent: string) => {
    const match = (rawContent || '').match(/^\[Topic:\s*([^\]]+)\]\s*(.*)$/s);
    if (match && match[1]) {
      return {
        topic: match[1].trim(),
        text: match[2]?.trim() || '',
      };
    }
    return {
      topic: null,
      text: rawContent || '',
    };
  };

  const formatRelativeTime = (dateString?: string | null) => {
    if (!dateString) return 'Just now';
    const date = new Date(dateString);
    const time = date.getTime();
    if (isNaN(time)) return 'Recently';
    const diffSec = Math.floor((Date.now() - time) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}d ago`;
    return safeFormatDate(dateString, 'MMM dd, yyyy');
  };

  const getAvatarProps = (name: string) => {
    const cleanName = (name || 'Anonymous').trim();
    const initials = cleanName === 'Anonymous'
      ? 'A'
      : cleanName.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');

    const colors = [
      'border-blue-200 bg-blue-100 text-blue-800',
      'border-emerald-200 bg-emerald-100 text-emerald-800',
      'border-amber-200 bg-amber-100 text-amber-800',
      'border-purple-200 bg-purple-100 text-purple-800',
      'border-rose-200 bg-rose-100 text-rose-800',
      'border-teal-200 bg-teal-100 text-teal-800',
      'border-indigo-200 bg-indigo-100 text-indigo-800',
    ];

    let sum = 0;
    for (let i = 0; i < cleanName.length; i++) {
      sum += cleanName.charCodeAt(i);
    }
    return {
      initials: initials || 'C',
      colorClass: colors[sum % colors.length] || colors[0]!,
    };
  };

  const getTopicBadgeStyle = (topicName: string | null) => {
    switch (topicName?.toLowerCase()) {
      case 'progress & site update':
      case 'progress & site':
      case 'progress':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'budget & funds':
      case 'budget & disbursement':
      case 'budget':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'citizen concern':
      case 'citizen concern / hazard':
      case 'concern':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'commendation':
      case 'appreciation':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const commentPhotoPreviews = useMemo(() => {
    return commentPhotos.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
  }, [commentPhotos]);

  useEffect(() => {
    return () => {
      commentPhotoPreviews.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [commentPhotoPreviews]);

  const handleCommentPhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    if (!selected.length) return;

    const validImages = selected.filter((file) => {
      if (!file.type.startsWith('image/')) {
        flashToast.warning('Invalid File', `${file.name} is not an image file.`);
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        flashToast.warning('File Too Large', `${file.name} exceeds the 5MB size limit.`);
        return false;
      }
      return true;
    });

    setCommentPhotos((prev) => {
      const combined = [...prev, ...validImages];
      if (combined.length > 4) {
        flashToast.info('Photo Limit', 'You can attach up to 4 photos per comment.');
        return combined.slice(0, 4);
      }
      return combined;
    });

    event.target.value = '';
  };

  const handleRemovePhoto = (indexToRemove: number) => {
    setCommentPhotos((prev) => prev.filter((_, i) => i !== indexToRemove));
  };

  const handleToggleReaction = (commentId: string, reactionType: 'helpful' | 'insightful') => {
    setUserReactions((prev) => {
      const current = prev[commentId] || {};
      const updated = {
        ...prev,
        [commentId]: {
          ...current,
          [reactionType]: !current[reactionType],
        },
      };
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(`sta-cruz-reactions-${id}`, JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });
    if (id) {
      apiClient.reactToComment(id, commentId, reactionType).catch(() => {});
    }
  };

  const handleReportComment = (commentId: string) => {
    if (reportedComments.includes(commentId)) return;
    const updated = [...reportedComments, commentId];
    setReportedComments(updated);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(`sta-cruz-reported-comments-${id}`, JSON.stringify(updated));
      } catch {}
    }
    if (id) {
      apiClient.reportComment(id, commentId).catch(() => {});
    }
    flashToast.info('Comment Flagged', 'Thank you. This comment has been flagged for municipal moderation.');
  };

  const commentWordCount = useMemo(() => countWords(commentContent), [commentContent]);
  const commentCharCount = commentContent.length;
  const isWordCountValid = commentWordCount >= MIN_COMMENT_WORDS && commentWordCount <= MAX_COMMENT_WORDS;
  const isCharCountValid = commentCharCount >= MIN_COMMENT_CHARS && commentCharCount <= MAX_COMMENT_CHARS;

  const handleSubmitComment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!id) return;

    if (cooldownSeconds > 0) {
      flashToast.warning('Cooldown Active', `Please wait ${cooldownSeconds}s before posting another comment.`);
      return;
    }

    const trimmedContent = commentContent.trim();
    if (!trimmedContent) {
      setCommentsError('Please write a comment before posting.');
      return;
    }

    if (trimmedContent.length < MIN_COMMENT_CHARS) {
      setCommentsError(`Comment must be at least ${MIN_COMMENT_CHARS} characters.`);
      return;
    }

    const words = countWords(trimmedContent);
    if (words < MIN_COMMENT_WORDS) {
      setCommentsError(`Comment is too short (${words} words). Please provide at least ${MIN_COMMENT_WORDS} words to share constructive feedback.`);
      return;
    }

    if (words > MAX_COMMENT_WORDS) {
      setCommentsError(`Comment exceeds the limit of ${MAX_COMMENT_WORDS} words (${words} words provided). Please shorten your comment.`);
      return;
    }

    try {
      setIsSubmittingComment(true);
      setCommentsError(null);

      const contentWithTopic = commentTopic && commentTopic !== 'General Feedback'
        ? `[Topic: ${commentTopic}] ${trimmedContent}`
        : trimmedContent;

      const formData = new FormData();
      formData.append('displayName', censorProfanity(commentDisplayName.trim() || 'Anonymous'));
      formData.append('content', censorProfanity(contentWithTopic));
      formData.append('topic', commentTopic || 'General Feedback');
      commentPhotos.forEach((photo) => formData.append('photos', photo));

      const response = await apiClient.createProjectComment(id, formData) as { comment: PublicComment };
      const createdComment = {
        ...response.comment,
        display_name: censorProfanity(response.comment.display_name || 'Anonymous'),
        content: censorProfanity(response.comment.content || ''),
      };

      setComments((prev) => [createdComment, ...prev]);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(`sta-cruz-comments-${id}`, JSON.stringify([createdComment, ...comments]));
        } catch {}
      }

      setCommentContent('');
      setCommentPhotos([]);
      setCommentDisplayName('Anonymous');
      setCommentTopic('General Feedback');
      setCooldownSeconds(10);
      flashToast.success('Comment Published', 'Your comment has been recorded on the public project board.');
    } catch (error: any) {
      const errMsg = error?.message || 'Failed to post comment.';
      setCommentsError(errMsg);
      if (errMsg.toLowerCase().includes('wait') || errMsg.toLowerCase().includes('too many') || errMsg.toLowerCase().includes('volume') || errMsg.toLowerCase().includes('cooldown')) {
        const match = errMsg.match(/(\d+)\s*second/i);
        setCooldownSeconds(match ? parseInt(match[1]!, 10) : 15);
      }
      flashToast.error('Posting Notice', errMsg);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const filteredComments = useMemo(() => {
    return comments.filter((comment) => {
      const parsed = parseCommentContent(comment.content);
      if (commentFilter === 'photos' && (!comment.photos || comment.photos.length === 0)) {
        return false;
      }
      if (commentFilter !== 'all' && commentFilter !== 'photos') {
        if (parsed.topic?.toLowerCase() !== commentFilter.toLowerCase()) {
          return false;
        }
      }
      if (commentSearch.trim()) {
        const query = commentSearch.toLowerCase();
        const inName = (comment.display_name || '').toLowerCase().includes(query);
        const inBody = parsed.text.toLowerCase().includes(query);
        if (!inName && !inBody) return false;
      }
      return true;
    }).sort((a, b) => {
      if (commentSort === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (commentSort === 'helpful') {
        const aHelpful = userReactions[a.id]?.helpful ? 1 : 0;
        const bHelpful = userReactions[b.id]?.helpful ? 1 : 0;
        return bHelpful - aHelpful || (new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [comments, commentFilter, commentSearch, commentSort, userReactions]);

  if (attemptedLoad && !rawProject && !summary) {
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
        : (displayProject.endDate || displayProject.end_date)
          ? `Target ${safeFormatDate(displayProject.endDate || displayProject.end_date, 'MMM dd, yyyy')}`
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
                  Created {safeFormatDate(displayProject.createdAt || displayProject.created_at, 'MMM dd, yyyy')}
                </span>
                {(displayProject.startDate || displayProject.start_date) && (
                  <span className="inline-flex items-center">
                    <Calendar className="mr-1 h-3.5 w-3.5 text-slate-400" />
                    Started {safeFormatDate(displayProject.startDate || displayProject.start_date, 'MMM dd, yyyy')}
                  </span>
                )}
                {(displayProject.endDate || displayProject.end_date) && (
                  <span className={projectDelayed ? 'inline-flex items-center font-bold text-red-700' : 'inline-flex items-center'}>
                    <Clock className="mr-1 h-3.5 w-3.5" />
                    Target end {safeFormatDate(displayProject.endDate || displayProject.end_date, 'MMM dd, yyyy')}
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Project Budget</p>
              <p className="mt-1 text-3xl font-extrabold text-slate-900">{formatCurrency(displayProject.totalBudget)}</p>
              <p className="mt-1 text-xs text-slate-500">{displayProject.budgetSource || displayProject.budget_source || 'Municipal Budget Allocation'}</p>
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
                                  {safeFormatDate(tx.date || tx.created_at, 'MMM dd, yyyy HH:mm')}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    className={
                                      (tx.type || '').includes('NCA')
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
                                  {getOfficerBadge(tx.recordedByRole || tx.recorded_by_role)}
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

            {((displayProject.locationPhotos && displayProject.locationPhotos.length > 0) || (displayProject.location_photos && displayProject.location_photos.length > 0)) && (
              <Card className="rounded-lg border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-2xl font-black text-[#17212b]">Location Photos</CardTitle>
                  <CardDescription>Site images attached to the public project record.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {(displayProject.locationPhotos || displayProject.location_photos || []).map((photoUrl: string, index: number) => (
                      <button
                        key={photoUrl}
                        type="button"
                        className="group overflow-hidden rounded-lg border border-slate-200 bg-slate-100 text-left shadow-sm"
                        onClick={() => openPreview(
                          (displayProject.locationPhotos || displayProject.location_photos || []).map((url: string, itemIndex: number) => ({
                            type: 'image',
                            url: resolveAssetUrl(url),
                            title: `Location photo ${itemIndex + 1}`,
                          })),
                          index
                        )}
                      >
                        <ProjectImageThumbnail
                          src={resolveAssetUrl(photoUrl)}
                          alt={`Location photo ${index + 1}`}
                          className="h-64 w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                          fallbackHeight="h-64"
                        />
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
                      const rawMilestoneReports = [
                        ...(displayProject.documents?.filter((doc: any) =>
                          (doc.milestoneId && doc.milestoneId === milestone.id) ||
                          (doc.milestone_id && doc.milestone_id === milestone.id)
                        ) || []),
                        ...(Array.isArray(milestone.reports) ? milestone.reports : []),
                        ...(Array.isArray(milestone.documents) ? milestone.documents : []),
                      ];
                      const rawMilestonePhotos = milestone.photos || [];

                      const seenPhotoKeys = new Set<string>();
                      const milestonePhotos = rawMilestonePhotos.filter((photo: any) => {
                        const key = photo.photoHash || photo.photo_hash || photo.url?.split('?')[0] || photo.id;
                        if (!key || seenPhotoKeys.has(key)) return false;
                        seenPhotoKeys.add(key);
                        return true;
                      });

                      const seenDocKeys = new Set<string>();
                      const milestoneReports = rawMilestoneReports.filter((doc: any) => {
                        const key = doc.checksumHash || doc.checksum_hash || (doc.title && doc.size ? `${doc.title}_${doc.size}` : doc.url?.split('?')[0] || doc.id);
                        if (!key || seenDocKeys.has(key)) return false;
                        seenDocKeys.add(key);
                        return true;
                      });

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
                              {(milestone.dueDate || milestone.due_date) ? `Target ${safeFormatDate(milestone.dueDate || milestone.due_date, 'MMM dd, yyyy')}` : 'Target date pending'}
                            </span>
                            <span>{(milestone.dateVerified || milestone.date_verified) ? `Verified ${safeFormatDate(milestone.dateVerified || milestone.date_verified, 'MMM dd, yyyy')}` : 'Pending verification'}</span>
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
                                        <ProjectImageThumbnail
                                          src={resolveAssetUrl(photo.url)}
                                          alt={photo.description || milestone.title}
                                          className="h-28 w-full object-cover"
                                          fallbackHeight="h-28"
                                        />
                                        <div className="p-2 text-xs text-slate-600">
                                          <div className="font-bold capitalize text-slate-700">{photo.type || photo.photo_type || 'Proof Photo'}</div>
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
                                        key={doc.id || doc.url}
                                        type="button"
                                        onClick={() => openPreview([{
                                          type: 'document',
                                          url: resolveAssetUrl(doc.url),
                                          title: doc.title || doc.name || 'Milestone Report',
                                          fileFormat: doc.fileFormat || doc.file_format || (doc.url?.toLowerCase().endsWith('.pdf') ? 'PDF' : undefined),
                                        }])}
                                        className="flex w-full items-start rounded-lg border border-slate-200 bg-[#fbfaf6] p-3 text-left transition-colors hover:bg-white"
                                      >
                                        <FileText className="mr-3 mt-0.5 h-4 w-4 shrink-0 text-[#315b7d]" />
                                        <div className="min-w-0 flex-1">
                                          <div className="truncate text-sm font-bold text-[#315b7d]">{doc.title || doc.name || 'Report'}</div>
                                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                            <span>{safeFormatDate(doc.dateUploaded || doc.date_uploaded || doc.created_at, 'MMM dd, yyyy')}</span>
                                            {doc.size ? <span>• {(Number(doc.size) / 1024).toFixed(1)} KB</span> : null}
                                            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-blue-800">
                                              {doc.fileFormat || doc.file_format || 'PDF'}
                                            </span>
                                          </div>
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

            {displayProject.documents && displayProject.documents.length > 0 && (
              <Card className="rounded-lg border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-2xl font-black text-[#17212b]">Project Documents & Reports</CardTitle>
                  <CardDescription>All official documents, milestone reports, and verification files recorded on this project.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {displayProject.documents.map((doc: any, docIdx: number) => (
                      <button
                        key={doc.id || doc.url || docIdx}
                        type="button"
                        onClick={() => openPreview([{
                          type: 'document',
                          url: resolveAssetUrl(doc.url),
                          title: doc.title || doc.name || 'Project Document',
                          fileFormat: doc.fileFormat || doc.file_format || (doc.url?.toLowerCase().endsWith('.pdf') ? 'PDF' : undefined),
                        }])}
                        className="flex items-start rounded-lg border border-slate-200 bg-[#fbfaf6] p-3 text-left transition-colors hover:bg-white"
                      >
                        <FileText className="mr-3 mt-0.5 h-4 w-4 shrink-0 text-[#315b7d]" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold text-[#315b7d]">{doc.title || doc.name || 'Document'}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span>{safeFormatDate(doc.dateUploaded || doc.date_uploaded || doc.created_at, 'MMM dd, yyyy')}</span>
                            {doc.size ? <span>• {(Number(doc.size) / 1024).toFixed(1)} KB</span> : null}
                            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-blue-800">
                              {doc.fileFormat || doc.file_format || 'PDF'}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-8">
            <Card className="rounded-lg border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-black text-[#17212b]">Project Details</CardTitle>
                <CardDescription>Category, schedule, and public funding information.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3.5">
                {displayProject.category && (
                  <div className="rounded-lg border border-slate-200 bg-[#fbfaf6] p-3">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Category</p>
                    <p className="mt-1 font-bold text-slate-900">{displayProject.category}</p>
                  </div>
                )}
                <div className="rounded-lg border border-[#d8c38f] bg-[#fff8e5] p-3">
                  <p className="text-[11px] font-black uppercase tracking-wider text-[#71591d]">Budget Source</p>
                  <p className="mt-1 font-bold text-[#71591d]">
                    {displayProject.budgetSource || displayProject.budget_source || 'LGU - Municipal Budget Allocation'}
                  </p>
                </div>
                {displayProject.location && (
                  <div className="rounded-lg border border-slate-200 bg-[#fbfaf6] p-3">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Project Location</p>
                    <p className="mt-1 font-bold text-slate-900 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      {displayProject.location}
                    </p>
                  </div>
                )}
                {(displayProject.startDate || displayProject.start_date || displayProject.endDate || displayProject.end_date || displayProject.createdAt || displayProject.created_at) && (
                  <div className="rounded-lg border border-slate-200 bg-[#fbfaf6] p-3">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Project Timeline</p>
                    <div className="mt-2 space-y-1.5 text-xs">
                      {(displayProject.createdAt || displayProject.created_at) && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Created:</span>
                          <span className="font-semibold text-slate-800">{safeFormatDate(displayProject.createdAt || displayProject.created_at, 'MMM dd, yyyy')}</span>
                        </div>
                      )}
                      {(displayProject.startDate || displayProject.start_date) && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Start Date:</span>
                          <span className="font-semibold text-slate-800">{safeFormatDate(displayProject.startDate || displayProject.start_date, 'MMM dd, yyyy')}</span>
                        </div>
                      )}
                      {(displayProject.endDate || displayProject.end_date) && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Target Completion:</span>
                          <span className={`font-semibold ${projectDelayed ? 'text-red-700 font-bold' : 'text-slate-800'}`}>
                            {safeFormatDate(displayProject.endDate || displayProject.end_date, 'MMM dd, yyyy')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="rounded-lg border border-slate-200 bg-[#fbfaf6] p-3">
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Funding Summary</p>
                  <div className="mt-2 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Total Budget:</span>
                      <span className="font-bold text-slate-900">{formatCurrency(displayProject.totalBudget)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Allocated (SARO):</span>
                      <span className="font-bold text-[#315b7d]">{formatCurrency(displayProject.allocatedFunds)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Disbursed (NCA):</span>
                      <span className="font-bold text-emerald-700">{formatCurrency(displayProject.disbursedFunds)}</span>
                    </div>
                    {(displayProject.saro || summary?.saroRef) && (
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                        <span className="text-slate-500">SARO Ref:</span>
                        <span className="font-mono text-[11px] font-bold text-slate-700">{displayProject.saro || summary?.saroRef}</span>
                      </div>
                    )}
                  </div>
                </div>
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

        <Card className="mt-8 rounded-xl border-slate-200 bg-white shadow-sm overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-[#fdfcf9] pb-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-2xl font-black text-[#17212b]">Public Comments & Community Voices</CardTitle>
                  <span className="inline-flex items-center rounded-full bg-[#315b7d]/10 px-2.5 py-0.5 text-xs font-bold text-[#315b7d]">
                    {comments.length} {comments.length === 1 ? 'Post' : 'Posts'}
                  </span>
                </div>
                <CardDescription className="mt-1 text-slate-500">
                  Open civic feedback forum for Santa Cruz citizens and stakeholders. Anyone can participate without signing in.
                </CardDescription>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50/70 border border-blue-100 px-3 py-2 text-xs text-blue-900">
              <ShieldCheck className="h-4 w-4 shrink-0 text-blue-600" />
              <span>
                <strong>Civic Discourse Guidelines:</strong> Public comments are permanently logged with audit integrity. Please ensure commentary is constructive, truthful, and relevant to this municipal project.
              </span>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pt-6">
            {/* Comment Composer */}
            <form onSubmit={handleSubmitComment} className="rounded-xl border border-slate-200 bg-[#fbfaf6] p-4 sm:p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 pb-3">
                <span className="text-xs font-black uppercase tracking-wider text-slate-600">New Public Comment</span>
                <span className="text-xs text-slate-500">Limits: 3–250 words • Max 1,500 chars</span>
              </div>

              {/* Name and Topic Selector */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-600">
                    Public Name or Alias
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={commentDisplayName}
                      onChange={(event) => setCommentDisplayName(event.target.value)}
                      maxLength={40}
                      placeholder="Anonymous"
                      className="rounded-lg border-slate-200 bg-white text-sm"
                    />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-slate-400">
                    <span>Quick alias:</span>
                    {['Anonymous', 'Local Resident', 'Daily Commuter', 'Sta. Cruz Taxpayer'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCommentDisplayName(preset)}
                        className="font-medium text-[#315b7d] hover:underline"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-600">
                    Comment Category / Topic
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: 'General Feedback', icon: '💬' },
                      { label: 'Progress & Site Update', icon: '🏗️' },
                      { label: 'Budget & Funds', icon: '💰' },
                      { label: 'Citizen Concern', icon: '⚠️' },
                      { label: 'Commendation', icon: '👏' },
                    ].map((topic) => (
                      <button
                        key={topic.label}
                        type="button"
                        onClick={() => setCommentTopic(topic.label)}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                          commentTopic === topic.label
                            ? 'bg-[#315b7d] text-white shadow-sm ring-2 ring-[#315b7d]/20'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span>{topic.icon}</span>
                        <span>{topic.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Textarea with active character and word counts */}
              <div className="relative rounded-lg border border-slate-300 bg-white p-3 shadow-inner transition focus-within:border-[#315b7d] focus-within:ring-2 focus-within:ring-[#315b7d]/15">
                <textarea
                  value={commentContent}
                  onChange={(event) => setCommentContent(event.target.value)}
                  maxLength={1500}
                  required
                  placeholder="Share your feedback, site observations, or questions about this project..."
                  className="min-h-[100px] w-full resize-none border-0 bg-transparent p-0 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                />

                {/* Live Progress Bar for Word Limit */}
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full transition-all duration-300 ${
                      commentWordCount > 250
                        ? 'bg-rose-500'
                        : commentWordCount >= 220
                        ? 'bg-amber-500'
                        : commentWordCount >= 3
                        ? 'bg-[#315b7d]'
                        : 'bg-slate-300'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(3, (commentWordCount / 250) * 100))}%` }}
                  />
                </div>

                {/* Real-time word and character stats */}
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-bold ${
                        commentWordCount === 0
                          ? 'bg-slate-100 text-slate-500'
                          : commentWordCount < 3
                          ? 'bg-amber-100 text-amber-800'
                          : commentWordCount <= 220
                          ? 'bg-emerald-50 text-emerald-700'
                          : commentWordCount <= 250
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {commentWordCount === 0 ? (
                        '0 / 250 words (min 3)'
                      ) : commentWordCount < 3 ? (
                        <>
                          <AlertCircle className="h-3 w-3" /> Need at least 3 words ({commentWordCount}/3)
                        </>
                      ) : commentWordCount <= 220 ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" /> {commentWordCount} / 250 words
                        </>
                      ) : commentWordCount <= 250 ? (
                        <>
                          <AlertCircle className="h-3 w-3" /> {250 - commentWordCount} words left
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3 w-3" /> Exceeds limit by {commentWordCount - 250} words!
                        </>
                      )}
                    </span>

                    <span className="text-slate-400">
                      {commentCharCount} / 1500 chars
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <label
                      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 ${
                        commentPhotos.length >= 4 ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      title={commentPhotos.length >= 4 ? 'Maximum 4 photos allowed' : 'Attach proof or site photos'}
                    >
                      <ImagePlus className="h-3.5 w-3.5 text-[#315b7d]" />
                      <span>Attach Photos ({commentPhotos.length}/4)</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={commentPhotos.length >= 4}
                        onChange={handleCommentPhotoChange}
                        className="hidden"
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={isSubmittingComment || cooldownSeconds > 0 || !commentContent.trim() || !isWordCountValid || !isCharCountValid}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#315b7d] px-4 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#264966] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSubmittingComment ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Posting...</span>
                        </>
                      ) : cooldownSeconds > 0 ? (
                        <>
                          <Clock className="h-3.5 w-3.5" />
                          <span>Wait {cooldownSeconds}s</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" />
                          <span>Post Comment</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Photo Previews with Delete Button */}
              {commentPhotoPreviews.length > 0 && (
                <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Attached Photos ({commentPhotoPreviews.length}/4)</span>
                    <span className="text-[11px] text-slate-400">Click &times; to remove before posting</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {commentPhotoPreviews.map((item, index) => (
                      <div
                        key={`${item.file.name}-${index}`}
                        className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm"
                      >
                        <img
                          src={item.url}
                          alt={item.file.name}
                          className="h-24 w-full object-cover transition group-hover:scale-105"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(index)}
                          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-white shadow hover:bg-rose-700 transition"
                          title="Remove photo"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <div className="p-1.5 text-[10px] text-slate-600 bg-white">
                          <div className="truncate font-semibold text-slate-800">{item.file.name}</div>
                          <div>{Math.round(item.file.size / 1024)} KB</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Anti-spam cooldown alert banner */}
              {cooldownSeconds > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <Clock className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>
                    <strong>Posting cooldown active:</strong> To prevent server congestion and spam bursts, you can post another comment in <strong>{cooldownSeconds} second{cooldownSeconds === 1 ? '' : 's'}</strong>.
                  </span>
                </div>
              )}

              {/* Error Alert */}
              {commentsError && (
                <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{commentsError}</span>
                </div>
              )}
            </form>

            {/* Comments Control Toolbar (Search, Topic Filter, Sort) */}
            <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-[#fbfaf6] p-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  value={commentSearch}
                  onChange={(e) => setCommentSearch(e.target.value)}
                  placeholder="Search comments or commenter..."
                  className="h-8 pl-8 text-xs bg-white border-slate-200 rounded-lg"
                />
                {commentSearch && (
                  <button
                    onClick={() => setCommentSearch('')}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Filter and Sort controls */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Filter className="h-3.5 w-3.5 text-slate-400" />
                  <select
                    value={commentFilter}
                    onChange={(e) => setCommentFilter(e.target.value)}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-[#315b7d]"
                  >
                    <option value="all">All Topics ({comments.length})</option>
                    <option value="photos">With Photos Only</option>
                    <option value="Progress & Site Update">Progress & Site Updates</option>
                    <option value="Budget & Funds">Budget Inquiries</option>
                    <option value="Citizen Concern">Citizen Concerns</option>
                    <option value="Commendation">Commendations</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
                  <select
                    value={commentSort}
                    onChange={(e) => setCommentSort(e.target.value as 'newest' | 'helpful' | 'oldest')}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-[#315b7d]"
                  >
                    <option value="newest">Newest First</option>
                    <option value="helpful">Most Helpful</option>
                    <option value="oldest">Oldest First</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Comments List */}
            <div className="space-y-4">
              {commentsLoading ? (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-[#fbfaf6] p-8 text-sm text-slate-500">
                  <RefreshCw className="h-4 w-4 animate-spin text-[#315b7d]" />
                  <span>Loading public comments...</span>
                </div>
              ) : filteredComments.length > 0 ? (
                <>
                  {filteredComments.slice(0, visibleCommentsCount).map((comment) => {
                    const parsed = parseCommentContent(comment.content);
                    const avatar = getAvatarProps(comment.display_name);
                    const isReported = reportedComments.includes(comment.id);
                    const userReaction = userReactions[comment.id] || {};

                    return (
                      <div
                        key={comment.id}
                        className={`rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm transition hover:shadow-md ${
                          isReported ? 'opacity-60 bg-slate-50/50' : ''
                        }`}
                      >
                        {/* Header: Avatar, Name, Topic Badge, Time */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border font-black text-sm shadow-sm ${avatar.colorClass}`}
                            >
                              {avatar.initials}
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-slate-900">
                                  {censorProfanity(comment.display_name || 'Anonymous')}
                                </span>
                                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                  Citizen Post
                                </span>
                                {parsed.topic && (
                                  <span
                                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${getTopicBadgeStyle(
                                      parsed.topic
                                    )}`}
                                  >
                                    {parsed.topic}
                                  </span>
                                )}
                              </div>
                              <div className="mt-0.5 text-xs text-slate-400" title={safeFormatDate(comment.created_at, 'MMMM dd, yyyy HH:mm')}>
                                {formatRelativeTime(comment.created_at)}
                              </div>
                            </div>
                          </div>

                          {isReported ? (
                            <Badge className="border-amber-200 bg-amber-50 text-amber-700 text-[10px]">
                              Flagged for Moderation
                            </Badge>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleReportComment(comment.id)}
                              className="text-slate-400 hover:text-rose-600 text-[11px] inline-flex items-center gap-1 transition"
                              title="Flag inappropriate comment"
                            >
                              <Flag className="h-3 w-3" />
                              <span className="hidden sm:inline">Report</span>
                            </button>
                          )}
                        </div>

                        {/* Comment Body */}
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                          {censorProfanity(parsed.text)}
                        </p>

                        {/* Attached Photos */}
                        {comment.photos && comment.photos.length > 0 && (
                          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {comment.photos.map((photo, photoIndex) => (
                              <button
                                key={photo.id}
                                type="button"
                                onClick={() =>
                                  openPreview(
                                    (comment.photos || []).map((item, itemIndex) => ({
                                      type: 'image',
                                      url: resolveAssetUrl(item.url),
                                      title: `Citizen photo attachment ${itemIndex + 1}`,
                                    })),
                                    photoIndex
                                  )
                                }
                                className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50 transition hover:border-[#315b7d]"
                              >
                                <ProjectImageThumbnail
                                  src={resolveAssetUrl(photo.url)}
                                  alt="Citizen comment photo"
                                  className="h-32 w-full object-cover transition group-hover:scale-105"
                                  fallbackHeight="h-32"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition" />
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Reactions and Helpful Votes */}
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleReaction(comment.id, 'helpful')}
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                                userReaction.helpful
                                  ? 'border-[#315b7d] bg-[#315b7d]/10 text-[#315b7d]'
                                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                              }`}
                            >
                              <ThumbsUp className="h-3.5 w-3.5" />
                              <span>Helpful</span>
                              <span className="font-bold">{userReaction.helpful ? 1 : 0}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleReaction(comment.id, 'insightful')}
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                                userReaction.insightful
                                  ? 'border-amber-300 bg-amber-50 text-amber-800'
                                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                              }`}
                            >
                              <Lightbulb className="h-3.5 w-3.5" />
                              <span>Insightful</span>
                              <span className="font-bold">{userReaction.insightful ? 1 : 0}</span>
                            </button>
                          </div>

                          <div className="text-[11px] text-slate-400">
                            Logged on Public Ledger
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Load More Pagination */}
                  {filteredComments.length > visibleCommentsCount && (
                    <div className="pt-2 text-center">
                      <button
                        type="button"
                        onClick={() => setVisibleCommentsCount((prev) => prev + 6)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-300"
                      >
                        <ChevronDown className="h-4 w-4" />
                        <span>Show More Comments ({filteredComments.length - visibleCommentsCount} remaining)</span>
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-[#fbfaf6] p-8 text-center">
                  <MessageSquare className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="mt-3 text-sm font-bold text-slate-700">
                    {commentSearch || commentFilter !== 'all' ? 'No matching comments found' : 'No comments yet'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {commentSearch || commentFilter !== 'all'
                      ? 'Try clearing the search or topic filters.'
                      : 'Be the first Santa Cruz citizen to share feedback or attach site updates!'}
                  </p>
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
