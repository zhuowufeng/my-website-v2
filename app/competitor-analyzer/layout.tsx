import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '竞争对手分析工具 | 竞品SEO对比 · 技术栈识别 · 内容分析 | SinMoniker',
  description: '输入竞争对手网站URL，自动分析其SEO表现、技术栈、内容策略、关键词分布。支持多站对比，一键导出报告。让数据帮你赢过对手。',
  openGraph: {
    title: '竞争对手分析工具 — 知己知彼，百战不殆',
    description: '全面分析竞品网站的SEO、技术栈、内容策略。支持多站对比和历史追踪。',
    type: 'website',
  },
  keywords: ['竞争对手分析', '竞品分析', 'SEO对比', '技术栈识别', '内容分析', '网站分析'],
};

export default function CompetitorAnalyzerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
