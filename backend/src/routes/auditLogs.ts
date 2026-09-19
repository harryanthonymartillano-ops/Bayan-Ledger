import { Router, Request, Response } from 'express';
import { supabase } from '../db/config';
import { logger } from '../logger';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

const normalizeLogTimestamp = (log: any) => log.timestamp || log.created_at || new Date().toISOString();

const emptyQueryResult = () => Promise.resolve({ data: [] as any[], error: null });

const formatUserName = (user: any) => {
  const firstName = String(user.first_name || '').trim();
  const middleName = String(user.middle_name || '').trim();
  const lastName = String(user.last_name || '').trim();
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ').trim();
  return fullName || user.email || 'System';
};

const enrichAuditLogs = async (logs: any[]) => {
  const userIds = Array.from(
    new Set(logs.map((log) => log.user_id).filter((userId): userId is string => typeof userId === 'string' && userId.length > 0))
  );

  const userMap = new Map<string, any>();

  if (userIds.length > 0) {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, first_name, middle_name, last_name, email, role, wallet_address')
      .in('id', userIds);

    if (error) {
      logger.warn('Failed to enrich audit logs with user data:', error);
    } else {
      for (const user of users || []) {
        userMap.set(user.id, user);
      }
    }
  }

  return logs.map((log) => {
    const actor = log.user_id ? userMap.get(log.user_id) : null;
    return {
      ...log,
      actor_name: actor ? formatUserName(actor) : 'System',
      actor_role: log.user_role || actor?.role || 'System',
      actor_wallet: actor?.wallet_address || null,
      timestamp: normalizeLogTimestamp(log),
      details_text: typeof log.details === 'string' ? log.details : JSON.stringify(log.details || {}, null, 2),
    };
  });
};

// Get audit logs with pagination and filtering
router.get('/', authenticateToken, requireRole(['official', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const {
      page = '1',
      limit = '50',
      action,
      user_id,
      resource_type,
      start_date,
      end_date,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    // Apply filters
    if (action) {
      query = query.eq('action', action);
    }
    if (user_id) {
      query = query.eq('user_id', user_id);
    }
    if (resource_type) {
      query = query.eq('resource_type', resource_type);
    }
    if (start_date) {
      query = query.gte('created_at', start_date);
    }
    if (end_date) {
      query = query.lte('created_at', end_date);
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to fetch audit logs' });
    }

    const enrichedLogs = await enrichAuditLogs(data || []);

    res.json({
      logs: enrichedLogs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count,
        pages: Math.ceil((count || 0) / limitNum),
      },
    });
  } catch (error) {
    logger.error('Fetch audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Get audit logs for a specific resource
router.get('/resource/:type/:id', authenticateToken, requireRole(['official', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { type, id } = req.params;

    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('resource_type', type)
      .eq('resource_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to fetch resource audit logs' });
    }

    const enrichedLogs = await enrichAuditLogs(data || []);

    res.json({ logs: enrichedLogs });
  } catch (error) {
    logger.error('Fetch resource audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch resource audit logs' });
  }
});

router.get('/project/:id/trail', authenticateToken, requireRole(['official', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, status, total_budget, allocated_funds, disbursed_funds, saro, metadata_hash, treasury_seal_hash')
      .eq('id', id)
      .single();

    if (projectError || !project) {
      logger.error('Project audit trail lookup error:', projectError);
      return res.status(404).json({ error: 'Project not found' });
    }

    const [
      { data: milestones, error: milestoneError },
      { data: transactions, error: transactionError },
      { data: documents, error: documentError },
      { data: alerts, error: alertError },
      { data: milestonePhotos, error: milestonePhotoError },
    ] = await Promise.all([
      supabase.from('milestones').select('id').eq('project_id', id),
      supabase.from('transactions').select('id').eq('project_id', id),
      supabase.from('documents').select('id').eq('project_id', id),
      supabase.from('system_alerts').select('id').eq('project_id', id),
      supabase.from('milestone_photos').select('id').eq('project_id', id),
    ]);

    if (milestoneError || transactionError || documentError || alertError || milestonePhotoError) {
      logger.error('Failed to assemble project audit trail resources:', {
        milestoneError,
        transactionError,
        documentError,
        alertError,
        milestonePhotoError,
      });
      return res.status(500).json({ error: 'Failed to assemble audit trail resources' });
    }

    const milestoneIds = (milestones || []).map((item) => String(item.id));
    const transactionIds = (transactions || []).map((item) => String(item.id));
    const documentIds = (documents || []).map((item) => String(item.id));
    const alertIds = (alerts || []).map((item) => String(item.id));
    const milestonePhotoIds = (milestonePhotos || []).map((item) => String(item.id));

    const [
      projectLogsResult,
      milestoneLogsResult,
      transactionLogsResult,
      documentLogsResult,
      alertLogsResult,
      milestonePhotoLogsResult,
    ] = await Promise.all([
      supabase.from('audit_logs').select('*').eq('resource_type', 'project').eq('resource_id', id),
      milestoneIds.length > 0
        ? supabase.from('audit_logs').select('*').eq('resource_type', 'milestone').in('resource_id', milestoneIds)
        : emptyQueryResult(),
      transactionIds.length > 0
        ? supabase.from('audit_logs').select('*').eq('resource_type', 'transaction').in('resource_id', transactionIds)
        : emptyQueryResult(),
      documentIds.length > 0
        ? supabase.from('audit_logs').select('*').eq('resource_type', 'document').in('resource_id', documentIds)
        : emptyQueryResult(),
      alertIds.length > 0
        ? supabase.from('audit_logs').select('*').eq('resource_type', 'system_alert').in('resource_id', alertIds)
        : emptyQueryResult(),
      milestonePhotoIds.length > 0
        ? supabase.from('audit_logs').select('*').eq('resource_type', 'milestone_photo').in('resource_id', milestonePhotoIds)
        : emptyQueryResult(),
    ]);

    const queryErrors = [
      projectLogsResult.error,
      milestoneLogsResult.error,
      transactionLogsResult.error,
      documentLogsResult.error,
      alertLogsResult.error,
      milestonePhotoLogsResult.error,
    ].filter(Boolean);

    if (queryErrors.length > 0) {
      logger.error('Failed to fetch project audit trail logs:', queryErrors);
      return res.status(500).json({ error: 'Failed to fetch project audit trail logs' });
    }

    const dedupedLogs = Array.from(
      new Map(
        [
          ...(projectLogsResult.data || []),
          ...(milestoneLogsResult.data || []),
          ...(transactionLogsResult.data || []),
          ...(documentLogsResult.data || []),
          ...(alertLogsResult.data || []),
          ...(milestonePhotoLogsResult.data || []),
        ].map((log) => [log.id, log])
      ).values()
    ).sort((left, right) => {
      return new Date(normalizeLogTimestamp(right)).getTime() - new Date(normalizeLogTimestamp(left)).getTime();
    });

    const logs = await enrichAuditLogs(dedupedLogs);

    res.json({
      trail: {
        project,
        coverage: {
          projectLogs: (projectLogsResult.data || []).length,
          milestoneLogs: (milestoneLogsResult.data || []).length,
          transactionLogs: (transactionLogsResult.data || []).length,
          documentLogs: (documentLogsResult.data || []).length,
          milestonePhotoLogs: (milestonePhotoLogsResult.data || []).length,
          systemAlertLogs: (alertLogsResult.data || []).length,
          totalLogs: logs.length,
        },
        logs,
      },
    });
  } catch (error) {
    logger.error('Fetch project audit trail error:', error);
    res.status(500).json({ error: 'Failed to fetch project audit trail' });
  }
});

// Get audit logs for current user
router.get('/my-logs', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      logger.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to fetch user audit logs' });
    }

    res.json({ logs: data });
  } catch (error) {
    logger.error('Fetch user audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch user audit logs' });
  }
});

export default router;
