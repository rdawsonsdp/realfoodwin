// Anonymous-visitor hero. Full-bleed produce-bag photo as the backdrop with
// "REAL FOOD WIN" set across the top in oversized warm-cream type. The right
// side is reserved for the quiet copy + value props so the produce reads.

export function HeroSplash() {
  return (
    <section className="relative overflow-hidden rounded-soft mb-16 ring-1 ring-ink/5 shadow-card bg-paper">
      {/* Full-bleed background image */}
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/hero-fresh-bag.webp"
          alt="Paper grocery bag spilling fresh produce — parsley, tomatoes, eggplant, lemon, cauliflower, banana, walnuts"
          className="w-full h-full object-cover"
          loading="eager"
        />
        {/* Warm overlay tints the photo to match the palette without burying it */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(115deg, rgba(255,243,214,0.65) 0%, rgba(255,213,107,0.18) 35%, rgba(255,255,255,0) 60%, rgba(26,26,46,0.18) 100%)",
          }}
        />
      </div>

      {/* "REAL FOOD WIN" oversized backdrop type */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-4 md:top-6 px-6 md:px-12 select-none pointer-events-none"
      >
        <h1
          className="font-black tracking-[-0.04em] leading-[0.85] text-ink/85 mix-blend-multiply"
          style={{ fontSize: "clamp(56px, 13vw, 180px)" }}
        >
          REAL <span className="text-sunrise-700">FOOD</span> WIN
        </h1>
      </div>

      {/* Foreground copy — anchored bottom-left so the produce reads through the top half */}
      <div className="relative px-6 md:px-12 pt-[36vw] md:pt-[24vw] lg:pt-[20vw] pb-10 md:pb-12">
        <div className="max-w-xl bg-white/85 backdrop-blur-sm rounded-soft p-6 md:p-7 shadow-card ring-1 ring-ink/5">
          <div className="badge-tuned mb-3">
            <span className="mr-1.5">✦</span> AI real-food coach
          </div>
          <p className="text-2xl md:text-3xl font-bold leading-tight tracking-tight text-ink">
            Type a junk food.
            <br />
            Get a <span className="text-sunrise-700">real-food swap</span>{" "}
            tuned to your kitchen.
          </p>
          <p className="text-ink-soft mt-3 leading-relaxed">
            Snickers, Doritos, Pop-Tarts, frozen pizza — name it. Complete recipe with real ingredients, nutrition compared, and what's wrong with the original.
          </p>

          <ul className="mt-4 space-y-1.5 text-sm text-ink-soft">
            <li className="flex items-start gap-2">
              <CheckBadge /> <span>Tuned to your allergies, household & weeknight time</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckBadge /> <span>100+ real recipes, no boxes, no fillers</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckBadge /> <span>Your data never leaves the platform</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Tiny brand stripe along the bottom */}
      <div className="relative bg-ink/85 text-white text-xs text-center py-2 px-4 backdrop-blur-sm">
        <em>Replace ultra-processed food with real food, family by family.</em>
      </div>
    </section>
  );
}

function CheckBadge() {
  return (
    <span className="mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-pill bg-sage text-white flex-shrink-0">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}
