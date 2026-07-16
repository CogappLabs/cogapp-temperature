// @ts-check

import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// Served from GitHub Pages at cogapplabs.github.io/cogapp-temperature.
export default defineConfig({
  site: "https://cogapplabs.github.io",
  base: "/cogapp-temperature",
  trailingSlash: "ignore",
  vite: {
    plugins: [tailwindcss()],
  },
});
