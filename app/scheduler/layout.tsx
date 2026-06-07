import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SEO Scheduler — Automated Website Monitoring | Sinmoniker",
  description:
    "Schedule automated SEO diagnoses for your website. Monitor your pages' SEO health with customizable frequency — daily, weekly, or monthly. Get trend data and alerts for score changes.",
  keywords: [
    "SEO scheduler",
    "automated website monitoring",
    "SEO health check",
    "website monitoring tool",
    "automatic SEO audit",
    "scheduled SEO analysis",
  ],
  openGraph: {
    title: "SEO Scheduler — Automated Website Monitoring | Sinmoniker",
    description:
      "Schedule automated SEO diagnoses for your website. Monitor your pages' SEO health with customizable frequency.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "SEO Scheduler" }],
  },
  alternates: {
    canonical: "/scheduler",
  },
};

export default function SchedulerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
