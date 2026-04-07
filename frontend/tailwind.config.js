/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // dark glassy base
        ink: {
          950: "#06060d",
          900: "#0b0b14",
          800: "#12121f",
          700: "#1a1a2e",
          600: "#24243a",
        },
        // accent gradient anchors (neon purple → violet → pink, matches screenshots)
        neon: {
          indigo: "#6366f1",
          violet: "#8b5cf6",
          pink: "#ec4899",
          cyan: "#22d3ee",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,255,255,0.06), 0 10px 30px -10px rgba(139,92,246,0.35)",
        "glow-sm": "0 0 0 1px rgba(255,255,255,0.06), 0 4px 14px -4px rgba(139,92,246,0.3)",
        card: "0 10px 30px -10px rgba(0,0,0,0.6)",
      },
      backgroundImage: {
        "grad-neon":
          "linear-gradient(135deg, #6366f1 0%, #8b5cf6 45%, #ec4899 100%)",
        "grad-ink":
          "radial-gradient(1200px 600px at 10% -10%, rgba(139,92,246,0.20), transparent 60%), radial-gradient(900px 500px at 110% 10%, rgba(236,72,153,0.15), transparent 60%), linear-gradient(180deg, #06060d 0%, #0b0b14 100%)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: 0, transform: "translateY(4px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        "pulse-glow": {
          "0%,100%": { boxShadow: "0 0 0 0 rgba(139,92,246,0.35)" },
          "50%": { boxShadow: "0 0 0 12px rgba(139,92,246,0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
        "pulse-glow": "pulse-glow 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
