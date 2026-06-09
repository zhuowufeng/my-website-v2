import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Website Change Monitor — Track Site Changes | Sinmoniker",
  description:
    "Free website change monitoring tool. Add any URL to track content changes, title updates, meta description changes, and more. Get notified when your monitored sites change.",
  keywords: [
    "website change monitor",
    "site tracking",
    "content change detection",
    "web monitoring",
    "URL change tracker",
    "SEO monitoring",
    "competitor tracking",
  ],
  openGraph: {
    title: "Website Change Monitor — Track Site Changes | Sinmoniker",
    description:
      "Free website change monitoring tool. Add any URL to track content changes, title updates, and more.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Website Change Monitor" }],
  },
  alternates: {
    canonical: "/monitor",
  },
};

export default function MonitorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
