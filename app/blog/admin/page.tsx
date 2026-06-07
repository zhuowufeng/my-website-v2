// /blog/admin — Blog管理后台

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function BlogAdminPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    loadPosts();
  }, [filter]);

  async function loadPosts() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (filter) params.set('status', filter);
      const res = await fetch(`/api/blog/posts?${params}`);
      if (!res.ok) {
        if (res.status === 401) {
          setError('请先登录管理员账号');
          return;
        }
        throw new Error('加载失败');
      }
      const data = await res.json();
      setPosts(data.posts || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('确定要删除这篇文章吗？不可恢复。')) return;
    try {
      const res = await fetch(`/api/blog/posts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('删除失败');
      setPosts(posts.filter(p => p.id !== id));
    } catch (err) {
      alert('删除失败: ' + err.message);
    }
  }

  async function handleToggleStatus(post) {
    const newStatus = post.status === 'published' ? 'draft' : 'published';
    try {
      const res = await fetch(`/api/blog/posts/${post.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('更新失败');
      setPosts(posts.map(p => p.id === post.id ? { ...p, status: newStatus } : p));
    } catch (err) {
      alert('更新失败: ' + err.message);
    }
  }

  const statusCount = {
    all: posts.length,
    published: posts.filter(p => p.status === 'published').length,
    draft: posts.filter(p => p.status === 'draft').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-teal-900 text-white px-4 sm:px-6 py-3 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold hover:text-amber-300 transition-colors">
          Sinmoniker
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/blog" className="text-teal-200 hover:text-white text-sm transition-colors">
            ← 博客前台
          </Link>
          <Link
            href="/blog/admin/new"
            className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            ✏️ 写新文章
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-teal-900">博客管理后台</h1>
            <p className="text-sm text-gray-500 mt-1">管理所有博客文章，包括草稿和已发布的</p>
          </div>
          <Link
            href="/blog/admin/new"
            className="mt-3 sm:mt-0 inline-flex items-center gap-1 bg-teal-600 hover:bg-teal-700 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm"
          >
            <span className="text-lg">+</span> 新建文章
          </Link>
        </div>

        {/* Status tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { key: '', label: '全部', count: statusCount.all },
            { key: 'published', label: '已发布', count: statusCount.published },
            { key: 'draft', label: '草稿', count: statusCount.draft },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-teal-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
            {error.includes('登录') && (
              <Link href="/login" className="ml-2 underline font-medium">去登录</Link>
            )}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-12 text-gray-500">加载中...</div>
        )}

        {/* Posts table */}
        {!loading && !error && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {posts.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg mb-2">还没有文章</p>
                <Link href="/blog/admin/new" className="text-teal-600 hover:text-teal-700 underline text-sm">
                  开始写第一篇文章 →
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-medium text-gray-600">标题</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">分类</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">状态</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">浏览</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">更新于</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {posts.map(post => (
                      <tr key={post.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-teal-900 truncate max-w-[250px] sm:max-w-sm">
                            <Link href={`/blog/${post.slug}`} className="hover:text-amber-600 transition-colors">
                              {post.title}
                            </Link>
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">/{post.slug}</div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="bg-teal-50 text-teal-700 text-xs px-2 py-0.5 rounded-full">
                            {post.category || '未分类'}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <button
                            onClick={() => handleToggleStatus(post)}
                            className={`text-xs font-medium px-2 py-1 rounded-full transition-colors ${
                              post.status === 'published'
                                ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                            }`}
                          >
                            {post.status === 'published' ? '✅ 已发布' : '📝 草稿'}
                          </button>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs">
                          {post.view_count || 0}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-gray-500 text-xs">
                          {post.updated_at ? new Date(post.updated_at).toLocaleDateString('zh-CN') : '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/blog/admin/${post.id}`}
                              className="text-teal-600 hover:text-teal-700 text-xs font-medium"
                            >
                              编辑
                            </Link>
                            <Link
                              href={`/blog/${post.slug}`}
                              target="_blank"
                              className="text-blue-600 hover:text-blue-700 text-xs"
                            >
                              预览
                            </Link>
                            <button
                              onClick={() => handleDelete(post.id)}
                              className="text-red-500 hover:text-red-600 text-xs"
                            >
                              删除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Quick tips */}
        <div className="mt-8 bg-blue-50 border border-blue-100 rounded-xl p-4 sm:p-6">
          <h3 className="font-bold text-blue-900 mb-2">💡 博客SEO小贴士</h3>
          <ul className="text-sm text-blue-800 space-y-1.5">
            <li>• 每篇文章至少 800 字，SEO 效果更好</li>
            <li>• 标题包含核心关键词，控制在 30 字以内</li>
            <li>• description 越精准，点击率越高</li>
            <li>• 添加至少 3-5 个标签，覆盖长尾词</li>
            <li>• 发布后记得分享到社交媒体引流</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
