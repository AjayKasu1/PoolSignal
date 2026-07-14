import type { MetadataRoute } from "next";

const origin = "https://poolsignal.ajaykasu7.workers.dev";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
