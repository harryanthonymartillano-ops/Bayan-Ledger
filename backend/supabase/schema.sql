create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text,
  first_name text,
  middle_name text,
  last_name text,
  wallet_address text,
  role text not null,
  chain_role_granted boolean not null default false,
  chain_role_granted_at timestamptz,
  status text not null default 'Active',
  last_login timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users add column if not exists first_name text;
alter table public.users add column if not exists middle_name text;
alter table public.users add column if not exists last_name text;
alter table public.users drop column if exists department;
alter table public.users drop constraint if exists users_wallet_address_key;


create table if not exists public.projects (
  id text primary key,
  name text not null,
  description text,
  location text,
  category text,
  start_date timestamptz,
  end_date timestamptz,
  stakeholders jsonb not null default '[]'::jsonb,
  total_budget bigint not null,
  allocated_funds bigint not null default 0,
  disbursed_funds bigint not null default 0,
  status text not null default 'MPDC Approved',
  saro text,
  metadata_hash text,
  latest_disbursement_ref text,
  rejection_reason text,
  rejected_by_role text,
  budget_officer_signed_at timestamptz,
  budget_officer_wallet text,
  treasurer_signed_at timestamptz,
  treasurer_wallet text,
  treasury_seal_hash text,
  activated_at timestamptz,
  blockchain_created_by_wallet text,
  blockchain_tx_hash text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  onchain_synced_at timestamptz
);

create table if not exists public.milestones (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  due_date timestamptz,
  budget bigint not null default 0,
  deliverables jsonb not null default '[]'::jsonb,
  percentage integer not null check (percentage >= 0 and percentage <= 100),
  status text not null default 'Pending',
  verification_data jsonb,
  date_verified timestamptz,
  verified_by uuid references public.users(id) on delete set null,
  verified_by_wallet text,
  photo_url text,
  ipfs_hash text,
  evidence_hash text,
  report_hash text,
  evidence_photo_count integer not null default 0,
  evidence_report_count integer not null default 0,
  onchain_verified_at timestamptz,
  onchain_paid boolean not null default false,
  blockchain_tx_hash text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.milestone_photos (
  id uuid primary key default gen_random_uuid(),
  milestone_id text not null references public.milestones(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  photo_type text not null,
  url text not null,
  photo_hash text,
  ipfs_hash text,
  description text,
  uploaded_by uuid references public.users(id) on delete set null,
  uploaded_by_wallet text,
  captured_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  milestone_id text references public.milestones(id) on delete set null,
  title text not null,
  name text,
  type text not null,
  url text not null,
  storage_provider text not null default 'supabase',
  storage_path text,
  ipfs_hash text,
  checksum_hash text,
  cloudinary_id text,
  mime_type text,
  file_format text,
  size bigint,
  uploaded_by uuid references public.users(id) on delete set null,
  uploaded_by_wallet text,
  description text,
  verified boolean not null default false,
  verified_by uuid references public.users(id) on delete set null,
  verified_date timestamptz,
  blockchain_tx_hash text,
  date_uploaded timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  milestone_id text references public.milestones(id) on delete set null,
  amount bigint not null,
  type text not null,
  date timestamptz not null,
  recipient text,
  payment_method text,
  initiated_by uuid references public.users(id) on delete set null,
  recorded_by uuid references public.users(id) on delete set null,
  recorded_by_role text,
  description text,
  hash text,
  saro text,
  contractor_wallet text,
  request_metadata_hash text,
  supporting_hash text,
  signature_count integer not null default 0,
  budget_signed_at timestamptz,
  budget_signed_by uuid references public.users(id) on delete set null,
  budget_signature_hash text,
  treasurer_signed_at timestamptz,
  treasurer_signed_by uuid references public.users(id) on delete set null,
  digital_seal_hash text,
  request_tx_hash text,
  rejection_reason text,
  rejected_by_role text,
  blockchain_reference_hash text,
  blockchain_tx_hash text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_comments (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  display_name text not null default 'Anonymous',
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_comment_photos (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.project_comments(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  url text not null,
  storage_provider text not null default 'local',
  storage_path text,
  cloudinary_id text,
  mime_type text,
  size bigint,
  file_name text,
  photo_hash text,
  created_at timestamptz not null default now()
);

alter table public.transactions add column if not exists contractor_wallet text;
alter table public.transactions add column if not exists request_metadata_hash text;
alter table public.transactions add column if not exists supporting_hash text;
alter table public.transactions add column if not exists signature_count integer not null default 0;
alter table public.transactions add column if not exists budget_signed_at timestamptz;
alter table public.transactions add column if not exists budget_signed_by uuid references public.users(id) on delete set null;
alter table public.transactions add column if not exists budget_signature_hash text;
alter table public.transactions add column if not exists treasurer_signed_at timestamptz;
alter table public.transactions add column if not exists treasurer_signed_by uuid references public.users(id) on delete set null;
alter table public.transactions add column if not exists digital_seal_hash text;
alter table public.transactions add column if not exists request_tx_hash text;
alter table public.transactions add column if not exists rejection_reason text;
alter table public.transactions add column if not exists rejected_by_role text;

alter table public.projects add column if not exists rejection_reason text;
alter table public.projects add column if not exists rejected_by_role text;
alter table public.projects add column if not exists budget_officer_signed_at timestamptz;
alter table public.projects add column if not exists budget_officer_wallet text;
alter table public.projects add column if not exists treasurer_signed_at timestamptz;
alter table public.projects add column if not exists treasurer_wallet text;
alter table public.projects add column if not exists treasury_seal_hash text;
alter table public.projects add column if not exists activated_at timestamptz;
alter table public.projects add column if not exists budget_source text;
alter table public.projects add column if not exists location_photos jsonb not null default '[]'::jsonb;

-- Create indexes for better query performance
create index if not exists idx_projects_budget_source on public.projects(budget_source);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  timestamp timestamptz not null default now(),
  action text not null,
  user_role text,
  user_id uuid references public.users(id) on delete set null,
  resource_type text,
  resource_id text,
  details jsonb,
  hash text,
  tx_hash text,
  created_at timestamptz not null default now()
);







create table if not exists public.blockchain_events (
  id uuid primary key default gen_random_uuid(),
  project_id text references public.projects(id) on delete cascade,
  milestone_id text references public.milestones(id) on delete cascade,
  event_name text not null,
  tx_hash text not null,
  block_number bigint,
  log_index integer,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.blockchain_sync_queue (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  sync_action text not null,
  status text not null default 'pending',
  retry_count integer not null default 0,
  last_error text,
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projects_status on public.projects(status);
create index if not exists idx_projects_category on public.projects(category);
create index if not exists idx_milestones_project_id on public.milestones(project_id);
create index if not exists idx_documents_project_id on public.documents(project_id);

create index if not exists idx_transactions_project_id on public.transactions(project_id);
create index if not exists idx_project_comments_project_id on public.project_comments(project_id, created_at desc);
create index if not exists idx_project_comment_photos_comment_id on public.project_comment_photos(comment_id);
create index if not exists idx_audit_logs_user_id on public.audit_logs(user_id);
create index if not exists idx_audit_logs_resource on public.audit_logs(resource_type, resource_id);
create index if not exists idx_blockchain_events_project_id on public.blockchain_events(project_id);
create index if not exists idx_blockchain_sync_queue_status on public.blockchain_sync_queue(status);
create index if not exists idx_users_wallet_address on public.users(wallet_address);

-- Notifications table
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  type text not null,
  title text not null,
  message text not null,
  link text,
  resource_type text,
  resource_id text,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_is_read on public.notifications(user_id, is_read);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists trg_milestones_updated_at on public.milestones;
create trigger trg_milestones_updated_at before update on public.milestones
for each row execute function public.set_updated_at();

drop trigger if exists trg_transactions_updated_at on public.transactions;
create trigger trg_transactions_updated_at before update on public.transactions
for each row execute function public.set_updated_at();

drop trigger if exists trg_project_comments_updated_at on public.project_comments;
create trigger trg_project_comments_updated_at before update on public.project_comments
for each row execute function public.set_updated_at();



drop trigger if exists trg_blockchain_sync_queue_updated_at on public.blockchain_sync_queue;
create trigger trg_blockchain_sync_queue_updated_at before update on public.blockchain_sync_queue
for each row execute function public.set_updated_at();
