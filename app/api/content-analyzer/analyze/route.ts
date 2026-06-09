/**
 * Content Analyzer API
 * 抓取目标页面 → 分析内容结构：标题层级、字数、阅读时间、关键词密度、
 * 图片alt属性、内链/外链分布、阅读难度
 * 
 * 壁垒：服务端正则+cheerio解析，不受CORS限制
 */

import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

// ============ Types ============

export interface HeadingInfo {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  hasContent: boolean;
}

export interface KeywordDensity {
  keyword: string;
  count: number;
  density: number;
}

export interface LinkStats {
  total: number;
  internal: number;
  external: number;
  internalPercent: number;
  externalPercent: number;
  broken: number;
  noFollow: number;
}

export interface ImageStats {
  total: number;
  withAlt: number;
  withoutAlt: number;
  altPercent: number;
}

export interface ContentAnalyzerResult {
  url: string;
  finalUrl: string;
  status: number;
  responseTime: number;

  // Basic stats
  title: string;
  description: string;
  wordCount: number;
  charCount: number;
  paragraphCount: number;
  readingTimeMinutes: number;
  readingTimeSeconds: number;

  // Headings
  headings: HeadingInfo[];
  headingIssues: string[];

  // Keywords
  keywordDensity: KeywordDensity[];
  topKeywords: KeywordDensity[];

  // Links
  links: LinkStats;

  // Images
  images: ImageStats;

  // Readability
  avgWordsPerSentence: number;
  longSentences: number;
  fleschReadingEase: number;

  // Scoring
  score: number;
  scoreBreakdown: { category: string; score: number; max: number; note: string }[];

  errors: string[];
}

// ============ Helpers ============

function sanitizeUrl(input: string): string {
  let url = input.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  try {
    const u = new URL(url);
    if (!u.hostname || !u.hostname.includes('.')) return '';
    return url;
  } catch {
    return '';
  }
}

function extractTitle($: cheerio.CheerioAPI): string {
  return $('title').first().text().trim();
}

function extractDescription($: cheerio.CheerioAPI): string {
  return $('meta[name="description"]').attr('content')?.trim() || '';
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

function analyzeHeadings($: cheerio.CheerioAPI): HeadingInfo[] {
  const headings: HeadingInfo[] = [];
  for (let lvl = 1; lvl <= 6; lvl++) {
    $(`h${lvl}`).each((_, el) => {
      const text = $(el).text().trim();
      headings.push({
        level: lvl as HeadingInfo['level'],
        text,
        hasContent: text.length > 0,
      });
    });
  }
  return headings;
}

function findHeadingIssues(headings: HeadingInfo[]): string[] {
  const issues: string[] = [];

  // Check for h1
  const h1s = headings.filter(h => h.level === 1);
  if (h1s.length === 0) {
    issues.push('缺少 H1 标签，搜索引擎重视标题层级结构');
  } else if (h1s.length > 1) {
    issues.push(`页面有 ${h1s.length} 个 H1 标签，建议每个页面只有一个 H1`);
  }

  // Check empty headings
  const emptyHeadings = headings.filter(h => !h.hasContent);
  if (emptyHeadings.length > 0) {
    issues.push(`有 ${emptyHeadings.length} 个空标题标签（无内容）`);
  }

  // Check heading depth jumping
  let lastLevel = 0;
  for (const h of headings) {
    if (lastLevel > 0 && h.level > lastLevel + 1) {
      issues.push(`标题层级跳跃：从 H${lastLevel} 跳到 H${h.level}，建议使用 H${lastLevel + 1}`);
    }
    lastLevel = h.level;
  }

  // Content to heading ratio
  if (headings.length === 0) {
    issues.push('页面没有任何标题标签（H1-H6），严重影响 SEO');
  } else if (headings.length === 1) {
    issues.push('页面只有一个标题标签，建议增加子标题使内容结构更清晰');
  }

  return issues;
}

function analyzeKeywordDensity($: cheerio.CheerioAPI, bodyText: string): KeywordDensity[] {
  // Remove common stop words and punctuation
  const clean = bodyText.toLowerCase()
    .replace(/[^\w\u4e00-\u9fff\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = clean.split(/\s+/);
  const totalWords = words.length;

  if (totalWords < 10) return [];

  const freq: Record<string, number> = {};

  for (const word of words) {
    if (word.length < 2) continue;

    // Filter common stop words
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
      'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
      'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
      'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
      'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
      'same', 'so', 'than', 'too', 'very', 'just', 'because', 'but', 'and',
      'or', 'if', 'while', 'although', 'this', 'that', 'these', 'those',
      'it', 'its', 'they', 'them', 'their', 'he', 'she', 'his', 'her',
      'we', 'us', 'our', 'you', 'your', 'my', 'me', 'mine', 'i',
      'about', 'which', 'what', 'who', 'whom', 'up', 'down',
    ]);

    if (stopWords.has(word)) continue;

    freq[word] = (freq[word] || 0) + 1;
  }

  const sorted = Object.entries(freq)
    .map(([keyword, count]) => ({
      keyword,
      count,
      density: parseFloat(((count / totalWords) * 100).toFixed(3)),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

  return sorted;
}

function analyzeLinks($: cheerio.CheerioAPI, baseUrl: string): LinkStats {
  const baseHost = new URL(baseUrl).hostname;
  let total = 0, internal = 0, external = 0, noFollow = 0;

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')?.trim();
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

    total++;
    const rel = $(el).attr('rel')?.toLowerCase() || '';
    if (rel.includes('nofollow')) noFollow++;

    try {
      const url = new URL(href, baseUrl);
      if (url.hostname === baseHost) {
        internal++;
      } else {
        external++;
      }
    } catch {
      internal++;
    }
  });

  const internalPercent = total > 0 ? parseFloat(((internal / total) * 100).toFixed(1)) : 0;
  const externalPercent = total > 0 ? parseFloat(((external / total) * 100).toFixed(1)) : 0;

  return { total, internal, external, internalPercent, externalPercent, broken: 0, noFollow };
}

function analyzeImages($: cheerio.CheerioAPI): ImageStats {
  let total = 0, withAlt = 0, withoutAlt = 0;

  $('img').each((_, el) => {
    total++;
    const alt = $(el).attr('alt')?.trim() || '';
    if (alt.length > 0) {
      withAlt++;
    } else {
      withoutAlt++;
    }
  });

  const altPercent = total > 0 ? parseFloat(((withAlt / total) * 100).toFixed(1)) : 0;
  return { total, withAlt, withoutAlt, altPercent };
}

function analyzeReadability(text: string): { avgWordsPerSentence: number; longSentences: number; fleschReadingEase: number } {
  const sentences = text
    .replace(/[.!?]+/g, '.')
    .split('.')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const totalSentences = sentences.length;
  if (totalSentences === 0) return { avgWordsPerSentence: 0, longSentences: 0, fleschReadingEase: 0 };

  const longSentences = sentences.filter(s => countWords(s) > 30).length;
  const totalWords = sentences.reduce((sum, s) => sum + countWords(s), 0);
  const avgWordsPerSentence = parseFloat((totalWords / totalSentences).toFixed(1));

  // English-only Flesch Reading Ease score (approximation)
  const syllables = countSyllables(text);
  const fleschReadingEase = totalSentences > 0 && totalWords > 0
    ? parseFloat((206.835 - 1.015 * (totalWords / totalSentences) - 84.6 * (syllables / totalWords)).toFixed(1))
    : 0;

  return { avgWordsPerSentence, longSentences, fleschReadingEase };
}

function countSyllables(text: string): number {
  // Simple syllable counter (approximation)
  const words = text
    .toLowerCase()
    .replace(/[^a-z]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);

  let count = 0;
  for (const word of words) {
    // Count vowel groups as syllables
    const vowelGroups = word.match(/[aeiouy]+/g);
    let sylCount = vowelGroups ? vowelGroups.length : 1;

    // Adjust for silent e at end
    if (word.endsWith('e') && word.length > 2 && !word.endsWith('le') && !/[aeiou]/.test(word[word.length - 2])) {
      sylCount--;
    }

    // Adjust for common suffixes
    if (word.endsWith('es') || word.endsWith('ed') && sylCount > 1) {
      sylCount--;
    }

    count += Math.max(1, sylCount);
  }

  return count;
}

function getFleschLabel(score: number): string {
  if (score >= 90) return '非常容易阅读（小学生水平）';
  if (score >= 80) return '容易阅读';
  if (score >= 70) return '较容易阅读';
  if (score >= 60) return '标准难度';
  if (score >= 50) return '较难阅读';
  if (score >= 30) return '难阅读';
  return '非常难阅读（专业文献）';
}

function calculateScore(
  wordCount: number,
  headings: HeadingInfo[],
  headingIssues: string[],
  images: ImageStats,
  links: LinkStats,
  readability: { avgWordsPerSentence: number; longSentences: number; fleschReadingEase: number },
): { score: number; breakdown: { category: string; score: number; max: number; note: string }[] } {
  const breakdown: { category: string; score: number; max: number; note: string }[] = [];
  let totalScore = 0;

  // Content length (max 25)
  let contentScore = 0;
  if (wordCount === 0) { contentScore = 0; }
  else if (wordCount < 100) { contentScore = 5; }
  else if (wordCount < 300) { contentScore = 10; }
  else if (wordCount < 800) { contentScore = 18; }
  else if (wordCount < 2000) { contentScore = 25; }
  else { contentScore = 22; } // Too long may be excessive
  breakdown.push({ category: '内容长度', score: contentScore, max: 25, note: `${wordCount} 词` });
  totalScore += contentScore;

  // Heading structure (max 25)
  let headingScore = 0;
  const hCount = headings.length;
  if (hCount === 0) { headingScore = 0; }
  else if (hCount === 1) { headingScore = 8; }
  else if (hCount < 4) { headingScore = 15; }
  else if (hCount < 10) { headingScore = 22; }
  else { headingScore = 20; }

  // Deduct for heading issues
  const issueDeduction = Math.min(headingIssues.length * 3, 10);
  headingScore = Math.max(0, headingScore - issueDeduction);
  breakdown.push({ category: '标题结构', score: headingScore, max: 25, note: `H1=${headings.filter(h=>h.level===1).length} 子标题=${headings.filter(h=>h.level>1).length}` });
  totalScore += headingScore;

  // Images & alt text (max 20)
  let imageScore = 0;
  if (images.total === 0) {
    imageScore = wordCount > 500 ? 8 : 12; // Content without images is okay for short pages
  } else {
    const altRatio = images.altPercent;
    const baseScore = Math.min(images.total * 2, 12);
    const altBonus = altRatio >= 90 ? 8 : altRatio >= 70 ? 5 : altRatio >= 50 ? 3 : 0;
    imageScore = baseScore + altBonus;
  }
  breakdown.push({ category: '图片与Alt', score: Math.min(imageScore, 20), max: 20, note: `${images.total} 张图，${images.altPercent}% 有alt属性` });
  totalScore += Math.min(imageScore, 20);

  // Link structure (max 15)
  let linkScore = 0;
  if (links.total === 0) {
    linkScore = wordCount > 300 ? 3 : 5;
  } else {
    linkScore = Math.min(links.total, 8);
    if (links.externalPercent > 0 && links.externalPercent < 60) linkScore += 3;
    if (links.internalPercent > 30) linkScore += 2;
    if (links.noFollow > 0) linkScore = Math.max(0, linkScore - 2);
  }
  breakdown.push({ category: '链接结构', score: Math.min(linkScore, 15), max: 15, note: `${links.total} 链接（内${links.internal} 外${links.external}）` });
  totalScore += Math.min(linkScore, 15);

  // Readability (max 15)
  let readabilityScore = 0;
  const fr = readability.fleschReadingEase;
  if (fr <= 0) { readabilityScore = 0; }
  else if (fr < 30) { readabilityScore = 3; }
  else if (fr < 50) { readabilityScore = 6; }
  else if (fr < 60) { readabilityScore = 9; }
  else if (fr < 80) { readabilityScore = 12; }
  else { readabilityScore = 15; }

  // Deduct for long sentences
  const longSentencePenalty = Math.min(readability.longSentences, 5);
  readabilityScore = Math.max(0, readabilityScore - longSentencePenalty);

  const fleschLabel = readability.fleschReadingEase > 0 ? `${readability.fleschReadingEase} — ${getFleschLabel(readability.fleschReadingEase)}` : '无法评估';
  breakdown.push({ category: '可读性', score: readabilityScore, max: 15, note: fleschLabel });
  totalScore += readabilityScore;

  return { score: totalScore, breakdown };
}

// ============ Main Analysis ============

async function analyzeContent(cleanUrl: string): Promise<ContentAnalyzerResult> {
  const start = Date.now();

  const response = await fetch(cleanUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SinmonikerContentAnalyzer/1.0; +https://sinmoniker.com/content-analyzer)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });

  const responseTime = Date.now() - start;
  const finalUrl = response.url || cleanUrl;
  const html = await response.text();
  const $ = cheerio.load(html);

  const title = extractTitle($);
  const description = extractDescription($);

  // Body text
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const wordCount = countWords(bodyText);
  const charCount = bodyText.length;
  const paragraphCount = $('p').length;

  // Reading time
  const readingTimeMinutes = Math.max(1, Math.round(wordCount / 200));
  const readingTimeSeconds = Math.max(30, Math.round((wordCount / 200) * 60));

  // Headings
  const headings = analyzeHeadings($);
  const headingIssues = findHeadingIssues(headings);

  // Keywords
  const keywordDensity = analyzeKeywordDensity($, bodyText);
  const topKeywords = keywordDensity.slice(0, 10);

  // Links
  const baseUrl = new URL(finalUrl).origin;
  const links = analyzeLinks($, baseUrl);

  // Images
  const images = analyzeImages($);

  // Readability
  const readability = analyzeReadability(bodyText);

  // Score
  const { score, breakdown } = calculateScore(wordCount, headings, headingIssues, images, links, {
    avgWordsPerSentence: readability.avgWordsPerSentence,
    longSentences: readability.longSentences,
    fleschReadingEase: readability.fleschReadingEase,
  });

  return {
    url: cleanUrl,
    finalUrl,
    status: response.status,
    responseTime,
    title,
    description,
    wordCount,
    charCount,
    paragraphCount,
    readingTimeMinutes,
    readingTimeSeconds,
    headings,
    headingIssues,
    keywordDensity,
    topKeywords,
    links,
    images,
    avgWordsPerSentence: readability.avgWordsPerSentence,
    longSentences: readability.longSentences,
    fleschReadingEase: readability.fleschReadingEase,
    score,
    scoreBreakdown: breakdown,
    errors: [],
  };
}

// ============ Route Handler ============

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const urlParam = searchParams.get('url');

  if (!urlParam) {
    return NextResponse.json(
      { error: '请提供 url 参数，如 ?url=example.com' },
      { status: 400 },
    );
  }

  const cleanUrl = sanitizeUrl(urlParam);
  if (!cleanUrl) {
    return NextResponse.json(
      { error: 'URL 格式不正确，请输入有效网址（如 example.com 或 https://example.com）' },
      { status: 400 },
    );
  }

  try {
    const result = await analyzeContent(cleanUrl);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: `分析失败: ${err?.message || '未知错误'}` },
      { status: 500 },
    );
  }
}
