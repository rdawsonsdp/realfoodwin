import { Nav } from "@/components/Nav";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface BrandRow {
  id: string;
  name: string;
  // Optional — the seed data may add these later. We `select *` so the page
  // doesn't break before / after the columns ship.
  logo_url?: string | null;
  website_url?: string | null;
  url?: string | null;
}

export default async function BrandsPage() {
  const supabase = createSupabaseServer();
  const { data } = await supabase.from("brands").select("*").order("name");
  const brands = (data ?? []) as BrandRow[];

  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-10 text-center">
          <h1 className="text-5xl font-bold tracking-tight text-paper">
            Real Food <span className="italic font-serif text-coral">Brands</span>
          </h1>
          <p className="text-paper/80 mt-3 max-w-2xl mx-auto">
            Brands we trust. Tap any tile to visit the brand directly.
          </p>
        </header>

        {brands.length === 0 ? (
          <p className="text-paper/70 text-center">No brands yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {brands.map((b) => {
              const href = b.website_url ?? b.url ?? null;
              const inner = (
                <div className="card p-4 flex flex-col items-center justify-center text-center gap-3 hover:shadow-warm hover:-translate-y-0.5 transition-all h-full">
                  {b.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.logo_url}
                      alt={`${b.name} logo`}
                      className="w-24 h-24 object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-soft bg-gradient-to-br from-cream to-honey/40 ring-1 ring-ink/10 grid place-items-center">
                      <div className="text-center leading-tight px-2">
                        <div className="text-3xl mb-1" aria-hidden>🥗</div>
                        <div className="text-[9px] font-bold uppercase tracking-widest text-ink-soft line-clamp-2">
                          {b.name ?? "No image"}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="text-sm font-semibold text-ink truncate w-full">
                    {b.name}
                  </div>
                </div>
              );
              return href ? (
                <a
                  key={b.id}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                  aria-label={`Visit ${b.name}`}
                >
                  {inner}
                </a>
              ) : (
                <div key={b.id}>{inner}</div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
