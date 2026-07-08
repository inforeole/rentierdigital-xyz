// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://rentierdigital.xyz",
  trailingSlash: "never",
  build: {
    inlineStylesheets: "auto",
  },
  integrations: [
    sitemap({
      filter: (page) =>
        !page.includes("/test-avif") &&
        !page.includes("/wizard-links") &&
        !page.includes("/go/"),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
