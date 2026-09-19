import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
    },
  }
);

const REQUIRED_TABLES = [
  'projects',
  'milestones',
  'milestone_photos',
  'documents',
  'transactions',
  'audit_logs',
  'system_alerts',
  'users',
  'project_comments',
  'project_comment_photos',
  'blockchain_events',
  'blockchain_sync_queue',
  'notifications',
];

export async function initializeDatabase() {
  try {
    for (const table of REQUIRED_TABLES) {
      const { error } = await supabase.from(table).select('*', { head: true, count: 'exact' }).limit(1);
      if (error) {
        const details = [error.code, error.message, error.details, error.hint].filter(Boolean).join(' | ');
        throw new Error(
          `Supabase table "${table}" is missing or inaccessible for project ${process.env.SUPABASE_URL}. ${details || 'Run backend/supabase/schema.sql in the Supabase SQL Editor first.'}`
        );
      }
    }

    console.log('Supabase schema verified successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}
