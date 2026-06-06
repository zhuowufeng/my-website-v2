'use client';

// 墨言文章助手 — AI Writing Tool (v2 with article history)
import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';

type ArticleType = 'blog' | 'social' | 'seo' | 'product';

const TYPE_LABELS: Record<ArticleType, string> = {
  blog: '📝 博客文章',
  social: '📱 社交媒体/小红书',
  seo: '🔍 SEO优化文章',
  product: '💼 产品介绍',
};

const TYPE_PLACEHOLDERS: Record<ArticleType, string> = {
  blog: '例如：如何用AI提高工作效率',
  social: '例如：周末必去的5个上海咖啡馆',
  seo: '例如：2026年最好的免费AI写作工具推荐',
  product: '例如：一款智能水杯的核心功能',
};

interface ArticleRecord {
  id: number;
  topic: string;
  article_type: string;
  title: string | null;
  word_count: number;
  created_at: string;
  content?: string;
}

function formatOutput(text: string): string {
  let clean = text.trim();
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```$/, '');
  }
  return clean;
}

function renderStructuredContent(text: string): string {
  try {
    const data = JSON.parse(text);
    let html = '';

    if (data.title) {
      html += `<h2 class="text-2xl font-bold text-teal-900 mb-3">${escapeHtml(data.title)}</h2>`;
    }
    if (data.alternateTitles?.length) {
      html += `<div class="mb-4 text-sm text-gray-500">备选标题：${data.alternateTitles.map((t: string) => escapeHtml(t)).join(' ｜ ')}</div>`;
    }
    if (data.tagline) {
      html += `<p class="text-lg text-amber-700 font-medium mb-4">${escapeHtml(data.tagline)}</p>`;
    }
    if (data.hook) {
      html += `<p class="text-lg font-medium text-gray-800 mb-3">${escapeHtml(data.hook)}</p>`;
    }
    if (data.summary) {
      html += `<div class="bg-teal-50 border-l-4 border-teal-500 p-3 mb-4 text-sm text-gray-700">📌 ${escapeHtml(data.summary)}</div>`;
    }
    if (data.metaDescription) {
      html += `<div class="bg-blue-50 border-l-4 border-blue-500 p-3 mb-4 text-sm text-gray-700">🔎 Meta描述：${escapeHtml(data.metaDescription)}</div>`;
    }
    if (data.sections?.length) {
      for (const section of data.sections) {
        html += `<h3 class="text-xl font-semibold text-teal-800 mt-5 mb-2">${escapeHtml(section.heading)}</h3>`;
        html += `<p class="text-gray-700 leading-relaxed mb-3">${escapeHtml(section.content)}</p>`;
      }
    }
    if (data.features?.length) {
      html += `<div class="grid gap-3 my-4">`;
      for (const f of data.features) {
        html += `<div class="bg-gray-50 p-3 rounded-lg border border-gray-200">
          <strong class="text-teal-800">${escapeHtml(f.name)}</strong>
          <p class="text-sm text-gray-600 mt-1">${escapeHtml(f.description)}</p>
        </div>`;
      }
      html += `</div>`;
    }
    if (data.benefits?.length) {
      html += `<h3 class="text-lg font-semibold text-gray-800 mt-4 mb-2">✨ 核心优势</h3><ul class="list-disc pl-5 space-y-1 text-gray-700 mb-4">`;
      for (const b of data.benefits) html += `<li>${escapeHtml(b)}</li>`;
      html += `</ul>`;
    }
    if (data.points?.length) {
      for (const p of data.points) {
        html += `<p class="text-gray-700 leading-relaxed mb-2">${escapeHtml(p)}</p>`;
      }
    }
    if (data.useCases?.length) {
      html += `<h3 class="text-lg font-semibold text-gray-800 mt-4 mb-2">🎯 适用场景</h3><ul class="list-disc pl-5 space-y-1 text-gray-700 mb-4">`;
      for (const u of data.useCases) html += `<li>${escapeHtml(u)}</li>`;
      html += `</ul>`;
    }
    if (data.conclusion) {
      html += `<div class="border-t pt-3 mt-4 text-gray-700 italic">${escapeHtml(data.conclusion)}</div>`;
    }
    if (data.cta) {
      html += `<div class="bg-amber-50 border border-amber-200 p-3 rounded-lg mt-4 text-center font-medium text-amber-800">${escapeHtml(data.cta)}</div>`;
    }
    if (data.hashtags?.length) {
      html += `<div class="mt-4 text-blue-600 text-sm">${data.hashtags.map((t: string) => escapeHtml(t)).join(' ')}</div>`;
    }
    if (data.keywords?.length) {
      html += `<div class="mt-2 text-xs text-gray-400">关键词：${data.keywords.join(', ')}</div>`;
    }

    return html || `<pre class="whitespace-pre-wrap text-sm text-gray-700">${escapeHtml(text)}</pre>`;
  } catch {
    return `<pre class="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">${escapeHtml(text)}</pre>`;
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const DAILY_FREE_LIMIT = 10;

function getDailyUsage(): number {
  if (typeof window === 'undefined') return 0;
  const today = new Date().toISOString().slice(0, 10);
  const val = parseInt(localStorage.getItem(`writing_usage_${today}`) || '0', 10);
  return val;
}

function incrementDailyUsage(): number {
  if (typeof window === 'undefined') return 0;
  const today = new Date().toISOString().slice(0, 10);
  const val = parseInt(localStorage.getItem(`writing_usage_${today}`) || '0', 10) + 1;
  localStorage.setItem(`writing_usage_${today}`, val.toString());
  return val;
}

function getSessionId(): string {
  let sid = localStorage.getItem('writing_session_id');
  if (!sid) {
    sid = 'anon_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    localStorage.setItem('writing_session_id', sid);
  }
  return sid;
}

export default function WritingToolPage() {
  const [topic, setTopic] = useState('');
  const [articleType, setArticleType] = useState<ArticleType>('blog');
  const [output, setOutput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<ArticleRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [viewingArticle, setViewingArticle] = useState<ArticleRecord | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [dailyUsage, setDailyUsage] = useState(0);
  const outputRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load history on mount
  useEffect(() => {
    loadHistory();
    setDailyUsage(getDailyUsage());
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const sid = getSessionId();
      const res = await fetch(`/api/articles?userId=1&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.articles || []);
      }
    } catch {
      // Silently fail if no DB
    }
    setHistoryLoading(false);
  }, []);

  const saveArticle = useCallback(async (content: string) => {
    if (!content.trim()) return;
    setSaveStatus('saving');
    try {
      // Extract title from content
      let title = '';
      try {
        const parsed = JSON.parse(content);
        title = parsed.title || parsed.tagline || '';
      } catch {
        title = topic;
      }

      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 1,
          topic: topic.trim(),
          articleType,
          title: title.substring(0, 300),
          content,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSavedId(data.article.id);
        setSaveStatus('saved');
        loadHistory();
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    }
  }, [topic, articleType, loadHistory]);

  async function handleGenerate() {
    if (!topic.trim() || isGenerating) return;

    // Daily usage check
    const usage = getDailyUsage();
    if (usage >= DAILY_FREE_LIMIT) {
      setError(`今天已免费使用 ${usage} 次，已达到每日上限。升级 Pro 可无限使用`);
      return;
    }

    setOutput('');
    setError('');
    setIsGenerating(true);
    setCopied(false);
    setSavedId(null);
    setSaveStatus('idle');
    setViewingArticle(null);

    try {
      const response = await fetch('/api/generate-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), articleType }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || '生成失败');
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.done) break;
            if (data.error) {
              setError(data.error);
              break;
            }
            if (data.text) {
              fullText += data.text;
              setOutput(prev => prev + data.text);
              if (outputRef.current) {
                outputRef.current.scrollTop = outputRef.current.scrollHeight;
              }
            }
          } catch {
            // skip
          }
        }
      }

      // Auto-save after generation
      if (fullText.trim()) {
        await saveArticle(fullText);
        const newUsage = incrementDailyUsage();
        setDailyUsage(newUsage);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || '出错了，请重试');
      }
    } finally {
      setIsGenerating(false);
    }
  }

  function handleCopy() {
    if (!output) return;
    navigator.clipboard.writeText(formatOutput(output)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const viewHistoryArticle = async (article: ArticleRecord) => {
    try {
      const res = await fetch(`/api/articles?id=${article.id}`);
      if (res.ok) {
        const data = await res.json();
        setViewingArticle(data.article);
        setOutput(data.article.content || '');
        setTopic(data.article.topic);
        setArticleType(data.article.article_type as ArticleType);
      }
    } catch {
      // ignore
    }
  };

  const deleteHistoryArticle = async (id: number) => {
    try {
      const res = await fetch(`/api/articles?id=${id}&userId=1`, { method: 'DELETE' });
      if (res.ok) {
        setHistory(prev => prev.filter(a => a.id !== id));
        if (viewingArticle?.id === id) {
          setViewingArticle(null);
          setOutput('');
        }
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Nav */}
      <nav className="bg-teal-900/95 backdrop-blur-sm text-white px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-1">
        <Link href="/" className="flex items-center gap-1.5 sm:gap-2 hover:opacity-80 transition-opacity min-w-0">
          <span className="text-base sm:text-lg font-bold shrink-0">✍️ 墨言</span>
          <span className="text-teal-300 text-[10px] sm:text-xs hidden sm:inline">AI文章助手</span>
        </Link>
        <div className="flex items-center gap-1.5 sm:gap-3">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`text-xs sm:text-sm px-2 sm:px-3 py-1.5 rounded-lg transition-all cursor-pointer min-h-[36px] ${
              showHistory
                ? 'bg-teal-700 text-white'
                : 'text-teal-200 hover:text-white hover:bg-teal-800/50'
            }`}
          >
            <span className="sm:hidden">📚</span>
            <span className="hidden sm:inline">📚 历史记录</span>
            {history.length > 0 && !showHistory && (
              <span className="ml-1 text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded-full">
                {history.length}
              </span>
            )}
          </button>
          <Link
            href="/blog"
            className="text-teal-200 hover:text-white text-xs sm:text-sm transition-colors hidden sm:inline"
          >
            📖 博客
          </Link>
          <Link
            href="/"
            className="text-teal-200 hover:text-white text-xs sm:text-sm transition-colors hidden sm:inline"
          >
            ← 返回首页
          </Link>
        </div>
      </nav>

      <div className="flex-1 flex">
        {/* History Sidebar — mobile: full-screen overlay, desktop: side panel */}
        {showHistory && (
          <>
            {/* Mobile backdrop */}
            <div
              className="fixed inset-0 z-40 bg-black/30 md:hidden"
              onClick={() => setShowHistory(false)}
            />
            <aside className="fixed inset-y-0 left-0 z-50 w-[85vw] max-w-sm bg-white md:relative md:w-80 md:inset-auto md:border-r md:border-gray-200 flex flex-col shadow-xl md:shadow-none animate-slide-in-right">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-teal-900">📚 历史文章</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {history.length > 0 ? `共 ${history.length} 篇` : '还没有文章'}
                </p>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="md:hidden p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                aria-label="关闭侧边栏"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {historyLoading && (
                <div className="p-4 text-center text-sm text-gray-400">加载中...</div>
              )}
              {!historyLoading && history.length === 0 && (
                <div className="p-6 text-center text-sm text-gray-400">
                  生成文章后自动保存在这里 📝
                </div>
              )}
              {history.map((article) => (
                <div
                  key={article.id}
                  className={`px-4 py-3 border-b border-gray-50 hover:bg-teal-50/50 cursor-pointer transition-colors group ${
                    viewingArticle?.id === article.id ? 'bg-teal-50 border-l-2 border-l-teal-600' : ''
                  }`}
                  onClick={() => {
                    setViewingArticle(article);
                    viewHistoryArticle(article);
                    // Close sidebar on mobile after selecting an article
                    if (window.innerWidth < 768) setShowHistory(false);
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {article.title || article.topic}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {TYPE_LABELS[article.article_type as ArticleType] || article.article_type}
                        {' · '}
                        {article.word_count > 0 ? `${article.word_count}字` : ''}
                        {' · '}
                        {new Date(article.created_at).toLocaleDateString('zh-CN', {
                          month: 'short', day: 'numeric',
                        })}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteHistoryArticle(article.id);
                      }}
                      className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all text-xs p-1 cursor-pointer"
                      title="删除"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </aside>
          </>
        )}

        {/* Main Content */}
        <main className="flex-1 bg-gradient-to-b from-cream via-cream to-white min-w-0">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl sm:text-4xl font-bold text-teal-900 mb-2">
                AI文章助手
              </h1>
              <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                输入主题，AI帮你写文章。博客、小红书、SEO、产品介绍，一键生成
              </p>
            </div>

            {/* Input Section */}
            <div className="bg-white rounded-xl border border-teal-100 shadow-sm p-4 sm:p-6 mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                输入文章主题
              </label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={TYPE_PLACEHOLDERS[articleType]}
                className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition resize-none bg-white"
                rows={2}
                maxLength={500}
                disabled={isGenerating}
              />

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  文章类型
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(Object.entries(TYPE_LABELS) as [ArticleType, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setArticleType(key)}
                      disabled={isGenerating}
                      className={`px-2 sm:px-3 py-2.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-150 cursor-pointer min-h-[44px] ${
                        articleType === key
                          ? 'bg-teal-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-[0.97]'
                      } disabled:opacity-50`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={!topic.trim() || isGenerating}
                className={`mt-4 w-full py-3 rounded-xl text-white font-medium text-base transition-all duration-150 ease-out cursor-pointer ${
                  !topic.trim() || isGenerating
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-gradient-to-r from-teal-600 to-amber-600 hover:from-teal-700 hover:to-amber-700 active:scale-[0.98] shadow-md hover:shadow-lg'
                }`}
              >
                {isGenerating ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    AI生成中...
                  </span>
                ) : (
                  '🚀 生成文章'
                )}
              </button>

              {/* Save Status */}
              {saveStatus === 'saving' && (
                <div className="mt-2 sm:mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs sm:text-sm text-blue-600 text-center animate-fade-in">
                  <span className="inline-block animate-spin mr-1">⏳</span> 正在保存...
                </div>
              )}
              {saveStatus === 'saved' && (
                <div className="mt-2 sm:mt-3 p-2 bg-green-50 border border-green-200 rounded-lg text-xs sm:text-sm text-green-700 text-center animate-scale-in">
                  ✅ 已保存到历史记录
                </div>
              )}

              {error && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {error}
                </div>
              )}
            </div>

            {/* Output Section */}
            {output && (
              <div className="bg-white rounded-xl border border-teal-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3 bg-gray-50 border-b border-gray-200 gap-1">
                  <h2 className="text-xs sm:text-sm font-medium text-gray-700">
                    {viewingArticle ? '📂 历史文章' : '✨ 生成结果'}
                  </h2>
                  <div className="flex gap-1.5 sm:gap-2">
                    {!isGenerating && (
                      <>
                        <button
                          onClick={() => {
                            if (viewingArticle) {
                              setViewingArticle(null);
                              setOutput('');
                              setTopic('');
                            } else {
                              handleGenerate();
                            }
                          }}
                          className="bg-gray-100 hover:bg-gray-200 active:scale-[0.97] text-gray-700 font-medium rounded-lg transition-all duration-150 cursor-pointer px-2 sm:px-3 py-2 sm:py-1.5 text-xs min-h-[36px] whitespace-nowrap"
                        >
                          {viewingArticle ? '← 写新文章' : '🔄 重新生成'}
                        </button>
                        <button
                          onClick={handleCopy}
                          className={`px-2 sm:px-3 py-2 sm:py-1.5 text-xs font-medium rounded-lg transition-all duration-150 cursor-pointer min-h-[36px] whitespace-nowrap ${
                            copied
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 hover:bg-gray-200 active:scale-[0.97] text-gray-700'
                          }`}
                        >
                          {copied ? '✅ 已复制' : '📋 复制'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div
                  ref={outputRef}
                  className="p-4 sm:p-6 max-h-[600px] overflow-y-auto"
                >
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: isGenerating
                        ? renderStructuredContent(output) + '<div class="inline-block w-2 h-5 bg-teal-600 animate-pulse ml-1"></div>'
                        : renderStructuredContent(output),
                    }}
                  />
                </div>
              </div>
            )}

            {/* Tips */}
            {!output && !isGenerating && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4 text-xs sm:text-sm text-amber-800 animate-fade-in-up">
                <strong>💡 使用小贴士：</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>输入越具体，生成的文章越精准</li>
                  <li>试试不同的文章类型，找到最适合你的格式</li>
                  <li>不满意就点「重新生成」，AI每次输出不同</li>
                  <li>生成的文字自动保存，随时在历史记录查看</li>
                </ul>
              </div>
            )}

            {/* Ad */}
            <div className="mt-4 sm:mt-6 p-3 bg-gradient-to-r from-gray-50 to-amber-50 border border-gray-200 rounded-xl">
              <div className="flex items-start sm:items-center justify-between gap-2 opacity-80 hover:opacity-100 transition-opacity duration-200">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">—— 推广 ——</p>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">
                    📢 需要高质量外链提升SEO排名？{' '}
                    <a
                      href="https://www.google.com/search?q=SEO+backlink+service"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-600 hover:text-teal-800 underline font-medium"
                    >
                      点击了解
                    </a>
                  </p>
                </div>
                <span className="text-xs text-gray-300 shrink-0">广告</span>
              </div>
            </div>

            {/* Usage + Pro upsell */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              <div className="bg-white rounded-xl border border-teal-100 shadow-sm p-4 text-center hover:shadow-md transition-shadow duration-200">
                <p className="text-xs text-gray-400">今日免费额度</p>
                <p className="text-2xl font-bold text-teal-700 mt-1">
                  {Math.max(0, DAILY_FREE_LIMIT - dailyUsage)}
                  <span className="text-sm text-gray-400 font-normal">/{DAILY_FREE_LIMIT}</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">每日重置</p>
              </div>
              <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-4 text-center text-white shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
                <p className="text-xs opacity-90">🚀 墨言 Pro</p>
                <p className="text-sm font-bold mt-1">无限使用 · 更高质量</p>
                <p className="text-xs opacity-80 mt-1">即将上线</p>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Footer with internal links for SEO */}
      <footer className="bg-teal-900 text-teal-300 text-[10px] sm:text-xs px-4 sm:px-6 py-3 sm:py-4 text-center">
        <p>© 2026 Sinmoniker — <Link href="/" className="hover:text-white">中文名生成</Link> · <Link href="/writing-tool" className="hover:text-white">AI写作助手</Link> · <Link href="/blog" className="hover:text-white">博客</Link></p>
      </footer>
    </div>
  );
}
