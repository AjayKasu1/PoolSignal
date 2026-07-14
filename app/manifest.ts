import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PoolSignal — Qi Licensing Intelligence",
    short_name: "PoolSignal",
    description: "Evidence-first agentic licensing intelligence with human-approved decisions.",
    start_url: "/",
    display: "standalone",
    background_color: "#070b12",
    theme_color: "#bafc54",
    icons: [{ src: "/favicon.png", sizes: "64x64", type: "image/png" }],
  };
}
