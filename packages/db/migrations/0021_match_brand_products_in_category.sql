-- 0021_match_brand_products_in_category.sql
--
-- Category-filtered product matcher for the swap fallback.
--
-- After a typed query is classified into a food category (e.g. "Frosted
-- Flakes" -> cereal_granola), the swap runner pulls SAME-CATEGORY brand
-- products instead of running a blind global cosine search. This RPC mirrors
-- match_brand_products() but restricts to bp.category = cat and ranks within
-- that category by embedding similarity. Depends on 0020 (brand_products.category).

create or replace function public.match_brand_products_in_category(
  query_embedding vector,
  cat text,
  k integer default 8
)
returns table(
  id uuid, brand_id uuid, brand_name text, name text,
  description text, product_url text, image_url text, similarity real
)
language sql stable
as $function$
  select
    bp.id,
    bp.brand_id,
    b.name as brand_name,
    bp.name,
    bp.description,
    bp.product_url,
    bp.image_url,
    1 - (bp.embedding <=> query_embedding) as similarity
  from public.brand_products bp
  join public.brands b on b.id = bp.brand_id
  where bp.embedding is not null
    and bp.category = cat
  order by bp.embedding <=> query_embedding
  limit k;
$function$;
