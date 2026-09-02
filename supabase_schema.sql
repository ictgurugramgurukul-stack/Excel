-- ============================================================
-- G-Hostel Points System — Supabase schema
-- STATUS: this has ALREADY been applied to your "New" Supabase
-- project (vczkojdfuvdeywnmnino). This file is kept here so you
-- have a record of it / can re-apply it elsewhere if needed.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  member_id text unique not null,
  name text not null,
  class text,
  room text,
  house text not null check (house in ('Samveda','Yajurveda','Atharvaveda','Rugveda')),
  current_points integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists points_transactions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete set null,
  member_id text not null,
  points integer not null,
  reason text,
  category text,
  teacher_name text,
  remarks text,
  created_at timestamptz not null default now()
);

create index if not exists idx_points_transactions_member_id on points_transactions(member_id);
create index if not exists idx_points_transactions_created_at on points_transactions(created_at desc);
create index if not exists idx_students_house on students(house);

-- Auto-update students.current_points whenever a transaction is inserted
create or replace function apply_points_transaction()
returns trigger as $$
begin
  update students
  set current_points = current_points + new.points,
      updated_at = now()
  where id = new.student_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_apply_points_transaction on points_transactions;
create trigger trg_apply_points_transaction
after insert on points_transactions
for each row execute function apply_points_transaction();

alter table students enable row level security;
alter table points_transactions enable row level security;

-- Public read-only access (website dashboard/leaderboard). All writes go
-- through the backend API using the service_role key, which bypasses RLS.
drop policy if exists "public read students" on students;
create policy "public read students" on students
  for select using (true);

drop policy if exists "public read points_transactions" on points_transactions;
create policy "public read points_transactions" on points_transactions
  for select using (true);
