module.exports = {
  darkMode: "class",
  content: ["./app/**/*.tsx", "./components/**/*.tsx"],
  theme: {
    extend: {
      colors: {
        ink: "#12303A",
        lagoon: "#14A3A0",
        paper: "#F2F6F7",
        amber: "#F5A524",
        alert: "#C62828",
        darkbg: "#0B1519",
        darkcard: "#13232A",
        darkpaper: "#0F1C22",
        darkborder: "rgba(255,255,255,0.08)",
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
      },
    },
  },
};
