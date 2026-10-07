import { Router, Response } from 'express';
import { supabase } from '../db/config';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

interface NotifCacheEntry {
  data: any;
  expiresAt: number;
}
const notifCache = new Map<string, NotifCacheEntry>();
const NOTIF_CACHE_TTL_MS = 20 * 1000; // 20-second cache per user

export const clearNotificationCache = (userId?: string) => {
  if (userId) {
    notifCache.delete(userId);
  } else {
    notifCache.clear();
  }
};

// Get notifications for current user
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { is_read, limit = 20, offset = 0 } = req.query;

    const cacheKey = `${userId}:${is_read}:${limit}:${offset}`;
    const cached = notifCache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      res.setHeader('Cache-Control', 'private, max-age=15');
      return res.json(cached.data);
    }

    let query = supabase
      .from('notifications')
      .select('id, user_id, type, title, message, link, resource_type, resource_id, is_read, created_at, read_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (is_read !== undefined) {
      query = query.eq('is_read', is_read === 'true');
    }

    const { data, error } = await query;

    if (error) throw error;

    // Get unread count with lightweight head request (no payload transferred)
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    const payload = { notifications: data || [], unreadCount: count || 0 };
    notifCache.set(cacheKey, {
      data: payload,
      expiresAt: now + NOTIF_CACHE_TTL_MS,
    });

    res.setHeader('Cache-Control', 'private, max-age=15');
    res.json(payload);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.patch('/:id/read', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    clearNotificationCache(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.patch('/read-all', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;

    clearNotificationCache(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// Delete a notification
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    clearNotificationCache(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Utility function to create notifications (to be called from other routes)
export async function createNotification({
  userId,
  type,
  title,
  message,
  link,
  resourceType,
  resourceId,
}: {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string | undefined;
  resourceType?: string | undefined;
  resourceId?: string | undefined;
}) {
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    message,
    link: link ?? null,
    resource_type: resourceType ?? null,
    resource_id: resourceId ?? null,
  });

  if (error) {
    console.error('Error creating notification:', error);
  } else {
    clearNotificationCache(userId);
  }
}

// Utility function to notify multiple users
export async function notifyUsers({
  userIds,
  type,
  title,
  message,
  link,
  resourceType,
  resourceId,
}: {
  userIds: string[];
  type: string;
  title: string;
  message: string;
  link?: string | undefined;
  resourceType?: string | undefined;
  resourceId?: string | undefined;
}) {
  const notifications = userIds.map((userId) => ({
    user_id: userId,
    type,
    title,
    message,
    link: link ?? null,
    resource_type: resourceType ?? null,
    resource_id: resourceId ?? null,
  }));

  const { error } = await supabase.from('notifications').insert(notifications);

  if (error) {
    console.error('Error creating bulk notifications:', error);
  } else {
    for (const uid of userIds) {
      clearNotificationCache(uid);
    }
  }
}

export default router;
