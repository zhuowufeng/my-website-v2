import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Analytics from "@/components/Analytics";
import JsonLd, { siteNavigationLd } from "@/components/JsonLd";
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
    default: "Sinmoniker - Find Your Chinese Name & AI Writing Assistant",
    template: "%s | Sinmoniker",
  },
  description:
    "Discover a beautiful Chinese name that reflects your personality. AI-powered name generator with meanings, pronunciation, and cute nicknames. Also features MoYan AI writing assistant.",
  keywords: [
    "Chinese name generator",
    "中文名生成",
    "AI name generator",
    "Chinese name meaning",
    "AI writing assistant",
    "AI文章助手",
    "墨言",
  ],
  openGraph: {
    title: "Sinmoniker - Find Your Chinese Name & AI Writing Assistant",
    description:
      "Discover a beautiful Chinese name that reflects your personality. AI-powered name generator with meanings, pronunciation, and cute nicknames.",
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
      "Discover a beautiful Chinese name that reflects your personality. AI-powered name generator with meanings, pronunciation, and cute nicknames.",
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
    // Add your Google Search Console verification code here
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
      <body className="min-h-full flex flex-col">
        <Analytics />
        <JsonLd data={siteNavigationLd()} />
        {children}
        <ProductFeedback />
      </body>
    </html>
  );
}
