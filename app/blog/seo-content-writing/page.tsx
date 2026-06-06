import type { Metadata } from "next";
import Link from "next/link";
import JsonLd, { breadcrumbLd, blogPostLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "SEO文章写作完全指南：让搜索引擎爱上你的内容 | Sinmoniker 墨言",
  description:
    "SEO文章怎么写才能排名靠前？关键词布局、标题优化、内链策略、文章结构、阅读体验，系统学习搜索引擎优化的写作方法。",
  keywords: [
    "SEO文章写作",
    "SEO优化教程",
    "关键词布局",
    "搜索引擎优化",
    "SEO内容策略",
    "内链优化",
    "标题优化",
    "内容营销",
  ],
  openGraph: {
    title: "SEO文章写作完全指南：让搜索引擎爱上你的内容",
    description:
      "关键词布局、标题优化、内链策略、文章结构，系统学习SEO文章写作。",
    type: "article",
    locale: "zh_CN",
    publishedTime: "2026-06-07",
  },
  twitter: {
    card: "summary_large_image",
    title: "SEO文章写作完全指南：让搜索引擎爱上你的内容",
    description: "关键词布局、标题优化、内链策略、文章结构，系统学习SEO文章写作。",
  },
  alternates: {
    canonical: "/blog/seo-content-writing",
  },
};

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://sinmoniker.com";

export default function SeoContentPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "首页", url: baseUrl },
          { name: "博客", url: `${baseUrl}/blog` },
          { name: "SEO文章写作指南", url: `${baseUrl}/blog/seo-content-writing` },
        ])}
      />
      <JsonLd
        data={blogPostLd({
          title: "SEO文章写作完全指南：让搜索引擎爱上你的内容",
          description: "关键词布局、标题优化、内链策略、文章结构，系统学习SEO文章写作。",
          url: `${baseUrl}/blog/seo-content-writing`,
          datePublished: "2026-06-07",
        })}
      />

      <article className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <nav className="bg-teal-900 text-white px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link href="/" className="font-bold hover:text-amber-300 transition-colors">Sinmoniker</Link>
          <Link href="/blog" className="text-teal-200 hover:text-white text-sm transition-colors">← 返回博客</Link>
        </nav>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <p className="text-xs sm:text-sm text-gray-500 mb-6">
            <Link href="/" className="hover:text-amber-600">首页</Link>
            <span className="mx-2">/</span>
            <Link href="/blog" className="hover:text-amber-600">博客</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-700">SEO文章写作指南</span>
          </p>

          <h1 className="text-3xl sm:text-4xl font-bold text-teal-900 mb-4 leading-tight">
            SEO文章写作完全指南：让搜索引擎爱上你的内容
          </h1>

          <div className="flex items-center gap-3 text-sm text-gray-500 mb-8 pb-6 border-b border-gray-200">
            <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium text-xs">SEO优化</span>
            <span>2026-06-07</span>
            <span>· 10分钟阅读</span>
          </div>

          <div className="prose prose-gray max-w-none space-y-5 text-gray-700 leading-relaxed text-sm sm:text-base">
            <p className="text-lg sm:text-xl text-gray-600 font-medium">
              搜索引擎是网站最大的免费流量来源。写好SEO文章，能让你的网站持续获得自然搜索流量，而且是免费的。
            </p>
            <p>用 <Link href="/writing-tool" className="text-amber-600 underline font-medium">墨言AI写作助手</Link> 选择"SEO文章"类型，AI自动生成符合搜索引擎优化标准的内容。</p>

            <h2 className="text-2xl font-bold mt-10 mb-4">1. 关键词研究是第一步</h2>
            <p>写SEO文章前，先确定你要优化的关键词。好的关键词有三个特征：</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>搜索量大</strong> — 每个月有足够多人搜这个词</li>
              <li><strong>竞争小</strong> — 大网站不会和你抢这个词</li>
              <li><strong>商业价值高</strong> — 搜索用户有明确需求</li>
            </ul>
            <p>新手策略：<strong>主攻长尾关键词</strong>（3-5个词组合）。比如不写"AI写作"，写"AI帮写小红书文案"——搜索的人少但更精准。</p>

            <h2 className="text-2xl font-bold mt-10 mb-4">2. 关键词布局（放在哪？）</h2>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="font-medium text-teal-800">🎯 关键词必放位置（按重要性排序）：</p>
              <ol className="list-decimal pl-5 mt-2 space-y-2">
                <li><strong>页面标题（Title Tag）</strong> — 最重要的排名因素</li>
                <li><strong>H1标题</strong> — 文章的大标题</li>
                <li><strong>文章首段</strong> — 前100个字符内</li>
                <li><strong>URL链接</strong> — 短、包含关键词</li>
                <li><strong>H2/H3副标题</strong> — 自然融入相关词</li>
                <li><strong>图片alt属性</strong> — 描述图片时带关键词</li>
                <li><strong>文章末尾</strong> — 自然总结</li>
              </ol>
            </div>
            <p className="mt-2"><strong>重要提醒</strong>：不要堆砌关键词（Keyword Stuffing）。Google会识别并惩罚。自然写作，每个关键词出现2-5次即可。</p>

            <h2 className="text-2xl font-bold mt-10 mb-4">3. 文章结构优化</h2>
            <p>搜索引擎喜欢有清晰结构的文章。使用正确的HTML标题层级：</p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 font-mono text-sm">
              <p>&lt;h1&gt;SEO文章写作完全指南&lt;/h1&gt;</p>
              <p className="pl-4">&lt;h2&gt;1. 关键词研究&lt;/h2&gt;</p>
              <p className="pl-8">&lt;h3&gt;长尾关键词策略&lt;/h3&gt;</p>
              <p className="pl-4">&lt;h2&gt;2. 关键词布局&lt;/h2&gt;</p>
              <p className="pl-8">&lt;h3&gt;标题优化&lt;/h3&gt;</p>
              <p className="pl-8">&lt;h3&gt;正文布局&lt;/h3&gt;</p>
            </div>
            <p><strong>规则</strong>：一篇文章只有一个H1。H2是主要章节，H3是子章节。不要跳过标题等级（不要H1直接到H3）。</p>

            <h2 className="text-2xl font-bold mt-10 mb-4">4. 内链策略</h2>
            <p>内链帮助搜索引擎理解你的网站结构，也能把权重传递给其他页面。</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>每篇文章链向你网站的2-3个其他相关页面</li>
              <li>使用有意义的锚文本（不要"点击这里"）</li>
              <li>高权重页面（如首页）链向低权重页面</li>
              <li>用 <Link href="/blog" className="text-amber-600 underline">相关的博客文章</Link> 互相链接</li>
            </ul>

            <h2 className="text-2xl font-bold mt-10 mb-4">5. 文章长度与质量</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>通用文章</strong>：800-1500字</li>
              <li><strong>深度指南</strong>：2000-5000字（Google更喜欢长文章）</li>
              <li><strong>清单列表</strong>：500-1000字</li>
            </ul>
            <p>质量比长度更重要。但数据表明，1500字以上的文章平均排名更高。</p>

            <h2 className="text-2xl font-bold mt-10 mb-4">6. 用户体验信号</h2>
            <p>Google越来越重视用户行为信号：</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>停留时间</strong> — 用户在页面待多久</li>
              <li><strong>跳出率</strong> — 打开就关掉的比例</li>
              <li><strong>点击率</strong> — 搜索结果中被点击的比例</li>
            </ul>
            <p>优化方法：写吸引人的标题、首段要抓人、用小标题和图片让文章易读、末尾加CTA引导继续浏览。</p>

            <h2 className="text-2xl font-bold mt-10 mb-4">总结</h2>
            <p>
              SEO文章写作不是玄学。做好关键词研究，布局好标题和结构，加上优质内容和内链，你的文章就能在搜索结果中获得更好的排名。
            </p>
            <p>
              想快速生成符合SEO标准的文章？试试 <Link href="/writing-tool" className="text-amber-600 underline font-medium">墨言AI写作助手</Link> 的"SEO文章"模式。
            </p>

            <div className="bg-gradient-to-r from-blue-50 to-teal-50 rounded-xl border border-blue-100 p-6 mt-8 text-center">
              <p className="text-lg font-bold text-teal-900 mb-2">
                免费生成SEO文章
              </p>
              <p className="text-sm text-gray-600 mb-4">
                输入主题，AI自动生成符合SEO标准的内容
              </p>
              <Link
                href="/writing-tool"
                className="inline-block bg-teal-600 hover:bg-teal-700 text-white font-medium px-6 py-3 rounded-lg transition-colors"
              >
                免费使用 →
              </Link>
            </div>
          </div>
        </div>

        <footer className="bg-teal-900 text-teal-300 text-xs px-4 sm:px-6 py-4 text-center">
          <p>© 2026 Sinmoniker — <Link href="/" className="hover:text-white">中文名生成</Link> · <Link href="/writing-tool" className="hover:text-white">AI写作助手</Link> · <Link href="/blog" className="hover:text-white">博客</Link></p>
        </footer>
      </article>
    </>
  );
}
