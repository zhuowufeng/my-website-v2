import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI文章助手 - 墨言 | 免费AI写作工具",
  description:
    "AI文章助手帮你写博客、小红书文案、SEO文章和产品介绍。输入主题，AI一键生成高质量中文内容，流式输出，免费使用。",
  keywords: [
    "AI写作工具",
    "AI写文章",
    "免费AI写作",
    "博客写作助手",
    "小红书文案生成",
    "SEO文章生成",
    "在线文章生成器",
  ],
  openGraph: {
    title: "AI文章助手 - 墨言 | 免费AI写作工具",
    description:
      "输入主题，AI自动生成博客文章、小红书文案、SEO内容、产品介绍。流式输出，文字逐字显示。",
    type: "website",
    locale: "zh_CN",
    siteName: "Sinmoniker - 墨言",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "AI文章助手 - 墨言",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI文章助手 - 墨言 | 免费AI写作工具",
    description:
      "输入主题，AI自动生成博客文章、小红书文案、SEO内容、产品介绍。",
  },
};

export default function WritingToolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
