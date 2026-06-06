'use client';

// 墨言文章助手 — AI Writing Tool
import { useState, useRef, useEffect } from 'react';
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

// 格式化JSON文本为可读HTML
function formatOutput(text: string): string {
  // Remove JSON markers if present
  let clean = text.trim();
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```$/, '');
  }
  return clean;
}

// 尝试解析并渲染JSON为美观的卡片格式
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
    // Not valid JSON, render as plain text
    return `<pre class="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">${escapeHtml(text)}</pre>`;
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default function WritingToolPage() {
  const [topic, setTopic] = useState('');
  const [articleType, setArticleType] = useState<ArticleType>('blog');
  const [output, setOutput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function handleGenerate() {
    if (!topic.trim() || isGenerating) return;

    setOutput('');
    setError('');
    setIsGenerating(true);
    setCopied(false);

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
              setOutput(prev => prev + data.text);
              // Auto-scroll
              if (outputRef.current) {
                outputRef.current.scrollTop = outputRef.current.scrollHeight;
              }
            }
          } catch {
            // skip
          }
        }
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

  function handleRegenerate() {
    handleGenerate();
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Nav */}
      <nav className="bg-teal-900/95 backdrop-blur-sm text-white px-4 sm:px-6 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="text-lg font-bold">✍️ 墨言</span>
          <span className="text-teal-300 text-xs hidden sm:inline">AI文章助手</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-teal-200 hover:text-white text-sm transition-colors"
          >
            ← 返回首页
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 bg-gradient-to-b from-cream via-cream to-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-teal-900 mb-2">
              AI文章助手
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">
              输入主题，AI帮你写文章。博客、小红书、SEO、产品介绍，一键生成
            </p>
          </div>

          {/* Input Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
            {/* Topic Input */}
            <label className="block text-sm font-medium text-gray-700 mb-2">
              输入文章主题
            </label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={TYPE_PLACEHOLDERS[articleType]}
              className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition resize-none"
              rows={2}
              maxLength={500}
              disabled={isGenerating}
            />

            {/* Article Type Selector */}
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
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      articleType === key
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    } disabled:opacity-50`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={!topic.trim() || isGenerating}
              className={`mt-4 w-full py-3 rounded-xl text-white font-medium text-base transition-all ${
                !topic.trim() || isGenerating
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-gradient-to-r from-teal-600 to-amber-600 hover:from-teal-700 hover:to-amber-700 active:scale-[0.98] shadow-md'
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

            {/* Error */}
            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}
          </div>

          {/* Output Section */}
          {output && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-200">
                <h2 className="text-sm font-medium text-gray-700">生成结果</h2>
                <div className="flex gap-2">
                  {!isGenerating && (
                    <>
                      <button
                        onClick={handleRegenerate}
                        className="px-3 py-1.5 text-xs font-medium bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
                      >
                        🔄 重新生成
                      </button>
                      <button
                        onClick={handleCopy}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          copied
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-200 hover:bg-gray-300'
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
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <strong>💡 使用小贴士：</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>输入越具体，生成的文章越精准</li>
                <li>试试不同的文章类型，找到最适合你的格式</li>
                <li>不满意就点「重新生成」，AI每次输出不同</li>
                <li>生成的文字可以直接复制使用</li>
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
