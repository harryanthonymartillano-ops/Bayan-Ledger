import { Router, Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { supabase } from '../db/config';
import { logger } from '../logger';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';
import { uploadFileBuffer } from '../services/fileUpload';
import { createNotification, notifyUsers } from './notifications';
import { generateMilestoneVerificationHash } from '../lib/hashUtils';

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

// Get milestones for a project
router.get('/project/:projectId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;

    const { data, error } = await supabase
      .from('milestones')
      .select('*')
      .eq('project_id', projectId)
      .order('due_date', { ascending: true });

    if (error) {
      logger.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to fetch milestones' });
    }

    res.json({ milestones: data });
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
      .select()
      .single();

    if (error) {
      logger.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to create milestone' });
    }

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
      .select()
      .single();

    if (error) {
      logger.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to update milestone' });
    }

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

    // Update milestone status
    const { data: milestone, error: updateError } = await supabase
      .from('milestones')
      .update({
        status: 'Verified',
        date_verified: verificationTimestamp,
        verified_by: req.user!.id,
        verified_by_wallet: req.user!.walletAddress || null,
        verification_data: verificationData,
        photo_url: verificationData?.photoUrl || null,
        ipfs_hash: verificationData?.ipfsHash || verificationData?.ipfs_hash || null,
        evidence_hash: verificationData?.evidenceHash || null,
        report_hash: verificationData?.reportHash || null,
        evidence_photo_count: Number(verificationData?.photoCount || 0),
        evidence_report_count: Number(verificationData?.reportCount || 0),
        blockchain_tx_hash: milestoneVerificationHash,
        onchain_verified_at: verificationTimestamp,
      })
      .eq('id', id)
      .eq('status', 'Pending')
      .select()
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

    const storedFile = await uploadFileBuffer(
      uploadReq.file.buffer,
      uploadReq.file.originalname,
      uploadReq.file.mimetype,
      `projects/${projectId}/milestones/${id}`
    );
    const photoHash = crypto.createHash('sha256').update(uploadReq.file.buffer).digest('hex');

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
      .select()
      .single();

    if (error) {
      logger.error('Milestone photo upload database error:', error);
      return res.status(500).json({ error: 'Failed to save milestone photo' });
    }

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

    const { error } = await supabase
      .from('milestones')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to delete milestone' });
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
