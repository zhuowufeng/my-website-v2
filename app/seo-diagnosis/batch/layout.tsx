import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Batch SEO Diagnosis — Analyze Multiple URLs | Sinmoniker",
  description:
    "Upload a CSV or paste URLs for bulk SEO analysis. Process up to 50 URLs at once with real-time streaming progress. Free tool for website owners and SEO professionals.",
  keywords: [
    "batch SEO analysis",
    "bulk SEO checker",
    "multiple URL SEO",
    "SEO batch tool",
    "website audit tool",
    "bulk website analyzer",
  ],
  openGraph: {
    title: "Batch SEO Diagnosis — Analyze Multiple URLs | Sinmoniker",
    description:
      "Upload a CSV or paste URLs for bulk SEO analysis. Process up to 50 URLs at once with real-time streaming progress.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Batch SEO Diagnosis" }],
  },
  alternates: {
    canonical: "/seo-diagnosis/batch",
  },
};

export default function BatchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
