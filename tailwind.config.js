/** @type {import('tailwindcss').Config} */
export default {
  // Use shared Picasso design tokens
  presets: [require('@picasso/shared-styles/tailwind-preset')],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Project-specific extensions go here
      // Shared colors (primary, danger, info, warning) come from the preset
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
