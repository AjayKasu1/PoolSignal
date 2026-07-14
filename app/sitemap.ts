import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{
    url: "https://poolsignal.ajaykasu7.workers.dev",
    lastModified: new Date("2026-07-14T00:00:00Z"),
    changeFrequency: "weekly",
    priority: 1,
  }];
}
