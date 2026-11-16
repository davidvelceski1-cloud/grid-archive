import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#000000",
        carbon: "#0B0D10",
        graphite: "#15181D",
        rule: "#2A2E35",
        steel: "#5A5F66",
        mist: "#B0B4BA",
        paper: "#F6F6F6",
        signal: {
          DEFAULT: "#E4002B", // fills, buttons, active states
          bright: "#FF5A72", // text/links on dark (AA on #000/#0B0D10)
          deep: "#B80020", // text/links on light (AA on #F6F6F6/#fff)
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        "display-xl": ["clamp(3rem, 7vw, 6rem)", { lineHeight: "0.95", letterSpacing: "-0.035em", fontWeight: "800" }],
        "display-lg": ["clamp(2.5rem, 5vw, 4.5rem)", { lineHeight: "1", letterSpacing: "-0.03em", fontWeight: "800" }],
        "display-md": ["clamp(1.875rem, 3.2vw, 3rem)", { lineHeight: "1.05", letterSpacing: "-0.025em", fontWeight: "800" }],
      },
      maxWidth: { grid: "1440px", prose: "44rem" },
      borderRadius: { none: "0", sm: "2px" },
      keyframes: {
        "fade-up": { from: { opacity: "0", transform: "translateY(16px)" }, to: { opacity: "1", transform: "none" } },
        "kenburns": { from: { transform: "scale(1)" }, to: { transform: "scale(1.06)" } },
      },
      animation: {
        "fade-up": "fade-up .7s cubic-bezier(.2,.7,.2,1) both",
        kenburns: "kenburns 12s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
