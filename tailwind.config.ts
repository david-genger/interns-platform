import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Devx brand palette (from the devx "x" gradient: blue → purple)
        brand: {
          DEFAULT: "#6637ED", // primary action (purple)
          dark: "#5325C8", // hover / pressed
          blue: "#1C75BC", // gradient start
          purple: "#6637ED", // gradient end
          ink: "#0B0B14", // near-black brand dark
          cyan: "#6AD7E5", // subtle accent
        },
      },
      fontFamily: {
        // Neutral system sans for body / UI — keeps simple text un-branded.
        sans: [
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        // Halyard Display — Devx brand face, reserved for headings.
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(90deg, #1C75BC 0%, #4A4FD6 50%, #6637ED 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
