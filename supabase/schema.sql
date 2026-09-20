-- Paralar — Supabase schema. Run this in Supabase Dashboard -> SQL Editor.
-- Safe to re-run (idempotent).

create extension if not exists pgcrypto;

-- PROFILES -------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text default '',
  avatar_url text default '',
  usage_mode text default 'personal',   -- personal | business | both
  language text default 'en',           -- id | ms | en | tr
  home_currency text default 'USD',
  plan_tier text default 'free',        -- free | premium
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ACCOUNTS (wallets / cards) --------------------------------------------
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text default 'bank',
  currency text default 'USD',
  balance numeric default 0,
  theme text default 'obsidian',
  logo text,
  country text,
  created_at timestamptz default now()
);
create index if not exists accounts_user_idx on public.accounts(user_id);

-- TRANSACTIONS -----------------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,                    -- expense | income | transfer
  amount numeric not null,               -- original amount in `currency`
  currency text not null,                -- original (foreign) currency
  home_currency text,                    -- user's home currency at time of entry
  home_currency_amount numeric,          -- converted amount
  rate numeric,                          -- 1 currency = rate home_currency
  category text,
  payment_method text,                   -- cash | qr | card | bank
  account_id uuid,
  to_account_id uuid,
  fee numeric default 0,
  note text,
  merchant text,
  receipt_number text,
  receipt_url text,
  items jsonb default '[]'::jsonb,
  tax_deductible boolean default false,
  date timestamptz default now(),
  created_at timestamptz default now()
);
create index if not exists transactions_user_date_idx on public.transactions(user_id, date desc);

-- GOALS --------------------------------------------------------------------
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  emoji text default '🎯',
  target_amount numeric default 0,
  saved_amount numeric default 0,
  currency text default 'USD',
  deadline date,
  created_at timestamptz default now()
);
create index if not exists goals_user_idx on public.goals(user_id);

-- SPLIT BILLS (phase 2) -----------------------------------------------------
create table if not exists public.split_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  total numeric default 0,
  currency text default 'USD',
  mode text default 'equally',           -- equally | uneven | items
  participants jsonb default '[]'::jsonb,
  items jsonb default '[]'::jsonb,
  transaction_id uuid,
  status text default 'open',
  created_at timestamptz default now()
);

-- RLS ------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.goals enable row level security;
alter table public.split_bills enable row level security;

grant select, insert, update, delete on public.profiles, public.accounts, public.transactions, public.goals, public.split_bills to authenticated;

-- profiles: id = auth.uid()
drop policy if exists "profiles own" on public.profiles;
create policy "profiles own" on public.profiles for all to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- per-user tables: user_id = auth.uid()
drop policy if exists "accounts own" on public.accounts;
create policy "accounts own" on public.accounts for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "transactions own" on public.transactions;
create policy "transactions own" on public.transactions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "goals own" on public.goals;
create policy "goals own" on public.goals for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "split_bills own" on public.split_bills;
create policy "split_bills own" on public.split_bills for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
