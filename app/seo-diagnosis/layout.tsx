import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SEO Diagnosis Tool — Free Website SEO Analyzer | Sinmoniker",
  description:
    "Free SEO analysis tool. Enter any URL and get a comprehensive SEO score across 10 checkpoints: title, meta, OG tags, H1, images, links, performance, favicon, sitemap, and more.",
  keywords: [
    "SEO diagnosis",
    "SEO analyzer",
    "free SEO tool",
    "website SEO checker",
    "SEO audit tool",
    "page SEO analysis",
    "SEO score",
  ],
  openGraph: {
    title: "SEO Diagnosis Tool — Free Website SEO Analyzer | Sinmoniker",
    description:
      "Free SEO analysis tool. Enter any URL and get a comprehensive SEO score across 10 checkpoints.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "SEO Diagnosis Tool" }],
  },
  alternates: {
    canonical: "/seo-diagnosis",
  },
};

export default function SeoDiagnosisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
