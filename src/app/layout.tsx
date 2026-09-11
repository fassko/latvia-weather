import type { Metadata, Viewport } from "next";
import { getSiteUrl, isIndexableDeployment } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  applicationName: "Latvia Weather",
  creator: "Latvia Weather",
  authors: [{ name: "Kristaps Grinbergs", url: "https://kristaps.me/" }],
  // Preview deployments share the same content as production and would compete
  // with it in search results.
  robots: isIndexableDeployment() ? undefined : { index: false, follow: false },
  openGraph: {
    siteName: "Latvia Weather",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f5f9" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

/**
 * Locale-aware `<html lang>` lives in `[locale]/layout`. Root only owns
 * shared metadata and global CSS.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
