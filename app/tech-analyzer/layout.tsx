import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tech Stack Analyzer — 网站技术栈检测 & 分析工具',
  description: '免费在线网站技术栈检测工具。输入网址，一键识别网站使用的技术：服务器类型（Nginx/Apache）、CMS（WordPress/Ghost/Shopify）、前端框架（React/Vue/Angular/Next.js）、CDN（Cloudflare/Fastly）、分析工具（GA/百度统计/Facebook Pixel）、JS库等。站长和开发者的网站竞品分析利器。',
  keywords: [
    '技术栈检测', '网站技术栈', '网站用什么技术', 'CMS检测', 'WordPress检测',
    '前端框架检测', 'CDN检测', '网站分析工具', '网站竞品分析', 'technology stack',
    'builtwith alternative', 'wappalyzer', 'site tech detector', '网页技术分析',
    '在线技术栈分析', '服务器识别',
  ],
  openGraph: {
    title: 'Tech Stack Analyzer — 免费在线网站技术栈检测工具',
    description: '一键识别网站技术栈：服务器、CMS、框架、CDN、分析工具、JS库。竞品分析利器。',
    type: 'website',
  },
};

export default function TechAnalyzerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
