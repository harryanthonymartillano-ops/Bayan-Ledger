import { INITIAL_PROJECTS_SEED } from './initialProjectsSeed';

const PUBLIC_PROJECTS_STORAGE_KEY = 'bayanledger-public-projects-cache-v1';
const isBrowser = typeof window !== 'undefined';

let inMemoryProjectsCache: any[] | null = null;

const sanitizeProjectForStorage = (project: any) => {
  if (!project || typeof project !== 'object') return null;

  const clone = { ...project };

  // Strip excessive base64 data URIs to safeguard localStorage quota
  if (Array.isArray(clone.locationPhotos)) {
    clone.locationPhotos = clone.locationPhotos.filter(
      (photo: unknown) => typeof photo === 'string' && !photo.startsWith('data:image')
    );
  }
  if (Array.isArray(clone.location_photos)) {
    clone.location_photos = clone.location_photos.filter(
      (photo: unknown) => typeof photo === 'string' && !photo.startsWith('data:image')
    );
  }

  if (Array.isArray(clone.milestones)) {
    clone.milestones = clone.milestones.map((m: any) => {
      if (!m || typeof m !== 'object') return m;
      const cleanM = { ...m };
      if (Array.isArray(cleanM.photos)) {
        cleanM.photos = cleanM.photos.filter(
          (p: any) => !(p && typeof p.url === 'string' && p.url.startsWith('data:image'))
        );
      }
      return cleanM;
    });
  }

  return clone;
};

const mapRawSeedProject = (p: any): any => {
  const milestones = Array.isArray(p.milestones) ? p.milestones : [];
  const transactions = Array.isArray(p.transactions) ? p.transactions : [];
  const documents = Array.isArray(p.documents) ? p.documents : [];

  return {
    id: String(p.id || ''),
    name: String(p.name || 'Unnamed Project'),
    description: String(p.description || ''),
    location: String(p.location || 'Santa Cruz, Laguna'),
    category: String(p.category || 'Infrastructure'),
    budgetSource: p.budget_source || p.budgetSource || undefined,
    locationPhotos: Array.isArray(p.location_photos) ? p.location_photos : Array.isArray(p.locationPhotos) ? p.locationPhotos : [],
    startDate: p.start_date || p.startDate || undefined,
    endDate: p.end_date || p.endDate || undefined,
    stakeholders: Array.isArray(p.stakeholders) ? p.stakeholders : [],
    totalBudget: Number(p.total_budget || p.totalBudget || 0),
    allocatedFunds: Number(p.allocated_funds || p.allocatedFunds || 0),
    disbursedFunds: Number(p.disbursed_funds || p.disbursedFunds || 0),
    status: p.status || 'In Progress',
    milestones: milestones.map((m: any) => ({
      id: String(m.id || ''),
      title: String(m.title || ''),
      description: String(m.description || ''),
      percentage: Number(m.percentage || 0),
      status: m.status || 'Pending',
      deliverables: Array.isArray(m.deliverables) ? m.deliverables : [],
      dueDate: m.due_date || m.dueDate || undefined,
      dateVerified: m.date_verified || m.dateVerified || undefined,
      verifiedBy: m.verified_by || m.verifiedBy || undefined,
      evidenceHash: m.evidence_hash || m.evidenceHash || undefined,
      reportHash: m.report_hash || m.reportHash || undefined,
      photos: Array.isArray(m.photos) ? m.photos : [],
      photoUrl: m.photo_url || m.photoUrl || undefined,
      onChainVerifiedAt: m.onchain_verified_at || m.onChainVerifiedAt || undefined,
      onChainPaid: Boolean(m.onchain_paid ?? m.onChainPaid),
    })),
    documents: documents.map((d: any) => ({
      id: String(d.id || ''),
      title: String(d.title || ''),
      type: d.type || 'Other',
      url: d.url || '',
      uploadedBy: d.uploaded_by || d.uploadedBy || 'System',
      dateUploaded: d.created_at || d.dateUploaded || new Date().toISOString(),
      ipfsHash: d.ipfs_hash || d.ipfsHash || '',
      size: Number(d.size || 0),
      version: Number(d.version || 1),
      verified: Boolean(d.verified),
      checksumHash: d.checksum_hash || d.checksumHash || '',
    })),
    transactions: transactions.map((t: any) => ({
      id: String(t.id || ''),
      projectId: String(t.project_id || t.projectId || p.id),
      milestoneId: t.milestone_id || t.milestoneId || undefined,
      amount: Number(t.amount || 0),
      type: t.type || 'Disbursement (NCA)',
      status: t.status || 'Executed',
      date: t.date || t.created_at || new Date().toISOString(),
      recordedBy: t.recorded_by || t.recordedBy || 'System',
      recordedByRole: t.recorded_by_role || t.recordedByRole || 'Treasurer',
      description: t.description || '',
      hash: t.hash || '',
      contractorAddress: t.contractor_address || t.contractorAddress || undefined,
      digitalSealHash: t.digital_seal_hash || t.digitalSealHash || undefined,
      requestTxHash: t.request_tx_hash || t.requestTxHash || undefined,
      budgetSignedAt: t.budget_officer_signed_at || t.budgetSignedAt || undefined,
      treasurerSignedAt: t.treasurer_signed_at || t.treasurerSignedAt || undefined,
      signatureCount: Number(t.signature_count || t.signatureCount || 0),
      rejectionReason: t.rejection_reason || t.rejectionReason || undefined,
    })),
    saro: p.saro || p.latest_saro_ref || p.latestSaroRef || undefined,
    createdAt: p.created_at || p.createdAt || new Date().toISOString(),
    metadataHash: p.metadata_hash || p.metadataHash || undefined,
    blockchainTxHash: p.blockchain_tx_hash || p.blockchainTxHash || undefined,
    latestDisbursementRef: p.latest_disbursement_ref || p.latestDisbursementRef || undefined,
    createdByWallet: p.blockchain_created_by_wallet || p.createdByWallet || undefined,
    budgetOfficerWallet: p.budget_officer_wallet || p.budgetOfficerWallet || undefined,
    treasurerWallet: p.treasurer_wallet || p.treasurerWallet || undefined,
    treasurySealHash: p.treasury_seal_hash || p.treasurySealHash || undefined,
    activatedAt: p.activated_at || p.activatedAt || undefined,
    budgetOfficerSignedAt: p.budget_officer_signed_at || p.budgetOfficerSignedAt || undefined,
    treasurerSignedAt: p.treasurer_signed_at || p.treasurerSignedAt || undefined,
  };
};

export const readStoredProjects = (): any[] => {
  if (inMemoryProjectsCache && inMemoryProjectsCache.length > 0) {
    return inMemoryProjectsCache;
  }

  if (isBrowser) {
    try {
      const raw = window.localStorage.getItem(PUBLIC_PROJECTS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          inMemoryProjectsCache = parsed;
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Unable to read public projects from localStorage:', e);
    }
  }

  // Instant fallback to embedded seed projects (0ms on fresh/incognito browsers)
  if (Array.isArray(INITIAL_PROJECTS_SEED) && INITIAL_PROJECTS_SEED.length > 0) {
    const mapped = INITIAL_PROJECTS_SEED.map(mapRawSeedProject);
    inMemoryProjectsCache = mapped;
    if (isBrowser) {
      try {
        window.localStorage.setItem(PUBLIC_PROJECTS_STORAGE_KEY, JSON.stringify(mapped));
      } catch {
        // Ignore quota limits on initial seed save
      }
    }
    return mapped;
  }

  return [];
};

export const writeStoredProjects = (projects: any[]): void => {
  if (!Array.isArray(projects) || projects.length === 0) return;

  const sanitized = projects.map(sanitizeProjectForStorage).filter(Boolean);
  inMemoryProjectsCache = sanitized;

  if (!isBrowser) return;

  try {
    window.localStorage.setItem(PUBLIC_PROJECTS_STORAGE_KEY, JSON.stringify(sanitized));
  } catch (e) {
    console.warn('Unable to persist public projects to localStorage:', e);
  }
};

export const hasStoredProjects = (): boolean => {
  if (inMemoryProjectsCache && inMemoryProjectsCache.length > 0) return true;
  if (!isBrowser) return (INITIAL_PROJECTS_SEED?.length || 0) > 0;

  try {
    const raw = window.localStorage.getItem(PUBLIC_PROJECTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return true;
    }
  } catch {
    // Fall back to seed availability
  }

  return (INITIAL_PROJECTS_SEED?.length || 0) > 0;
};

export const getStoredProjectById = (id: string): any | null => {
  if (!id) return null;
  const projects = readStoredProjects();
  return projects.find((p) => p.id === id) || null;
};
