import { Nav } from "@/components/Nav";
import { createSupabaseServer } from "@/lib/supabase/server";
import { BrandsDirectory } from "@/components/BrandsDirectory";

export const dynamic = "force-dynamic";

export interface BrandRow {
  id: string;
  name: string;
  category?: string | null;
  description?: string | null;
  logo_url?: string | null;
  website_url?: string | null;
  url?: string | null;
  brand_products?: BrandProduct[] | null;
}

export interface BrandProduct {
  id: string;
  name: string;
  description?: string | null;
  product_url?: string | null;
  image_url?: string | null;
}

export default async function BrandsPage() {
  const supabase = createSupabaseServer();

  // brand_products join is optional — if the table doesn't exist yet the
  // query falls back to a brands-only fetch so the page never blanks out.
  let brands: BrandRow[] = [];
  const joined = await supabase
    .from("brands")
    .select("*, brand_products(id, name, description, product_url, image_url, sort_order)")
    .order("name");
  if (joined.error) {
    const fallback = await supabase.from("brands").select("*").order("name");
    brands = (fallback.data ?? []) as BrandRow[];
  } else {
    brands = (joined.data ?? []) as BrandRow[];
  }

  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <header className="mb-6 md:mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-paper">
            Real Food <span className="italic font-serif text-coral">Brands</span>
          </h1>
          <p className="text-paper/80 mt-3 max-w-2xl mx-auto">
            Brands we trust. Filter by category, read what they make, and tap to visit.
          </p>
        </header>
        <BrandsDirectory brands={brands} />
      </main>
    </>
  );
}
