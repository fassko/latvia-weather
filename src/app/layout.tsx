import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PullToRefresh } from "@/components/PullToRefresh";
import { ThemeScript } from "@/components/ThemeScript";
import { ThemeSync } from "@/components/ThemeSync";
import { getSiteUrl } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  applicationName: "Latvia Weather",
  creator: "Latvia Weather",
  openGraph: {
    siteName: "Latvia Weather",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full bg-slate-100 font-sans text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
        <ThemeSync />
        <PullToRefresh />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
