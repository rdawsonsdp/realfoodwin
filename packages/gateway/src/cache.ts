import { getServiceSupabase } from "./supabase.js";

export interface CachedSwap {
  id: string;
  user_id: string | null;
  product_id: string;
  recipe: unknown;
  nutrition: unknown;
  narrative: string;
  created_at: string;
}

export async function getCachedSwap(
  userId: string,
  productId: string,
): Promise<CachedSwap | null> {
  const sb = getServiceSupabase();
  const { data } = await sb
    .from("swaps")
    .select("*")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as CachedSwap | null) ?? null;
}

export interface CacheSwapInput {
  user_id: string | null;
  product_id: string | null;
  recipe: unknown;
  nutrition: unknown;
  narrative: string;
  base_swap_id?: string | null;
}

export async function cacheSwap(input: CacheSwapInput): Promise<CachedSwap> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("swaps")
    .insert({
      user_id: input.user_id,
      product_id: input.product_id,
      recipe: input.recipe,
      nutrition: input.nutrition,
      narrative: input.narrative,
      base_swap_id: input.base_swap_id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as CachedSwap;
}
