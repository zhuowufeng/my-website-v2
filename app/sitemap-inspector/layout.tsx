// app/sitemap-inspector/layout.tsx
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: '🗺️ Sitemap Inspector — 免费检查 XML 站点地图 | Sinmoniker',
  description: '免费在线 Sitemap 检查工具。验证 XML 站点地图格式、分析 URL 完整性、检测协议合规问题、支持多层 Sitemap Index 追踪。',
  path: '/sitemap-inspector',
  keywords: ['Sitemap检查', '站点地图验证', 'XML Sitemap检查', 'Sitemap Inspector', 'SEO工具', '站点地图分析', 'sitemap.xml验证'],
  ogType: 'website',
});

export default function SitemapInspectorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
