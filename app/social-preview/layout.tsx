import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Social Preview Inspector — 社交分享预览 & Meta 标签检测工具',
  description: '免费在线社交分享预览检查工具。输入网址，一键查看页面在 Facebook、Twitter 等平台的分享效果。检测 OG 标签、Twitter Cards、Meta 标签完整性，并提供优化建议。SEO 优化和内容营销必备工具。',
  keywords: [
    '社交分享预览', 'OG标签检测', 'Twitter Card检测', 'Meta标签检查',
    'Facebook分享预览', 'Twitter分享预览', '社交卡片预览',
    'link preview checker', 'social media preview', 'open graph checker',
    'meta tag inspector', 'URL preview', '社交分享优化',
    'OG meta tag', 'twitter card validator',
  ],
  openGraph: {
    title: 'Social Preview Inspector — 免费社交分享预览检查工具',
    description: '输入网址，一键查看 Facebook/Twitter 分享效果。检测 OG 标签、Twitter Cards，优化社交分享。',
    type: 'website',
  },
};

export default function SocialPreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
