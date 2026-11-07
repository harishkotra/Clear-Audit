import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import MascotCompanion from "@/components/MascotCompanion";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-serif",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://clearaudit.xyz";
}

const title = "ClearAudit";
const description =
  "Evidence-gated USDC settlement on Arc: lock funds, match a live Arkiv fingerprint, pay, then forget.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${title} — evidence-gated USDC settlement`,
    template: `%s · ${title}`,
  },
  description,
  applicationName: title,
  authors: [{ name: "ClearAudit" }],
  keywords: [
    "ClearAudit",
    "USDC",
    "Arc",
    "Arkiv",
    "escrow",
    "incident settlement",
    "evidence gate",
    "EIP-8141",
  ],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: title,
    title: `${title} — evidence-gated USDC settlement`,
    description,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "ClearAudit — Pip the companion and evidence-gated USDC settlement on Arc",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${title} — evidence-gated USDC settlement`,
    description,
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  category: "finance",
};

export const viewport: Viewport = {
  themeColor: "#101012",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} ${serif.variable}`}>
      <body>
        <Providers>
          {children}
          <MascotCompanion />
        </Providers>
      </body>
    </html>
  );
}
