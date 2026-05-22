// Home background themes. Each one renders as a CSS background on the v3
// home wrapper. `tone` controls the default text color on top — most themes
// are dark and use the cream "paper" palette; light themes flip to "ink".
//
// Keep this list small but distinctive. Patterns use inline SVG so we don't
// need extra build steps or assets.

export type ThemeTone = "paper" | "ink";

export interface HomeTheme {
  id: string;
  name: string;
  description: string;
  /** CSS background value applied to the outer wrapper. */
  background: string;
  /** Tone of foreground text on this background. */
  tone: ThemeTone;
  /** Small swatch background for the picker chip. */
  swatch: string;
}

// Each helper returns a CSS `background` value: the SVG pattern URL drawn
// on top of a flat background color. Patterns are kept tile-able and tiny
// so they ship inline with no extra requests.

function svgBg(svg: string, bg: string): string {
  return `${bg} url("data:image/svg+xml;utf8,${svg.replace(/#/g, "%23").replace(/\n/g, "")}")`;
}

const dotPattern = (color: string, bg: string) =>
  svgBg(
    `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><circle cx='2' cy='2' r='1.2' fill='${color}'/></svg>`,
    bg,
  );

const gridPattern = (color: string, bg: string) =>
  svgBg(
    `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><path d='M0 0H40V40' fill='none' stroke='${color}' stroke-width='0.75'/></svg>`,
    bg,
  );

const diagonalStripePattern = (color: string, bg: string) =>
  svgBg(
    `<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'><path d='M-2 14L14 -2M-2 6L6 -2M6 14L14 6' stroke='${color}' stroke-width='1.2'/></svg>`,
    bg,
  );

const crosshatchPattern = (color: string, bg: string) =>
  svgBg(
    `<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 14 14'><path d='M0 0L14 14M14 0L0 14' stroke='${color}' stroke-width='0.7'/></svg>`,
    bg,
  );

const trianglePattern = (color: string, bg: string) =>
  svgBg(
    `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'><path d='M14 5L24 22H4z' fill='none' stroke='${color}' stroke-width='1'/></svg>`,
    bg,
  );

const plusPattern = (color: string, bg: string) =>
  svgBg(
    `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><path d='M11 6V18M5 12H17' stroke='${color}' stroke-width='1.4' stroke-linecap='round'/></svg>`,
    bg,
  );

const waveyPattern = (color: string, bg: string) =>
  svgBg(
    `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='12' viewBox='0 0 48 12'><path d='M0 6 Q 12 0 24 6 T 48 6' fill='none' stroke='${color}' stroke-width='1.2'/></svg>`,
    bg,
  );

const chevronPattern = (color: string, bg: string) =>
  svgBg(
    `<svg xmlns='http://www.w3.org/2000/svg' width='30' height='15' viewBox='0 0 30 15'><path d='M0 12L15 3L30 12' fill='none' stroke='${color}' stroke-width='1.2'/></svg>`,
    bg,
  );

const honeycombPattern = (color: string, bg: string) =>
  svgBg(
    `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='32' viewBox='0 0 28 32'><path d='M14 1L26 8V24L14 31L2 24V8z M14 1V0M26 24L28 25M2 24L0 25' fill='none' stroke='${color}' stroke-width='0.9'/></svg>`,
    bg,
  );

const starPattern = (color: string, bg: string) =>
  svgBg(
    `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><g fill='${color}'><path d='M8 8 L9 11 L12 11 L9.5 13 L10.5 16 L8 14 L5.5 16 L6.5 13 L4 11 L7 11z'/><circle cx='28' cy='30' r='1'/><circle cx='32' cy='10' r='0.8'/></g></svg>`,
    bg,
  );

const topoPattern = (color: string, bg: string) =>
  svgBg(
    `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><g fill='none' stroke='${color}' stroke-width='0.8'><ellipse cx='40' cy='40' rx='32' ry='22'/><ellipse cx='40' cy='40' rx='22' ry='14'/><ellipse cx='40' cy='40' rx='12' ry='7'/></g></svg>`,
    bg,
  );

const polkaPattern = (color: string, bg: string) =>
  svgBg(
    `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><circle cx='10' cy='10' r='3' fill='${color}'/><circle cx='30' cy='30' r='3' fill='${color}'/></svg>`,
    bg,
  );

export const HOME_THEMES: HomeTheme[] = [
  {
    id: "slate",
    name: "Slate",
    description: "Default deep ink.",
    background: "#1B1F2C",
    tone: "paper",
    swatch: "#1B1F2C",
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Indigo to plum gradient.",
    background: "linear-gradient(135deg, #1a1e3a 0%, #3a1f4a 60%, #1a1e3a 100%)",
    tone: "paper",
    swatch: "linear-gradient(135deg, #1a1e3a, #3a1f4a)",
  },
  {
    id: "forest",
    name: "Forest",
    description: "Pine green into deep moss.",
    background: "linear-gradient(160deg, #1a3a2d 0%, #0e2620 100%)",
    tone: "paper",
    swatch: "linear-gradient(135deg, #1a3a2d, #0e2620)",
  },
  {
    id: "sunrise",
    name: "Sunrise",
    description: "Coral, honey, and dawn.",
    background: "linear-gradient(160deg, #2a1018 0%, #6b2b2f 45%, #d9925a 100%)",
    tone: "paper",
    swatch: "linear-gradient(135deg, #6b2b2f, #d9925a)",
  },
  {
    id: "plum",
    name: "Plum",
    description: "Berry to wine.",
    background: "linear-gradient(160deg, #2a1530 0%, #4d1d3b 100%)",
    tone: "paper",
    swatch: "linear-gradient(135deg, #2a1530, #4d1d3b)",
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Teal into deep cobalt.",
    background: "linear-gradient(160deg, #06343f 0%, #0e1c4a 100%)",
    tone: "paper",
    swatch: "linear-gradient(135deg, #06343f, #0e1c4a)",
  },
  {
    id: "dots",
    name: "Confetti",
    description: "Subtle dots on slate.",
    background: dotPattern("rgba(245, 232, 209, 0.18)", "#1B1F2C"),
    tone: "paper",
    swatch: dotPattern("rgba(245, 232, 209, 0.4)", "#1B1F2C"),
  },
  {
    id: "polka",
    name: "Polka",
    description: "Bigger dots, soft cream.",
    background: polkaPattern("rgba(245, 232, 209, 0.10)", "#1f1c2c"),
    tone: "paper",
    swatch: polkaPattern("rgba(245, 232, 209, 0.30)", "#1f1c2c"),
  },
  {
    id: "grid",
    name: "Graph paper",
    description: "Faint grid on forest green.",
    background: gridPattern("rgba(245, 232, 209, 0.10)", "#15302a"),
    tone: "paper",
    swatch: gridPattern("rgba(245, 232, 209, 0.30)", "#15302a"),
  },
  {
    id: "stripes",
    name: "Stripes",
    description: "Diagonal lines on indigo.",
    background: diagonalStripePattern("rgba(245, 232, 209, 0.10)", "#1a1e3a"),
    tone: "paper",
    swatch: diagonalStripePattern("rgba(245, 232, 209, 0.32)", "#1a1e3a"),
  },
  {
    id: "crosshatch",
    name: "Crosshatch",
    description: "Etched lines on plum.",
    background: crosshatchPattern("rgba(245, 232, 209, 0.10)", "#2a1530"),
    tone: "paper",
    swatch: crosshatchPattern("rgba(245, 232, 209, 0.30)", "#2a1530"),
  },
  {
    id: "chevron",
    name: "Chevron",
    description: "Zig-zag on cobalt.",
    background: chevronPattern("rgba(245, 232, 209, 0.10)", "#0e1c4a"),
    tone: "paper",
    swatch: chevronPattern("rgba(245, 232, 209, 0.32)", "#0e1c4a"),
  },
  {
    id: "wavey",
    name: "Wavey",
    description: "Soft ripples on teal.",
    background: waveyPattern("rgba(245, 232, 209, 0.12)", "#06343f"),
    tone: "paper",
    swatch: waveyPattern("rgba(245, 232, 209, 0.32)", "#06343f"),
  },
  {
    id: "triangles",
    name: "Triangles",
    description: "Geometric prisms on slate.",
    background: trianglePattern("rgba(245, 232, 209, 0.10)", "#1B1F2C"),
    tone: "paper",
    swatch: trianglePattern("rgba(245, 232, 209, 0.32)", "#1B1F2C"),
  },
  {
    id: "honeycomb",
    name: "Honeycomb",
    description: "Hex tile on warm amber.",
    background: honeycombPattern("rgba(245, 232, 209, 0.12)", "#3a230f"),
    tone: "paper",
    swatch: honeycombPattern("rgba(245, 232, 209, 0.32)", "#3a230f"),
  },
  {
    id: "plus",
    name: "Plus signs",
    description: "Little crosses on midnight.",
    background: plusPattern("rgba(245, 232, 209, 0.12)", "#1a1e3a"),
    tone: "paper",
    swatch: plusPattern("rgba(245, 232, 209, 0.32)", "#1a1e3a"),
  },
  {
    id: "stars",
    name: "Stars",
    description: "Scattered sparkles at midnight.",
    background: starPattern("rgba(245, 232, 209, 0.30)", "#0e1530"),
    tone: "paper",
    swatch: starPattern("rgba(245, 232, 209, 0.55)", "#0e1530"),
  },
  {
    id: "topo",
    name: "Topo",
    description: "Topographic rings on forest.",
    background: topoPattern("rgba(245, 232, 209, 0.10)", "#15302a"),
    tone: "paper",
    swatch: topoPattern("rgba(245, 232, 209, 0.30)", "#15302a"),
  },
  {
    id: "cream",
    name: "Cream",
    description: "Light paper, dark text.",
    background: "#F5E8D1",
    tone: "ink",
    swatch: "#F5E8D1",
  },
  {
    id: "cream-dots",
    name: "Cream dots",
    description: "Polka on cream, dark text.",
    background: polkaPattern("rgba(27, 31, 44, 0.18)", "#F5E8D1"),
    tone: "ink",
    swatch: polkaPattern("rgba(27, 31, 44, 0.35)", "#F5E8D1"),
  },
];

export const DEFAULT_THEME_ID = "slate";
export const CUSTOM_THEME_ID = "custom";

export function getTheme(id: string | null | undefined): HomeTheme {
  if (!id) return HOME_THEMES[0]!;
  return HOME_THEMES.find((t) => t.id === id) ?? HOME_THEMES[0]!;
}

/**
 * Build a theme object from a user-uploaded image (data URL or http URL).
 * Centered, cover-fit so the background still looks intentional on any
 * viewport size.
 */
export function buildCustomTheme(imageUrl: string): HomeTheme {
  const bg = `#1B1F2C url("${imageUrl}") center/cover no-repeat fixed`;
  return {
    id: CUSTOM_THEME_ID,
    name: "Your photo",
    description: "Custom background from your library.",
    background: bg,
    tone: "paper",
    swatch: bg,
  };
}

export interface UiPrefs {
  theme?: string;
  /**
   * User-uploaded custom background. Stored inline as a `data:` URL so the
   * server can return it in a single ui_prefs read. Capped client-side
   * (~400KB) to keep the row small; promote to Supabase Storage if usage
   * pushes that toward the JSONB limits.
   */
  custom_bg?: string;
}
