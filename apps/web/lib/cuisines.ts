// Curated cuisine list. Each entry has a label + emoji + food/color hint
// used in the chip UI. Order roughly reflects US grocery-store volume.

export interface CuisineOption {
  value: string;
  label: string;
  emoji: string;
  tone: string; // tailwind bg class for the chip
}

export const CUISINES: CuisineOption[] = [
  { value: "italian", label: "Italian", emoji: "🍝", tone: "bg-coral-soft" },
  { value: "mexican", label: "Mexican", emoji: "🌮", tone: "bg-honey/60" },
  { value: "japanese", label: "Japanese", emoji: "🍱", tone: "bg-paper" },
  { value: "thai", label: "Thai", emoji: "🍜", tone: "bg-honey/60" },
  { value: "mediterranean", label: "Mediterranean", emoji: "🫒", tone: "bg-sage-soft" },
  { value: "indian", label: "Indian", emoji: "🍛", tone: "bg-coral-soft" },
  { value: "american", label: "American", emoji: "🍔", tone: "bg-honey/60" },
  { value: "french", label: "French", emoji: "🥖", tone: "bg-cream" },
  { value: "korean", label: "Korean", emoji: "🥢", tone: "bg-coral-soft" },
  { value: "vietnamese", label: "Vietnamese", emoji: "🍲", tone: "bg-sage-soft" },
  { value: "middle-eastern", label: "Middle Eastern", emoji: "🥙", tone: "bg-honey/60" },
  { value: "chinese", label: "Chinese", emoji: "🥡", tone: "bg-coral-soft" },
  { value: "caribbean", label: "Caribbean", emoji: "🍤", tone: "bg-honey/60" },
  { value: "soul-food", label: "Soul food", emoji: "🍗", tone: "bg-cream" },
];

export const OCCASIONS: CuisineOption[] = [
  { value: "weeknight-rescue", label: "Weeknight rescue", emoji: "⚡", tone: "bg-honey/60" },
  { value: "sunday-meal-prep", label: "Sunday meal prep", emoji: "📦", tone: "bg-sage-soft" },
  { value: "lunch-box", label: "Lunch box", emoji: "🥪", tone: "bg-cream" },
  { value: "quick-snack", label: "Quick snack", emoji: "🍎", tone: "bg-honey/60" },
  { value: "kids-favorite", label: "Kids' favorite", emoji: "🧒", tone: "bg-coral-soft" },
  { value: "date-night", label: "Date night", emoji: "🕯️", tone: "bg-coral-soft" },
  { value: "make-ahead", label: "Make-ahead", emoji: "📅", tone: "bg-sage-soft" },
  { value: "comfort-food", label: "Comfort food", emoji: "🥧", tone: "bg-honey/60" },
];

export const DISMISS_REASONS: { value: string; label: string }[] = [
  { value: "too-complex", label: "Too complex" },
  { value: "weird-ingredients", label: "Weird ingredients" },
  { value: "not-what-i-wanted", label: "Not what I wanted" },
  { value: "too-time-consuming", label: "Too time-consuming" },
  { value: "just-browsing", label: "Just browsing" },
];
