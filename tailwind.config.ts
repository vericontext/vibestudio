import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "#d7dde5",
        panel: "#f7f9fb",
        panel2: "#eef3f7",
        ink: "#17202a",
        muted: "#617083",
        accent: "#0f8b8d",
        warn: "#b45309"
      },
      boxShadow: {
        tool: "0 1px 0 rgba(23, 32, 42, 0.05)"
      }
    }
  },
  plugins: []
};

export default config;

