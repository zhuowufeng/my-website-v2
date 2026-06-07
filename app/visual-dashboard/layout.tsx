import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Visual Dashboard — Website Analytics & Charts | Sinmoniker",
  description:
    "Interactive data visualization dashboard with charts and graphs. Track page views, usage trends, and key metrics with beautiful visualizations. Free analytics tool.",
  keywords: [
    "visual dashboard",
    "data visualization",
    "website analytics",
    "charts and graphs",
    "interactive dashboard",
    "analytics tool",
    "traffic dashboard",
  ],
  openGraph: {
    title: "Visual Dashboard — Website Analytics & Charts | Sinmoniker",
    description:
      "Interactive data visualization dashboard with charts and graphs. Track page views, usage trends, and key metrics.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Visual Dashboard" }],
  },
  alternates: {
    canonical: "/visual-dashboard",
  },
};

export default function VisualDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
