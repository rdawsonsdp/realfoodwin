-- =========================================================================
-- 0014_rating_target_product.sql
-- Extends recipe_ratings.target_type to accept 'product' so users can rate
-- the brand product a swap surfaced (in addition to the matched recipe).
-- The aggregate view (recipe_ratings_aggregate) already groups by
-- (target_type, target_id) so no view change needed.
-- =========================================================================

alter table public.recipe_ratings
  drop constraint if exists recipe_ratings_target_type_check;
alter table public.recipe_ratings
  add constraint recipe_ratings_target_type_check
  check (target_type in ('recipe', 'swap', 'variant', 'product'));
