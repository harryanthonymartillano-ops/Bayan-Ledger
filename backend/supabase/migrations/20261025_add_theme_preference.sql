-- Migration: Add theme_preference column to users table
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- 1. Add theme_preference column to public.users if it doesn't already exist
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS theme_preference text NOT NULL DEFAULT 'light';

-- 2. Drop existing constraint if it exists to allow re-running safely
ALTER TABLE public.users 
DROP CONSTRAINT IF EXISTS check_users_theme_preference;

-- 3. Add check constraint to ensure only 'light' or 'dark' can be saved
ALTER TABLE public.users 
ADD CONSTRAINT check_users_theme_preference 
CHECK (theme_preference IN ('light', 'dark'));

-- 4. Update any existing null values to 'light' (if any existed prior)
UPDATE public.users 
SET theme_preference = 'light' 
WHERE theme_preference IS NULL;

-- 5. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
