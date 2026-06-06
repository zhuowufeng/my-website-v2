import type { Metadata } from "next";
import Link from "next/link";
import JsonLd, { breadcrumbLd, siteNavigationLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "博客 | AI写作技巧 & SEO内容攻略 | Sinmoniker",
  description:
    "免费学习AI写作技巧、小红书文案模板、SEO内容优化方法。用墨言AI写作助手，轻松生成优质中文内容。",
  keywords: [
    "AI写作技巧",
    "博客写作教程",
    "小红书文案怎么写",
    "SEO文章写作指南",
    "AI内容创作",
    "免费写作工具",
  ],
  openGraph: {
    title: "博客 | AI写作技巧 & SEO内容攻略 | Sinmoniker",
    description:
      "免费学习AI写作技巧、小红书文案模板、SEO内容优化方法。",
    type: "website",
    locale: "zh_CN",
    siteName: "Sinmoniker - 墨言",
  },
  twitter: {
    card: "summary_large_image",
    title: "博客 | AI写作技巧 & SEO内容攻略",
    description: "免费学习AI写作技巧、小红书文案模板、SEO内容优化方法。",
  },
  alternates: {
    canonical: "/blog",
  },
};

const blogPosts = [
  {
    slug: "ai-writing-tips",
    title: "AI写作入门：如何用AI工具快速写出高质量文章",
    description:
      "掌握AI写作的核心技巧，从Prompt工程到文章结构优化，让你用AI工具写出比人工更好的内容。适合博客作者、自媒体运营和SEO内容创作者。",
    date: "2026-06-07",
    category: "AI写作教程",
    readTime: "8分钟",
    tags: ["AI写作", "Prompt工程", "写作技巧"],
  },
  {
    slug: "xiaohongshu-copywriting",
    title: "小红书文案生成指南：AI帮你写出爆款笔记",
    description:
      "小红书笔记怎么写才有人看？从选题到标题，从正文到标签，手把手教你用AI生成高互动率的小红书文案。免费AI工具一键生成。",
    date: "2026-06-07",
    category: "小红书运营",
    readTime: "6分钟",
    tags: ["小红书", "文案生成", "爆款笔记", "AI工具"],
  },
  {
    slug: "seo-content-writing",
    title: "SEO文章写作完全指南：让搜索引擎爱上你的内容",
    description:
      "SEO文章怎么写才能排名靠前？从关键词布局到标题优化，从内链策略到内容结构，系统学习搜索引擎优化的写作方法。支持免费AI生成SEO文章。",
    date: "2026-06-07",
    category: "SEO优化",
    readTime: "10分钟",
    tags: ["SEO", "搜索引擎优化", "内容策略", "关键词研究"],
  },
];

export default function BlogPage() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://sinmoniker.com";

  return (
    <>
      <JsonLd data={siteNavigationLd()} />
      <JsonLd
        data={breadcrumbLd([
          { name: "首页", url: baseUrl },
          { name: "博客", url: `${baseUrl}/blog` },
        ])}
      />

      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        {/* Navigation */}
        <nav className="bg-teal-900 text-white px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <Link href="/" className="text-lg sm:text-xl font-bold hover:text-amber-300 transition-colors">
            Sinmoniker
          </Link>
          <Link
            href="/writing-tool"
            className="text-teal-200 hover:text-white text-sm transition-colors"
          >
            ✍️ 免费写作 →
          </Link>
        </nav>

        {/* Header */}
        <header className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center">
          <h1 className="text-3xl sm:text-5xl font-bold text-teal-900 mb-4">
            AI写作 & SEO内容攻略
          </h1>
          <p className="text-gray-600 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            免费学习AI写作技巧、小红书文案模板和SEO优化方法。
            用<a href="/writing-tool" className="text-amber-600 hover:text-amber-700 underline">墨言AI写作助手</a>轻松生成高质量内容。
          </p>
        </header>

        {/* Blog Posts */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 pb-16">
          <div className="grid gap-6 sm:gap-8">
            {blogPosts.map((post) => (
              <article
                key={post.slug}
                className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <Link href={`/blog/${post.slug}`} className="block p-5 sm:p-8">
                  <div className="flex items-center gap-2 sm:gap-3 mb-3 text-xs sm:text-sm text-gray-500">
                    <span className="bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full font-medium">
                      {post.category}
                    </span>
                    <span>{post.date}</span>
                    <span>· {post.readTime}</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-teal-900 mb-3 hover:text-amber-600 transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-sm sm:text-base text-gray-600 leading-relaxed mb-4">
                    {post.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </Link>
              </article>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-12 text-center bg-gradient-to-r from-teal-50 to-amber-50 rounded-xl border border-teal-100 p-6 sm:p-8">
            <p className="text-lg sm:text-xl font-bold text-teal-900 mb-2">
              想试试AI写作？
            </p>
            <p className="text-sm sm:text-base text-gray-600 mb-4">
              输入主题，AI帮你自动生成，支持4种文章类型。
            </p>
            <Link
              href="/writing-tool"
              className="inline-block bg-teal-600 hover:bg-teal-700 text-white font-medium px-6 py-3 rounded-lg transition-colors"
            >
              免费使用墨言AI写作助手 →
            </Link>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-teal-900 text-teal-300 text-xs px-4 sm:px-6 py-4 text-center">
          <p>© 2026 Sinmoniker — AI写作 & 中文名生成</p>
        </footer>
      </div>
    </>
  );
}
