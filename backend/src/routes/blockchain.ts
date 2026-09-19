import { Router, Response } from 'express';
import { supabase } from '../db/config';
import { logger } from '../logger';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

router.get('/config', authenticateToken, async (_req: AuthRequest, res: Response) => {
  res.json({
    contractAddress: process.env.CONTRACT_ADDRESS || null,
    chainId: process.env.CHAIN_ID || null,
    rpcUrlConfigured: Boolean(process.env.SEPOLIA_RPC_URL),
  });
});

router.get('/events', authenticateToken, requireRole(['official', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { event_name, project_id, tx_hash } = req.query;
    let query = supabase.from('blockchain_events').select('*').order('created_at', { ascending: false });

    if (event_name) query = query.eq('event_name', event_name);
    if (project_id) query = query.eq('project_id', project_id);
    if (tx_hash) query = query.eq('tx_hash', tx_hash);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ events: data || [] });
  } catch (error) {
    logger.error('Fetch blockchain events error:', error);
    res.status(500).json({ error: 'Failed to fetch blockchain events' });
  }
});

router.post('/events', authenticateToken, requireRole(['official', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { project_id, milestone_id, event_name, tx_hash, block_number, log_index, payload } = req.body;
    if (!event_name || !tx_hash) {
      res.status(400).json({ error: 'event_name and tx_hash are required' });
      return;
    }

    const { data, error } = await supabase
      .from('blockchain_events')
      .insert({
        project_id: project_id || null,
        milestone_id: milestone_id || null,
        event_name,
        tx_hash,
        block_number: block_number || null,
        log_index: log_index || null,
        payload: payload || {},
      })
      .select('*')
      .single();

    if (error) throw error;

    await supabase.from('audit_logs').insert({
      user_id: req.user?.id || null,
      action: 'BLOCKCHAIN_EVENT_RECORDED',
      resource_type: 'blockchain_event',
      resource_id: data.id,
      details: { event_name, tx_hash, project_id, milestone_id },
      tx_hash,
    });

    res.status(201).json({ event: data });
  } catch (error) {
    logger.error('Record blockchain event error:', error);
    res.status(500).json({ error: 'Failed to record blockchain event' });
  }
});

router.get('/sync-queue', authenticateToken, requireRole(['official', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;
    let query = supabase.from('blockchain_sync_queue').select('*').order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (error) {
    logger.error('Fetch blockchain sync queue error:', error);
    res.status(500).json({ error: 'Failed to fetch blockchain sync queue' });
  }
});

router.post('/sync-queue', authenticateToken, requireRole(['official', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { entity_type, entity_id, sync_action, payload } = req.body;
    if (!entity_type || !entity_id || !sync_action) {
      res.status(400).json({ error: 'entity_type, entity_id, and sync_action are required' });
      return;
    }

    const { data, error } = await supabase
      .from('blockchain_sync_queue')
      .insert({
        entity_type,
        entity_id,
        sync_action,
        payload: payload || {},
      })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ item: data });
  } catch (error) {
    logger.error('Queue blockchain sync error:', error);
    res.status(500).json({ error: 'Failed to queue blockchain sync item' });
  }
});

router.patch('/sync-queue/:id', authenticateToken, requireRole(['official', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, retry_count, last_error, payload } = req.body;

    const { data, error } = await supabase
      .from('blockchain_sync_queue')
      .update({
        status,
        retry_count,
        last_error,
        payload,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ item: data });
  } catch (error) {
    logger.error('Update blockchain sync queue error:', error);
    res.status(500).json({ error: 'Failed to update blockchain sync item' });
  }
});

export default router;
