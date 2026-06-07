import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Writing Assistant — Blog, SEO & Social Content | Sinmoniker",
  description:
    "Free AI-powered writing tool. Generate blog posts, SEO articles, Xiaohongshu copy, and product descriptions in seconds. 4 writing styles, streaming output, real-time editing.",
  keywords: [
    "AI writing assistant",
    "AI blog generator",
    "SEO content writer",
    "Xiaohongshu copywriting",
    "free AI writer",
    "online writing tool",
    "content generator",
  ],
  openGraph: {
    title: "AI Writing Assistant — Blog, SEO & Social Content | Sinmoniker",
    description:
      "Free AI-powered writing tool. Generate blog posts, SEO articles, Xiaohongshu copy, and product descriptions in seconds.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "AI Writing Assistant" }],
  },
  alternates: {
    canonical: "/writing-tool",
  },
};

export default function WritingToolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
