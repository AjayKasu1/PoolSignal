import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "PoolSignal — Qi Licensing Intelligence";
  const description = "An evidence-first, agentic licensing intelligence and campaign operations platform.";
  const socialImage = `${origin}/og.jpg`;

  return {
    title,
    description,
    applicationName: "PoolSignal",
    alternates: { canonical: origin },
    category: "technology",
    icons: { icon: [{ url: "/favicon.png", type: "image/png", sizes: "64x64" }], shortcut: "/favicon.ico" },
    manifest: "/manifest.webmanifest",
    openGraph: { title, description, type: "website", url: origin, siteName: "PoolSignal", images: [{ url: socialImage, width: 1200, height: 800, alt: "PoolSignal — Evidence before action" }] },
    twitter: { card: "summary_large_image", title, description, images: [socialImage] },
    robots: { index: true, follow: true },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
