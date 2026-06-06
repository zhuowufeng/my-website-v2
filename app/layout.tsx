import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
  title: "Sinmoniker - Find Your Chinese Name",
  description:
    "Discover a beautiful Chinese name that reflects your personality. AI-powered name generator with meanings, pronunciation, and cute nicknames.",
  keywords: ["Chinese name generator", "中文名生成", "AI name generator", "Chinese name meaning"],
  openGraph: {
    title: "Sinmoniker - Find Your Chinese Name",
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
