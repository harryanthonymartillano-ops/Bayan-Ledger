import { Router, Response } from 'express';
import { supabase } from '../db/config';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Get notifications for current user
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { is_read, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (is_read !== undefined) {
      query = query.eq('is_read', is_read === 'true');
    }

    const { data, error } = await query;

    if (error) throw error;

    // Get unread count
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    res.json({ notifications: data, unreadCount: count });
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
  }
}

export default router;
