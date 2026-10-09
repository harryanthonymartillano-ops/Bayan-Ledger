import { Router, Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { supabase } from '../db/config';
import { logger } from '../logger';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';
import { uploadFileBuffer } from '../services/fileUpload';
import { createNotification, notifyUsers } from './notifications';
import { generateMilestoneVerificationHash } from '../lib/hashUtils';
import { clearProjectsCache } from './projects';

const router = Router();
const normalizeRole = (role: string) => role.trim().toLowerCase();
const isMpdcRole = (role: string) => {
  const normalized = normalizeRole(role);
  return normalized === 'mpdc (planning)' || normalized === 'mpdc';
};
const isOperationalProjectStatus = (status: string | null | undefined) => status === 'ACTIVE' || status === 'In Progress';
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
      return;
    }
    cb(new Error('Invalid photo type'));
  },
});

const MILESTONE_COLUMNS = 'id, project_id, title, description, percentage, status, budget, deliverables, due_date, date_verified, verified_by, verified_by_wallet, photo_url, ipfs_hash, evidence_hash, report_hash, evidence_photo_count, evidence_report_count, verification_data, onchain_verified_at, onchain_paid, blockchain_tx_hash, created_at';

// Get milestones for a project
router.get('/project/:projectId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;

    const { data, error } = await supabase
      .from('milestones')
      .select(MILESTONE_COLUMNS)
      .eq('project_id', projectId)
      .order('due_date', { ascending: true });

    if (error) {
      logger.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to fetch milestones' });
    }

    res.json({ milestones: data || [] });
  } catch (error) {
    logger.error('Fetch milestones error:', error);
    res.status(500).json({ error: 'Failed to fetch milestones' });
  }
});

// Create milestone
router.post('/', authenticateToken, requireRole(['official', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { id, projectId, name, title, description, dueDate, budget, deliverables, percentage } = req.body;

    if (!projectId || !(name || title) || percentage === undefined) {
      return res.status(400).json({ error: 'Project ID, title, and percentage are required' });
    }

    const { data, error } = await supabase
      .from('milestones')
      .insert({
        id: id || `m-${Date.now()}`,
        project_id: projectId,
        title: title || name,
        description,
        due_date: dueDate,
        budget: budget || 0,
        deliverables: deliverables || [],
        percentage,
        status: 'Pending',
        created_by: req.user!.id,
      })
      .select(MILESTONE_COLUMNS)
      .single();

    if (error) {
      logger.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to create milestone' });
    }

    clearProjectsCache(projectId);

    // Log audit event
    await supabase.from('audit_logs').insert({
      user_id: req.user!.id,
      action: 'MILESTONE_CREATED',
      resource_type: 'milestone',
      resource_id: data.id,
      details: { projectId, title: title || name, percentage },
      tx_hash: null,
    });

    res.status(201).json({ milestone: data });
  } catch (error) {
    logger.error('Create milestone error:', error);
    res.status(500).json({ error: 'Failed to create milestone' });
  }
});

// Update milestone
router.put('/:id', authenticateToken, requireRole(['official', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabase
      .from('milestones')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(MILESTONE_COLUMNS)
      .single();

    if (error) {
      logger.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to update milestone' });
    }

    clearProjectsCache(data.project_id);

    // Log audit event
    await supabase.from('audit_logs').insert({
      user_id: req.user!.id,
      action: 'MILESTONE_UPDATED',
      resource_type: 'milestone',
      resource_id: id,
      details: updates,
      tx_hash: null,
    });

    res.json({ milestone: data });
  } catch (error) {
    logger.error('Update milestone error:', error);
    res.status(500).json({ error: 'Failed to update milestone' });
  }
});

// Verify milestone (blockchain integration)
router.post('/:id/verify', authenticateToken, requireRole(['official', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !isMpdcRole(req.user.role)) {
      return res.status(403).json({ error: 'Only MPDC can verify milestones' });
    }

    const { id } = req.params;
    const { verificationData, transactionHash } = req.body;

    const { data: existingMilestone, error: milestoneLookupError } = await supabase
      .from('milestones')
      .select('id, project_id, title, status')
      .eq('id', id)
      .single();

    if (milestoneLookupError || !existingMilestone) {
      logger.error('Milestone lookup error during verification:', milestoneLookupError);
      return res.status(404).json({ error: 'Milestone not found' });
    }

    if (existingMilestone.status !== 'Pending') {
      return res.status(400).json({ error: 'Only pending milestones can be verified' });
    }

    const { data: projectForStatus, error: projectStatusError } = await supabase
      .from('projects')
      .select('id, allocated_funds, status')
      .eq('id', existingMilestone.project_id)
      .single();

    if (projectStatusError || !projectForStatus) {
      logger.error('Project lookup error during milestone verify:', projectStatusError);
      return res.status(500).json({ error: 'Failed to load project before milestone verification' });
    }

    if (!isOperationalProjectStatus(projectForStatus.status)) {
      return res.status(400).json({ error: 'Milestone verification is blocked until Treasurer activates the project' });
    }

    const verificationTimestamp = new Date().toISOString();

    // Generate milestone verification hash if not provided
    const milestoneVerificationHash = transactionHash || generateMilestoneVerificationHash(
      id as string,
      existingMilestone.project_id,
      req.user!.id,
      verificationTimestamp,
      verificationData?.evidenceHash
    );

    // Query existing photos and documents to prevent blob URLs and guarantee accurate evidence counts
    const { data: existingPhotos } = await supabase
      .from('milestone_photos')
      .select('id, milestone_id, project_id, photo_type, url, photo_hash, description, created_at')
      .eq('milestone_id', id)
      .order('created_at', { ascending: true });

    const seenPhotoKeys = new Set<string>();
    const photoList = (existingPhotos || []).filter((p) => {
      const key = p.photo_hash || p.url || p.id;
      if (!key || seenPhotoKeys.has(key)) return false;
      seenPhotoKeys.add(key);
      return true;
    });
    const photoCount = Math.max(photoList.length, Number(verificationData?.photoCount || 0));

    const { data: milestoneDocs } = await supabase
      .from('documents')
      .select('id, checksum_hash, url, title, size')
      .eq('milestone_id', id);

    const seenDocKeys = new Set<string>();
    const uniqueDocs = (milestoneDocs || []).filter((d) => {
      const key = d.checksum_hash || (d.title && d.size ? `${d.title}_${d.size}` : d.url || d.id);
      if (!key || seenDocKeys.has(key)) return false;
      seenDocKeys.add(key);
      return true;
    });

    const reportCount = Math.max(uniqueDocs.length, Number(verificationData?.reportCount || 0));

    let effectivePhotoUrl = verificationData?.photoUrl;
    if (!effectivePhotoUrl || typeof effectivePhotoUrl !== 'string' || effectivePhotoUrl.startsWith('blob:')) {
      effectivePhotoUrl = photoList[0]?.url || null;
    }

    const sanitizedVerificationData = {
      ...(verificationData || {}),
      photoUrl: effectivePhotoUrl,
      photos: photoList.length > 0 ? photoList : (verificationData?.photos || []),
      photoCount,
      reportCount,
    };

    // Update milestone status
    const { data: milestone, error: updateError } = await supabase
      .from('milestones')
      .update({
        status: 'Verified',
        date_verified: verificationTimestamp,
        verified_by: req.user!.id,
        verified_by_wallet: req.user!.walletAddress || null,
        verification_data: sanitizedVerificationData,
        photo_url: effectivePhotoUrl,
        ipfs_hash: verificationData?.ipfsHash || verificationData?.ipfs_hash || null,
        evidence_hash: verificationData?.evidenceHash || null,
        report_hash: verificationData?.reportHash || null,
        evidence_photo_count: photoCount,
        evidence_report_count: reportCount,
        blockchain_tx_hash: milestoneVerificationHash,
        onchain_verified_at: verificationTimestamp,
      })
      .eq('id', id)
      .eq('status', 'Pending')
      .select(MILESTONE_COLUMNS)
      .single();

    if (updateError) {
      logger.error('Database error:', updateError);
      return res.status(500).json({ error: 'Failed to verify milestone' });
    }

    const nextProjectStatus = isOperationalProjectStatus(projectForStatus.status) ? 'In Progress' : projectForStatus.status;
    const { error: projectUpdateError } = await supabase
      .from('projects')
      .update({
        status: nextProjectStatus,
        onchain_synced_at: verificationTimestamp,
        updated_at: verificationTimestamp,
      })
      .eq('id', milestone.project_id);

    if (projectUpdateError) {
      logger.error('Project status update error during milestone verify:', projectUpdateError);
      return res.status(500).json({ error: 'Milestone verified but project status failed to sync' });
    }

    clearProjectsCache(milestone.project_id);

    // Log audit event
    await supabase.from('audit_logs').insert({
      user_id: req.user!.id,
      action: 'MILESTONE_VERIFIED',
      resource_type: 'milestone',
      resource_id: id,
      details: { transactionHash: milestoneVerificationHash, verificationData },
      tx_hash: milestoneVerificationHash,
    });

    // Get project info for notification
    const { data: project } = await supabase
      .from('projects')
      .select('id, name, created_by')
      .eq('id', milestone.project_id)
      .single();

    // Notify the project creator about milestone verification
    if (project?.created_by) {
      await createNotification({
        userId: project.created_by,
        type: 'milestone',
        title: 'Milestone Verified',
        message: `Your milestone "${milestone.title}" has been verified and approved.`,
        link: `/official/milestones?projectId=${project.id}`,
        resourceType: 'milestone',
        resourceId: id,
      });
    }

    // Notify Treasurer about verified milestone (ready for payment)
    const { data: treasurers } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'Treasurer')
      .eq('status', 'Active');

    if (treasurers && treasurers.length > 0) {
      await notifyUsers({
        userIds: treasurers.map(t => t.id),
        type: 'payment',
        title: 'Milestone Ready for Payment',
        message: `Milestone "${milestone.title}" in project "${project?.name}" is verified and ready for disbursement.`,
        link: `/official/disbursement-pipeline?projectId=${project?.id}`,
        resourceType: 'milestone',
        resourceId: id,
      });
    }

    res.json({ milestone });
  } catch (error) {
    logger.error('Verify milestone error:', error);
    res.status(500).json({ error: 'Failed to verify milestone' });
  }
});

router.post('/:id/photos', authenticateToken, requireRole(['official', 'admin']), photoUpload.single('photo'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const uploadReq = req as AuthRequest & { file?: Express.Multer.File };
    if (!uploadReq.file) {
      return res.status(400).json({ error: 'No photo uploaded' });
    }

    const { projectId, photoType, description, capturedAt } = req.body;
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    const { data: milestone, error: milestoneLookupError } = await supabase
      .from('milestones')
      .select('id, project_id')
      .eq('id', id)
      .single();

    if (milestoneLookupError || !milestone) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    if (milestone.project_id !== projectId) {
      return res.status(400).json({ error: 'Milestone does not belong to the provided project' });
    }

    const photoHash = crypto.createHash('sha256').update(uploadReq.file.buffer).digest('hex');

    // Prevent duplicate photo upload for the same milestone
    const { data: existingPhoto } = await supabase
      .from('milestone_photos')
      .select('id, milestone_id, project_id, photo_type, url, photo_hash, description, created_at')
      .eq('milestone_id', id)
      .eq('photo_hash', photoHash)
      .limit(1)
      .maybeSingle();

    if (existingPhoto) {
      logger.info('Duplicate milestone photo detected by hash; reusing existing photo:', {
        milestoneId: id,
        photoHash,
        existingId: existingPhoto.id,
      });
      return res.json({ photo: existingPhoto });
    }

    const storedFile = await uploadFileBuffer(
      uploadReq.file.buffer,
      uploadReq.file.originalname,
      uploadReq.file.mimetype,
      `projects/${projectId}/milestones/${id}`
    );

    const { data, error } = await supabase
      .from('milestone_photos')
      .insert({
        milestone_id: id,
        project_id: projectId,
        photo_type: photoType || 'proof',
        url: storedFile.url,
        photo_hash: photoHash,
        description: description || null,
        uploaded_by: req.user!.id,
        uploaded_by_wallet: req.user!.walletAddress || null,
        captured_at: capturedAt || new Date().toISOString(),
      })
      .select('id, milestone_id, project_id, photo_type, url, photo_hash, description, created_at')
      .single();

    if (error) {
      logger.error('Milestone photo upload database error:', error);
      return res.status(500).json({ error: 'Failed to save milestone photo' });
    }

    // Update milestone evidence_photo_count and primary photo_url if missing or blob
    const { count: photoCount } = await supabase
      .from('milestone_photos')
      .select('id', { count: 'exact', head: true })
      .eq('milestone_id', id);

    const { data: currentMilestone } = await supabase
      .from('milestones')
      .select('photo_url')
      .eq('id', id)
      .single();

    const milestoneUpdates: Record<string, any> = {
      evidence_photo_count: photoCount || 1,
    };

    if (!currentMilestone?.photo_url || currentMilestone.photo_url.startsWith('blob:')) {
      milestoneUpdates.photo_url = storedFile.url;
    }

    await supabase
      .from('milestones')
      .update(milestoneUpdates)
      .eq('id', id);

    clearProjectsCache(projectId);

    await supabase.from('audit_logs').insert({
      user_id: req.user!.id,
      action: 'MILESTONE_PHOTO_UPLOADED',
      resource_type: 'milestone_photo',
      resource_id: String(data.id),
      details: { projectId, milestoneId: id, photoType: photoType || 'proof', photoHash },
      tx_hash: photoHash || null,
    });

    res.status(201).json({ photo: data });
  } catch (error) {
    logger.error('Milestone photo upload error:', error);
    res.status(500).json({ error: 'Failed to upload milestone photo' });
  }
});

// Delete milestone
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const { data: existing } = await supabase
      .from('milestones')
      .select('id, project_id')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('milestones')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to delete milestone' });
    }

    if (existing?.project_id) {
      clearProjectsCache(existing.project_id);
    } else {
      clearProjectsCache();
    }

    // Log audit event
    await supabase.from('audit_logs').insert({
      user_id: req.user!.id,
      action: 'MILESTONE_DELETED',
      resource_type: 'milestone',
      resource_id: id,
      tx_hash: null,
    });

    res.json({ message: 'Milestone deleted successfully' });
  } catch (error) {
    logger.error('Delete milestone error:', error);
    res.status(500).json({ error: 'Failed to delete milestone' });
  }
});

export default router;
