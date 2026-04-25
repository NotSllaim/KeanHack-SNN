export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      colors: {
        ink: "#172026",
        meadow: "#3f7d58",
        coral: "#d56b52",
        skyglass: "#d9ebf2"
      },
      boxShadow: {
        soft: "0 16px 42px rgba(23, 32, 38, 0.12)"
      }
    }
  },
  plugins: []
};

