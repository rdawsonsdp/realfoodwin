-- 0020_brand_products_category.sql
--
-- Product-level food category for the brand catalog.
--
-- The brand-level `brands.category` is too coarse and free-text to drive swap
-- matching ("Snacks", "Meats", "Pantry Staples", ...). This column lets the
-- swap matcher filter brand_products by the food category a query classifies
-- into (e.g. "Frosted Flakes" -> cereal_granola) BEFORE ranking by embedding
-- similarity, instead of pure global cosine.
--
-- Closed taxonomy (keep in sync with the classifier enum in the swap runner):
--   cereal_granola, chips_crackers, cookies_baked, candy_chocolate, snack_bars,
--   jerky_meat_snacks, beverages, protein_supplements, meat_poultry_seafood,
--   dairy_eggs, pantry_condiments, tortillas_wraps, frozen_prepared_meals, other
--
-- ('other' is a real bucket for non-food merch/services that exist in the
-- catalog — t-shirts, farm-tour tickets, delivery fees — which should be
-- excluded from swap matching.)
--
-- The initial backfill of all 210 rows was done via an LLM classification pass
-- over (name, description, brand), not in this migration (not reproducible as
-- static SQL). This migration only adds the column + index.

alter table public.brand_products
  add column if not exists category text;

create index if not exists brand_products_category_idx
  on public.brand_products(category);
