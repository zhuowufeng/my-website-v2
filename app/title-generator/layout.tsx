import type { Metadata } from "next";
import { ReactNode } from "react";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://sinmoniker.com";

export const metadata: Metadata = {
  title: "AI标题生成器 - 6种风格一键生成高点击率标题",
  description:
    "输入主题，AI自动生成博客/小红书/SEO/营销/视频/邮件6种风格标题。每个标题附含「为什么有效」解读，支持一键复制。每日免费15次。历史记录保存50次。",
  keywords: [
    "AI标题生成器",
    "标题生成",
    "博客标题",
    "小红书标题",
    "SEO标题",
    "营销标题",
    "视频标题",
    "邮件标题",
    "点击率优化",
    "内容营销",
    "标题写作",
    "AI写作工具",
  ],
  openGraph: {
    title: "AI标题生成器 - Sinmoniker",
    description:
      "输入主题，AI自动生成博客/小红书/SEO/营销/视频/邮件6种风格标题。一键复制，每日免费15次。",
    url: `${BASE_URL}/title-generator`,
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "AI标题生成器 - Sinmoniker",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI标题生成器 - 6种风格一键生成",
    description:
      "输入主题，AI自动生成博客/小红书/SEO/营销/视频/邮件6种风格标题。一键复制，每日免费15次。",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function TitleGeneratorLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
