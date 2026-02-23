-- ============================================================
-- Trip Vault — Supabase Schema
-- Run this in the Supabase SQL Editor before uploading docs
-- ============================================================

-- Documents table
create table if not exists documents (
  id          uuid primary key default gen_random_uuid(),
  filename    text not null,
  storage_path text not null unique,
  category    text not null check (category in ('flights','hotels','car_rental','activities','insurance','misc')),
  title       text,
  raw_text    text,
  metadata    jsonb default '{}',
  event_date  date,
  created_at  timestamptz default now()
);

-- Trip metadata table (key-value store for trip-level data)
create table if not exists trip_metadata (
  id         uuid primary key default gen_random_uuid(),
  key        text unique not null,
  value      jsonb not null,
  updated_at timestamptz default now()
);

-- Indexes
create index if not exists documents_category_idx on documents(category);
create index if not exists documents_event_date_idx on documents(event_date);

-- Row Level Security (disable public access — all access via service role)
alter table documents enable row level security;
alter table trip_metadata enable row level security;

-- Policy: service role bypasses RLS automatically
-- No public read policies — all reads go through Next.js API with service role key

-- Storage bucket (create via Supabase dashboard or this SQL won't work directly)
-- Go to: Storage > New Bucket > Name: "travel-documents" > Private (uncheck public)
