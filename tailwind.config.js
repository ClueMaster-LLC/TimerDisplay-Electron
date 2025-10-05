/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
       fontFamily: {
        sans: ['"Google Sans Code"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
