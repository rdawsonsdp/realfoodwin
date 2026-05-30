// Visual marker pills. The Swap Generator emits keys from a closed taxonomy
// describing what's wrong with the original ultra-processed product and
// what's right about the real-food swap; this component turns each key
// into an emoji-labeled pill so the story reads visually first and the
// text reinforces it.
//
// The keys MUST stay in lockstep with BAD_MARKERS / GOOD_MARKERS in
// packages/agents/src/swap-generator.ts. If a key arrives that isn't in
// the map below we render a neutral fallback pill rather than crashing —
// the agent could add a new key before the UI ships.

type BadKey = string;
type GoodKey = string;

interface MarkerEntry {
  emoji: string;
  label: string;
  // Longer-form explanation shown on hover/long-press.
  hint: string;
}

// Bad markers — coral pills under the ORIGINAL ultra-processed product.
const BAD: Record<BadKey, MarkerEntry> = {
  seed_oils: {
    emoji: "🛢️",
    label: "Seed oils",
    hint: "Contains canola, soy, sunflower, safflower, cottonseed, or corn oil.",
  },
  hfcs: {
    emoji: "🌽",
    label: "HFCS",
    hint: "Contains high-fructose corn syrup.",
  },
  refined_sugar: {
    emoji: "🍬",
    label: "Refined sugar",
    hint: "Significant added refined sugar (cane sugar, dextrose, etc.).",
  },
  artificial_colors: {
    emoji: "🎨",
    label: "Artificial colors",
    hint: "Contains FD&C colors (Red 40, Yellow 5, etc.).",
  },
  artificial_flavors: {
    emoji: "👃",
    label: "Artificial flavors",
    hint: "Contains 'natural flavor' or 'artificial flavor' additives.",
  },
  artificial_sweeteners: {
    emoji: "💊",
    label: "Artificial sweeteners",
    hint: "Contains aspartame, sucralose, ace-K, or saccharin.",
  },
  msg: {
    emoji: "⚗️",
    label: "MSG",
    hint: "Contains monosodium glutamate or hidden MSG (autolyzed yeast, etc.).",
  },
  hydrogenated_oils: {
    emoji: "🧪",
    label: "Trans fat",
    hint: "Contains hydrogenated or partially-hydrogenated oils.",
  },
  synthetic_preservatives: {
    emoji: "🥫",
    label: "Synthetic preservatives",
    hint: "Contains BHT, BHA, sodium benzoate, TBHQ, or calcium propionate.",
  },
  fried: {
    emoji: "🍟",
    label: "Fried",
    hint: "Deep-fried or pan-fried (typically in seed oil).",
  },
  ultra_processed: {
    emoji: "⚙️",
    label: "Ultra-processed",
    hint: "Made primarily of extracted, refined ingredients (NOVA 4).",
  },
  gmo: {
    emoji: "🌾",
    label: "GMO",
    hint: "Likely contains GMO ingredients (corn, soy, sugar beet derivatives).",
  },
};

// Good markers — sage pills under the REAL-FOOD swap.
const GOOD: Record<GoodKey, MarkerEntry> = {
  whole_food: {
    emoji: "🥑",
    label: "Whole-food only",
    hint: "Every ingredient is a whole, recognizable food.",
  },
  no_seed_oils: {
    emoji: "✅🛢️",
    label: "No seed oils",
    hint: "Cooked in butter, ghee, tallow, olive, avocado, or coconut oil.",
  },
  no_added_sugar: {
    emoji: "✅🍬",
    label: "No added sugar",
    hint: "Sweetness comes only from whole-food sources (dates, fruit, honey).",
  },
  no_artificial_anything: {
    emoji: "✨",
    label: "No artificial anything",
    hint: "No artificial colors, flavors, sweeteners, or preservatives.",
  },
  organic: {
    emoji: "🌱",
    label: "Organic",
    hint: "Made with organic ingredients.",
  },
  grass_fed: {
    emoji: "🐄",
    label: "Grass-fed",
    hint: "Features grass-fed dairy or meat.",
  },
  high_protein: {
    emoji: "💪",
    label: "High protein",
    hint: "≥15g protein per serving.",
  },
  high_fiber: {
    emoji: "🌾",
    label: "High fiber",
    hint: "≥5g fiber per serving.",
  },
  made_fresh: {
    emoji: "🍳",
    label: "Made fresh",
    hint: "Prepared from scratch, not packaged.",
  },
  low_sugar: {
    emoji: "📉",
    label: "Low sugar",
    hint: "≤5g total sugar per serving.",
  },
  dairy_free: {
    emoji: "🚫🥛",
    label: "Dairy-free",
    hint: "Contains no dairy.",
  },
  gluten_free: {
    emoji: "🌾🚫",
    label: "Gluten-free",
    hint: "Contains no gluten.",
  },
};

interface Props {
  markers: string[];
  variant: "bad" | "good";
  // Tighter padding for in-card use; larger for hero strips.
  size?: "sm" | "md";
}

export function MarkerBadges({ markers, variant, size = "md" }: Props) {
  if (!markers || markers.length === 0) return null;

  const tone =
    variant === "bad"
      ? "bg-coral-soft text-ink ring-1 ring-coral/40"
      : "bg-sage-soft text-forest-700 ring-1 ring-forest-700/20";

  const padding = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";

  const map = variant === "bad" ? BAD : GOOD;

  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={variant === "bad" ? "What's wrong with the original" : "What's good about this swap"}>
      {markers.map((key) => {
        const entry = map[key];
        const emoji = entry?.emoji ?? (variant === "bad" ? "⚠️" : "✅");
        const label = entry?.label ?? key.replace(/_/g, " ");
        const hint = entry?.hint ?? "";
        return (
          <li key={key}>
            <span
              className={`inline-flex items-center gap-1 rounded-pill font-semibold ${tone} ${padding}`}
              title={hint}
            >
              <span aria-hidden className="leading-none">{emoji}</span>
              <span className="leading-none">{label}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
