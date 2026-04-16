import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        app: "#070b15",
        panel: "#0f172a",
        muted: "#94a3b8",
        accent: "#6ee7f9",
        accent2: "#22c55e",
        warm: "#f59e0b",
      },
      boxShadow: {
        panel: "0 24px 80px rgba(3, 7, 18, 0.42)",
      },
      fontFamily: {
        display: ["SF Pro Display", "Pretendard Variable", "IBM Plex Sans KR", "system-ui", "sans-serif"],
        body: ["SF Pro Text", "Pretendard Variable", "IBM Plex Sans KR", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;

