'use client';

// AI标题生成器 — 输入主题，批量生成高点击率标题
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

type TitleStyle = 'blog' | 'xiaohongshu' | 'seo' | 'marketing' | 'video' | 'newsletter';

const STYLE_LABELS: Record<TitleStyle, string> = {
  blog: '📝 博客标题',
  xiaohongshu: '📱 小红书标题',
  seo: '🔍 SEO标题',
  marketing: '💼 营销标题',
  video: '🎬 视频标题',
  newsletter: '📧 邮件标题',
};

const STYLE_PLACEHOLDERS: Record<TitleStyle, string> = {
  blog: '例如：如何用AI提高工作效率',
  xiaohongshu: '例如：周末必去的5个上海咖啡馆',
  seo: '例如：2026年免费AI写作工具推荐',
  marketing: '例如：在线英语课程推广',
  video: '例如：上班族必学的5个Excel技巧',
  newsletter: '例如：本周AI行业大事件盘点',
};

interface TitleItem {
  title: string;
  reason: string;
  style: string;
}

interface HistoryEntry {
  id: string;
  timestamp: number;
  topic: string;
  style: TitleStyle;
  titles: TitleItem[];
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function parseTitlesFromContent(content: string): { titles: TitleItem[]; raw: string } {
  let clean = content.trim();
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```$/, '');
  }

  try {
    const data = JSON.parse(clean);
    if (data.titles && Array.isArray(data.titles)) {
      return { titles: data.titles, raw: content };
    }
  } catch {
    // Not valid JSON yet (streaming incomplete) — try partial parse
  }

  return { titles: [], raw: content };
}

function getDailyUsage(): number {
  if (typeof window === 'undefined') return 0;
  const today = new Date().toISOString().slice(0, 10);
  return parseInt(localStorage.getItem(`titlegen_usage_${today}`) || '0', 10);
}

function incrementDailyUsage(): number {
  if (typeof window === 'undefined') return 0;
  const today = new Date().toISOString().slice(0, 10);
  const val = parseInt(localStorage.getItem(`titlegen_usage_${today}`) || '0', 10) + 1;
  localStorage.setItem(`titlegen_usage_${today}`, val.toString());
  return val;
}

const DAILY_FREE_LIMIT = 15;

const HISTORY_KEY = 'titlegen_history';
const MAX_HISTORY = 50;

function getHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveToHistory(topic: string, style: TitleStyle, titles: TitleItem[]): void {
  if (typeof window === 'undefined' || titles.length === 0) return;
  try {
    const history = getHistory();
    const entry: HistoryEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      timestamp: Date.now(),
      topic,
      style,
      titles,
    };
    history.unshift(entry);
    if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch { /* ignore storage errors */ }
}

function clearHistory(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(HISTORY_KEY);
}

export default function TitleGeneratorPage() {
  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState<TitleStyle>('blog');
  const [rawOutput, setRawOutput] = useState('');
  const [titles, setTitles] = useState<TitleItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [dailyUsage, setDailyUsage] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDailyUsage(getDailyUsage());
    setHistory(getHistory());
  }, []);

  async function handleGenerate() {
    if (!topic.trim() || isGenerating) return;

    const usage = getDailyUsage();
    if (usage >= DAILY_FREE_LIMIT) {
      setError(`今天已免费使用 ${usage} 次，已达到每日上限`);
      return;
    }

    setRawOutput('');
    setTitles([]);
    setError('');
    setIsGenerating(true);
    setCopiedAll(false);

    try {
      const response = await fetch('/api/generate-titles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), style }),
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
              setRawOutput(fullText);
              const parsed = parseTitlesFromContent(fullText);
              if (parsed.titles.length > 0) {
                setTitles(parsed.titles);
              }
              if (outputRef.current) {
                outputRef.current.scrollTop = outputRef.current.scrollHeight;
              }
            }
          } catch {
            // skip
          }
        }
      }

      // Final parse
      const finalParsed = parseTitlesFromContent(fullText);
      if (finalParsed.titles.length > 0) {
        setTitles(finalParsed.titles);
      }

      if (fullText && finalParsed.titles.length > 0) {
        incrementDailyUsage();
        setDailyUsage(getDailyUsage());
        saveToHistory(topic.trim(), style, finalParsed.titles);
        setHistory(getHistory());
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || '出错了，请重试');
      }
    } finally {
      setIsGenerating(false);
    }
  }

  function handleCopy(title: string, index: number) {
    navigator.clipboard.writeText(title).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  }

  function handleCopyAll() {
    const text = titles.map((t, i) => `${i + 1}. ${t.title}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    });
  }

  function handleDeleteHistory(id: string) {
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  }

  function handleClearHistory() {
    if (!confirm('确定清空所有历史记录？')) return;
    clearHistory();
    setHistory([]);
  }

  function formatDate(ts: number): string {
    const d = new Date(ts);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  const styleKeys = Object.entries(STYLE_LABELS) as [TitleStyle, string][];

  return (
    <div className="flex-1 flex flex-col animate-fade-in">
      {/* Navigation */}
      <nav className="bg-teal-900/95 backdrop-blur-sm text-white px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-1" aria-label="主导航">
        <Link href="/" className="flex items-center gap-1.5 sm:gap-2 hover:opacity-80 transition-opacity min-w-0">
          <span className="text-base sm:text-lg font-bold shrink-0">🏷️ 智标题</span>
          <span className="text-teal-300 text-[10px] sm:text-xs hidden sm:inline">AI标题生成器</span>
        </Link>
        <div className="flex items-center gap-1.5 sm:gap-3">
          <Link
            href="/writing-tool"
            className="text-teal-200 hover:text-white text-xs sm:text-sm transition-colors hidden sm:inline"
          >
            ✍️ 文章助手
          </Link>
          <Link
            href="/blog"
            className="text-teal-200 hover:text-white text-xs sm:text-sm transition-colors hidden sm:inline"
          >
            📖 博客
          </Link>
          <Link
            href="/"
            className="text-teal-200 hover:text-white text-xs sm:text-sm transition-colors"
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
            <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 text-xs font-medium px-3 py-1 rounded-full mb-4">
              <span className="text-sm">🎯</span>
              <span>AI一键生成 · 6种风格</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-teal-900 mb-2">
              AI标题生成器
            </h1>
            <p className="text-sm sm:text-base text-gray-600 leading-relaxed max-w-xl mx-auto">
              输入主题，AI自动生成多个高点击率标题
            </p>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              适合博客、小红书、SEO、营销、视频、邮件 &nbsp;
              <span className="inline-block bg-teal-50 text-teal-600 px-2 py-0.5 rounded text-[10px]">
                每日{DAILY_FREE_LIMIT}次免费
              </span>
            </p>
          </div>

          {/* Input Section */}
          <div className="bg-white rounded-xl border border-teal-100 shadow-sm p-4 sm:p-6 mb-6">
            <label htmlFor="topic-input" className="block text-sm font-medium text-gray-700 mb-2">
              输入主题或关键词
            </label>
            <input
              id="topic-input"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={STYLE_PLACEHOLDERS[style]}
              className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition bg-white"
              maxLength={200}
              disabled={isGenerating}
              onKeyDown={(e) => { if (e.key === 'Enter') handleGenerate(); }}
            />

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                标题风格
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {styleKeys.map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setStyle(key)}
                    disabled={isGenerating}
                    className={`px-2 sm:px-3 py-2.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-150 cursor-pointer min-h-[44px] ${
                      style === key
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-[0.97]'
                    } disabled:opacity-50`}
                    aria-pressed={style === key}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!topic.trim() || isGenerating}
              aria-label="生成标题"
              className={`mt-4 w-full py-3 rounded-xl text-white font-medium text-base transition-all duration-150 ease-out cursor-pointer ${
                !topic.trim() || isGenerating
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-gradient-to-r from-teal-600 to-amber-600 hover:from-teal-700 hover:to-amber-700 active:scale-[0.98] shadow-md hover:shadow-lg'
              }`}
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  AI生成中...
                </span>
              ) : (
                '🚀 生成标题'
              )}
            </button>

            {/* Usage info */}
            <div className="mt-3 flex items-center justify-between">
              <div className="text-xs text-gray-400">
                今日剩余：<span className="font-medium text-teal-600">{Math.max(0, DAILY_FREE_LIMIT - dailyUsage)}</span>/{DAILY_FREE_LIMIT} 次
              </div>
              {history.length > 0 && (
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-xs text-teal-600 hover:text-teal-800 transition-colors cursor-pointer"
                >
                  📋 历史记录 ({history.length})
                </button>
              )}
            </div>

            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600" role="alert">
                {error}
              </div>
            )}
          </div>

          {/* History Panel */}
          {showHistory && history.length > 0 && (
            <div className="mb-6 bg-white rounded-xl border border-teal-100 shadow-sm overflow-hidden animate-fade-in">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-bold text-teal-900">📋 历史记录</h3>
                <button
                  onClick={handleClearHistory}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors cursor-pointer"
                >
                  清空
                </button>
              </div>
              <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
                {history.map((entry) => (
                  <div key={entry.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded">
                            {STYLE_LABELS[entry.style]?.replace(/^[^\s]+\s/, '') || entry.style}
                          </span>
                          <span className="text-[10px] text-gray-400">{formatDate(entry.timestamp)}</span>
                        </div>
                        <p className="text-sm font-medium text-gray-800 truncate">{entry.topic}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{entry.titles.length}个标题</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            const text = entry.titles.map((t, i) => `${i+1}. ${t.title}`).join('\n');
                            navigator.clipboard.writeText(text);
                          }}
                          className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors cursor-pointer"
                          aria-label={`复制此条历史`}
                        >
                          📋
                        </button>
                        <button
                          onClick={() => handleDeleteHistory(entry.id)}
                          className="text-xs px-2 py-1 text-gray-300 hover:text-red-500 transition-colors cursor-pointer"
                          aria-label={`删除此条历史`}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Title Results */}
          {titles.length > 0 && (
            <div className="space-y-4" ref={outputRef}>
              {/* Copy All Button */}
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-teal-900">
                  ✨ 生成的标题 <span className="text-gray-400 font-normal text-xs">({titles.length}个)</span>
                </h2>
                <button
                  onClick={handleCopyAll}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-150 cursor-pointer ${
                    copiedAll
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 hover:bg-gray-200 active:scale-[0.97] text-gray-700'
                  }`}
                >
                  {copiedAll ? '✅ 全部已复制' : '📋 复制全部'}
                </button>
              </div>

              {/* Title Cards */}
              {titles.map((item, index) => (
                <div
                  key={index}
                  className="bg-white rounded-xl border border-teal-100 shadow-sm p-4 sm:p-5 hover:shadow-md transition-all duration-200 animate-fade-in-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-6 h-6 bg-teal-100 text-teal-700 rounded-full text-xs font-bold flex items-center justify-center shrink-0">
                          {index + 1}
                        </span>
                        <span className="text-[10px] sm:text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                          {item.style || '推荐'}
                        </span>
                      </div>
                      <p className="text-base sm:text-lg font-semibold text-gray-900 leading-snug">
                        {item.title}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-500 mt-2">
                        💡 {item.reason}
                      </p>
                    </div>
                    <button
                      onClick={() => handleCopy(item.title, index)}
                      className={`shrink-0 px-2.5 py-2 text-xs font-medium rounded-lg transition-all duration-150 cursor-pointer min-h-[36px] ${
                        copiedIndex === index
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-50 hover:bg-gray-100 active:scale-[0.97] text-gray-500 hover:text-gray-700'
                      }`}
                      aria-label={`复制标题 ${index + 1}`}
                    >
                      {copiedIndex === index ? '✅' : '📋'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tips */}
          {!isGenerating && titles.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4 text-xs sm:text-sm text-amber-800 animate-fade-in-up">
              <strong>💡 使用小贴士：</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>主题越具体，生成的标题越精准</li>
                <li>试试不同的风格，找到最适合的</li>
                <li>不满意就重新生成，每次结果不同</li>
                <li>每个标题都有"为什么有效"的解读</li>
                <li>一键复制单个或全部，直接拿去用</li>
                <li>历史记录保存最近的{MAX_HISTORY}次，随时查看</li>
              </ul>
            </div>
          )}

          {/* Ad */}
          {titles.length > 0 && (
            <div className="mt-6 p-3 bg-gradient-to-r from-gray-50 to-amber-50 border border-gray-200 rounded-xl">
              <div className="flex items-start sm:items-center justify-between gap-2 opacity-80 hover:opacity-100 transition-opacity duration-200">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">—— 推广 ——</p>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">
                    📢 标题写好了？用{' '}
                    <Link href="/writing-tool" className="text-teal-600 hover:text-teal-800 underline font-medium">
                      AI文章助手
                    </Link>
                    {' '}生成全文内容
                  </p>
                </div>
                <span className="text-xs text-gray-300 shrink-0">广告</span>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-teal-900 text-teal-300 text-[10px] sm:text-xs px-4 sm:px-6 py-3 sm:py-4 text-center">
        <p>© 2026 Sinmoniker — <Link href="/" className="hover:text-white">中文名生成</Link> · <Link href="/title-generator" className="hover:text-white">AI标题生成</Link> · <Link href="/writing-tool" className="hover:text-white">AI写作助手</Link> · <Link href="/blog" className="hover:text-white">博客</Link></p>
      </footer>
    </div>
  );
}
