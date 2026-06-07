// /blog — 博客列表页（动态从数据库读取）

import type { Metadata } from "next";
import Link from "next/link";
import JsonLd, { breadcrumbLd, siteNavigationLd } from "@/components/JsonLd";
import { getPublishedPosts, getCategories } from "@/models/BlogPost.js";
import { createTable } from "@/models/BlogPost.js";

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

export const dynamic = 'force-dynamic';

export default async function BlogPage() {
  // Ensure table exists
  await createTable().catch(() => {});

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://sinmoniker.com";
  const posts = await getPublishedPosts({ limit: 50, offset: 0 });
  const categories = await getCategories().catch(() => []);

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
          <div className="flex items-center gap-3">
            <Link
              href="/writing-tool"
              className="text-teal-200 hover:text-white text-sm transition-colors"
            >
              ✍️ 免费写作 →
            </Link>
            <Link
              href="/blog/admin"
              className="text-amber-300 hover:text-amber-200 text-xs transition-colors"
            >
              管理
            </Link>
          </div>
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

        {/* Categories */}
        {categories.length > 0 && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 mb-8">
            <div className="flex flex-wrap gap-2 justify-center">
              {categories.map(cat => (
                <span
                  key={cat.category}
                  className="text-xs bg-teal-50 text-teal-700 px-3 py-1.5 rounded-full border border-teal-100"
                >
                  {cat.category} ({cat.count})
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Blog Posts */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 pb-16">
          {posts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-400 text-lg mb-2">📝 暂无文章</p>
              <p className="text-gray-400 text-sm">新文章正在路上，敬请期待</p>
            </div>
          ) : (
            <div className="grid gap-6 sm:gap-8">
              {posts.map((post) => (
                <article
                  key={post.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                >
                  <Link href={`/blog/${post.slug}`} className="block p-5 sm:p-8">
                    <div className="flex items-center gap-2 sm:gap-3 mb-3 text-xs sm:text-sm text-gray-500">
                      <span className="bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full font-medium">
                        {post.category || '未分类'}
                      </span>
                      <span>
                        {post.published_at
                          ? new Date(post.published_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
                          : '刚刚发布'}
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-teal-900 mb-3 hover:text-amber-600 transition-colors">
                      {post.title}
                    </h2>
                    <p className="text-sm sm:text-base text-gray-600 leading-relaxed mb-4">
                      {post.description || '点击阅读全文'}
                    </p>
                    {post.tags && post.tags.length > 0 && (
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
                    )}
                  </Link>
                </article>
              ))}
            </div>
          )}

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
          <p>© 2026 Sinmoniker — AI写作 & 中文名生成 & SEO工具</p>
        </footer>
      </div>
    </>
  );
}
