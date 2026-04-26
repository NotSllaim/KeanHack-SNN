export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      colors: {
        ink: "#172026",
        meadow: "#A44200",
        coral: "#69140E",
        skyglass: "#F0D2AD",
        ember: "#D58936",
        wine: "#3C1518"
      },
      boxShadow: {
        soft: "0 16px 42px rgba(60, 21, 24, 0.18)"
      }
    }
  },
  plugins: []
};

