import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Link Checker - 链接健康检查器 | Sinmoniker',
  description:
    '输入网址，一键检测页面中所有链接的健康状态。快速发现 404 死链、重定向链、连接错误。SEO 必备工具，批量检测站内站外链接。',
  keywords: [
    '链接检查',
    '死链检测',
    'broken link checker',
    'SEO工具',
    '链接健康',
    '404检测',
    'link checker',
    '网站诊断',
  ],
  openGraph: {
    title: 'Link Checker - 链接健康检查器 | Sinmoniker',
    description: '一键检测网页所有链接的健康状态，发现死链和重定向链。',
    type: 'website',
  },
};

export default function LinkCheckerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
