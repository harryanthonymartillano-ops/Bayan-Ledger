-- Migration: Ensure all budget and transaction amount columns support decimal points (numeric(15,2))
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- 1. Alter public.projects monetary columns to numeric(15,2)
ALTER TABLE public.projects 
  ALTER COLUMN total_budget TYPE numeric(15,2),
  ALTER COLUMN allocated_funds TYPE numeric(15,2),
  ALTER COLUMN disbursed_funds TYPE numeric(15,2);

-- 2. Alter public.milestones budget column to numeric(15,2)
ALTER TABLE public.milestones 
  ALTER COLUMN budget TYPE numeric(15,2);

-- 3. Alter public.transactions amount column to numeric(15,2)
ALTER TABLE public.transactions 
  ALTER COLUMN amount TYPE numeric(15,2);

-- 4. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
