import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Keyword Research Tool — Find SEO Keywords | Sinmoniker",
  description:
    "Free keyword research tool for SEO. Enter a seed keyword and get dozens of long-tail suggestions from Google & Baidu. Export to CSV, save history, and discover untapped search opportunities.",
  keywords: [
    "keyword research tool",
    "SEO keywords",
    "long tail keywords",
    "Google search suggestions",
    "Baidu keyword tool",
    "free keyword tool",
    "SEO keyword research",
  ],
  openGraph: {
    title: "Keyword Research Tool — Find SEO Keywords | Sinmoniker",
    description:
      "Free keyword research tool for SEO. Enter a seed keyword and get dozens of long-tail suggestions from Google & Baidu.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Keyword Research Tool" }],
  },
  alternates: {
    canonical: "/keyword-research",
  },
};

export default function KeywordResearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
