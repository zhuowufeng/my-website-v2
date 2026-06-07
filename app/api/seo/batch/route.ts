/**
 * /api/seo/batch — 批量SEO诊断（工作流自动化）
 *
 * 模块11：工作流自动化 — 上传→处理→下载
 * - 文件解析（CSV/JSON/TXT）
 * - 后台批量处理
 * - SSE实时进度推送
 * - 结果汇总导出
 */

import { NextRequest } from 'next/server';
import SEOAudit from '../../../../models/SEOAudit';
import { appCache, SEARCH_CACHE_TTL } from '../../../../lib/cache';

// ============ 类型 ============

interface BatchProgress {
  /** 作业唯一标识 */
  jobId: string;
  /** 总URL数 */
  total: number;
  /** 已处理数 */
  processed: number;
  /** 成功数 */
  succeeded: number;
  /** 失败数 */
  failed: number;
  /** 当前处理的URL */
  currentUrl: string;
  /** 当前状态: processing | completed | error */
  status: 'processing' | 'completed' | 'error';
  /** 错误信息 */
  error?: string;
  /** 结果 */
  results?: BatchResult[];
}

interface BatchResult {
  url: string;
  success: boolean;
  data?: any;
  error?: string;
}

// ============ 作业存储 ============

interface JobStore {
  [jobId: string]: {
    progress: BatchProgress;
    resolvers: ((data: BatchProgress) => void)[];
    abortController: AbortController;
  };
}

const jobs: JobStore = {};

// ============ 工具函数 ============

function generateJobId(): string {
  return `batch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * 从CSV文本中提取URL列表
 */
function extractUrlsFromCSV(text: string): string[] {
  const urls: string[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Try to parse as CSV — look for URLs in any column
    const columns = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    for (const col of columns) {
      if (col.match(/^https?:\/\//i) || col.match(/^[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}/)) {
        const url = col.startsWith('http') ? col : `https://${col}`;
        urls.push(url);
        break;
      }
    }
  }

  return [...new Set(urls)]; // Deduplicate
}

/**
 * 从JSON文本中提取URL列表
 */
function extractUrlsFromJSON(text: string): string[] {
  try {
    const data = JSON.parse(text);
    const urls: string[] = [];

    if (Array.isArray(data)) {
      for (const item of data) {
        if (typeof item === 'string' && isValidUrl(item)) {
          urls.push(normalizeUrl(item));
        } else if (item && typeof item === 'object') {
          // Try common field names
          for (const key of ['url', 'URL', 'link', 'website', 'domain', 'site']) {
            if (item[key] && typeof item[key] === 'string' && isValidUrl(item[key])) {
              urls.push(normalizeUrl(item[key]));
              break;
            }
          }
        }
      }
    } else if (data && typeof data === 'object') {
      // Maybe it's an object with URLs in values
      for (const val of Object.values(data)) {
        if (typeof val === 'string' && isValidUrl(val)) {
          urls.push(normalizeUrl(val));
        }
      }
    }

    return [...new Set(urls)];
  } catch {
    return [];
  }
}

/**
 * 从纯文本中提取URL
 */
function extractUrlsFromText(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s,;'"]+/gi;
  const matches = text.match(urlRegex);
  if (matches) {
    return [...new Set(matches.map(u => u.replace(/[.,;)]$/, '')))];
  }

  // Try line-by-line URLs
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const urls: string[] = [];
  for (const line of lines) {
    if (isValidUrl(line)) {
      urls.push(normalizeUrl(line));
    }
  }

  return [...new Set(urls)];
}

function isValidUrl(str: string): boolean {
  try {
    const s = str.startsWith('http') ? str : `https://${str}`;
    new URL(s);
    return true;
  } catch {
    return false;
  }
}

function normalizeUrl(url: string): string {
  const s = url.trim();
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  return `https://${s}`;
}

/**
 * 解析上传内容，提取URL列表
 */
function parseInputContent(content: string, filename?: string): {
  urls: string[];
  parser: string;
} {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('内容为空');

  // Try JSON first (most structured)
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const urls = extractUrlsFromJSON(trimmed);
    if (urls.length > 0) return { urls, parser: 'json' };
  }

  // Try CSV (if there are commas and lines)
  if (trimmed.includes(',') && trimmed.includes('\n')) {
    const urls = extractUrlsFromCSV(trimmed);
    if (urls.length > 0) return { urls, parser: 'csv' };
  }

  // Fallback: plain text URLs
  const urls = extractUrlsFromText(trimmed);
  if (urls.length > 0) return { urls, parser: 'text' };

  throw new Error('未能从输入中提取到任何有效的URL');
}

// ============ SSE处理 ============

function sendSSE(
  writer: WritableStreamDefaultWriter,
  data: any,
  event?: string
): Promise<void> {
  const encoder = new TextEncoder();
  const lines: string[] = [];
  if (event) lines.push(`event: ${event}`);
  lines.push(`data: ${JSON.stringify(data)}`);
  lines.push(''); // Empty line separates events
  return writer.write(encoder.encode(lines.join('\n') + '\n'));
}

/**
 * Stream progress via SSE
 */
async function* processBatch(
  jobId: string,
  urls: string[],
  signal: AbortSignal
): AsyncGenerator<BatchProgress, BatchResult[], void> {
  const results: BatchResult[] = [];
  const progress: BatchProgress = {
    jobId,
    total: urls.length,
    processed: 0,
    succeeded: 0,
    failed: 0,
    currentUrl: '',
    status: 'processing',
  };

  for (let i = 0; i < urls.length; i++) {
    // Check for abort
    if (signal.aborted) {
      progress.status = 'error';
      progress.error = '用户取消';
      yield { ...progress, results };
      return results;
    }

    const url = urls[i];
    progress.currentUrl = url;

    try {
      // Try cache first
      const cacheKey = `seo:audit:${url}`;
      let auditResult = appCache.get(cacheKey);

      if (!auditResult) {
        auditResult = await SEOAudit.analyze(url);
        // Cache each result
        appCache.set(cacheKey, auditResult, { ttl: 300_000 });
      }

      results.push({ url, success: true, data: auditResult });
      progress.succeeded++;
    } catch (error: any) {
      results.push({ url, success: false, error: error.message });
      progress.failed++;
    }

    progress.processed++;
    yield { ...progress, results };
  }

  progress.status = 'completed';
  yield { ...progress, results };
  return results;
}

// ============ Routes ============

/**
 * POST /api/seo/batch — 启动批量诊断
 * Body: { content: string, filename?: string } 或 FormData file
 * Returns SSE stream
 */
export async function POST(request: NextRequest) {
  try {
    let content: string;
    let filename: string | undefined;

    // Handle both JSON and FormData
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return new Response(
          JSON.stringify({ error: '请上传文件' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      filename = file.name;
      content = await file.text();
    } else {
      const body = await request.json();
      content = body.content;
      filename = body.filename;
    }

    if (!content || typeof content !== 'string') {
      return new Response(
        JSON.stringify({ error: '请提供要分析的内容' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse URLs from input
    const { urls, parser } = parseInputContent(content, filename);

    if (urls.length === 0) {
      return new Response(
        JSON.stringify({ error: '未能从输入中提取到任何有效的URL' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (urls.length > 50) {
      return new Response(
        JSON.stringify({ error: `URL数量超过限制（最多50个），当前${urls.length}个` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const jobId = generateJobId();
    const abortController = new AbortController();

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const writer = controller as any;

        // Send initial progress
        const initial: BatchProgress = {
          jobId,
          total: urls.length,
          processed: 0,
          succeeded: 0,
          failed: 0,
          currentUrl: '',
          status: 'processing',
        };

        writer.enqueue(encoder.encode(`data: ${JSON.stringify(initial)}\n\n`));

        let lastResults: BatchResult[] = [];

        for await (const progress of processBatch(jobId, urls, abortController.signal)) {
          if (progress.results) {
            lastResults = progress.results;
          }

          // Send progress event (without full results to keep it light)
          const { results: _, ...progressOnly } = progress;
          writer.enqueue(encoder.encode(`data: ${JSON.stringify(progressOnly)}\n\n`));
        }

        // Send final event with full results
        const final: BatchProgress = {
          jobId,
          total: urls.length,
          processed: urls.length,
          succeeded: lastResults.filter(r => r.success).length,
          failed: lastResults.filter(r => !r.success).length,
          currentUrl: '',
          status: 'completed',
          results: lastResults,
        };

        writer.enqueue(encoder.encode(`event: complete\ndata: ${JSON.stringify(final)}\n\n`));
        controller.close();
      },
      cancel() {
        abortController.abort();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || '批量处理失败' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
