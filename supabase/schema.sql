-- ============================================================================
-- PARALAR — SUPABASE POSTGRESQL COMPLETE CONSOLIDATED SCHEMA
-- Run this script directly in your Supabase Dashboard -> SQL Editor.
-- Safe to re-run anytime (fully idempotent with IF NOT EXISTS & DROP POLICY IF EXISTS).
-- ============================================================================

-- 0. EXTENSIONS
create extension if not exists pgcrypto;

-- ============================================================================
-- 1. PROFILES
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text default '',
  avatar_url text default '',
  usage_mode text default 'personal',   -- personal | business | both
  language text default 'id',           -- id | ms | en | tr
  home_currency text default 'IDR',     -- IDR | USD | MYR | TRY | SGD | EUR | etc.
  plan_tier text default 'free',        -- free | premium
  cloud_backup_provider text default 'local', -- local | icloud | google_drive
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================================
-- 2. ACCOUNTS (Wallets, Bank Accounts, E-Wallets, Cards)
-- ============================================================================
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text default 'bank',             -- bank | ewallet | cash | card | crypto
  currency text default 'IDR',
  balance numeric default 0,
  theme text default 'obsidian',        -- obsidian | metal | royal | emerald | sakura | sunset | matrix | batik | kawung
  logo text,
  icon text,
  country text,
  created_at timestamptz default now()
);
create index if not exists accounts_user_idx on public.accounts(user_id);

-- ============================================================================
-- 3. TRANSACTIONS
-- ============================================================================
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,                    -- expense | income | transfer
  amount numeric not null,               -- original amount in `currency`
  currency text not null,                -- original currency
  home_currency text,                    -- user's home currency at time of entry
  home_currency_amount numeric,          -- converted amount in home_currency
  rate numeric,                          -- exchange rate used (1 currency = rate home_currency)
  category text,                         -- e.g. cat_food, cat_transport, cat_bills, etc.
  subcategory text,
  payment_method text,                   -- cash | qr | card | bank | transfer
  account_id uuid references public.accounts(id) on delete set null,
  to_account_id uuid references public.accounts(id) on delete set null,
  fee numeric default 0,
  note text,
  merchant text,
  receipt_number text,
  receipt_url text,
  items jsonb default '[]'::jsonb,
  tax_deductible boolean default false,
  date timestamptz default now(),
  transaction_date timestamptz default now(),
  created_at timestamptz default now()
);
create index if not exists transactions_user_date_idx on public.transactions(user_id, date desc);
create index if not exists transactions_account_idx on public.transactions(account_id);

-- ============================================================================
-- 4. GOALS (Savings Goals, Monthly Budgets, Subscriptions, Loans & BNPL)
-- ============================================================================
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  emoji text default '🎯',
  icon text,
  cover_url text,
  type text default 'savings',           -- savings | budget | subscription | loan | bnpl | postpaid
  category text,                         -- for budget goals
  target_amount numeric default 0,       -- savings target or budget limit or total loan amount
  saved_amount numeric default 0,        -- current accumulated savings
  currency text default 'IDR',
  deadline date,
  notes text,

  -- Extended fields for Loans, Cicilan, and Postpaid / PayLater
  debt_type text,                        -- loan | installment | postpaid | bnpl
  debt_mode text,                        -- installment | postpaid
  provider_id text,                      -- spaylater | kredivo | gopay | akulaku | kta | cc | other
  provider_name text,                    -- Display name for provider
  monthly_installment numeric default 0, -- Monthly installment amount
  installment_amount numeric default 0,  -- Alias for monthly installment
  tenor_months integer default 0,        -- Total installment duration in months
  remaining_tenor integer default 0,      -- Remaining installment months
  due_day integer default 10,            -- Due date (day of month, 1-31)
  due_day_of_month integer default 10,   -- Alias for due date
  credit_limit numeric default 0,        -- Credit limit for PayLater / CC
  billing_cycle_day integer default 25,  -- Billing statement closing day
  current_bill_amount numeric default 0, -- Active statement bill amount
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists goals_user_idx on public.goals(user_id);
create index if not exists goals_type_idx on public.goals(user_id, type);

-- ============================================================================
-- 5. BILLS (Recurring Monthly Checklist & Bill Tracker)
-- ============================================================================
create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  amount numeric not null default 0,
  currency text default 'IDR',
  due_day integer default 1,             -- 1 to 31
  cycle text default 'monthly',          -- monthly | weekly | yearly
  category text default 'cat_bills',
  payment_method text default 'card',
  account_id uuid references public.accounts(id) on delete set null,
  auto_log_expense boolean default false,
  paid_months jsonb default '{}'::jsonb, -- e.g. {"2026-09": true, "2026-10": true}
  subscription_id uuid,
  is_subscription_mirror boolean default false,
  created_at timestamptz default now()
);
create index if not exists bills_user_idx on public.bills(user_id);

-- ============================================================================
-- 6. BUDGETS (Category Expense Limits)
-- ============================================================================
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  subcategory text,
  limit_amount numeric not null default 0,
  currency text default 'IDR',
  month text,                            -- YYYY-MM or null for rolling monthly
  created_at timestamptz default now()
);
create index if not exists budgets_user_idx on public.budgets(user_id);

-- ============================================================================
-- 7. ANNOUNCEMENTS (Public Admin Announcements & Broadcasts)
-- ============================================================================
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  is_active boolean default true,
  priority text default 'normal',        -- normal | urgent | info
  icon text default 'Megaphone',
  expires_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists announcements_active_idx on public.announcements(is_active, created_at desc);

-- ============================================================================
-- 8. SPLIT BILLS
-- ============================================================================
create table if not exists public.split_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  total numeric default 0,
  currency text default 'IDR',
  mode text default 'equally',           -- equally | uneven | items
  participants jsonb default '[]'::jsonb,
  items jsonb default '[]'::jsonb,
  transaction_id uuid references public.transactions(id) on delete set null,
  status text default 'open',            -- open | settled
  created_at timestamptz default now()
);
create index if not exists split_bills_user_idx on public.split_bills(user_id);

-- ============================================================================
-- 9. CUSTOM CATEGORIES
-- ============================================================================
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text default 'CircleDashed',
  type text default 'expense',           -- expense | income
  preset boolean default false,
  created_at timestamptz default now()
);
create index if not exists categories_user_idx on public.categories(user_id);

-- ============================================================================
-- 10. TRANSACTION TEMPLATES (Quick Expense Presets)
-- ============================================================================
create table if not exists public.transaction_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  amount numeric default 0,
  currency text default 'IDR',
  category text default 'other',
  account_id uuid references public.accounts(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists templates_user_idx on public.transaction_templates(user_id);

-- ============================================================================
-- 11. DEBTS & LOANS (Personal P2P Lending/Borrowing Tracker)
-- ============================================================================
create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  direction text default 'lent',         -- lent (owed to me) | borrowed (I owe)
  person text not null,
  amount numeric default 0,
  currency text default 'IDR',
  due_date date,
  note text,
  account_id uuid references public.accounts(id) on delete set null,
  settled boolean default false,
  created_at timestamptz default now()
);
create index if not exists debts_user_idx on public.debts(user_id);

-- ============================================================================
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.goals enable row level security;
alter table public.bills enable row level security;
alter table public.budgets enable row level security;
alter table public.announcements enable row level security;
alter table public.split_bills enable row level security;
alter table public.categories enable row level security;
alter table public.transaction_templates enable row level security;
alter table public.debts enable row level security;

-- Grants
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.accounts to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.goals to authenticated;
grant select, insert, update, delete on public.bills to authenticated;
grant select, insert, update, delete on public.budgets to authenticated;
grant select, insert, update, delete on public.split_bills to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.transaction_templates to authenticated;
grant select, insert, update, delete on public.debts to authenticated;

-- Announcements: Public read for authenticated and anonymous visitors
grant select on public.announcements to authenticated, anon;

-- Profiles Policy: id = auth.uid()
drop policy if exists "profiles own" on public.profiles;
create policy "profiles own" on public.profiles for all to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Per-user tables: user_id = auth.uid()
drop policy if exists "accounts own" on public.accounts;
create policy "accounts own" on public.accounts for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "transactions own" on public.transactions;
create policy "transactions own" on public.transactions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "goals own" on public.goals;
create policy "goals own" on public.goals for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "bills own" on public.bills;
create policy "bills own" on public.bills for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "budgets own" on public.budgets;
create policy "budgets own" on public.budgets for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "split_bills own" on public.split_bills;
create policy "split_bills own" on public.split_bills for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "categories own" on public.categories;
create policy "categories own" on public.categories for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "transaction_templates own" on public.transaction_templates;
create policy "transaction_templates own" on public.transaction_templates for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "debts own" on public.debts;
create policy "debts own" on public.debts for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Announcements Policy: Public active announcements read policy
drop policy if exists "announcements public read" on public.announcements;
create policy "announcements public read" on public.announcements for select
  using (is_active = true);

-- Seed Initial Welcome Announcement (Sample Data)
insert into public.announcements (title, content, is_active, priority)
values (
  'Selamat Datang di Paralar',
  'Nikmati kemudahan pencatatan keuangan, pelacakan tagihan bulanan, cicilan PayLater, dan target tabungan Anda dalam satu tempat.',
  true,
  'normal'
)
on conflict do nothing;

-- ============================================================================
-- 11. AI QUOTA & USAGE TRACKING (Admin & Premium Quota Management)
-- ============================================================================
create table if not exists public.ai_quotas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  used_count integer default 0,
  last_reset_date date default current_date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.ai_quotas enable row level security;
grant select, insert, update on public.ai_quotas to authenticated;

drop policy if exists "ai_quotas own" on public.ai_quotas;
create policy "ai_quotas own" on public.ai_quotas for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- RPC: get_ai_quota_status(user_id)
create or replace function public.get_ai_quota_status(user_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_plan text;
  v_used int;
  v_limit int := 50;
  v_last_date date;
begin
  select plan_tier into v_plan from public.profiles where id = user_id;
  if v_plan = 'premium' or v_plan = 'admin' then
    return jsonb_build_object(
      'remaining', 999,
      'total', 999,
      'is_unlimited', true
    );
  end if;

  select used_count, last_reset_date into v_used, v_last_date
  from public.ai_quotas where ai_quotas.user_id = get_ai_quota_status.user_id;

  if v_used is null or v_last_date < current_date then
    v_used := 0;
  end if;

  return jsonb_build_object(
    'remaining', greatest(0, v_limit - v_used),
    'total', v_limit,
    'is_unlimited', false
  );
end;
$$;

-- RPC: check_and_consume_ai_quota(user_id)
create or replace function public.check_and_consume_ai_quota(user_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_plan text;
  v_used int;
  v_limit int := 50;
  v_last_date date;
begin
  select plan_tier into v_plan from public.profiles where id = user_id;
  if v_plan = 'premium' or v_plan = 'admin' then
    return jsonb_build_object(
      'allowed', true,
      'remaining', 999,
      'total', 999,
      'is_unlimited', true
    );
  end if;

  -- Default Free users are not allowed
  return jsonb_build_object(
    'allowed', false,
    'error', 'Fitur AI eksklusif untuk pengguna Premium atau Admin.',
    'code', 'AI_PREMIUM_REQUIRED'
  );
end;
$$;

