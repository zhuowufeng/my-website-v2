// app/mobile-friendly/layout.tsx
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: '📱 移动友好检测 — 免费检测网站移动端适配性 | Sinmoniker',
  description: '免费检测网页在手机端的表现。分析 Viewport 配置、字体大小、触摸目标、响应式 CSS 等 15 项移动友好指标，给出综合评分和优化建议。',
  path: '/mobile-friendly',
  keywords: ['移动友好检测', 'Mobile Friendly Test', '移动端适配', '响应式设计检测', '网站移动优化', 'SEO工具'],
  ogType: 'website',
});

export default function MobileFriendlyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
