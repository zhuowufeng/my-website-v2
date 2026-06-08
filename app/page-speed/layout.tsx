import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Page Speed Analyzer — 页面速度 & 性能在线检测工具',
  description: '免费在线页面速度检测工具。一键分析网页加载速度、TTFB、压缩状态、缓存策略、HTTP/2支持、渲染阻塞资源。站长和开发者的网站性能优化利器。',
  keywords: [
    '页面速度检测', '网站性能分析', 'TTFB检测', '网页速度测试',
    'Core Web Vitals', '性能优化', '网站加载速度', 'Page Speed',
    '网站测速', '性能分析工具', '缓存检测', 'HTTP/2检测',
  ],
  openGraph: {
    title: 'Page Speed Analyzer — 免费页面性能检测工具',
    description: '输入网址，一键分析页面速度、TTFB、资源加载、缓存策略、HTTP/2支持，获取性能优化建议。',
    type: 'website',
  },
};

export default function PageSpeedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
