import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '域名侦探 — DNS 诊断 & 域名健康检测',
  description: '免费在线 DNS 检测工具。输入域名，一键检测 A记录、CNAME、MX、NS、TXT 配置，多地 DNS 解析对比，健康评分与优化建议。适合站长、开发者排查域名问题。',
  keywords: [
    'DNS检测', '域名诊断', 'DNS lookup', 'DNS checker', 'DNS健康检查',
    '域名解析检测', 'DNS propagation', '在线DNS工具', '域名侦探',
  ],
  openGraph: {
    title: '域名侦探 — 免费 DNS 诊断工具',
    description: '多DNS服务器解析对比 + 健康评分 + 配置问题诊断，中文友好报告。',
    type: 'website',
  },
};

export default function DNSDetectiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
