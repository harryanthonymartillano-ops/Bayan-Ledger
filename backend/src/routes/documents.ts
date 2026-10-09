import { Router, Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { supabase } from '../db/config';
import { logger } from '../logger';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';
import { deleteStoredFile, uploadFileBuffer } from '../services/fileUpload';
import { clearProjectsCache } from './projects';

const router = Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

// Extend AuthRequest to include file
interface AuthRequestWithFile extends AuthRequest {
  file?: Express.Multer.File;
}

const DOCUMENT_COLUMNS = 'id, project_id, milestone_id, title, name, type, url, storage_provider, file_format, size, verified, date_uploaded, created_at';

// Upload document
router.post('/upload', authenticateToken, requireRole(['official', 'admin']), upload.single('document'), async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequestWithFile;
    if (!authReq.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { projectId, milestoneId, documentType, description, ipfsHash } = req.body;

    if (!projectId || !documentType) {
      return res.status(400).json({ error: 'Project ID and document type are required' });
    }

    const checksumHash = crypto.createHash('sha256').update(authReq.file.buffer).digest('hex');

    // Prevent duplicate document uploads for the same project / milestone
    let existingQuery = supabase
      .from('documents')
      .select(DOCUMENT_COLUMNS)
      .eq('project_id', projectId)
      .eq('checksum_hash', checksumHash);

    if (milestoneId) {
      existingQuery = existingQuery.eq('milestone_id', milestoneId);
    }

    const { data: existingDoc } = await existingQuery.limit(1).maybeSingle();

    if (existingDoc) {
      logger.info('Duplicate document detected by checksum; reusing existing record:', {
        projectId,
        milestoneId,
        checksumHash,
        existingId: existingDoc.id,
      });
      return res.json({ document: existingDoc });
    }

    const storedFile = await uploadFileBuffer(
      authReq.file.buffer,
      authReq.file.originalname,
      authReq.file.mimetype,
      `projects/${projectId}`
    );
    const fileFormat = authReq.file.originalname.includes('.')
      ? authReq.file.originalname.split('.').pop()?.toUpperCase()
      : undefined;

    const { data, error: dbError } = await supabase
      .from('documents')
      .insert({
        id: `doc-${Date.now()}`,
        project_id: projectId,
        milestone_id: milestoneId || null,
        title: authReq.file.originalname,
        name: authReq.file.originalname,
        type: documentType,
        url: storedFile.url,
        storage_provider: storedFile.provider,
        storage_path: storedFile.path,
        ipfs_hash: ipfsHash || null,
        checksum_hash: checksumHash,
        cloudinary_id: storedFile.cloudinaryId,
        size: authReq.file.size,
        mime_type: authReq.file.mimetype,
        file_format: fileFormat || null,
        uploaded_by: authReq.user!.id,
        uploaded_by_wallet: authReq.user!.walletAddress,
        description,
      })
      .select(DOCUMENT_COLUMNS)
      .single();

    if (dbError) {
      logger.error('Database error:', dbError);
      return res.status(500).json({ error: 'Failed to save document metadata' });
    }

    if (milestoneId) {
      const { count: reportCount } = await supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('milestone_id', milestoneId);

      await supabase
        .from('milestones')
        .update({
          evidence_report_count: reportCount || 1,
        })
        .eq('id', milestoneId);
    }

    clearProjectsCache(projectId);

    await supabase.from('audit_logs').insert({
      user_id: authReq.user!.id,
      action: 'DOCUMENT_UPLOADED',
      resource_type: 'document',
      resource_id: data.id,
      details: { projectId, milestoneId: milestoneId || null, documentType, fileName: authReq.file.originalname, storageProvider: storedFile.provider, checksumHash },
      tx_hash: checksumHash || null,
    });

    res.json({ document: data });
  } catch (error) {
    logger.error('Document upload error:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// Get documents for a project
router.get('/project/:projectId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;

    const { data, error } = await supabase
      .from('documents')
      .select(DOCUMENT_COLUMNS)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to fetch documents' });
    }

    res.json({ documents: data || [] });
  } catch (error) {
    logger.error('Fetch documents error:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Delete document
router.delete('/:id', authenticateToken, requireRole(['official', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Get document info first
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('id, project_id, milestone_id, storage_provider, cloudinary_id, storage_path, url, name')
      .eq('id', id)
      .single();

    if (fetchError || !document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    await deleteStoredFile({
      provider: document.storage_provider as any,
      cloudinaryId: document.cloudinary_id || undefined,
      path: document.storage_path || undefined,
      url: document.url,
    });

    // Delete from database
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (deleteError) {
      logger.error('Database error:', deleteError);
      return res.status(500).json({ error: 'Failed to delete document' });
    }

    if (document.milestone_id) {
      const { count: reportCount } = await supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('milestone_id', document.milestone_id);

      await supabase
        .from('milestones')
        .update({
          evidence_report_count: reportCount || 0,
        })
        .eq('id', document.milestone_id);
    }

    clearProjectsCache(document.project_id);

    // Log audit event
    await supabase.from('audit_logs').insert({
      user_id: req.user!.id,
      action: 'DOCUMENT_DELETED',
      resource_type: 'document',
      resource_id: id,
      details: { fileName: document.name },
      tx_hash: null,
    });

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    logger.error('Delete document error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

export default router;
