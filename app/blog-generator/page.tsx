'use client';

// 文序 — AI博客文章生成器
// 5种风格：教程式/清单式/深度分析/故事式/观点式

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';

type BlogStyle = 'tutorial' | 'listicle' | 'analysis' | 'story' | 'opinion';

const STYLE_CONFIG: Record<BlogStyle, { label: string; icon: string; desc: string; color: string }> = {
  tutorial: {
    label: '教程式',
    icon: '📚',
    desc: '步骤清晰，手把手教你做一件事',
    color: 'from-blue-500 to-cyan-500',
  },
  listicle: {
    label: '清单式',
    icon: '📋',
    desc: 'X个方法/技巧/原因，轻松易读',
    color: 'from-emerald-500 to-teal-500',
  },
  analysis: {
    label: '深度分析',
    icon: '🔬',
    desc: '有数据有案例，深度洞察一个话题',
    color: 'from-violet-500 to-purple-500',
  },
  story: {
    label: '故事式',
    icon: '📖',
    desc: '有画面感的故事，引发情感共鸣',
    color: 'from-rose-500 to-pink-500',
  },
  opinion: {
    label: '观点式',
    icon: '💡',
    desc: '鲜明观点+论据，说服力强',
    color: 'from-amber-500 to-orange-500',
  },
};

interface HistoryEntry {
  id: string;
  timestamp: number;
  topic: string;
  style: BlogStyle;
  content: string;
}

const HISTORY_KEY = 'bloggen_history';
const MAX_HISTORY = 30;

function parseJsonFromStream(content: string): Record<string, any> | null {
  let clean = content.trim();
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```$/, '');
  }
  try {
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

function loadHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
  } catch {
    // localStorage full — silently fail
  }
}

function BlogStyleCard({
  style,
  selected,
  onClick,
}: {
  style: BlogStyle;
  selected: boolean;
  onClick: () => void;
}) {
  const cfg = STYLE_CONFIG[style];
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`${cfg.label}风格：${cfg.desc}`}
      className={`relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 ease-out cursor-pointer text-left min-h-[60px] ${
        selected
          ? 'border-teal-500 bg-teal-50 shadow-sm shadow-teal-100 scale-[1.02]'
          : 'border-gray-200 bg-white hover:border-teal-300 hover:shadow-sm hover:-translate-y-0.5'
      }`}
    >
      <span
        className={`text-xl shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-gradient-to-br ${cfg.color} text-white text-sm font-bold`}
        aria-hidden="true"
      >
        {cfg.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm text-gray-800">{cfg.label}</div>
        <div className="text-xs text-gray-500 truncate">{cfg.desc}</div>
      </div>
      {selected && (
        <span className="absolute top-2 right-2 w-5 h-5 bg-teal-500 rounded-full flex items-center justify-center" aria-hidden="true">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      )}
    </button>
  );
}

function HistorySidebar({
  open,
  onClose,
  history,
  onSelect,
  onClear,
}: {
  open: boolean;
  onClose: () => void;
  history: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
  onClear: () => void;
}) {
  if (!open) return null;

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-base font-bold text-gray-800">📜 生成记录</h2>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button
              onClick={onClear}
              className="text-xs text-red-500 hover:text-red-700 transition-colors px-2 py-1 rounded hover:bg-red-50 cursor-pointer"
              aria-label="清空所有历史记录"
            >
              清空
            </button>
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="关闭侧栏"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {history.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            <span className="text-2xl block mb-2">📭</span>
            还没有生成记录<br />开始写第一篇文章吧！
          </div>
        ) : (
          [...history].reverse().map((entry) => (
            <button
              key={entry.id}
              onClick={() => onSelect(entry)}
              className="w-full text-left p-3 rounded-xl border border-gray-100 hover:border-teal-200 hover:bg-teal-50/30 transition-all duration-150 ease-out cursor-pointer group"
              aria-label={`查看 ${entry.topic} 的记录`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                  {STYLE_CONFIG[entry.style]?.icon} {STYLE_CONFIG[entry.style]?.label}
                </span>
                <span className="text-[10px] text-gray-400">
                  {new Date(entry.timestamp).toLocaleString('zh-CN', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="text-sm font-medium text-gray-700 truncate group-hover:text-teal-700 transition-colors">
                {entry.topic}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-72 border-r border-gray-200 bg-gray-50/50 overflow-hidden rounded-l-xl" role="complementary" aria-label="历史记录">
        {sidebar}
      </aside>
      {/* Mobile overlay */}
      <div className="lg:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="历史记录">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative w-80 max-w-[85vw] bg-white shadow-xl animate-slide-in-right overflow-hidden">
          {sidebar}
        </div>
      </div>
    </>
  );
}

function renderBlogPreview(data: Record<string, any>, style: BlogStyle): React.ReactNode {
  if (!data || Object.keys(data).length === 0) return null;

  const copyText = JSON.stringify(data, null, 2);

  return (
    <div className="bg-white rounded-xl border border-teal-100 shadow-sm overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs text-teal-200 font-medium uppercase tracking-wider">
              {STYLE_CONFIG[style]?.icon} {STYLE_CONFIG[style]?.label}
            </span>
            {data.title && (
              <h3 className="text-lg font-bold text-white mt-1 leading-snug">{data.title}</h3>
            )}
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(copyText);
            }}
            className="shrink-0 px-3 py-1.5 bg-white/20 hover:bg-white/30 active:scale-[0.97] text-white text-xs font-medium rounded-lg transition-all duration-150 cursor-pointer backdrop-blur-sm"
            aria-label="复制全部内容"
          >
            📋 复制全部
          </button>
        </div>
      </div>

      <div className="p-5 space-y-5 text-sm leading-relaxed text-gray-700">
        {/* Meta Description */}
        {data.metaDescription && (
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
            <div className="text-xs font-semibold text-amber-700 mb-1">🔍 SEO元描述</div>
            <p className="text-sm text-amber-800">{data.metaDescription}</p>
          </div>
        )}

        {/* Keywords */}
        {data.keywords && Array.isArray(data.keywords) && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-gray-400 mr-1 self-center">🏷️</span>
            {data.keywords.map((kw: string, i: number) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-100"
              >
                {kw}
              </span>
            ))}
          </div>
        )}

        {/* Hook */}
        {data.hook && (
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">📌 开篇</div>
            <p className="text-gray-700 leading-relaxed">{data.hook}</p>
          </div>
        )}

        {/* Sections (tutorial) */}
        {data.sections && Array.isArray(data.sections) && (
          <div className="space-y-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">📝 正文</div>
            {data.sections.map((sec: any, i: number) => (
              <div key={i} className="border-l-3 border-teal-400 pl-4">
                <h4 className="font-semibold text-gray-800 mb-1">{sec.heading}</h4>
                <p className="text-gray-600 leading-relaxed">{sec.content}</p>
                {sec.tip && (
                  <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg p-2.5 text-xs text-blue-700">
                    💡 {sec.tip}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Items (listicle) */}
        {data.items && Array.isArray(data.items) && (
          <div className="space-y-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">📝 正文</div>
            {data.items.map((item: any, i: number) => (
              <div key={i} className="flex gap-3">
                <span className="shrink-0 w-7 h-7 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold mt-0.5">
                  {item.number || i + 1}
                </span>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-800 mb-1">{item.heading}</h4>
                  <p className="text-gray-600 leading-relaxed mb-1">{item.content}</p>
                  {item.why && (
                    <p className="text-xs text-teal-600">
                      ✅ {item.why}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Dimensions (analysis) */}
        {data.dimensions && Array.isArray(data.dimensions) && (
          <div className="space-y-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">📝 分析维度</div>
            {data.dimensions.map((dim: any, i: number) => (
              <div key={i} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                <h4 className="font-semibold text-gray-800 mb-1">{dim.heading}</h4>
                {dim.argument && (
                  <p className="text-sm font-medium text-teal-700 mb-2">观点：{dim.argument}</p>
                )}
                {dim.evidence && (
                  <p className="text-gray-600 text-sm leading-relaxed">{dim.evidence}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Chapters (story) */}
        {data.chapters && Array.isArray(data.chapters) && (
          <div className="space-y-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">📝 故事章节</div>
            {data.chapters.map((ch: any, i: number) => (
              <div key={i} className="relative pl-6 before:content-[''] before:absolute before:left-2 before:top-2 before:w-1 before:h-[calc(100%-1rem)] before:bg-gradient-to-b before:from-teal-300 before:to-amber-300 before:rounded-full">
                <h4 className="font-semibold text-gray-800 mb-1">{ch.heading}</h4>
                <p className="text-gray-600 leading-relaxed">{ch.content}</p>
              </div>
            ))}
          </div>
        )}

        {/* Arguments (opinion) */}
        {data.arguments && Array.isArray(data.arguments) && (
          <div className="space-y-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">📝 核心论点</div>
            {data.arguments.map((arg: any, i: number) => (
              <div key={i} className="border-l-4 border-amber-400 pl-4">
                <h4 className="font-semibold text-gray-800 mb-1">{arg.heading}</h4>
                {arg.position && <p className="text-sm font-medium text-amber-700 mb-1">{arg.position}</p>}
                {arg.evidence && <p className="text-gray-600 leading-relaxed">{arg.evidence}</p>}
              </div>
            ))}
            {data.counterpoint && (
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <span className="text-xs font-semibold text-gray-500">🤔 反方观点：</span>
                <p className="text-sm text-gray-600 mt-1">{data.counterpoint}</p>
              </div>
            )}
          </div>
        )}

        {/* Lesson (story) */}
        {data.lesson && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 rounded-lg p-4">
            <div className="text-xs font-semibold text-amber-700 mb-1">💡 启发</div>
            <p className="text-sm text-amber-800 leading-relaxed">{data.lesson}</p>
          </div>
        )}

        {/* Conclusion */}
        {data.conclusion && (
          <div className="bg-teal-50 border border-teal-100 rounded-lg p-4">
            <div className="text-xs font-semibold text-teal-700 mb-1">🎯 总结</div>
            <p className="text-sm text-teal-800 leading-relaxed">{data.conclusion}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BlogGeneratorPage() {
  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState<BlogStyle>('tutorial');
  const [loading, setLoading] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [parsedData, setParsedData] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const streamRef = useRef<{ abort: () => void } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load history on mount
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const handleGenerate = useCallback(async () => {
    const trimmedTopic = topic.trim();
    if (trimmedTopic.length < 2) {
      setError('请输入至少2个字符的主题');
      textareaRef.current?.focus();
      return;
    }

    setLoading(true);
    setError('');
    setStreamContent('');
    setParsedData(null);
    setShowRaw(false);

    try {
      const response = await fetch('/api/generate-blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: trimmedTopic,
          style,
          model: 'deepseek-chat',
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: '请求失败' }));
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      streamRef.current = {
        abort: () => reader.cancel(),
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6);

          try {
            const data = JSON.parse(dataStr);
            if (data.error) {
              setError(data.error);
              setLoading(false);
              return;
            }
            if (data.done) {
              // Final save
              const entry: HistoryEntry = {
                id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                timestamp: Date.now(),
                topic: trimmedTopic,
                style,
                content: fullContent,
              };
              const updated = [entry, ...history];
              setHistory(updated);
              saveHistory(updated);
              break;
            }
            if (data.text) {
              fullContent += data.text;
              setStreamContent(fullContent);
              // Try to parse as JSON
              const parsed = parseJsonFromStream(fullContent);
              if (parsed) {
                setParsedData(parsed);
              }
            }
          } catch {
            // Skip
          }
        }
      }

      // Try final parse
      const finalParsed = parseJsonFromStream(fullContent);
      if (finalParsed) {
        setParsedData(finalParsed);
      }

      setLoading(false);
      streamRef.current = null;

      // Scroll to result
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || '生成失败，请重试');
      }
      setLoading(false);
    }
  }, [topic, style, history]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const handleHistorySelect = (entry: HistoryEntry) => {
    setTopic(entry.topic);
    setStyle(entry.style);
    setStreamContent(entry.content);
    const parsed = parseJsonFromStream(entry.content);
    setParsedData(parsed);
    setShowHistory(false);
    setShowRaw(false);

    setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleClearHistory = () => {
    setHistory([]);
    saveHistory([]);
  };

  const copySection = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="flex-1 flex flex-col animate-fade-in">
      {/* Navigation */}
      <nav className="bg-teal-900/95 backdrop-blur-sm text-white px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2" aria-label="主导航">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <Link href="/" className="text-teal-200 hover:text-white text-xs sm:text-sm transition-colors shrink-0">
            ← 首页
          </Link>
          <span className="text-teal-400 text-xs hidden sm:inline">|</span>
          <span className="text-lg sm:text-xl font-bold shrink-0 tracking-tight">文序</span>
          <span className="text-teal-300 text-[10px] sm:text-xs hidden sm:inline">AI博客生成器</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/title-generator"
            className="text-teal-200 hover:text-white text-xs sm:text-sm hidden sm:inline transition-colors"
            aria-label="前往标题生成器"
          >
            🏷️ 标题生成
          </Link>
          <Link
            href="/writing-tool"
            className="text-teal-200 hover:text-white text-xs sm:text-sm hidden sm:inline transition-colors"
            aria-label="前往文章助手"
          >
            ✍️ 文章助手
          </Link>
          <Link
            href="/blog"
            className="text-teal-200 hover:text-white text-xs sm:text-sm hidden sm:inline transition-colors"
            aria-label="浏览博客"
          >
            📖 博客
          </Link>
          <button
            onClick={() => setShowHistory(true)}
            className="relative px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm rounded-lg transition-all duration-150 cursor-pointer"
            aria-label="查看历史记录"
          >
            📜 <span className="hidden sm:inline">记录</span>
            {history.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {history.length > 9 ? '9+' : history.length}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* History Sidebar */}
        <HistorySidebar
          open={showHistory}
          onClose={() => setShowHistory(false)}
          history={history}
          onSelect={handleHistorySelect}
          onClear={handleClearHistory}
        />

        <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-6" role="main">
          {/* Header */}
          <div className="text-center">
            <span className="text-3xl sm:text-4xl block mb-2">📝</span>
            <h1 className="text-2xl sm:text-3xl font-bold text-teal-900">文序 — AI博客文章生成器</h1>
            <p className="text-sm text-gray-500 mt-1">输入主题，5种风格一键生成高质量博客文章</p>
          </div>

          {/* Input Section */}
          <section className="bg-white rounded-xl border border-teal-100 shadow-sm p-4 sm:p-6 space-y-4" aria-label="文章生成表单">
            {/* Topic Input */}
            <div>
              <label htmlFor="blog-topic" className="block text-sm font-medium text-gray-700 mb-1.5">
                📌 文章主题
              </label>
              <textarea
                ref={textareaRef}
                id="blog-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="例如：如何用AI工具提高工作效率、2026年SEO趋势分析..."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none transition-all duration-150 resize-none text-sm text-gray-700 placeholder:text-gray-400 min-h-[80px]"
                rows={3}
                maxLength={200}
                disabled={loading}
                aria-describedby="topic-hint"
              />
              <div id="topic-hint" className="flex justify-between mt-1 text-xs text-gray-400">
                <span>按 Ctrl+Enter 快速生成</span>
                <span>{topic.length}/200</span>
              </div>
            </div>

            {/* Style Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🎨 文章风格
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3" role="radiogroup" aria-label="文章风格选择">
                {(Object.keys(STYLE_CONFIG) as BlogStyle[]).map((s) => (
                  <BlogStyleCard
                    key={s}
                    style={s}
                    selected={style === s}
                    onClick={() => !loading && setStyle(s)}
                  />
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={loading || topic.trim().length < 2}
              className={`w-full py-3.5 rounded-xl font-medium text-base transition-all duration-150 ease-out cursor-pointer active:scale-[0.98] ${
                loading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 text-white shadow-sm shadow-teal-200 hover:shadow-md'
              }`}
              aria-busy={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  AI正在写作中...
                </span>
              ) : (
                '🚀 生成文章'
              )}
            </button>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700" role="alert">
                ❌ {error}
              </div>
            )}
          </section>

          {/* Result Section */}
          {(streamContent || parsedData) && (
            <section ref={resultRef} className="space-y-3" aria-label="生成结果">
              {/* Controls */}
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-800">
                  ✨ 生成结果
                </h2>
                <div className="flex items-center gap-2">
                  {parsedData && (
                    <button
                      onClick={() => setShowRaw(!showRaw)}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-all cursor-pointer"
                    >
                      {showRaw ? '📄 预览模式' : '🔧 原始数据'}
                    </button>
                  )}
                </div>
              </div>

              {showRaw && parsedData ? (
                /* Raw JSON */
                <div className="bg-gray-900 text-green-400 rounded-xl p-4 overflow-x-auto text-xs leading-relaxed font-mono">
                  <pre>{JSON.stringify(parsedData, null, 2)}</pre>
                </div>
              ) : parsedData ? (
                /* Rendered Preview */
                renderBlogPreview(parsedData, style)
              ) : (
                /* Streaming raw text */
                <div className="bg-white rounded-xl border border-teal-100 shadow-sm p-5">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                    {streamContent}
                    {loading && (
                      <span className="inline-block w-2 h-4 bg-teal-500 animate-pulse ml-0.5 align-text-bottom" aria-hidden="true" />
                    )}
                  </pre>
                </div>
              )}

              {/* Copy buttons for sections when in preview mode */}
              {parsedData && !showRaw && (
                <div className="flex flex-wrap gap-2">
                  {parsedData.title && (
                    <SectionCopyButton
                      label="复制标题"
                      text={parsedData.title}
                      index={0}
                      copiedIndex={copiedIndex}
                      onCopy={copySection}
                    />
                  )}
                  {parsedData.metaDescription && (
                    <SectionCopyButton
                      label="复制元描述"
                      text={parsedData.metaDescription}
                      index={1}
                      copiedIndex={copiedIndex}
                      onCopy={copySection}
                    />
                  )}
                  {parsedData.hook && (
                    <SectionCopyButton
                      label="复制开篇"
                      text={parsedData.hook}
                      index={2}
                      copiedIndex={copiedIndex}
                      onCopy={copySection}
                    />
                  )}
                  {parsedData.conclusion && (
                    <SectionCopyButton
                      label="复制总结"
                      text={parsedData.conclusion}
                      index={3}
                      copiedIndex={copiedIndex}
                      onCopy={copySection}
                    />
                  )}
                </div>
              )}
            </section>
          )}

          {/* Features */}
          <section className="bg-gradient-to-r from-teal-50 to-amber-50 rounded-xl border border-teal-100 p-5 sm:p-6" aria-label="功能介绍">
            <h2 className="text-base font-bold text-teal-900 mb-3">✨ 功能介绍</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {[
                { icon: '📚', title: '5种写作风格', desc: '教程/清单/分析/故事/观点' },
                { icon: '🔍', title: 'SEO元数据', desc: '自动生成标题/描述/关键词' },
                { icon: '🎯', title: '结构化内容', desc: '分章节/分要点，清晰易读' },
                { icon: '📋', title: '一键复制', desc: '复制全部或按章节复制' },
              ].map((f, i) => (
                <div key={i} className="text-center p-3 rounded-xl bg-white/60 backdrop-blur-sm">
                  <span className="text-xl sm:text-2xl block mb-1">{f.icon}</span>
                  <h3 className="text-xs sm:text-sm font-semibold text-gray-800">{f.title}</h3>
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">{f.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Footer */}
          <footer className="text-center text-xs text-gray-400 pb-4">
            <Link href="/" className="hover:text-teal-600 transition-colors">Sinmoniker</Link>
            <span className="mx-2">·</span>
            <Link href="/writing-tool" className="hover:text-teal-600 transition-colors">墨言文章助手</Link>
            <span className="mx-2">·</span>
            <Link href="/title-generator" className="hover:text-teal-600 transition-colors">智标题</Link>
          </footer>
        </main>
      </div>
    </div>
  );
}

function SectionCopyButton({
  label,
  text,
  index,
  copiedIndex,
  onCopy,
}: {
  label: string;
  text: string;
  index: number;
  copiedIndex: number | null;
  onCopy: (text: string, index: number) => void;
}) {
  return (
    <button
      onClick={() => onCopy(text, index)}
      className={`text-xs px-3 py-1.5 rounded-lg border transition-all duration-150 cursor-pointer ${
        copiedIndex === index
          ? 'bg-teal-100 border-teal-300 text-teal-700'
          : 'border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-gray-700'
      }`}
    >
      {copiedIndex === index ? '✅ 已复制' : `📋 ${label}`}
    </button>
  );
}
