// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://rentierdigital.xyz",
  build: {
    inlineStylesheets: "always",
  },
  i18n: {
    defaultLocale: "en",
    locales: ["en", "fr", "es", "de"],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  integrations: [
    sitemap({
      filter: (page) => !page.includes("/prompt-contract/"),
      i18n: {
        defaultLocale: "en",
        locales: {
          en: "en",
          fr: "fr",
          es: "es",
          de: "de",
        },
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
