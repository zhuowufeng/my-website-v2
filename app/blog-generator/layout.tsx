import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Blog Generator — Full Blog Posts in 5 Styles | Sinmoniker",
  description:
    "Free AI blog post generator. Create complete blog articles in 5 styles: tutorial, listicle, deep analysis, story, and opinion. Perfect for content marketers and bloggers.",
  keywords: [
    "AI blog generator",
    "blog post generator",
    "free blog writer",
    "AI content writer",
    "blog article generator",
    "content creation tool",
    "automated blogging",
  ],
  openGraph: {
    title: "AI Blog Generator — Full Blog Posts in 5 Styles | Sinmoniker",
    description:
      "Free AI blog post generator. Create complete blog articles in 5 styles: tutorial, listicle, deep analysis, story, and opinion.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "AI Blog Generator" }],
  },
  alternates: {
    canonical: "/blog-generator",
  },
};

export default function BlogGeneratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
