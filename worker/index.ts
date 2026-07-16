/** Cloudflare Worker entry point for PoolSignal. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { ensureLiveSchema } from "../db";
import { refreshLiveSources } from "../lib/live-store";
import { processPendingSourceChanges } from "../lib/change-processor";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  REVIEWER_TOKEN?: string;
  API_READ_RATE_LIMITER: ApiRateLimiter;
  API_WRITE_RATE_LIMITER: ApiRateLimiter;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ApiRateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

interface ScheduledController {
  cron: string;
  scheduledTime: number;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const securityHeaders: Record<string, string> = {
  "Content-Security-Policy": "default-src 'self'; base-uri 'self'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; frame-src 'none'; img-src 'self' data:; manifest-src 'self'; media-src 'none'; object-src 'none'; script-src 'self' 'unsafe-inline'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; upgrade-insecure-requests; worker-src 'self'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const apiJsonHeaders = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Robots-Tag": "noindex" };

async function enforceApiRateLimit(request: Request, env: Env, url: URL): Promise<Response | null> {
  if (!url.pathname.startsWith("/api/")) return null;
  const sensitive = url.pathname === "/api/reviews" || !["GET", "HEAD"].includes(request.method);
  const limiter = sensitive ? env.API_WRITE_RATE_LIMITER : env.API_READ_RATE_LIMITER;
  const clientKey = request.headers.get("cf-connecting-ip") ?? "local-or-unknown";

  try {
    const result = await limiter.limit({ key: `${url.pathname}:${clientKey}` });
    if (result.success) return null;
    return new Response(JSON.stringify({ error: "Too many requests; try again shortly" }), {
      status: 429,
      headers: { ...apiJsonHeaders, "Retry-After": "60" },
    });
  } catch (error) {
    console.error("PoolSignal API rate limiter failed", {
      path: url.pathname,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    if (!sensitive) return null;
    return new Response(JSON.stringify({ error: "Protected API controls are temporarily unavailable" }), {
      status: 503,
      headers: apiJsonHeaders,
    });
  }
}

function secure(response: Response): Response {
  const secured = new Response(response.body, response);
  for (const [name, value] of Object.entries(securityHeaders)) secured.headers.set(name, value);
  return secured;
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    const isLocalDevelopment = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(url.hostname);
    if (url.protocol === "http:" && !isLocalDevelopment) {
      url.protocol = "https:";
      return secure(Response.redirect(url.toString(), 308));
    }

    const rateLimited = await enforceApiRateLimit(request, env, url);
    if (rateLimited) return secure(rateLimited);

    if (url.pathname === "/robots.txt") {
      const robots = `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${url.origin}/sitemap.xml\n`;
      return secure(new Response(robots, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } }));
    }

    if (url.pathname === "/sitemap.xml") {
      const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${url.origin}</loc><lastmod>2026-07-15</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url></urlset>`;
      return secure(new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } }));
    }

    if (url.pathname === "/manifest.webmanifest") {
      return secure(Response.json({
        name: "PoolSignal — Qi Licensing Intelligence",
        short_name: "PoolSignal",
        description: "Evidence-first agentic licensing intelligence with human-approved decisions.",
        start_url: "/",
        display: "standalone",
        background_color: "#070b12",
        theme_color: "#bafc54",
        icons: [{ src: "/favicon.png", sizes: "64x64", type: "image/png" }],
      }, { headers: { "Cache-Control": "public, max-age=3600" } }));
    }

    const isDocumentRequest = request.method === "GET"
      && url.pathname === "/"
      && url.search === ""
      && request.headers.get("accept")?.includes("text/html")
      && !request.headers.has("RSC");
    if (isDocumentRequest) {
      const edgeCache = (caches as CacheStorage & { default: Cache }).default;
      const cacheKey = new Request(url.toString(), { headers: { Accept: "text/html" } });
      const cached = await edgeCache.match(cacheKey);
      if (cached) return secure(cached);

      const response = secure(await handler.fetch(request, env, ctx));
      if (response.ok) {
        response.headers.set("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=3600");
        ctx.waitUntil(edgeCache.put(cacheKey, response.clone()));
      }
      return response;
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      const response = await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
      return secure(response);
    }

    return secure(await handler.fetch(request, env, ctx));
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const sources = ["wpc" as const];
    ctx.waitUntil((async () => {
      try {
        await ensureLiveSchema(env.DB);
        const scheduledAt = new Date(controller.scheduledTime);
        await refreshLiveSources(env.DB, sources, scheduledAt);
        await processPendingSourceChanges(env.DB, { limit: 3, now: scheduledAt });
      } catch (error) {
        console.error("PoolSignal scheduled refresh failed", {
          source: sources[0],
          message: error instanceof Error ? error.message : "Unknown error",
        });
        throw error;
      }
    })());
  },
};

export default worker;
