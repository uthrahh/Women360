import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        maroon: {
          950: "#2A0910",
          900: "#3D0F1A",
          800: "#521626",
          700: "#6B1D30",
          600: "#82233A",
          500: "#9A2C45",
          400: "#B85468",
          300: "#D0899A",
          200: "#E6BFC9",
          100: "#F3E1E6",
          50: "#FAF1F3",
        },
        ink: {
          900: "#171310",
          800: "#241E1A",
          700: "#372E28",
        },
        paper: {
          DEFAULT: "#FBF8F4",
          warm: "#F5EFE8",
        },
        warmgrey: {
          100: "#EFE9E2",
          200: "#E2D9CF",
          300: "#C9BCAF",
          400: "#A79A8B",
          500: "#8A7C6D",
          600: "#665A4E",
        },
        surface: {
          darkbg: "#15100E",
          dark: "#1E1815",
          darkraised: "#251E19",
        },
      },
      fontFamily: {
        display: ["Fraunces", "ui-serif", "Georgia", "serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
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
        subtle: "0 1px 2px rgba(23, 19, 16, 0.06)",
        card: "0 1px 3px rgba(23, 19, 16, 0.08), 0 1px 2px rgba(23,19,16,0.04)",
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
