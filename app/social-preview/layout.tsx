import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Social Preview Inspector v2 — 社交分享预览 & Meta 标签/JSON-LD 检测工具',
  description: '免费在线社交分享预览检查工具 v2。输入网址，一键在 Facebook、Twitter、LinkedIn、WhatsApp、Telegram、Slack 6 个平台预览分享效果。检测 OG 标签、Twitter Cards、JSON-LD 结构化数据，全方位优化社交分享。SEO 和内容营销必备。',
  keywords: [
    '社交分享预览', 'OG标签检测', 'Twitter Card检测', 'Meta标签检查',
    'Facebook分享预览', 'Twitter分享预览', 'LinkedIn预览',
    'WhatsApp预览', 'Telegram预览', 'Slack预览',
    'JSON-LD检测', '结构化数据分析', 'Schema.org检测',
    'link preview checker', 'social media preview', 'open graph checker',
    'meta tag inspector', 'URL preview', '社交分享优化',
    'OG meta tag', 'twitter card validator',
  ],
  openGraph: {
    title: 'Social Preview Inspector v2 — 6平台社交分享预览 & JSON-LD 检测',
    description: '输入网址，一键在 6 个平台（Facebook/Twitter/LinkedIn/WhatsApp/Telegram/Slack）预览分享效果。检测 OG 标签、Twitter Cards、JSON-LD 结构化数据。',
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
