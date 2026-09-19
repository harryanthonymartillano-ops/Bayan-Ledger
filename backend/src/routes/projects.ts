import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { supabase } from '../db/config';
import { logger } from '../logger';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';
import { isValidProjectCategory } from '../constants/projectCategories';
import { uploadFileBuffer } from '../services/fileUpload';
import { censorProfanity } from '../lib/profanityFilter';

const router = Router();
const PUBLIC_COMMENT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const PUBLIC_COMMENT_RATE_LIMIT_MAX = 5;
const publicCommentRateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

const publicCommentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 4,
  },
});

const getPublicCommentRateLimitKey = (req: Request) => {
  const projectId = String(req.params.id || 'unknown');
  return `${req.ip || req.socket.remoteAddress || 'unknown'}:${projectId}`;
};

const prunePublicCommentRateLimitBuckets = (now: number) => {
  for (const [key, bucket] of publicCommentRateLimitBuckets) {
    if (bucket.resetAt <= now) {
      publicCommentRateLimitBuckets.delete(key);
    }
  }
};

const publicCommentRateLimit = (req: Request, res: Response, next: NextFunction) => {
  const now = Date.now();
  prunePublicCommentRateLimitBuckets(now);

  const key = getPublicCommentRateLimitKey(req);
  const currentBucket = publicCommentRateLimitBuckets.get(key);
  const bucket = currentBucket && currentBucket.resetAt > now
    ? currentBucket
    : { count: 0, resetAt: now + PUBLIC_COMMENT_RATE_LIMIT_WINDOW_MS };

  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  res.setHeader('RateLimit-Limit', String(PUBLIC_COMMENT_RATE_LIMIT_MAX));
  res.setHeader('RateLimit-Remaining', String(Math.max(0, PUBLIC_COMMENT_RATE_LIMIT_MAX - bucket.count)));
  res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

  if (bucket.count >= PUBLIC_COMMENT_RATE_LIMIT_MAX) {
    res.setHeader('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      error: `Too many public comments. Please wait ${retryAfterSeconds} seconds before posting again.`,
    });
  }

  bucket.count += 1;
  publicCommentRateLimitBuckets.set(key, bucket);
  res.setHeader('RateLimit-Remaining', String(Math.max(0, PUBLIC_COMMENT_RATE_LIMIT_MAX - bucket.count)));

  next();
};

const normalizeRole = (role: string) => role.trim().toLowerCase();
const isMpdcRole = (role: string) => {
  const normalized = normalizeRole(role);
  return normalized === 'mpdc (planning)' || normalized === 'mpdc';
};

const normalizeProjectMilestones = (milestones: any) => {
  if (!Array.isArray(milestones)) return [];

  return milestones
    .map((milestone) => ({
      title: typeof milestone?.title === 'string' ? milestone.title.trim() : '',
      description: typeof milestone?.description === 'string' ? milestone.description.trim() : '',
      percentage: Number(milestone?.percentage || 0),
      due_date: typeof milestone?.dueDate === 'string'
        ? milestone.dueDate
        : typeof milestone?.due_date === 'string'
          ? milestone.due_date
          : null,
      deliverables: Array.isArray(milestone?.deliverables)
        ? milestone.deliverables
          .map((deliverable: unknown) => String(deliverable || '').trim())
          .filter(Boolean)
        : typeof milestone?.deliverables === 'string'
          ? milestone.deliverables
            .split(/\r?\n|,/)
            .map((deliverable: string) => deliverable.trim())
            .filter(Boolean)
          : [],
    }))
    .filter((milestone) => milestone.title);
};

const validateProjectMilestones = (milestones: ReturnType<typeof normalizeProjectMilestones>) => {
  if (milestones.length === 0) {
    return 'At least one milestone is required before a project can be created.';
  }

  let totalPercentage = 0;
  for (const milestone of milestones) {
    if (!Array.isArray(milestone.deliverables) || milestone.deliverables.length === 0) {
      milestone.deliverables = [milestone.title || 'Milestone deliverables and completion verification'];
    }

    if (!Number.isFinite(milestone.percentage) || milestone.percentage <= 0 || milestone.percentage > 100) {
      return 'Milestone percentages must be between 1 and 100.';
    }

    totalPercentage += milestone.percentage;
  }

  if (Math.abs(totalPercentage - 100) > 0.01) {
    return 'Milestone percentages must total exactly 100%.';
  }

  return null;
};

const normalizeNumber = (value: unknown) => {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const normalizePublicDisplayName = (value: unknown) => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return 'Anonymous';
  return censorProfanity(trimmed).slice(0, 60);
};

const normalizePublicCommentContent = (value: unknown) => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return censorProfanity(trimmed).slice(0, 2000);
};

const isMissingRelationError = (error: any) => {
  const code = typeof error?.code === 'string' ? error.code : '';
  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';

  return code === '42P01' || message.includes('relation') && message.includes('does not exist');
};

const fetchProjectComments = async (projectId: string) => {
  const [{ data: comments, error: commentsError }, { data: photos, error: photosError }] = await Promise.all([
    supabase
      .from('project_comments')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),
    supabase
      .from('project_comment_photos')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true }),
  ]);

  if (commentsError) {
    if (isMissingRelationError(commentsError)) {
      logger.warn('Project comments table is unavailable; returning empty comments list.', { projectId, error: commentsError });
      return [];
    }
    throw commentsError;
  }

  if (photosError) {
    if (isMissingRelationError(photosError)) {
      logger.warn('Project comment photos table is unavailable; returning empty comments list.', { projectId, error: photosError });
      return [];
    }
    throw photosError;
  }

  const photosByComment = new Map<string, any[]>();
  for (const photo of photos || []) {
    const current = photosByComment.get(photo.comment_id) || [];
    current.push(photo);
    photosByComment.set(photo.comment_id, current);
  }

  return (comments || []).map((comment) => ({
    ...comment,
    display_name: censorProfanity(comment.display_name || 'Anonymous'),
    content: censorProfanity(comment.content || ''),
    photos: photosByComment.get(comment.id) || [],
  }));
};

const deriveTransparencyStages = (project: any, transactions: any[], milestones: any[]) => {
  const allocationTransaction = transactions.find((transaction) => {
    const type = String(transaction.type || '').toLowerCase();
    return type === 'allocation (saro)' || type === 'allocation';
  }) || null;

  const disbursementTransactions = transactions.filter((transaction) => {
    const type = String(transaction.type || '').toLowerCase();
    return type === 'disbursement (nca)' || type === 'disbursement';
  });

  const verifiedMilestones = milestones.filter((milestone) => milestone.status === 'Verified' || milestone.status === 'Paid').length;
  const paidMilestones = milestones.filter((milestone) => milestone.status === 'Paid').length;

  return [
    {
      phase: 'PHASE 1',
      title: 'MPDC Creates Approved Project',
      status: 'Completed',
      statusLabel: 'MPDC Approved',
      actorRole: 'MPDC (Planning)',
      actorWallet: project.blockchain_created_by_wallet || null,
      timestamp: project.created_at || null,
      notes: 'Project was created directly as an approved municipal project.',
    },
    {
      phase: 'GATE 1',
      title: 'Budget Officer Allocation (SARO)',
      status:
        project.status === 'Rejected - Budget Officer'
          ? 'Rejected'
          : allocationTransaction
            ? 'Completed'
            : 'Pending',
      statusLabel:
        project.status === 'Rejected - Budget Officer'
          ? 'Rejected - Budget Officer'
          : allocationTransaction
            ? 'SARO Approved - Pending Treasurer'
            : 'Pending Budget Officer Review',
      actorRole: 'Budget Officer',
      actorWallet: project.budget_officer_wallet || null,
      timestamp: project.budget_officer_signed_at || null,
      reference: project.saro || allocationTransaction?.saro || null,
      amount: allocationTransaction ? normalizeNumber(allocationTransaction.amount) : normalizeNumber(project.allocated_funds),
      notes:
        project.status === 'Rejected - Budget Officer'
          ? project.rejection_reason || 'Budget Officer rejected this project.'
          : allocationTransaction
            ? 'SARO created and first signature recorded.'
            : 'Awaiting SARO allocation review.',
    },
    {
      phase: 'GATE 2',
      title: 'Treasurer Approval & Execution',
      status:
        project.status === 'Rejected - Treasurer'
          ? 'Rejected'
          : ['ACTIVE', 'In Progress', 'Completed'].includes(project.status)
            ? 'Completed'
            : project.status === 'SARO Approved - Pending Treasurer'
              ? 'Pending'
              : 'Locked',
      statusLabel:
        project.status === 'Rejected - Treasurer'
          ? 'Rejected - Treasurer'
          : ['ACTIVE', 'In Progress', 'Completed'].includes(project.status)
            ? 'ACTIVE'
            : project.status === 'SARO Approved - Pending Treasurer'
              ? 'Pending Treasurer Sign-off'
              : 'Locked Until Gate 1',
      actorRole: 'Treasurer',
      actorWallet: project.treasurer_wallet || null,
      timestamp: project.treasurer_signed_at || project.activated_at || null,
      reference: project.treasury_seal_hash || null,
      amount: normalizeNumber(project.allocated_funds),
      notes:
        project.status === 'Rejected - Treasurer'
          ? project.rejection_reason || 'Treasurer rejected this project.'
          : ['ACTIVE', 'In Progress', 'Completed'].includes(project.status)
            ? 'Treasury activation complete. Digital seal of truth issued.'
            : project.status === 'SARO Approved - Pending Treasurer'
              ? 'Awaiting Treasurer review and execution.'
              : 'Treasurer action is not available yet.',
    },
    {
      phase: 'PHASE 2',
      title: 'Project Execution',
      status:
        project.status === 'Completed'
          ? 'Completed'
          : project.status === 'In Progress'
            ? 'In Progress'
            : project.status === 'ACTIVE'
              ? 'Ready'
              : 'Locked',
      statusLabel:
        project.status === 'Completed'
          ? 'Completed'
          : project.status === 'In Progress'
            ? 'In Progress'
            : project.status === 'ACTIVE'
              ? 'ACTIVE'
              : 'Locked Until Both Gates Pass',
      actorRole: 'MPDC / Treasurer / Public',
      actorWallet: null,
      timestamp: project.activated_at || null,
      reference: project.latest_disbursement_ref || null,
      amount: normalizeNumber(project.disbursed_funds),
      notes:
        project.status === 'Completed'
          ? `All milestones and disbursements are complete. Paid milestones: ${paidMilestones}/${milestones.length}.`
          : project.status === 'In Progress'
            ? `Execution is live. Verified milestones: ${verifiedMilestones}/${milestones.length}.`
            : project.status === 'ACTIVE'
              ? 'Execution is unlocked and ready for milestone evidence, verification, and disbursement requests.'
              : 'Execution remains locked until Budget Officer and Treasurer approvals are complete.',
    },
  ];
};

const buildProjectTransparencySummary = async (project: any) => {
  const projectWithEvidence = await attachProjectEvidence(project);
  const milestones = projectWithEvidence.milestones || [];
  const transactions = projectWithEvidence.transactions || [];
  const publicDocuments = (projectWithEvidence.documents || []).filter((document: any) => !document.milestone_id && !document.milestoneId);

  return {
    projectId: project.id,
    name: project.name,
    status: project.status,
    metadataHash: project.metadata_hash || null,
    createdByWallet: project.blockchain_created_by_wallet || null,
    budgetOfficerWallet: project.budget_officer_wallet || null,
    treasurerWallet: project.treasurer_wallet || null,
    treasurySealHash: project.treasury_seal_hash || null,
    saroRef: project.saro || null,
    latestDisbursementRef: project.latest_disbursement_ref || null,
    rejectionReason: project.rejection_reason || null,
    createdAt: project.created_at || null,
    activatedAt: project.activated_at || null,
    totalBudget: normalizeNumber(project.total_budget),
    allocatedFunds: normalizeNumber(project.allocated_funds),
    disbursedFunds: normalizeNumber(project.disbursed_funds),
    milestoneCount: milestones.length,
    verifiedMilestoneCount: milestones.filter((milestone: any) => milestone.status === 'Verified' || milestone.status === 'Paid').length,
    paidMilestoneCount: milestones.filter((milestone: any) => milestone.status === 'Paid').length,
    transactionCount: transactions.length,
    publicDocumentCount: publicDocuments.length,
    stages: deriveTransparencyStages(project, transactions, milestones),
  };
};

const csvEscape = (value: unknown) => {
  const stringValue = String(value ?? '');
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const buildProjectTransparencyCsv = async (project: any) => {
  const projectWithEvidence = await attachProjectEvidence(project);
  const summary = await buildProjectTransparencySummary(project);
  const rows: string[] = [];

  rows.push('section,key,value');
  rows.push(`project,project_id,${csvEscape(project.id)}`);
  rows.push(`project,name,${csvEscape(project.name)}`);
  rows.push(`project,status,${csvEscape(project.status)}`);
  rows.push(`project,location,${csvEscape(project.location)}`);
  rows.push(`project,category,${csvEscape(project.category)}`);
  rows.push(`project,budget_source,${csvEscape(project.budget_source)}`);
  rows.push(`project,location_photos,${csvEscape(Array.isArray(project.location_photos) ? project.location_photos.join(';') : '')}`);
  rows.push(`project,total_budget,${csvEscape(summary.totalBudget)}`);
  rows.push(`project,allocated_funds,${csvEscape(summary.allocatedFunds)}`);
  rows.push(`project,disbursed_funds,${csvEscape(summary.disbursedFunds)}`);
  rows.push(`project,metadata_hash,${csvEscape(summary.metadataHash)}`);
  rows.push(`project,created_by_wallet,${csvEscape(summary.createdByWallet)}`);
  rows.push(`project,budget_officer_wallet,${csvEscape(summary.budgetOfficerWallet)}`);
  rows.push(`project,treasurer_wallet,${csvEscape(summary.treasurerWallet)}`);
  rows.push(`project,saro_ref,${csvEscape(summary.saroRef)}`);
  rows.push(`project,treasury_seal_hash,${csvEscape(summary.treasurySealHash)}`);
  rows.push(`project,rejection_reason,${csvEscape(summary.rejectionReason)}`);

  rows.push('');
  rows.push('stage,phase,title,status,status_label,actor_role,actor_wallet,timestamp,reference,amount,notes');
  for (const stage of summary.stages) {
    rows.push([
      'stage',
      stage.phase,
      stage.title,
      stage.status,
      stage.statusLabel,
      stage.actorRole,
      stage.actorWallet || '',
      stage.timestamp || '',
      stage.reference || '',
      stage.amount ?? '',
      stage.notes || '',
    ].map(csvEscape).join(','));
  }

  rows.push('');
  rows.push('milestone,id,title,status,percentage,due_date,verified_by,verified_at,evidence_hash,report_hash');
  for (const milestone of projectWithEvidence.milestones || []) {
    rows.push([
      'milestone',
      milestone.id,
      milestone.title,
      milestone.status,
      milestone.percentage,
      milestone.due_date || milestone.dueDate || '',
      milestone.verified_by || milestone.verifiedBy || '',
      milestone.date_verified || milestone.dateVerified || '',
      milestone.evidence_hash || milestone.evidenceHash || '',
      milestone.report_hash || milestone.reportHash || '',
    ].map(csvEscape).join(','));
  }

  rows.push('');
  rows.push('transaction,id,type,status,amount,date,recorded_by_role,saro,hash,rejection_reason');
  for (const transaction of projectWithEvidence.transactions || []) {
    rows.push([
      'transaction',
      transaction.id,
      transaction.type,
      transaction.status,
      transaction.amount,
      transaction.date,
      transaction.recorded_by_role || transaction.recordedByRole || '',
      transaction.saro || '',
      transaction.hash || '',
      transaction.rejection_reason || '',
    ].map(csvEscape).join(','));
  }

  return rows.join('\n');
};

const attachProjectEvidence = async (project: any) => {
  const [{ data: milestones }, { data: documents }, { data: milestonePhotos }, { data: transactions }, comments] = await Promise.all([
    supabase
      .from('milestones')
      .select('*')
      .eq('project_id', project.id)
      .order('due_date', { ascending: true }),
    supabase
      .from('documents')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('milestone_photos')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('transactions')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false }),
    fetchProjectComments(project.id),
  ]);

  const photosByMilestone = new Map<string, any[]>();
  for (const photo of milestonePhotos || []) {
    const current = photosByMilestone.get(photo.milestone_id) || [];
    current.push(photo);
    photosByMilestone.set(photo.milestone_id, current);
  }

  return {
    ...project,
    milestones: (milestones || []).map((milestone) => ({
      ...milestone,
      photos: photosByMilestone.get(milestone.id) || [],
    })),
    documents: documents || [],
    transactions: transactions || [],
    comments,
  };
};

interface ProjectsCacheEntry {
  data: any;
  expiresAt: number;
}

const projectsListCache = new Map<string, ProjectsCacheEntry>();
const PROJECTS_CACHE_TTL_MS = 15 * 1000; // 15-second cache for public project listings

export const clearProjectsCache = () => {
  projectsListCache.clear();
};

const attachProjectsEvidenceBatch = async (projects: any[]) => {
  if (!projects || projects.length === 0) {
    return [];
  }

  const projectIds = projects.map((p) => p.id);

  const [
    { data: milestones, error: milestonesError },
    { data: documents, error: documentsError },
    { data: transactions, error: transactionsError },
    { data: milestonePhotos, error: photosError },
  ] = await Promise.all([
    supabase
      .from('milestones')
      .select('*')
      .in('project_id', projectIds)
      .order('due_date', { ascending: true }),
    supabase
      .from('documents')
      .select('*')
      .in('project_id', projectIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('transactions')
      .select('*')
      .in('project_id', projectIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('milestone_photos')
      .select('*')
      .in('project_id', projectIds)
      .order('created_at', { ascending: true }),
  ]);

  if (milestonesError) logger.warn('Batch fetch milestones warning:', milestonesError);
  if (documentsError) logger.warn('Batch fetch documents warning:', documentsError);
  if (transactionsError) logger.warn('Batch fetch transactions warning:', transactionsError);
  if (photosError) logger.warn('Batch fetch milestone photos warning:', photosError);

  const photosByMilestone = new Map<string, any[]>();
  for (const photo of milestonePhotos || []) {
    const current = photosByMilestone.get(photo.milestone_id) || [];
    current.push(photo);
    photosByMilestone.set(photo.milestone_id, current);
  }

  const milestonesByProject = new Map<string, any[]>();
  for (const milestone of milestones || []) {
    const current = milestonesByProject.get(milestone.project_id) || [];
    current.push({
      ...milestone,
      photos: photosByMilestone.get(milestone.id) || [],
    });
    milestonesByProject.set(milestone.project_id, current);
  }

  const documentsByProject = new Map<string, any[]>();
  for (const document of documents || []) {
    const current = documentsByProject.get(document.project_id) || [];
    current.push(document);
    documentsByProject.set(document.project_id, current);
  }

  const transactionsByProject = new Map<string, any[]>();
  for (const transaction of transactions || []) {
    const current = transactionsByProject.get(transaction.project_id) || [];
    current.push(transaction);
    transactionsByProject.set(transaction.project_id, current);
  }

  return projects.map((project) => ({
    ...project,
    milestones: milestonesByProject.get(project.id) || [],
    documents: documentsByProject.get(project.id) || [],
    transactions: transactionsByProject.get(project.id) || [],
    comments: [],
  }));
};

router.get('/:id/comments', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '');

    if (!id) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    const { data: project, error } = await supabase
      .from('projects')
      .select('id')
      .eq('id', id)
      .single();

    if (error || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const comments = await fetchProjectComments(id);
    res.json({ comments });
  } catch (error) {
    logger.error('Fetch project comments error:', error);
    res.status(500).json({ error: 'Failed to fetch project comments' });
  }
});

router.post('/:id/comments', publicCommentRateLimit, publicCommentUpload.array('photos', 4), async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '');
    const displayName = normalizePublicDisplayName(req.body.displayName);
    const content = normalizePublicCommentContent(req.body.content);
    const files = Array.isArray(req.files) ? req.files : [];

    if (!id) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    if (!content) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const { data: project, error } = await supabase
      .from('projects')
      .select('id')
      .eq('id', id)
      .single();

    if (error || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { data: comment, error: commentError } = await supabase
      .from('project_comments')
      .insert({
        project_id: id,
        display_name: displayName,
        content,
      })
      .select('*')
      .single();

    if (commentError || !comment) {
      logger.error('Create public comment database error:', commentError);
      return res.status(500).json({ error: 'Failed to save public comment' });
    }

    const photoRows: Record<string, unknown>[] = [];
    for (const file of files) {
      const storedFile = await uploadFileBuffer(
        file.buffer,
        file.originalname,
        file.mimetype,
        'project-comments'
      );

      photoRows.push({
        comment_id: comment.id,
        project_id: id,
        url: storedFile.url,
        storage_provider: storedFile.provider,
        storage_path: storedFile.path || null,
        cloudinary_id: storedFile.cloudinaryId || null,
        mime_type: storedFile.mimeType,
        size: storedFile.size,
        file_name: storedFile.originalName,
        photo_hash: crypto.createHash('sha256').update(file.buffer).digest('hex'),
      });
    }

    if (photoRows.length > 0) {
      const { error: photoError } = await supabase
        .from('project_comment_photos')
        .insert(photoRows);

      if (photoError) {
        logger.error('Create public comment photos database error:', photoError);
        return res.status(500).json({ error: 'Comment was saved but photo attachments failed to save' });
      }
    }

    await supabase.from('audit_logs').insert({
      action: 'PUBLIC_COMMENT_CREATED',
      resource_type: 'project',
      resource_id: id,
      details: {
        displayName,
        hasPhotos: photoRows.length > 0,
        photoCount: photoRows.length,
        preview: content.slice(0, 120),
      },
    });

    const comments = await fetchProjectComments(id);
    const createdComment = comments.find((entry) => entry.id === comment.id) || { ...comment, photos: [] };
    res.status(201).json({ comment: createdComment });
  } catch (error) {
    logger.error('Create public comment error:', error);
    res.status(500).json({ error: 'Failed to create public comment' });
  }
});

// Get all projects with optional filtering
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, category, location, page = '1', limit = '20' } = req.query;

    const cacheKey = JSON.stringify({ status, category, location, page, limit });
    const cached = projectsListCache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return res.json(cached.data);
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .from('projects')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (category) {
      query = query.eq('category', category);
    }
    if (location) {
      query = query.ilike('location', `%${location}%`);
    }

    const { data: projects, error, count } = await query;

    if (error) {
      logger.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to fetch projects' });
    }

    // Get milestones and documents for all projects in a single batched operation
    const projectsWithDetails = await attachProjectsEvidenceBatch(projects || []);

    const responsePayload = {
      projects: projectsWithDetails,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count,
        pages: Math.ceil((count || 0) / limitNum),
      },
    };

    projectsListCache.set(cacheKey, {
      data: responsePayload,
      expiresAt: now + PROJECTS_CACHE_TTL_MS,
    });

    res.json(responsePayload);
  } catch (error) {
    logger.error('Fetch projects error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get project by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const projectWithEvidence = await attachProjectEvidence(project);

    res.json({
      project: projectWithEvidence,
    });
  } catch (error) {
    logger.error('Fetch project error:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

router.get('/:id/transparency-summary', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const summary = await buildProjectTransparencySummary(project);
    res.json({ summary });
  } catch (error) {
    logger.error('Fetch transparency summary error:', error);
    res.status(500).json({ error: 'Failed to fetch transparency summary' });
  }
});

router.get('/:id/export.csv', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const csv = await buildProjectTransparencyCsv(project);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${project.id}-transparency-report.csv"`);
    res.status(200).send(csv);
  } catch (error) {
    logger.error('Export transparency CSV error:', error);
    res.status(500).json({ error: 'Failed to export transparency CSV' });
  }
});

// Create project
router.post('/', authenticateToken, requireRole(['official', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !isMpdcRole(req.user.role)) {
      return res.status(403).json({ error: 'Only MPDC can create approved projects directly' });
    }

    const {
      id,
      name,
      description,
      location,
      category,
      totalBudget,
      budgetSource,
      locationPhotos = [],
      startDate,
      endDate,
      stakeholders,
      metadataHash,
      blockchainTxHash,
      createdByWallet,
      milestones = [],
    } = req.body;

    const normalizedCategory = typeof category === 'string' ? category.trim() : '';
    const normalizedBudgetSource = typeof budgetSource === 'string' ? budgetSource.trim() : '';

    const parsedTotalBudget = normalizeNumber(totalBudget);
    if (!name || parsedTotalBudget <= 0) {
      return res.status(400).json({ error: 'Name and total budget are required' });
    }

    if (!normalizedCategory || !isValidProjectCategory(normalizedCategory)) {
      logger.error('Invalid project category:', {
        category,
        categoryType: typeof category,
        categoryString: String(category),
        normalizedCategory,
        isValid: isValidProjectCategory(normalizedCategory),
      });
      return res.status(400).json({ error: 'A valid project category is required' });
    }

    if (typeof budgetSource !== 'undefined' && typeof budgetSource !== 'string') {
      return res.status(400).json({ error: 'A valid budget source is required' });
    }

    const normalizedMilestones = normalizeProjectMilestones(milestones);
    const milestoneValidationError = validateProjectMilestones(normalizedMilestones);
    if (milestoneValidationError) {
      return res.status(400).json({ error: milestoneValidationError });
    }

    if (startDate && endDate && new Date(startDate).getTime() > new Date(endDate).getTime()) {
      return res.status(400).json({ error: 'Start date cannot be later than end date' });
    }

    const normalizedStakeholders = Array.isArray(stakeholders)
      ? stakeholders.map((stakeholder) => String(stakeholder || '').trim()).filter(Boolean)
      : typeof stakeholders === 'string'
        ? stakeholders
          .split(/\r?\n|,/)
          .map((stakeholder: string) => stakeholder.trim())
          .filter(Boolean)
        : [];

    // Generate metadata hash from project data
    const metadataString = JSON.stringify({
      name,
      description,
      location,
      category: normalizedCategory,
      totalBudget: parsedTotalBudget,
      budgetSource: normalizedBudgetSource || null,
      locationPhotos,
      startDate,
      endDate,
      stakeholders: normalizedStakeholders,
      milestones: normalizedMilestones,
    });
    const resolvedMetadataHash = metadataHash || Buffer.from(metadataString).toString('base64');

    const { data, error } = await supabase
      .from('projects')
      .insert({
        id: id || `proj-${Date.now()}`,
        name,
        description,
        location,
        category: normalizedCategory,
        total_budget: parsedTotalBudget,
        allocated_funds: 0,
        disbursed_funds: 0,
        budget_source: normalizedBudgetSource || null,
        location_photos: Array.isArray(locationPhotos) && locationPhotos.length > 0 ? locationPhotos : [],
        start_date: startDate,
        end_date: endDate,
        status: 'MPDC Approved',
        stakeholders: normalizedStakeholders,
        metadata_hash: resolvedMetadataHash,
        blockchain_created_by_wallet: createdByWallet ? String(createdByWallet).toLowerCase() : req.user.walletAddress || null,
        blockchain_tx_hash: blockchainTxHash || null,
        onchain_synced_at: blockchainTxHash ? new Date().toISOString() : null,
        created_by: req.user!.id,
      })
      .select()
      .single();

    if (error) {
      logger.error('Database error creating project:', {
        error,
        projectData: {
          name,
          category: normalizedCategory,
          budgetSource: normalizedBudgetSource || null,
          locationPhotosCount: Array.isArray(locationPhotos) ? locationPhotos.length : 0,
        },
      });
      return res.status(500).json({ error: 'Failed to create project', details: error.message });
    }

    const milestoneRows = normalizedMilestones.map((milestone, index) => ({
      id: `m-${data.id}-${index + 1}`,
      project_id: data.id,
      title: milestone.title,
      description: milestone.description || null,
      due_date: milestone.due_date,
      deliverables: milestone.deliverables,
      percentage: Math.round(Number(milestone.percentage || 0)),
      budget: Math.round(Number((parsedTotalBudget * (milestone.percentage || 0)) / 100)),
      status: 'Pending',
      created_by: req.user!.id,
    }));

    const { error: milestoneInsertError } = await supabase
      .from('milestones')
      .insert(milestoneRows);

    if (milestoneInsertError) {
      logger.error('Milestone insert error during project create:', milestoneInsertError);
      await supabase.from('projects').delete().eq('id', data.id);
      return res.status(500).json({ error: 'Project creation failed while saving milestones' });
    }

    // Log audit event
    await supabase.from('audit_logs').insert({
      user_id: req.user!.id,
      action: 'PROJECT_CREATED_DIRECT_APPROVAL',
      resource_type: 'project',
      resource_id: data.id,
      details: {
        name,
        category: normalizedCategory,
        totalBudget: parsedTotalBudget,
        milestoneCount: milestoneRows.length,
        status: 'MPDC Approved',
        blockchainTxHash: blockchainTxHash || null,
      },
      tx_hash: blockchainTxHash || null,
    });

    clearProjectsCache();
    res.status(201).json({ project: data });
  } catch (error) {
    logger.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Update project
router.put('/:id', authenticateToken, requireRole(['official', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const projectId = String(req.params.id || '');
    const updates = req.body;

    const { data, error } = await supabase
      .from('projects')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId)
      .select()
      .single();

    if (error) {
      logger.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to update project' });
    }

    // Log audit event
    await supabase.from('audit_logs').insert({
      user_id: req.user!.id,
      action: 'PROJECT_UPDATED',
      resource_type: 'project',
      resource_id: projectId,
      details: updates,
      tx_hash: null,
    });

    clearProjectsCache();
    res.json({ project: data });
  } catch (error) {
    logger.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

router.post('/:id/resolve-breach', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const projectId = String(req.params.id || '');
    const blockchainBudget = Number(req.body?.blockchainBudget);
    const tamperedBudget = Number(req.body?.tamperedBudget);
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    if (!Number.isFinite(blockchainBudget) || blockchainBudget < 0) {
      return res.status(400).json({ error: 'A valid blockchainBudget is required' });
    }

    const { data: currentProject, error: currentProjectError } = await supabase
      .from('projects')
      .select('id, total_budget')
      .eq('id', projectId)
      .single();

    if (currentProjectError || !currentProject) {
      logger.error('Resolve breach project lookup error:', currentProjectError);
      return res.status(404).json({ error: 'Project not found' });
    }

    const previousBudget = Number(currentProject.total_budget || 0);

    const { data, error } = await supabase
      .from('projects')
      .update({
        total_budget: blockchainBudget,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId)
      .select()
      .single();

    if (error) {
      logger.error('Resolve breach update error:', error);
      return res.status(500).json({ error: 'Failed to resolve breached project budget' });
    }

    await supabase.from('audit_logs').insert({
      user_id: req.user!.id,
      action: 'PROJECT_BREACH_RESOLVED',
      resource_type: 'project',
      resource_id: projectId,
      details: {
        projectId,
        previousBudget,
        tamperedBudget: Number.isFinite(tamperedBudget) ? tamperedBudget : previousBudget,
        blockchainBudget,
        notes: notes || 'Admin forced database reconciliation using blockchain ledger as source of truth.',
        resolution: 'Database budget overwritten with immutable blockchain budget.',
      },
      tx_hash: null,
    });

    await supabase
      .from('system_alerts')
      .update({
        status: 'Resolved',
        resolved_at: new Date().toISOString(),
      })
      .eq('project_id', projectId)
      .eq('status', 'Unresolved');

    clearProjectsCache();
    res.json({ project: data });
  } catch (error) {
    logger.error('Resolve breached project error:', error);
    res.status(500).json({ error: 'Failed to resolve breached project budget' });
  }
});

// Update project status
router.patch('/:id/status', authenticateToken, requireRole(['official', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const { data, error } = await supabase
      .from('projects')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to update project status' });
    }

    // Log audit event
    await supabase.from('audit_logs').insert({
      user_id: req.user!.id,
      action: 'PROJECT_STATUS_UPDATED',
      resource_type: 'project',
      resource_id: id,
      details: { status, notes },
      tx_hash: null,
    });

    clearProjectsCache();
    res.json({ project: data });
  } catch (error) {
    logger.error('Update project status error:', error);
    res.status(500).json({ error: 'Failed to update project status' });
  }
});

// Delete project
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to delete project' });
    }

    // Log audit event
    await supabase.from('audit_logs').insert({
      user_id: req.user!.id,
      action: 'PROJECT_DELETED',
      resource_type: 'project',
      resource_id: id,
      tx_hash: null,
    });

    clearProjectsCache();
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    logger.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

export default router;
