import { Router, Request, Response } from 'express';
import { supabase } from '../db/config';
import { logger } from '../logger';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';
import { notifyUsers } from './notifications';

const router = Router();

let systemAlertsTableVerified = false;

// Ensure system_alerts table exists (only once)
async function ensureSystemAlertsTableExists() {
  if (systemAlertsTableVerified) return;
  try {
    const { error } = await supabase
      .from('system_alerts')
      .select('id')
      .limit(1);

    if (!error) {
      systemAlertsTableVerified = true;
    } else if (error.message.includes('relation "system_alerts" does not exist')) {
      logger.info('System_alerts table does not exist yet.');
    }
  } catch (error) {
    logger.warn(`Error ensuring system_alerts table: ${error}`);
  }
}

// Initialize table on startup once
ensureSystemAlertsTableExists();

interface AlertsCacheEntry {
  data: any;
  expiresAt: number;
}
let alertsCache: AlertsCacheEntry | null = null;
const ALERTS_CACHE_TTL_MS = 60 * 1000; // 60-second cache

export const clearAlertsCache = () => {
  alertsCache = null;
};

// Get all system alerts
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const now = Date.now();
    if (alertsCache && alertsCache.expiresAt > now) {
      res.setHeader('Cache-Control', 'private, max-age=30');
      return res.json(alertsCache.data);
    }

    const { error, data } = await supabase
      .from('system_alerts')
      .select('id, project_id, message, severity, alert_type, status, details, detected_at, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      if (error.message.includes('relation "system_alerts" does not exist')) {
        return res.json({ alerts: [] });
      }
      logger.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to fetch alerts' });
    }

    const payload = { alerts: data || [] };
    alertsCache = {
      data: payload,
      expiresAt: now + ALERTS_CACHE_TTL_MS,
    };

    res.setHeader('Cache-Control', 'private, max-age=30');
    res.json(payload);
  } catch (error) {
    logger.error('Get system alerts error:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Create a system alert
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, message, severity = 'INFO', alertType, details } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const { error, data } = await supabase
      .from('system_alerts')
      .insert({
        project_id: projectId || null,
        message,
        severity,
        alert_type: alertType,
        status: 'Unresolved',
        details: details || null,
        detected_by: req.user?.id,
        detected_at: new Date().toISOString(),
      })
      .select('id, project_id, message, severity, alert_type, status, details, detected_at, created_at')
      .single();

    if (error) {
      logger.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to create alert' });
    }

    clearAlertsCache();
    logger.info(`System alert created: ${message}`);
    try {
      const { data: admins } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'Admin')
        .eq('status', 'Active');

      if (admins && admins.length > 0) {
        await notifyUsers({
          userIds: admins.map((a) => a.id),
          type: 'alert',
          title: severity === 'CRITICAL' ? '🚨 Critical Security Alert' : '⚠️ System Alert',
          message,
          link: '/official/alerts',
          resourceType: 'alert',
          resourceId: data.id,
        });
      }
    } catch (notifErr) {
      logger.warn('Failed to dispatch alert notification to admins:', notifErr);
    }

    res.status(201).json(data);
  } catch (error) {
    logger.error('Create system alert error:', error);
    res.status(500).json({ error: 'Failed to create alert' });
  }
});

// Update system alert status
router.patch('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'Resolved') {
      updateData.resolved_by = req.user?.id;
      updateData.resolved_at = new Date().toISOString();
    }

    const { error, data } = await supabase
      .from('system_alerts')
      .update(updateData)
      .eq('id', id)
      .select('id, project_id, message, severity, alert_type, status, details, detected_at, created_at')
      .single();

    if (error) {
      logger.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to update alert' });
    }

    clearAlertsCache();
    logger.info(`System alert ${id} updated: ${status}`);
    res.json(data);
  } catch (error) {
    logger.error('Update system alert error:', error);
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

// Get alerts for a specific project
router.get('/project/:projectId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;

    const { error, data } = await supabase
      .from('system_alerts')
      .select('id, project_id, message, severity, alert_type, status, details, detected_at, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to fetch project alerts' });
    }

    res.json({ alerts: data || [] });
  } catch (error) {
    logger.error('Get project alerts error:', error);
    res.status(500).json({ error: 'Failed to fetch project alerts' });
  }
});

export default router;
