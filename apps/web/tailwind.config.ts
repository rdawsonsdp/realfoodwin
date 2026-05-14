import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx,mdx}",
    "./components/**/*.{ts,tsx,mdx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm Headspace-inspired palette
        sunrise: {
          DEFAULT: "#F39B47", // primary action
          50: "#FEF6EE",
          100: "#FCE9D2",
          200: "#FAD3A5",
          300: "#F7BD78",
          400: "#F5A75B",
          500: "#F39B47", // base
          600: "#DD7E2A",
          700: "#B86220",
          800: "#8F4B19",
          900: "#693712",
        },
        honey: {
          DEFAULT: "#FFD56B",
          50: "#FFFAEB",
          100: "#FFF4D1",
          200: "#FFE9A2",
          300: "#FFDF7E",
          400: "#FFD56B",
          500: "#F5C24A",
          600: "#D9A02E",
          700: "#A87822",
        },
        cream: "#FFF3D6",
        paper: "#FAF6EF",
        coral: {
          DEFAULT: "#F47A6A",
          soft: "#FBC4BB",
        },
        sage: {
          DEFAULT: "#7DA88E",
          soft: "#C7DCCD",
        },
        ink: {
          DEFAULT: "#1A1A2E",
          soft: "#4A4A5E",
          muted: "#7A7A8E",
        },
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        soft: "1.25rem",
        pill: "9999px",
      },
      boxShadow: {
        warm: "0 8px 24px -8px rgba(243, 155, 71, 0.25)",
        card: "0 2px 8px rgba(26, 26, 46, 0.06)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-up": "fade-up 280ms cubic-bezier(0.16, 1, 0.3, 1)",
        "shimmer": "shimmer 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
