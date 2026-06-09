import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Analytics from "@/components/Analytics";
import JsonLd, { siteNavigationLd, organizationLd, webPageLd } from "@/components/JsonLd";
import ProductFeedback from "@/components/ProductFeedback";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://sinmoniker.com';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Sinmoniker - Find Your Chinese Name & SEO Tools",
    template: "%s | Sinmoniker",
  },
  description:
    "Discover your Chinese name with AI. Free generator with meanings, pronunciation, and cute nicknames. Pro tools: SEO diagnosis, batch analysis, scheduling & analytics.",
  keywords: [
    "Chinese name generator",
    "Chinese name meaning",
    "AI name generator",
    "Sinmoniker",
    "SEO diagnosis",
    "SEO analytics",
    "AI writing assistant",
  ],
  openGraph: {
    title: "Sinmoniker - Find Your Chinese Name & SEO Tools",
    description:
      "Discover your Chinese name with AI. Free generator with meanings, pronunciation, and cute nicknames. Pro tools: SEO diagnosis, batch analysis, scheduling & analytics.",
    type: "website",
    locale: "en_US",
    siteName: "Sinmoniker",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Sinmoniker - Chinese Name Generator",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sinmoniker - Find Your Chinese Name",
    description:
      "Discover your Chinese name with AI. Free generator with meanings, pronunciation, and cute nicknames.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    // google: "YOUR_VERIFICATION_CODE",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
      </head>
      <body className="min-h-full flex flex-col">
        <Analytics />
        <JsonLd data={siteNavigationLd()} />
        <JsonLd data={organizationLd()} />
        <JsonLd data={webPageLd({
          name: "Sinmoniker - Find Your Chinese Name & SEO Tools",
          description: "Discover your Chinese name with AI. Free generator with meanings, pronunciation, and cute nicknames. Pro tools: SEO diagnosis, batch analysis, scheduling & analytics.",
          url: BASE_URL,
          datePublished: "2025-01-01",
          dateModified: new Date().toISOString().split("T")[0],
        })} />
        {children}
        <ProductFeedback />
      </body>
    </html>
  );
}
