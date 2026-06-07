import type { Metadata } from "next";
import { ReactNode } from "react";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://sinmoniker.com";

export const metadata: Metadata = {
  title: "文序 - AI博客文章生成器 | 5种风格一键生成高质量博客",
  description:
    "输入主题，AI自动生成教程式/清单式/深度分析/故事式/观点式5种风格博客文章。每篇含SEO元数据、关键词优化、结构化内容。免费使用，无需注册。",
  keywords: [
    "AI博客文章生成器",
    "AI写作工具",
    "博客文章生成",
    "AI内容生成",
    "SEO文章生成",
    "博客写作",
    "AI写文章",
    "内容营销工具",
    "文序",
    "Sinmoniker",
  ],
  openGraph: {
    title: "文序 - AI博客文章生成器 | Sinmoniker",
    description:
      "输入主题，AI自动生成教程式/清单式/深度分析/故事式/观点式5种风格博客文章。含SEO优化，一键复制。",
    url: `${BASE_URL}/blog-generator`,
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "文序 AI博客文章生成器 - Sinmoniker",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "文序 - AI博客文章生成器 | 5种风格一键生成",
    description:
      "输入主题，AI自动生成5种风格的博客文章。含SEO元数据，一键复制内容。",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function BlogGeneratorLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
