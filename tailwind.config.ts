import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand accent: hot pink. The key keeps its historical name "maroon" so existing classes keep working;
        // 600 is the light-mode accent (5.1:1 on white), 400 the dark-mode accent (6:1 on black), 500 the pure hot pink
        // for decoration only (it does not reach 4.5:1 with white text).
        maroon: {
          950: "#3D001F",
          900: "#5C002F",
          800: "#8A0047",
          700: "#B8005F",
          600: "#D6006F",
          500: "#FF1493",
          400: "#FF3EA5",
          300: "#FF7CBB",
          200: "#FFB8DA",
          100: "#FFE0EF",
          50: "#FFF2F8",
        },
        ink: {
          900: "#0A0A0A",
          800: "#171717",
          700: "#262626",
        },
        paper: {
          DEFAULT: "#FFFFFF",
          warm: "#F6F6F6",
        },
        warmgrey: {
          100: "#F2F2F2",
          200: "#E6E6E6",
          300: "#CFCFCF",
          400: "#A3A3A3",
          500: "#858585",
          600: "#5C5C5C",
        },
        surface: {
          darkbg: "#000000",
          dark: "#0D0D0D",
          darkraised: "#161616",
        },
      },
      fontFamily: {
        display: ["Fraunces Variable", "Fraunces", "ui-serif", "Georgia", "serif"],
        sans: ["Inter Variable", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        none: "0",
        sm: "3px",
        DEFAULT: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
      boxShadow: {
        subtle: "0 1px 2px rgba(0, 0, 0, 0.06)",
        card: "0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0,0,0,0.04)",
        // Only for the floating bottom nav — the one element that genuinely
        // sits above content and needs separating from it.
        float: "0 8px 28px rgba(0, 0, 0, 0.14), 0 2px 6px rgba(0, 0, 0, 0.08)",
      },
      maxWidth: {
        content: "1180px",
      },
    },
  },
  plugins: [
    plugin(({ addVariant }) => {
      addVariant("senior", ".senior &");
    }),
  ],
} satisfies Config;
