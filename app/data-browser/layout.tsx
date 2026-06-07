import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Browser — Explore & Search Your Database | Sinmoniker",
  description:
    "Browse, search, and explore your website's data with full-text search, pagination, and stats. Advanced data exploration tool for developers and site owners.",
  keywords: [
    "data browser",
    "database explorer",
    "full text search",
    "data explorer tool",
    "search database",
    "database management tool",
  ],
  openGraph: {
    title: "Data Browser — Explore & Search Your Database | Sinmoniker",
    description:
      "Browse, search, and explore your website's data with full-text search, pagination, and stats.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Data Browser" }],
  },
  alternates: {
    canonical: "/data-browser",
  },
};

export default function DataBrowserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
