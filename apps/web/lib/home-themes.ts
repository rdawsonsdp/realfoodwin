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

const dotPattern = (color: string, bg: string) =>
  `${bg} url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><circle cx='2' cy='2' r='1.2' fill='${encodeURIComponent(color)}'/></svg>")`;

const gridPattern = (color: string, bg: string) =>
  `${bg} url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><path d='M0 0H40V40' fill='none' stroke='${encodeURIComponent(color)}' stroke-width='0.75'/></svg>")`;

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
    id: "grid",
    name: "Graph paper",
    description: "Faint grid on forest green.",
    background: gridPattern("rgba(245, 232, 209, 0.10)", "#15302a"),
    tone: "paper",
    swatch: gridPattern("rgba(245, 232, 209, 0.30)", "#15302a"),
  },
  {
    id: "cream",
    name: "Cream",
    description: "Light paper, dark text.",
    background: "#F5E8D1",
    tone: "ink",
    swatch: "#F5E8D1",
  },
];

export const DEFAULT_THEME_ID = "slate";

export function getTheme(id: string | null | undefined): HomeTheme {
  if (!id) return HOME_THEMES[0]!;
  return HOME_THEMES.find((t) => t.id === id) ?? HOME_THEMES[0]!;
}

export interface UiPrefs {
  theme?: string;
}
