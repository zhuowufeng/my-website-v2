import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SEO Analytics Dashboard — Track Your Website Performance | Sinmoniker",
  description:
    "Visual SEO analytics dashboard with interactive charts. Track score trends, grade distribution, top pages, and weekly averages. Free tool for monitoring your website's search engine performance.",
  keywords: [
    "SEO analytics",
    "SEO dashboard",
    "website performance tracker",
    "SEO score history",
    "SEO reporting",
    "website analytics tool",
    "SEO monitoring",
  ],
  openGraph: {
    title: "SEO Analytics Dashboard — Track Your Website Performance | Sinmoniker",
    description:
      "Visual SEO analytics dashboard with interactive charts. Track score trends, grade distribution, top pages, and weekly averages.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "SEO Analytics Dashboard" }],
  },
  alternates: {
    canonical: "/seo-analytics",
  },
};

export default function SeoAnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
