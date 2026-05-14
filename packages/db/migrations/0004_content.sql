-- =========================================================================
-- 0004_content.sql
-- Content layer: products, swaps, recipes, recipe_variants, brands.
--
-- Notes:
-- * `products.barcode` is UNIQUE NULLABLE (spec): we accept products with
--   no barcode (e.g. fresh produce, manual entry).
-- * `swaps.user_id` is NULLABLE: canonical (non-personalized) swaps have
--   no owner, while cached personalized variants are tied to a user.
-- * Cross-content soft references (swaps → products, variants → recipes)
--   use ON DELETE RESTRICT or SET NULL — we don't want a product cleanup
--   to wipe a user's saved variant.
-- =========================================================================

-- -------------------------------------------------------------------------
-- brands
-- -------------------------------------------------------------------------
-- Brand directory ported from the current site (spec 9 Phase 1). Public
-- read, service-role writes (admin-curated).
create table if not exists public.brands (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  category        text,
  description     text,
  certifications  text[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists brands_name_unique_idx on public.brands(lower(name));
create index if not exists brands_category_idx on public.brands(category);

drop trigger if exists brands_set_updated_at on public.brands;
create trigger brands_set_updated_at
  before update on public.brands
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- products
-- -------------------------------------------------------------------------
-- Cached product data from Barcode Resolution Service (spec 5.5).
-- Sources: 'open_food_facts', 'sonnet', 'manual', 'seed'. `confidence`
-- is null for high-trust sources and 'low'/'review' for Sonnet fallbacks
-- pending admin review (Phase 2 dashboard).
create table if not exists public.products (
  id                    uuid primary key default gen_random_uuid(),
  barcode               text unique,                  -- UNIQUE NULLABLE per spec
  name                  text not null,
  brand                 text,
  category              text,
  canonical_ingredients text[] not null default '{}',
  nutrition_facts       jsonb not null default '{}'::jsonb,
  source                text not null default 'manual'
                          check (source in ('open_food_facts', 'sonnet', 'manual', 'seed')),
  confidence            text check (confidence is null or confidence in ('high', 'low', 'review')),
  last_refreshed        timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists products_name_idx on public.products(lower(name));
create index if not exists products_brand_idx on public.products(lower(brand));
create index if not exists products_category_idx on public.products(category);
create index if not exists products_source_confidence_idx on public.products(source, confidence);

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- recipes
-- -------------------------------------------------------------------------
-- Canonical recipe library (spec 9 Phase 1: ported from current site).
-- Public read, service-role writes. User-authored variants live in
-- `recipe_variants` below.
create table if not exists public.recipes (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  ingredients  jsonb not null default '[]'::jsonb,
  steps        jsonb not null default '[]'::jsonb,
  time_min     integer check (time_min is null or time_min > 0),
  difficulty   text check (difficulty is null or difficulty in ('easy', 'medium', 'hard')),
  meal_type    text,                                     -- 'breakfast', 'lunch', 'dinner', 'snack', ...
  tags         text[] not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists recipes_meal_type_idx on public.recipes(meal_type);
create index if not exists recipes_tags_gin_idx on public.recipes using gin (tags);
create index if not exists recipes_title_idx on public.recipes(lower(title));

drop trigger if exists recipes_set_updated_at on public.recipes;
create trigger recipes_set_updated_at
  before update on public.recipes
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- recipe_variants
-- -------------------------------------------------------------------------
-- User-iterated variants of a parent recipe (spec 4.4: iteration produces
-- a variant tied to the parent). ON DELETE CASCADE from users because a
-- variant has no meaning without its author; ON DELETE RESTRICT from the
-- parent recipe so we don't accidentally orphan many variants on a content
-- delete (the parent should never be deleted while variants exist).
create table if not exists public.recipe_variants (
  id                uuid primary key default gen_random_uuid(),
  parent_recipe_id  uuid not null references public.recipes(id) on delete restrict,
  user_id           uuid not null references public.users(id) on delete cascade,
  modification      text,                                -- free-text request like "make dairy-free"
  recipe            jsonb not null default '{}'::jsonb,  -- full variant body (ingredients + steps)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists recipe_variants_user_id_idx on public.recipe_variants(user_id);
create index if not exists recipe_variants_parent_id_idx on public.recipe_variants(parent_recipe_id);

drop trigger if exists recipe_variants_set_updated_at on public.recipe_variants;
create trigger recipe_variants_set_updated_at
  before update on public.recipe_variants
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- swaps
-- -------------------------------------------------------------------------
-- Cached swap output (spec 5.4 step 12: Gateway writes swap to `swaps`
-- table tagged to user). Two flavors:
--   * Canonical/anonymous swap: user_id NULL, base for personalization
--   * Personalized variant:     user_id set, base_swap_id points to base
--
-- ON DELETE SET NULL from products: if a product is purged, we don't want
-- to lose the swap history (which is part of the user's audit trail).
-- ON DELETE CASCADE from users: personalized variants vanish with the user.
create table if not exists public.swaps (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid references public.products(id) on delete set null,
  user_id       uuid references public.users(id) on delete cascade,
  base_swap_id  uuid references public.swaps(id) on delete set null,
  recipe        jsonb not null default '{}'::jsonb,
  nutrition     jsonb not null default '{}'::jsonb,
  narrative     text,
  created_at    timestamptz not null default now()
);

-- Lookup pattern: "cached personalized swap for (user_id, product_id)" — spec 5.4 step 8.
create index if not exists swaps_user_product_idx on public.swaps(user_id, product_id);
create index if not exists swaps_product_id_idx on public.swaps(product_id);
create index if not exists swaps_base_swap_id_idx on public.swaps(base_swap_id);
-- Canonical swaps (user_id null) are the basis for personalization.
create index if not exists swaps_canonical_idx on public.swaps(product_id) where user_id is null;
