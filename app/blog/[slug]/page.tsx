// /blog/[slug] — 动态博客文章页
// 从数据库读取文章内容，支持SEO元数据

import { getPostBySlug, getRelatedPosts } from '@/models/BlogPost.js';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import JsonLd, { breadcrumbLd, blogPostLd } from '@/components/JsonLd';

interface Props {
  params: Promise<{ slug: string }>;
}

// Render basic markdown to HTML (server-side safe)
function renderMarkdown(text: string): string {
  if (!text) return '';
  let html = text
    .replace(/^### (.+)$/gm, '<h3 class="text-xl font-bold text-teal-900 mt-6 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold text-teal-900 mt-8 mb-3">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold text-teal-900 mt-8 mb-4">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-teal-800">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-5 list-disc text-gray-700 leading-relaxed mb-1">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-5 list-decimal text-gray-700 leading-relaxed mb-1">$2</li>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-amber-600 hover:text-amber-700 underline font-medium">$1</a>')
    .replace(/\n\n/g, '</p><p class="text-gray-700 leading-relaxed mb-4">')
    .replace(/\n/g, '<br>');
  return `<p class="text-gray-700 leading-relaxed mb-4">${html}</p>`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  
  if (!post) {
    return { title: '文章未找到 | Sinmoniker' };
  }

  return {
    title: `${post.title} | Sinmoniker`,
    description: post.description || `阅读"${post.title}"，获取实用干货。`,
    keywords: post.keywords || [],
    openGraph: {
      title: post.title,
      description: post.description || '',
      type: 'article',
      locale: 'zh_CN',
      siteName: 'Sinmoniker',
      publishedTime: post.published_at?.toISOString(),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description || '',
    },
    alternates: {
      canonical: `/blog/${post.slug}`,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://sinmoniker.com';
  const relatedPosts = await getRelatedPosts(slug, 3);

  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: '首页', url: baseUrl },
          { name: '博客', url: `${baseUrl}/blog` },
          { name: post.title, url: `${baseUrl}/blog/${post.slug}` },
        ])}
      />
      <JsonLd
        data={blogPostLd({
          title: post.title,
          description: post.description || '',
          url: `${baseUrl}/blog/${post.slug}`,
          datePublished: post.published_at?.toISOString().split('T')[0] || post.created_at?.toISOString().split('T')[0],
        })}
      />

      <article className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        {/* Navigation */}
        <nav className="bg-teal-900 text-white px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold hover:text-amber-300 transition-colors">
            Sinmoniker
          </Link>
          <Link href="/blog" className="text-teal-200 hover:text-white text-sm transition-colors">
            ← 返回博客
          </Link>
        </nav>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          {/* Breadcrumb */}
          <p className="text-xs sm:text-sm text-gray-500 mb-6">
            <Link href="/" className="hover:text-amber-600">首页</Link>
            <span className="mx-2">/</span>
            <Link href="/blog" className="hover:text-amber-600">博客</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-700">{post.title}</span>
          </p>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl font-bold text-teal-900 mb-4 leading-tight">
            {post.title}
          </h1>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mb-6 pb-6 border-b border-gray-200">
            <span className="bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full font-medium text-xs">
              {post.category || '未分类'}
            </span>
            <span>
              {post.published_at
                ? new Date(post.published_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
                : new Date(post.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
              }
            </span>
            {post.tags && post.tags.length > 0 && (
              <span className="hidden sm:inline">
                · {post.tags.slice(0, 3).join(' / ')}
              </span>
            )}
          </div>

          {/* Description (if exists) */}
          {post.description && (
            <div className="bg-teal-50 border border-teal-100 rounded-lg p-4 mb-8">
              <p className="text-sm text-teal-800 leading-relaxed">
                📖 {post.description}
              </p>
            </div>
          )}

          {/* Content */}
          <div
            className="prose prose-gray prose-headings:text-teal-900 prose-a:text-amber-600 max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }}
          />

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag: string) => (
                  <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Related posts */}
          {relatedPosts.length > 0 && (
            <div className="mt-10 pt-8 border-t border-gray-200">
              <h2 className="text-xl font-bold text-teal-900 mb-4">📖 相关文章</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                {relatedPosts.map((rp: any) => (
                  <Link
                    key={rp.id}
                    href={`/blog/${rp.slug}`}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <h3 className="font-medium text-teal-800 text-sm mb-1 line-clamp-2">{rp.title}</h3>
                    <p className="text-xs text-gray-400">
                      {rp.published_at
                        ? new Date(rp.published_at).toLocaleDateString('zh-CN')
                        : ''}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="mt-10 bg-gradient-to-r from-teal-50 to-amber-50 rounded-xl border border-teal-100 p-6 text-center">
            <p className="text-lg font-bold text-teal-900 mb-2">
              觉得有用？试试这些工具
            </p>
            <p className="text-sm text-gray-600 mb-4">
              AI写作 · 中文名生成 · SEO诊断
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/writing-tool"
                className="inline-block bg-teal-600 hover:bg-teal-700 text-white font-medium px-5 py-2.5 rounded-lg transition-colors text-sm"
              >
                ✍️ 墨言AI写作
              </Link>
              <Link
                href="/seo-diagnosis"
                className="inline-block bg-amber-500 hover:bg-amber-600 text-white font-medium px-5 py-2.5 rounded-lg transition-colors text-sm"
              >
                🔍 SEO诊断工具
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-teal-900 text-teal-300 text-xs px-4 sm:px-6 py-4 text-center">
          <p>© 2026 Sinmoniker — 博客 · AI写作 · 中文名生成 · SEO工具</p>
        </footer>
      </article>
    </>
  );
}
