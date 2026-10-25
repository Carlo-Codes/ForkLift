const forkliftTailwindConfig = require("@forklift/tailwind-config").default;

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("nativewind/preset"), forkliftTailwindConfig],
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"]
};
