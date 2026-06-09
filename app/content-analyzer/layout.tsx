import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Content Analyzer — 网页内容分析 & SEO 内容结构诊断工具',
  description: '免费在线网页内容分析工具。输入网址，一键分析页面内容结构：标题层级、字数统计、阅读时间、关键词密度、图片Alt属性、内外链分布，给出内容优化建议。SEO 写作和内容优化必备工具。',
  keywords: [
    '内容分析', 'SEO内容优化', '标题层级检测', '关键词密度', '阅读时间计算',
    '网页内容诊断', 'Alt属性检查', '内外链分析', '可读性评估',
    'content analyzer', 'SEO content analysis', 'heading structure',
    'keyword density checker', 'readability score', 'SEO writing tool',
    '内容质量评估', '页面结构分析',
  ],
  openGraph: {
    title: 'Content Analyzer — 免费网页内容分析工具',
    description: '输入网址，一键分析页面内容结构、关键词密度、可读性评分。SEO 内容优化利器。',
    type: 'website',
  },
};

export default function ContentAnalyzerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
