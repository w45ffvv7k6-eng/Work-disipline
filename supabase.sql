-- À coller dans Supabase → SQL Editor → Run.
-- Une ligne par personne, contenant toutes ses données de l'appli.
create table if not exists public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Sécurité : chaque personne ne peut lire et modifier QUE ses propres données.
alter table public.user_data enable row level security;

create policy "lire ses donnees" on public.user_data
  for select using (auth.uid() = user_id);
create policy "creer ses donnees" on public.user_data
  for insert with check (auth.uid() = user_id);
create policy "modifier ses donnees" on public.user_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "supprimer ses donnees" on public.user_data
  for delete using (auth.uid() = user_id);
