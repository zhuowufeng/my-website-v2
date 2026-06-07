/**
 * lib/keyword-suggester.ts
 * 关键词建议采集器 — 从多个公开来源获取相关关键词
 * 
 * 数据来源：
 * 1. Baidu 搜索建议（中文）
 * 2. Google 搜索建议（英文/全球）
 * 3. 组合去重
 * 
 * 壁垒优势：爬取多源数据聚合分析，不是AI能替代的
 */

export interface KeywordSuggestion {
  keyword: string;
  source: 'baidu' | 'google';
  /** 建议排名（0 = 最热门） */
  rank: number;
}

export interface KeywordResearchResult {
  seedKeyword: string;
  suggestions: KeywordSuggestion[];
  totalKeywords: number;
  fetchedAt: string;
}

/**
 * 从百度搜索建议获取中文关键词
 * 使用百度suggestion API（公开接口）
 */
async function fetchBaiduSuggestions(keyword: string): Promise<KeywordSuggestion[]> {
  try {
    const url = new URL('https://suggestion.baidu.com/su');
    url.searchParams.set('wd', keyword);
    url.searchParams.set('p', '3');

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.baidu.com/',
      },
      signal: AbortSignal.timeout(5000),
    });

    const text = await response.text();
    // 百度返回格式: window.baidu.sug({q: "...", p: false, s: ["kw1", "kw2", ...]})
    const match = text.match(/s:\s*(\[[^\]]+\])/);
    if (!match) return [];

    const suggestions: string[] = JSON.parse(match[1]);
    return suggestions.map((kw, i) => ({
      keyword: kw,
      source: 'baidu' as const,
      rank: i,
    }));
  } catch (error) {
    console.warn('[keyword-suggester] Baidu fetch failed:', (error as Error).message);
    return [];
  }
}

/**
 * 从Google搜索建议获取英文关键词
 * 使用Google suggest API（公开接口）
 */
async function fetchGoogleSuggestions(keyword: string): Promise<KeywordSuggestion[]> {
  try {
    const url = new URL('https://suggestqueries.google.com/complete/search');
    url.searchParams.set('client', 'firefox');
    url.searchParams.set('q', keyword);
    url.searchParams.set('hl', 'zh-CN');
    url.searchParams.set('gl', 'cn');

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(5000),
    });

    const data = await response.json();
    if (!Array.isArray(data) || data.length < 2) return [];

    const suggestions: string[] = data[1];
    return suggestions.map((kw, i) => ({
      keyword: kw,
      source: 'google' as const,
      rank: i,
    }));
  } catch (error) {
    console.warn('[keyword-suggester] Google fetch failed:', (error as Error).message);
    return [];
  }
}

/**
 * 对同一个种子关键词，用多种方式扩展：
 * 1. 获取百度/Google建议
 * 2. 用百度结果的前几个词再次扩展（深度2层）
 * 3. 去重合并
 */
export async function researchKeywords(seedKeyword: string): Promise<KeywordResearchResult> {
  const lowerKeyword = seedKeyword.trim().toLowerCase();
  if (!lowerKeyword) {
    return {
      seedKeyword,
      suggestions: [],
      totalKeywords: 0,
      fetchedAt: new Date().toISOString(),
    };
  }

  // 并行请求两个源
  const [baiduResults, googleResults] = await Promise.all([
    fetchBaiduSuggestions(lowerKeyword),
    fetchGoogleSuggestions(lowerKeyword),
  ]);

  // 合并所有结果
  const all: KeywordSuggestion[] = [...baiduResults, ...googleResults];

  // 去重（保留首次出现）
  const seen = new Set<string>();
  const unique: KeywordSuggestion[] = [];
  for (const item of all) {
    const key = item.keyword.toLowerCase().trim();
    if (!seen.has(key) && key !== lowerKeyword) {
      seen.add(key);
      unique.push(item);
    }
  }

  // 如果有百度结果，用top-3关键词做第二轮深挖（只做百度）
  const expandedResults: KeywordSuggestion[] = [];
  const topBaiduKws = baiduResults
    .filter(k => !seen.has(k.keyword.toLowerCase().trim()))
    .slice(0, 3)
    .map(k => k.keyword);

  if (topBaiduKws.length > 0) {
    const secondLevelResults = await Promise.all(
      topBaiduKws.map(kw => fetchBaiduSuggestions(kw))
    );

    for (const results of secondLevelResults) {
      for (const item of results) {
        const key = item.keyword.toLowerCase().trim();
        if (!seen.has(key) && key !== lowerKeyword) {
          seen.add(key);
          expandedResults.push({
            keyword: item.keyword,
            source: 'baidu',
            rank: item.rank + 100, // 权重降低
          });
        }
      }
    }
  }

  const allUnique = [...unique, ...expandedResults];

  return {
    seedKeyword: lowerKeyword,
    suggestions: allUnique,
    totalKeywords: allUnique.length,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * 格式化输出（用于API响应）
 */
export function formatKeywordResults(result: KeywordResearchResult): {
  seedKeyword: string;
  totalKeywords: number;
  baiduKeywords: string[];
  googleKeywords: string[];
  expandedKeywords: string[];
  fetchedAt: string;
} {
  const baiduKws = result.suggestions
    .filter(s => s.source === 'baidu' && s.rank < 100)
    .map(s => s.keyword);
  
  const googleKws = result.suggestions
    .filter(s => s.source === 'google')
    .map(s => s.keyword);
  
  const expandedKws = result.suggestions
    .filter(s => s.source === 'baidu' && s.rank >= 100)
    .map(s => s.keyword);

  return {
    seedKeyword: result.seedKeyword,
    totalKeywords: result.totalKeywords,
    baiduKeywords: [...new Set(baiduKws)],
    googleKeywords: [...new Set(googleKws)],
    expandedKeywords: [...new Set(expandedKws)],
    fetchedAt: result.fetchedAt,
  };
}
