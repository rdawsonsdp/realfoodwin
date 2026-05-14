import { Nav } from "@/components/Nav";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  const supabase = createSupabaseServer();
  const { data: brands } = await supabase
    .from("brands")
    .select("id, name, category, description, certifications")
    .order("name");

  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight">Brand directory</h1>
          <p className="text-ink-soft mt-2">Real-food brands we trust.</p>
        </header>

        <div className="grid md:grid-cols-2 gap-4">
          {brands?.map((b) => (
            <article key={b.id} className="card p-6 hover:shadow-warm transition-shadow">
              <div className="text-xs text-ink-muted uppercase tracking-wider mb-1">
                {b.category ?? "Brand"}
              </div>
              <h3 className="font-bold text-lg text-ink mb-2">{b.name}</h3>
              {b.description && (
                <p className="text-sm text-ink-soft mb-3">{b.description}</p>
              )}
              {b.certifications && b.certifications.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {b.certifications.map((c: string) => (
                    <span
                      key={c}
                      className="text-xs px-2 py-0.5 rounded-pill bg-sage-soft text-ink"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </article>
          )) ?? <p className="text-ink-muted">No brands yet.</p>}
        </div>
      </main>
    </>
  );
}
