// /blog/admin/[id] — 编辑文章

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

export default function EditBlogPostPage() {
  const router = useRouter();
  const params = useParams();
  const [form, setForm] = useState({
    title: '',
    content: '',
    description: '',
    keywords: '',
    category: 'SEO优化',
    tags: '',
    slug: '',
    status: 'draft',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState('');

  const categories = ['SEO优化', 'AI写作教程', '小红书运营', '网站运营', '产品教程', '行业资讯', '未分类'];

  useEffect(() => {
    loadPost();
  }, []);

  async function loadPost() {
    try {
      const res = await fetch(`/api/blog/posts/${params.id}`);
      if (!res.ok) {
        if (res.status === 401) {
          setError('请先登录管理员账号');
          return;
        }
        throw new Error('加载失败');
      }
      const data = await res.json();
      const post = data.post;
      setForm({
        title: post.title || '',
        content: post.content || '',
        description: post.description || '',
        keywords: (post.keywords || []).join(', '),
        category: post.category || '未分类',
        tags: (post.tags || []).join(', '),
        slug: post.slug || '',
        status: post.status || 'draft',
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function renderMarkdown(text) {
    if (!text) return '';
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

      const submitStatus = e.nativeEvent.submitter?.value || form.status;

      const res = await fetch(`/api/blog/posts/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          slug: form.slug,
          content: form.content,
          description: form.description,
          keywords,
          category: form.category,
          tags,
          status: submitStatus,
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  if (error && !form.title) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          {error.includes('登录') && (
            <Link href="/login" className="text-teal-600 underline">去登录</Link>
          )}
          <Link href="/blog/admin" className="ml-4 text-gray-500 underline">返回后台</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-teal-900 text-white px-4 sm:px-6 py-3 flex items-center justify-between">
        <Link href="/blog/admin" className="text-lg font-bold hover:text-amber-300 transition-colors">
          ← 管理后台
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPreview(!preview)}
            className="text-teal-200 hover:text-white text-sm transition-colors"
          >
            {preview ? '✏️ 编辑' : '👁️ 预览'}
          </button>
          <Link
            href={`/blog/${form.slug}`}
            target="_blank"
            className="text-teal-200 hover:text-white text-xs"
          >
            前台查看 ↗
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <h1 className="text-2xl font-bold text-teal-900 mb-6">✏️ 编辑文章</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Status badge */}
        <div className="mb-4">
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            form.status === 'published'
              ? 'bg-green-50 text-green-700'
              : 'bg-yellow-50 text-yellow-700'
          }`}>
            {form.status === 'published' ? '✅ 已发布' : '📝 草稿'}
          </span>
        </div>

        {preview ? (
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
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">标题 *</label>
              <input
                type="text"
                value={form.title}
                onChange={e => handleChange('title', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-lg font-bold"
                maxLength={300}
                required
              />
            </div>

            {/* Slug */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL路径)</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 shrink-0">/blog/</span>
                <input
                  type="text"
                  value={form.slug}
                  onChange={e => handleChange('slug', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
                  maxLength={200}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SEO描述</label>
              <textarea
                value={form.description}
                onChange={e => handleChange('description', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
                maxLength={400}
                rows={2}
              />
              <span className="text-xs text-gray-400">{form.description.length}/400</span>
            </div>

            {/* Keywords + Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">关键词</label>
                <input
                  type="text"
                  value={form.keywords}
                  onChange={e => handleChange('keywords', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">标签</label>
              <input
                type="text"
                value={form.tags}
                onChange={e => handleChange('tags', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
              />
            </div>

            {/* Content */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">内容 (Markdown)</label>
                <span className="text-xs text-gray-400"># h1, ## h2, ### h3, **加粗**, - 列表</span>
              </div>
              <textarea
                value={form.content}
                onChange={e => handleChange('content', e.target.value)}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm font-mono leading-relaxed"
                rows={16}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="flex gap-2">
                <button
                  type="submit"
                  value="draft"
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  💾 保存草稿
                </button>
                <button
                  type="submit"
                  value="published"
                  disabled={saving}
                  className="px-6 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors text-sm"
                >
                  {saving ? '保存中...' : form.status === 'published' ? '🔄 更新发布' : '🚀 发布'}
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
