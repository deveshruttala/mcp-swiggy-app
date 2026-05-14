import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#06070b",
          soft: "#0b0d14",
          card: "#0f111a",
          line: "#1a1d2a",
        },
        accent: {
          DEFAULT: "#ff6a2c",
          hover: "#ff7d47",
          soft: "rgba(255, 106, 44, 0.12)",
        },
        ink: {
          DEFAULT: "#e7e9f0",
          dim: "#9aa0b4",
          fade: "#5a6076",
        },
        ok: "#3ddc97",
        warn: "#ffb547",
        bad: "#ff5d6c",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Inter",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,106,44,0.35), 0 8px 32px -8px rgba(255,106,44,0.35)",
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 12px 40px -12px rgba(0,0,0,0.6)",
      },
      backgroundImage: {
        "grid-fade":
          "radial-gradient(ellipse at top, rgba(255,106,44,0.10), transparent 50%), radial-gradient(ellipse at bottom right, rgba(120,160,255,0.06), transparent 50%)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        shimmer: "shimmer 2.4s linear infinite",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
