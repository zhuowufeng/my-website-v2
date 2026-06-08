import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'HTTP Checker — HTTP/SSL 在线探测 & 诊断工具',
  description: '免费在线 HTTP 检测工具。输入网址，一键查看 HTTP 状态码、响应头、SSL 证书详情（颁发者/有效期/SANs）、重定向链路追踪、DNS 解析、响应时间。站长和开发者的网站故障排查利器。',
  keywords: [
    'HTTP检测', 'SSL证书检查', '网站状态检测', 'HTTP状态码', '响应头查看',
    '重定向追踪', 'SSL checker', 'HTTP header checker', '网站诊断工具',
    '在线HTTP工具', 'HTTPS检测',
  ],
  openGraph: {
    title: 'HTTP Checker — 免费 HTTP/SSL 在线探测工具',
    description: '一键探测 HTTP 状态、响应头、SSL 证书、重定向链路，站长必备诊断工具。',
    type: 'website',
  },
};

export default function HTTPCheckerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
