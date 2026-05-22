-- =========================================================================
-- 0012_grocery.sql
-- Grocery list: per-user shopping items, populated by "Add to Grocery List"
-- from the swap result popup. One row per ingredient. Items are check-off-
-- able; checked rows stay around so the user can re-uncheck them or rebuild
-- a list from history.
-- =========================================================================

create table if not exists public.grocery_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  swap_id     uuid references public.swaps(id) on delete set null,
  name        text not null,
  quantity    text,
  unit        text,
  checked     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists grocery_items_user_created_idx
  on public.grocery_items(user_id, created_at desc);
create index if not exists grocery_items_user_checked_idx
  on public.grocery_items(user_id, checked);
create index if not exists grocery_items_swap_id_idx
  on public.grocery_items(swap_id);

drop trigger if exists grocery_items_set_updated_at on public.grocery_items;
create trigger grocery_items_set_updated_at
  before update on public.grocery_items
  for each row execute function public.set_updated_at();

alter table public.grocery_items enable row level security;

drop policy if exists grocery_items_select on public.grocery_items;
create policy grocery_items_select on public.grocery_items
  for select to authenticated using (user_id = auth.uid());

drop policy if exists grocery_items_insert on public.grocery_items;
create policy grocery_items_insert on public.grocery_items
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists grocery_items_update on public.grocery_items;
create policy grocery_items_update on public.grocery_items
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists grocery_items_delete on public.grocery_items;
create policy grocery_items_delete on public.grocery_items
  for delete to authenticated using (user_id = auth.uid());
