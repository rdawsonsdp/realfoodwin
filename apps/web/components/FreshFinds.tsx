import Link from "next/link";

// Horizontal photo strip for logged-in users — popular swaps as plate photos.
// Each card links to /?q={junk} which SwapHero picks up via useSearchParams
// and auto-runs as a swap. Decorative + functional.

const FEATURED = [
  {
    src: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=500&q=75&auto=format&fit=crop",
    alt: "Date and chocolate bites",
    junk: "Snickers",
    swap: "Homemade Snickers Bites",
    accent: "bg-honey/40",
  },
  {
    src: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=75&auto=format&fit=crop",
    alt: "Real-food smash burger",
    junk: "Big Mac",
    swap: "Real-Food Smash Burger",
    accent: "bg-coral-soft",
  },
  {
    src: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=500&q=75&auto=format&fit=crop",
    alt: "Crispy baked tortilla chips",
    junk: "Doritos",
    swap: "Real-Cheese Tortilla Chips",
    accent: "bg-honey/40",
  },
  {
    src: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=500&q=75&auto=format&fit=crop",
    alt: "Almond flour cookies stacked",
    junk: "Oreos",
    swap: "Almond Flour Sandwich Cookies",
    accent: "bg-cream",
  },
  {
    src: "https://images.unsplash.com/photo-1517433367423-c7e5b0f35086?w=500&q=75&auto=format&fit=crop",
    alt: "Overnight oats with berries",
    junk: "Pop-Tarts",
    swap: "Five-Minute Overnight Oats",
    accent: "bg-sage-soft",
  },
  {
    src: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=500&q=75&auto=format&fit=crop",
    alt: "Chicken tenders with honey mustard",
    junk: "Chicken Nuggets",
    swap: "Real-Ingredient Chicken Tenders",
    accent: "bg-honey/40",
  },
];

export function FreshFinds() {
  return (
    <section className="mb-12">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2 text-paper">
            <span>🌿</span> Fresh today
          </h2>
          <p className="text-sm text-paper/70">
            Popular swaps the community is cooking — tap one to see it tuned for you.
          </p>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-3 -mx-2 px-2 snap-x">
        {FEATURED.map((f) => (
          <Link
            key={f.junk}
            href={`/?q=${encodeURIComponent(f.junk)}`}
            className="snap-start flex-shrink-0 w-56 group"
          >
            <div className="relative rounded-soft overflow-hidden aspect-[4/5] shadow-card ring-1 ring-ink/5 group-hover:shadow-warm group-hover:-translate-y-0.5 transition-all">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={f.src}
                alt={f.alt}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                <div
                  className={`inline-block text-[10px] uppercase tracking-[0.15em] font-semibold px-2 py-0.5 rounded-pill ${f.accent} text-ink mb-2`}
                >
                  {f.junk} swap
                </div>
                <h3 className="font-bold leading-tight text-base">{f.swap}</h3>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
