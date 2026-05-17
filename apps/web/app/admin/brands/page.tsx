import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";
import { BrandsAdmin } from "@/components/BrandsAdmin";

export const dynamic = "force-dynamic";

export interface AdminBrand {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  website_url: string | null;
  logo_url: string | null;
  certifications: string[] | null;
  brand_products: AdminBrandProduct[];
}

export interface AdminBrandProduct {
  id: string;
  brand_id: string;
  name: string;
  description: string | null;
  product_url: string | null;
  image_url: string | null;
  tags: string[] | null;
  sort_order: number;
}

export default async function AdminBrandsPage() {
  const admin = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const { data } = await admin
    .from("brands")
    .select("*, brand_products(*)")
    .order("name");

  const brands: AdminBrand[] = (data ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    category: b.category ?? null,
    description: b.description ?? null,
    website_url: b.website_url ?? null,
    logo_url: b.logo_url ?? null,
    certifications: b.certifications ?? null,
    brand_products: (b.brand_products ?? []) as AdminBrandProduct[],
  }));

  return (
    <div className="space-y-4">
      <p className="text-sm text-paper/80">
        Manage real-food brands and the curated products under each. Public users see brand cards on /brands tap-through to the brand site, with the curated products underneath.
      </p>
      <BrandsAdmin initial={brands} />
    </div>
  );
}
