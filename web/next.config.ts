import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // The language loader reads the messages directory at run time, so a new
  // `<namespace>.<locale>.json` file needs no code change. The directory has
  // to travel with the deployment for that to work.
  outputFileTracingIncludes: {
    "/**/*": ["./messages/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    // The design preview is a standalone static page under public/preview.
    // A rewrite keeps the address and the query string, so the page's own
    // relative data paths (data/BGR.json and the rest) still resolve.
    return [
      { source: "/preview", destination: "/preview/index.html" },
      // The pitch deck, a standalone page; its <base> tag points its
      // relative asset paths at /presentation/.
      { source: "/presentation", destination: "/presentation/index.html" },
    ];
  },
};

export default withNextIntl(nextConfig);
