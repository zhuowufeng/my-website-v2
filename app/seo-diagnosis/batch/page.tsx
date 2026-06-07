/**
 * /seo-diagnosis/batch — 批量SEO诊断（模块11：工作流自动化）
 *
 * 学习目标验证：
 * 1. ✅ 多步骤流程：上传→解析→处理→输出
 * 2. ✅ 文件处理：CSV/JSON/TXT 读写解析
 * 3. ✅ 后台任务：SSE流式处理长任务
 * 4. ✅ 进度反馈：实时进度条 + 逐条状态
 */

'use client';

import { useState, useRef, useCallback } from 'react';

// ============ 类型 ============

interface BatchProgress {
  jobId: string;
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  currentUrl: string;
  status: 'processing' | 'completed' | 'error';
  error?: string;
  results?: BatchResult[];
}

interface BatchResult {
  url: string;
  success: boolean;
  data?: any;
  error?: string;
}

interface InputMethod {
  type: 'paste' | 'upload';
  content: string;
  filename?: string;
}

// ============ 输入模式组件 ============

function InputPanel({
  inputMethod,
  onInputChange,
  onStart,
  disabled,
}: {
  inputMethod: InputMethod;
  onInputChange: (m: InputMethod) => void;
  onStart: () => void;
  disabled: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    onInputChange({ type: 'upload', content: text, filename: file.name });
  };

  const urlCount = inputMethod.content.trim()
    ? inputMethod.content.trim().split('\n').filter(l => l.trim()).length
    : 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-6">
      {/* Mode toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => onInputChange({ type: 'paste', content: '' })}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            inputMethod.type === 'paste'
              ? 'bg-blue-100 text-blue-700 border border-blue-200'
              : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
          }`}
        >
          📝 粘贴URL
        </button>
        <button
          onClick={() => onInputChange({ type: 'upload', content: '' })}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            inputMethod.type === 'upload'
              ? 'bg-blue-100 text-blue-700 border border-blue-200'
              : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
          }`}
        >
          📂 上传文件
        </button>
      </div>

      {inputMethod.type === 'paste' ? (
        <>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              输入URL（每行一个，支持纯文本/CSV/JSON）
            </label>
            {urlCount > 0 && (
              <span className="text-xs text-gray-400">
                共 {urlCount} 行
              </span>
            )}
          </div>
          <textarea
            value={inputMethod.content}
            onChange={e => onInputChange({ type: 'paste', content: e.target.value })}
            placeholder={`example1.com\nhttps://example2.com/page\nhttps://example3.com`}
            className="w-full h-40 px-4 py-3 border border-gray-200 rounded-xl
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     text-sm transition-all resize-none font-mono"
            disabled={disabled}
          />
        </>
      ) : (
        <>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8
                     text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50
                     transition-all"
          >
            <div className="text-3xl mb-2">📄</div>
            <p className="text-sm text-gray-500">
              点击上传 CSV / JSON / TXT 文件
            </p>
            <p className="text-xs text-gray-400 mt-1">
              支持 .csv, .json, .txt — 文件会自动解析URL
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json,.txt,.tsv"
            onChange={handleFileSelect}
            className="hidden"
          />
          {inputMethod.filename && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200">
              <span>✅</span>
              <span className="text-sm text-green-700 font-medium">{inputMethod.filename}</span>
              <span className="text-xs text-green-500 ml-auto">
                {(inputMethod.content.length / 1024).toFixed(1)} KB
              </span>
            </div>
          )}
        </>
      )}

      {/* Start button */}
      <button
        onClick={onStart}
        disabled={disabled || !inputMethod.content.trim()}
        className="mt-4 w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600
                 text-white rounded-xl font-medium text-sm shadow-md hover:shadow-lg
                 hover:from-blue-700 hover:to-indigo-700 transition-all
                 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        🚀 开始批量诊断
      </button>
    </div>
  );
}

// ============ 进度面板 ============

function ProgressPanel({ progress }: { progress: BatchProgress }) {
  const percent = progress.total > 0
    ? Math.round((progress.processed / progress.total) * 100)
    : 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-6">
      <h3 className="text-base font-semibold text-gray-800 mb-3">
        📊 批量诊断进度
      </h3>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1.5">
          <span className="text-gray-600">
            {progress.status === 'completed' ? '✅ 已完成' : '⏳ 处理中'}
          </span>
          <span className="font-medium text-gray-800">{percent}%</span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              progress.status === 'completed'
                ? 'bg-gradient-to-r from-green-400 to-green-500'
                : 'bg-gradient-to-r from-blue-400 to-indigo-500 animate-pulse'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        <div className="text-center p-3 bg-blue-50 rounded-xl border border-blue-100">
          <div className="text-2xl font-bold text-blue-600">{progress.total}</div>
          <div className="text-xs text-blue-400">总计</div>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-xl border border-gray-200">
          <div className="text-2xl font-bold text-gray-600">{progress.processed}</div>
          <div className="text-xs text-gray-400">已处理</div>
        </div>
        <div className="text-center p-3 bg-green-50 rounded-xl border border-green-100">
          <div className="text-2xl font-bold text-green-600">{progress.succeeded}</div>
          <div className="text-xs text-green-400">成功</div>
        </div>
        <div className="text-center p-3 bg-red-50 rounded-xl border border-red-100">
          <div className="text-2xl font-bold text-red-600">{progress.failed}</div>
          <div className="text-xs text-red-400">失败</div>
        </div>
      </div>

      {/* Current URL */}
      {progress.currentUrl && progress.status === 'processing' && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
          <span className="truncate flex-1">{progress.currentUrl}</span>
        </div>
      )}
    </div>
  );
}

// ============ 结果列表 ============

function ResultsList({ results }: { results: BatchResult[] }) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (!results || results.length === 0) return null;

  // Summary header
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  const avgScore = results
    .filter(r => r.success && r.data)
    .reduce((sum, r) => sum + (r.data.score || 0), 0) / Math.max(successCount, 1);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-800">
          📋 诊断结果
        </h3>
        <div className="text-sm text-gray-500">
          平均评分: <span className="font-bold text-indigo-600">{avgScore.toFixed(0)}</span>
          {' · '}
          共 {results.length} 个
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <SummaryCard label="A级 (≥90)" count={results.filter(r => r.data?.grade === 'A').length} color="emerald" />
        <SummaryCard label="B级 (75-89)" count={results.filter(r => r.data?.grade === 'B').length} color="blue" />
        <SummaryCard label="C级 (60-74)" count={results.filter(r => r.data?.grade === 'C').length} color="amber" />
        <SummaryCard label="D/F级 (<60)" count={results.filter(r => r.data && ['D', 'F'].includes(r.data.grade)).length} color="rose" />
      </div>

      {/* Individual results */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {results.map((result, i) => (
          <div key={i}>
            <button
              onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left
                       transition-all border ${
                result.success
                  ? 'border-gray-200 hover:bg-gray-50'
                  : 'border-red-200 bg-red-50 hover:bg-red-100'
              }`}
            >
              {/* Grade badge */}
              {result.success && result.data ? (
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                  result.data.grade === 'A' ? 'bg-emerald-500' :
                  result.data.grade === 'B' ? 'bg-blue-500' :
                  result.data.grade === 'C' ? 'bg-amber-500' :
                  'bg-rose-500'
                }`}>
                  {result.data.grade}
                </span>
              ) : (
                <span className="w-8 h-8 rounded-full flex items-center justify-center bg-red-100 text-red-500">✗</span>
              )}

              {/* URL + info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">
                  {result.url}
                </div>
                {result.success && result.data && (
                  <div className="text-xs text-gray-400">
                    {result.data.score}分 · {result.data.summary.critical}严重 {result.data.summary.warnings}警告
                  </div>
                )}
                {!result.success && (
                  <div className="text-xs text-red-400 truncate">{result.error}</div>
                )}
              </div>

              {/* Expand icon */}
              <span className="text-gray-300 text-xs">
                {expandedIndex === i ? '▲' : '▼'}
              </span>
            </button>

            {/* Expanded detail */}
            {expandedIndex === i && result.success && result.data && (
              <div className="mx-4 mb-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="space-y-1">
                    <CheckLabel label="标题" value={result.data.domainInfo.title || '-'} pass={!!result.data.domainInfo.title} />
                    <CheckLabel label="描述" value={result.data.domainInfo.description || '-'} pass={!!result.data.domainInfo.description} />
                    <CheckLabel label="H1标题" value={`${result.data.domainInfo.h1Count}个`} pass={result.data.domainInfo.h1Count > 0} />
                    <CheckLabel label="加载速度" value={`${result.data.domainInfo.fetchTime}ms`} pass={result.data.domainInfo.fetchTime < 2000} />
                  </div>
                  <div className="space-y-1">
                    <CheckLabel label="OG标签" value={result.data.domainInfo.hasOGTags ? '有' : '无'} pass={result.data.domainInfo.hasOGTags} />
                    <CheckLabel label="图片Alt" value={`${result.data.domainInfo.imgWithAlt}/${result.data.domainInfo.imgCount}`} pass={result.data.domainInfo.imgWithAlt > 0} />
                    <CheckLabel label="Sitemap" value={result.data.domainInfo.hasSitemap ? '有' : '无'} pass={result.data.domainInfo.hasSitemap} />
                    <CheckLabel label="Favicon" value={result.data.domainInfo.hasFavicon ? '有' : '无'} pass={result.data.domainInfo.hasFavicon} />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ label, count, color }: { label: string; count: number; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    rose: 'bg-rose-50 border-rose-200 text-rose-700',
  };

  return (
    <div className={`text-center p-2 rounded-lg border ${colorMap[color] || colorMap.blue}`}>
      <div className="text-lg font-bold">{count}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}

function CheckLabel({ label, value, pass }: { label: string; value: string; pass: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span>{pass ? '✅' : '❌'}</span>
      <span className="text-gray-600">{label}:</span>
      <span className="font-medium text-gray-800 truncate">{value}</span>
    </div>
  );
}

// ============ 导出面板 ============

function ExportPanel({ results }: { results: BatchResult[] }) {
  const handleExportCSV = useCallback(() => {
    if (!results || results.length === 0) return;

    // Build CSV
    const headers = [
      'URL', '状态', '评分', '等级', '严重问题', '警告', '建议',
      '标题', '描述', '字数', '加载速度(ms)', 'OG标签',
      'H1数', '图片Alt', '内部链接', '外部链接', 'Sitemap', 'Favicon',
      '错误信息'
    ];

    const rows = results.map(r => {
      const d = r.success && r.data ? r.data : null;
      return [
        r.url,
        r.success ? '成功' : '失败',
        d ? d.score : '',
        d ? d.grade : '',
        d ? d.summary.critical : '',
        d ? d.summary.warnings : '',
        d ? d.summary.suggestions : '',
        d ? `"${(d.domainInfo.title || '').replace(/"/g, '""')}"` : '',
        d ? `"${(d.domainInfo.description || '').replace(/"/g, '""')}"` : '',
        d ? d.domainInfo.wordCount : '',
        d ? d.domainInfo.fetchTime : '',
        d ? (d.domainInfo.hasOGTags ? '有' : '无') : '',
        d ? d.domainInfo.h1Count : '',
        d ? `${d.domainInfo.imgWithAlt}/${d.domainInfo.imgCount}` : '',
        d ? d.domainInfo.internalLinks : '',
        d ? d.domainInfo.externalLinks : '',
        d ? (d.domainInfo.hasSitemap ? '有' : '无') : '',
        d ? (d.domainInfo.hasFavicon ? '有' : '无') : '',
        !r.success ? `"${(r.error || '').replace(/"/g, '""')}"` : '',
      ].join(',');
    });

    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seo-batch-report_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [results]);

  const handleExportJSON = useCallback(() => {
    if (!results || results.length === 0) return;

    const exportData = results.map(r => ({
      url: r.url,
      success: r.success,
      ...(r.success && r.data ? {
        score: r.data.score,
        grade: r.data.grade,
        gradeLabel: r.data.gradeLabel,
        summary: r.data.summary,
        domain: r.data.domainInfo.domain,
        title: r.data.domainInfo.title,
        description: r.data.domainInfo.description,
        fetchTime: r.data.domainInfo.fetchTime,
        hasOGTags: r.data.domainInfo.hasOGTags,
        hasSitemap: r.data.domainInfo.hasSitemap,
        h1Count: r.data.domainInfo.h1Count,
        imgCount: r.data.domainInfo.imgCount,
        imgWithAlt: r.data.domainInfo.imgWithAlt,
        internalLinks: r.data.domainInfo.internalLinks,
        checks: r.data.checks,
      } : {}),
      ...(!r.success ? { error: r.error } : {}),
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seo-batch-report_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [results]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-800">📤 导出报告</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            下载诊断结果，方便存档或进一步分析
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-green-50 border border-green-200 text-green-700
                     rounded-lg text-sm font-medium hover:bg-green-100 transition-all"
          >
            📊 CSV
          </button>
          <button
            onClick={handleExportJSON}
            className="px-4 py-2 bg-blue-50 border border-blue-200 text-blue-700
                     rounded-lg text-sm font-medium hover:bg-blue-100 transition-all"
          >
            📋 JSON
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ 主页面 ============

export default function BatchSEODiagnosisPage() {
  const [inputMethod, setInputMethod] = useState<InputMethod>({ type: 'paste', content: '' });
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [results, setResults] = useState<BatchResult[] | null>(null);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const handleStart = useCallback(async () => {
    setLoading(true);
    setProgress(null);
    setResults(null);
    setError('');

    try {
      const body = JSON.stringify({
        content: inputMethod.content,
        filename: inputMethod.filename,
      });

      const response = await fetch('/api/seo/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || `请求失败 (${response.status})`);
      }

      // Read SSE stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      const decoder = new TextDecoder();
      let buffer = '';
      let completed = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(line.slice(6)) as BatchProgress;
            setProgress(data);

            if (data.status === 'completed' && data.results) {
              setResults(data.results);
              completed = true;
            }
          } catch {
            // Skip malformed lines
          }
        }
      }

      // Process remaining buffer
      if (buffer.startsWith('data: ')) {
        try {
          const data = JSON.parse(buffer.slice(6)) as BatchProgress;
          if (data.status === 'completed' && data.results) {
            setResults(data.results);
            completed = true;
          }
        } catch {}
      }

      if (!completed) {
        throw new Error('连接意外中断，部分结果可能已丢失');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [inputMethod]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-2xl">🔍</span>
            <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full font-medium">
              批量版
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            📦 批量SEO诊断
          </h1>
          <p className="text-gray-500 mt-2 text-sm max-w-lg mx-auto">
            一次上传或粘贴多个网址，自动批量分析SEO状况。支持 CSV / JSON / TXT 文件上传。
          </p>
          <div className="flex flex-wrap gap-2 justify-center mt-3">
            <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs rounded-full">
              📤 上传→处理
            </span>
            <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
              ⚡ 实时进度
            </span>
            <span className="px-2.5 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
              📊 下载报告
            </span>
          </div>
        </header>

        {/* Back link */}
        <div className="mb-4">
          <a
            href="/seo-diagnosis"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
          >
            ← 返回单页诊断
          </a>
        </div>

        {/* Input Panel */}
        <InputPanel
          inputMethod={inputMethod}
          onInputChange={setInputMethod}
          onStart={handleStart}
          disabled={loading}
        />

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
            <div className="flex items-start gap-2">
              <span className="text-lg">❌</span>
              <div>
                <p className="font-medium text-red-800 text-sm">批量处理失败</p>
                <p className="text-red-600 text-xs mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Progress */}
        {progress && <ProgressPanel progress={progress} />}

        {/* Results */}
        {results && results.length > 0 && (
          <>
            <ResultsList results={results} />
            <ExportPanel results={results} />
          </>
        )}

        {/* Tips */}
        <div className="mt-8 p-6 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl border border-indigo-100">
          <h3 className="text-sm font-semibold text-indigo-800 mb-3">💡 工作流自动化：学到了什么</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-indigo-700">
            <div className="bg-white/60 rounded-xl p-3">
              <strong>📤 多步骤处理流程</strong>
              <p className="mt-1 text-indigo-500">上传→解析URL→批量诊断→下载报告，完整的工作流编排。</p>
            </div>
            <div className="bg-white/60 rounded-xl p-3">
              <strong>📄 文件处理</strong>
              <p className="mt-1 text-indigo-500">CSV/JSON/TXT三种格式智能解析，自动提取URL，含BOM头的CSV导出。</p>
            </div>
            <div className="bg-white/60 rounded-xl p-3">
              <strong>⏳ 后台长时间任务</strong>
              <p className="mt-1 text-indigo-500">SSE Server-Sent Events流式推送进度，可取消，50个URL不超时。</p>
            </div>
            <div className="bg-white/60 rounded-xl p-3">
              <strong>📊 进度反馈</strong>
              <p className="mt-1 text-indigo-500">实时进度条 + 逐条状态 + 总分评级 + CSV/JSON导出，不白等。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
