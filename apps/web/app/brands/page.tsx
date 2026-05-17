import { Nav } from "@/components/Nav";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface BrandRow {
  id: string;
  name: string;
  logo_url?: string | null;
  website_url?: string | null;
  url?: string | null;
  brand_products?: BrandProduct[] | null;
}

interface BrandProduct {
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
        <header className="mb-8 md:mb-10 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-paper">
            Real Food <span className="italic font-serif text-coral">Brands</span>
          </h1>
          <p className="text-paper/80 mt-3 max-w-2xl mx-auto">
            Brands we trust. Tap any tile to visit the brand directly.
          </p>
        </header>

        {brands.length === 0 ? (
          <p className="text-paper/70 text-center">No brands yet.</p>
        ) : (
          <div className="space-y-8">
            {brands.map((b) => {
              const href = b.website_url ?? b.url ?? null;
              const products = (b.brand_products ?? []).slice().sort(
                (a, b) => ((a as { sort_order?: number }).sort_order ?? 0) - ((b as { sort_order?: number }).sort_order ?? 0),
              );
              return (
                <section key={b.id} className="space-y-3">
                  <BrandHeader brand={b} href={href} />
                  {products.length > 0 && (
                    <BrandProductsRow products={products} brandName={b.name} />
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}

function BrandHeader({
  brand,
  href,
}: {
  brand: BrandRow;
  href: string | null;
}) {
  const inner = (
    <div className="card p-4 flex items-center gap-4 hover:shadow-warm transition-shadow">
      {brand.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={brand.logo_url}
          alt={`${brand.name} logo`}
          className="w-16 h-16 object-contain"
          loading="lazy"
        />
      ) : (
        <div className="w-16 h-16 rounded-soft bg-gradient-to-br from-cream to-honey/40 ring-1 ring-ink/10 grid place-items-center text-2xl">
          🥗
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h2 className="font-bold text-lg text-ink truncate">{brand.name}</h2>
        {href && (
          <p className="text-xs text-ink-muted truncate">{stripScheme(href)}</p>
        )}
      </div>
      {href && (
        <span className="text-sm text-coral font-semibold whitespace-nowrap">
          Visit →
        </span>
      )}
    </div>
  );
  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Visit ${brand.name}`}
      className="block"
    >
      {inner}
    </a>
  ) : (
    <div>{inner}</div>
  );
}

function BrandProductsRow({
  products,
  brandName,
}: {
  products: BrandProduct[];
  brandName: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-paper/60 mb-2 pl-2">
        Products we like
      </p>
      <div className="flex gap-3 overflow-x-auto scroll-row -mx-4 px-4 md:mx-0 md:px-0 pb-2">
        {products.map((p) => (
          <a
            key={p.id}
            href={p.product_url ?? "#"}
            target={p.product_url ? "_blank" : undefined}
            rel={p.product_url ? "noopener noreferrer" : undefined}
            className="card p-3 w-44 shrink-0 hover:shadow-warm transition-shadow flex flex-col gap-2"
            aria-label={`${brandName}: ${p.name}`}
          >
            {p.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.image_url}
                alt={p.name}
                className="w-full h-24 object-contain bg-paper rounded-soft"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-24 rounded-soft bg-gradient-to-br from-cream to-honey/40 ring-1 ring-ink/10 grid place-items-center text-3xl">
                🥗
              </div>
            )}
            <div className="text-sm font-semibold text-ink line-clamp-2 leading-tight">
              {p.name}
            </div>
            {p.description && (
              <div className="text-xs text-ink-muted line-clamp-2">{p.description}</div>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}

function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
