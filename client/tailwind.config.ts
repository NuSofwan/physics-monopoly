import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "Noto Sans Thai", "system-ui", "sans-serif"],
      },
      colors: {
        ink: "#101827",
        panel: "#f8fbff",
        coral: "#ff6b5f",
        mint: "#34d399",
        gold: "#f8c24a",
      },
      boxShadow: {
        game: "0 18px 48px rgba(5, 13, 30, 0.20)",
      },
    },
  },
  plugins: [],
} satisfies Config;
