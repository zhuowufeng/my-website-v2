import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Title Generator — Catchy Blog & SEO Titles | Sinmoniker",
  description:
    "Free AI title generator for blogs, articles, and SEO content. Generate dozens of compelling titles in seconds with customizable tones and styles. Boost your click-through rates.",
  keywords: [
    "AI title generator",
    "blog title generator",
    "SEO title maker",
    "catchy headline generator",
    "free title generator",
    "content headline tool",
  ],
  openGraph: {
    title: "AI Title Generator — Catchy Blog & SEO Titles | Sinmoniker",
    description:
      "Free AI title generator for blogs, articles, and SEO content. Generate dozens of compelling titles in seconds.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "AI Title Generator" }],
  },
  alternates: {
    canonical: "/title-generator",
  },
};

export default function TitleGeneratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
