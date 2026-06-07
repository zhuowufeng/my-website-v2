// /blog/admin/new — 新建文章

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewBlogPostPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: '',
    content: '',
    description: '',
    keywords: '',
    category: 'SEO优化',
    tags: '',
    status: 'draft',
  });
  const [slug, setSlug] = useState('');
  const [autoSlug, setAutoSlug] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState('');

  const categories = ['SEO优化', 'AI写作教程', '小红书运营', '网站运营', '产品教程', '行业资讯', '未分类'];

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === 'title' && autoSlug) {
      setSlug(generateSlug(value));
    }
  }

  function generateSlug(text) {
    return text.toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .substring(0, 200) || 'untitled';
  }

  function renderMarkdown(text) {
    if (!text) return '';
    // Simple markdown to HTML
    let html = text
      .replace(/^### (.+)$/gm, '<h3 class="text-xl font-bold text-teal-900 mt-6 mb-2">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold text-teal-900 mt-8 mb-3">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold text-teal-900 mt-8 mb-4">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code class="bg-gray-100 px-1 rounded text-sm">$1</code>')
      .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-gray-700">$1</li>')
      .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal text-gray-700">$2</li>')
      .replace(/\n\n/g, '</p><p class="text-gray-700 leading-relaxed mb-4">')
      .replace(/\n/g, '<br>');
    return `<p class="text-gray-700 leading-relaxed mb-4">${html}</p>`;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const keywords = form.keywords.split(/[,，、]/).map(k => k.trim()).filter(Boolean);
      const tags = form.tags.split(/[,，、]/).map(t => t.trim()).filter(Boolean);

      const res = await fetch('/api/blog/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          slug: slug || generateSlug(form.title),
          content: form.content,
          description: form.description,
          keywords,
          category: form.category,
          tags,
          status: form.status,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '保存失败');
      }

      router.push('/blog/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-teal-900 text-white px-4 sm:px-6 py-3 flex items-center justify-between">
        <Link href="/blog/admin" className="text-lg font-bold hover:text-amber-300 transition-colors">
          ← 管理后台
        </Link>
        <button
          onClick={() => setPreview(!preview)}
          className="text-teal-200 hover:text-white text-sm transition-colors"
        >
          {preview ? '✏️ 编辑' : '👁️ 预览'}
        </button>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <h1 className="text-2xl font-bold text-teal-900 mb-6">📝 写新文章</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {preview ? (
          /* Preview mode */
          <div className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8">
            <h1 className="text-3xl font-bold text-teal-900 mb-4">{form.title || '(无标题)'}</h1>
            {form.description && (
              <p className="text-gray-500 text-sm mb-6 pb-4 border-b border-gray-200">{form.description}</p>
            )}
            <div 
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(form.content) }}
            />
          </div>
        ) : (
          /* Editor mode */
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">标题 *</label>
              <input
                type="text"
                value={form.title}
                onChange={e => handleChange('title', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-lg font-bold"
                placeholder="输入文章标题"
                maxLength={300}
                required
              />
            </div>

            {/* Slug */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Slug (URL路径)
                <label className="ml-2 text-xs text-gray-400 font-normal cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSlug}
                    onChange={e => setAutoSlug(e.target.checked)}
                    className="mr-1"
                  />
                  自动生成
                </label>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 shrink-0">/blog/</span>
                <input
                  type="text"
                  value={slug}
                  onChange={e => { setSlug(e.target.value); setAutoSlug(false); }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
                  placeholder="article-slug"
                  maxLength={200}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SEO描述 (description)</label>
              <textarea
                value={form.description}
                onChange={e => handleChange('description', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
                placeholder="文章在搜索结果中显示的简短描述"
                maxLength={400}
                rows={2}
              />
              <span className="text-xs text-gray-400">{form.description.length}/400</span>
            </div>

            {/* Keywords + Category row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">关键词 (逗号分隔)</label>
                <input
                  type="text"
                  value={form.keywords}
                  onChange={e => handleChange('keywords', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
                  placeholder="SEO, 博客写作, 内容营销"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">分类</label>
                <select
                  value={form.category}
                  onChange={e => handleChange('category', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">标签 (逗号分隔)</label>
              <input
                type="text"
                value={form.tags}
                onChange={e => handleChange('tags', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
                placeholder="AI写作, SEO优化, 内容创作"
              />
            </div>

            {/* Content */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">文章内容 (Markdown格式)</label>
                <span className="text-xs text-gray-400">支持 # h1, ## h2, ### h3, **加粗**, - 列表</span>
              </div>
              <textarea
                value={form.content}
                onChange={e => handleChange('content', e.target.value)}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm font-mono leading-relaxed"
                placeholder={`# 文章标题\n\n文章内容...\n\n## 小标题\n\n- 列表项1\n- 列表项2\n\n**加粗文字**`}
                rows={16}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="flex gap-2">
                <button
                  type="submit"
                  name="status"
                  value="draft"
                  onClick={() => { form.status = 'draft'; }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  💾 保存草稿
                </button>
                <button
                  type="submit"
                  name="status"
                  value="published"
                  onClick={() => { form.status = 'published'; }}
                  disabled={saving}
                  className="px-6 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors text-sm"
                >
                  {saving ? '保存中...' : '🚀 发布'}
                </button>
              </div>
              <Link href="/blog/admin" className="text-sm text-gray-500 hover:text-gray-700">
                取消
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
