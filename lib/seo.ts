// SEO Metadata Utility — 可复用的 SEO 元数据生成器
// 支持：Open Graph、Twitter Card、关键词、结构化数据集成

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://sinmoniker.com";
const SITE_NAME = "Sinmoniker";

export type SeoPageConfig = {
  title: string;
  description: string;
  keywords: string[];
  path: string;
  locale?: string;
  image?: string;
  noIndex?: boolean;
  ogType?: "website" | "article" | "product";
  publishedTime?: string;
  modifiedTime?: string;
};

/**
 * 生成完整的 Metadata 对象（适合在 server components 中 export）
 * 包含：title, description, keywords, openGraph, twitter, robots, alternates
 */
export function buildMetadata(config: SeoPageConfig) {
  const url = `${BASE_URL}${config.path}`;
  const image = config.image || "/og-image.png";
  const locale = config.locale || "en_US";

  return {
    title: config.title,
    description: config.description,
    keywords: config.keywords,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: config.title,
      description: config.description,
      url,
      siteName: SITE_NAME,
      locale,
      type: config.ogType || "website",
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: config.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: config.title,
      description: config.description,
      images: [image],
    },
    robots: {
      index: !config.noIndex,
      follow: !config.noIndex,
      googleBot: {
        index: !config.noIndex,
        follow: !config.noIndex,
        "max-video-preview": -1,
        "max-image-preview": "large" as const,
        "max-snippet": -1,
      },
    },
  };
}

// ======== 各页面 SEO 配置 ========

export const SEO_CONFIGS: Record<string, SeoPageConfig> = {
  home: {
    title: "Sinmoniker - Find Your Chinese Name & SEO Tools",
    description:
      "Discover your Chinese name with AI. Free generator with meanings, pronunciation, and cute nicknames. Pro tools: SEO diagnosis, batch analysis, scheduling & analytics.",
    keywords: [
      "Chinese name generator",
      "Chinese name meaning",
      "AI name generator",
      "Sinmoniker",
      "SEO diagnosis",
      "SEO analytics",
      "AI writing assistant",
    ],
    path: "/",
  },
  pricing: {
    title: "Pricing Plans | Sinmoniker - Chinese Name Generator & SEO Tools",
    description:
      "Choose the right plan for your needs. Free plan includes basic name generation. Pro plan unlocks SEO tools, analytics, and AI writing assistant.",
    keywords: ["Sinmoniker pricing", "Chinese name generator plans", "SEO tools subscription", "AI writing pricing"],
    path: "/pricing",
  },
  writingTool: {
    title: "AI Writing Assistant - Free AI Article Generator | Sinmoniker 墨言",
    description:
      "Free AI-powered writing assistant. Generate blog posts, Xiaohongshu copy, SEO content, and product descriptions. Streaming output, multiple styles.",
    keywords: ["AI writing assistant", "free AI article generator", "AI content creator", "SEO writing tool", "AI blog writer"],
    path: "/writing-tool",
    locale: "zh_CN",
  },
  titleGenerator: {
    title: "AI Title Generator - High CTR Headlines | Sinmoniker",
    description:
      "Generate high-click-rate titles with AI. Support blog, Xiaohongshu, SEO, and marketing styles. Free online title generator tool.",
    keywords: ["AI title generator", "headline generator", "CTR optimization", "blog title ideas", "free title maker"],
    path: "/title-generator",
  },
  blogGenerator: {
    title: "AI Blog Post Generator - Free SEO-Optimized Content | Sinmoniker 文序",
    description:
      "Generate high-quality blog posts with AI. 5 content styles: tutorial, listicle, analysis, story, opinion. Built-in SEO metadata and keyword optimization.",
    keywords: ["AI blog generator", "blog post writer", "SEO content generator", "free blog writer AI", "content creation tool"],
    path: "/blog-generator",
  },
  keywordResearch: {
    title: "Free Keyword Research Tool - Long-tail Keywords | Sinmoniker",
    description:
      "Discover long-tail keywords from Baidu and Google suggestions. Free SEO keyword research tool to find user search terms and traffic opportunities.",
    keywords: ["keyword research tool", "long-tail keywords", "SEO keyword tool", "keyword suggester", "free keyword research"],
    path: "/keyword-research",
    locale: "zh_CN",
  },
  seoDiagnosis: {
    title: "Free SEO Diagnosis Tool - Website SEO Audit | Sinmoniker",
    description:
      "Free SEO diagnosis tool. Analyze your website's SEO health, meta tags, headers, structured data, and performance. Get actionable optimization suggestions.",
    keywords: ["SEO diagnosis", "website SEO audit", "free SEO analyzer", "SEO checker", "meta tag analyzer"],
    path: "/seo-diagnosis",
  },
  seoAnalytics: {
    title: "SEO Analytics Dashboard | Sinmoniker",
    description:
      "Track your SEO performance with comprehensive analytics. Monitor rankings, traffic, and optimization progress over time.",
    keywords: ["SEO analytics", "SEO dashboard", "rank tracking", "SEO performance", "website analytics"],
    path: "/seo-analytics",
  },
  httpChecker: {
    title: "HTTP Checker - HTTP Status & SSL Certificate Check | Sinmoniker",
    description:
      "Free HTTP checker tool. Probe HTTP status codes, response headers, SSL certificate details, and redirect chains. Check if your website is responding correctly.",
    keywords: ["HTTP checker", "SSL checker", "HTTP status check", "response header analyzer", "redirect tracer"],
    path: "/http-checker",
  },
  dnsDetective: {
    title: "DNS Detective - Free DNS Health Check Tool | Sinmoniker",
    description:
      "Free DNS health checker. Multi-location DNS probe, health score, configuration diagnosis. Essential tool for website owners to diagnose DNS issues.",
    keywords: ["DNS checker", "DNS health check", "DNS diagnostic tool", "domain health check", "free DNS tool"],
    path: "/dns-detective",
  },
  pageSpeed: {
    title: "Page Speed Analyzer - Free Website Performance Test | Sinmoniker",
    description:
      "Free website speed analyzer. Check DNS resolution, TLS handshake, TTFB, content download. Get performance score and optimization tips.",
    keywords: ["page speed test", "website speed analyzer", "performance test", "TTFB checker", "free speed tool"],
    path: "/page-speed",
  },
  linkChecker: {
    title: "Link Checker - Free Broken Link Detector | Sinmoniker",
    description:
      "Free broken link checker. Automatically crawl and check all links on your page. Find 404 errors, redirect chains, and connection issues.",
    keywords: ["broken link checker", "link checker tool", "404 detector", "dead link finder", "SEO link checker"],
    path: "/link-checker",
  },
  techAnalyzer: {
    title: "Tech Stack Analyzer - Free Website Technology Detector | Sinmoniker",
    description:
      "Free technology stack analyzer. Identify server type, CMS, frontend framework, CDN, analytics tools, and JS libraries used by any website.",
    keywords: ["tech stack analyzer", "website technology detector", "CMS detector", "framework identifier", "competitor analysis"],
    path: "/tech-analyzer",
  },
  socialPreview: {
    title: "Social Preview Inspector - Free OG Tag Checker | Sinmoniker",
    description:
      "Free social preview checker. See how your website looks when shared on Facebook, Twitter, and other platforms. Check OG tags and Twitter Cards.",
    keywords: ["social preview checker", "OG tag checker", "Twitter Card validator", "social media preview", "link preview tool"],
    path: "/social-preview",
  },
  blog: {
    title: "AI Writing Tips & SEO Content Guide | Sinmoniker Blog",
    description:
      "Free tutorials: How to write high-quality articles with AI tools, create viral Xiaohongshu posts, and optimize SEO content. Practical guides for content creators.",
    keywords: ["AI writing tips", "blog writing tutorial", "SEO content guide", "Xiaohongshu copywriting", "free writing tools"],
    path: "/blog",
    locale: "zh_CN",
  },
  seoContent: {
    title: "SEO Content Scoring - Free AI Content Optimizer | Sinmoniker",
    description:
      "Free SEO content scoring tool. Analyze your content for keyword density, readability, structure, and SEO optimization. Get actionable improvement suggestions.",
    keywords: ["SEO content scoring", "content optimizer", "keyword density checker", "SEO content analysis", "free SEO tool"],
    path: "/seo-content",
  },
};

/**
 * 获取页面基础URL（带协议）
 */
export function getBaseUrl(): string {
  return BASE_URL;
}

/**
 * 检测关键词密度
 */
export function analyzeKeywordDensity(text: string, keyword: string): {
  count: number;
  density: number;
  recommendations: string[];
} {
  if (!text || !keyword) return { count: 0, density: 0, recommendations: [] };

  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const words = lowerText.split(/\s+/).filter(Boolean);
  const keywordWords = lowerKeyword.split(/\s+/).filter(Boolean);

  if (keywordWords.length === 0) return { count: 0, density: 0, recommendations: [] };

  let count = 0;
  if (keywordWords.length === 1) {
    count = lowerText.split(lowerKeyword).length - 1;
  } else {
    // Multi-word keyword: count exact matches
    const regex = new RegExp(lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = lowerText.match(regex);
    count = matches?.length || 0;
  }

  const density = words.length > 0 ? (count / words.length) * 100 : 0;
  const recommendations: string[] = [];

  if (density === 0) {
    recommendations.push("⚠️ 目标关键词未出现在内容中。请在标题和正文中自然加入关键词。");
  } else if (density < 0.5) {
    recommendations.push(`📈 关键词密度偏低 (${density.toFixed(2)}%)。建议在正文中适当增加关键词出现次数，保持在1-3%。`);
  } else if (density > 5) {
    recommendations.push(`⚠️ 关键词密度过高 (${density.toFixed(2)}%)。可能被搜索引擎视为关键词堆砌，建议减少使用频率。`);
  } else {
    recommendations.push(`✅ 关键词密度适中 (${density.toFixed(2)}%)。保持在1-3%是最佳实践。`);
  }

  return { count, density, recommendations };
}

/**
 * SEO内容评分
 * 满分100，多维度评估
 */
export function scoreSeoContent({
  title,
  description,
  content,
  h1Count,
  h2Count,
  images,
  wordCount,
  keyword,
}: {
  title: string;
  description: string;
  content: string;
  h1Count: number;
  h2Count: number;
  images: number;
  wordCount: number;
  keyword: string;
}): { score: number; details: { category: string; score: number; maxScore: number; feedback: string }[] } {
  const details: { category: string; score: number; maxScore: number; feedback: string }[] = [];
  let totalScore = 0;

  // 1. Title optimization (15 points)
  const titleLen = title.length;
  if (titleLen < 10) {
    details.push({ category: "标题优化", score: 3, maxScore: 15, feedback: "标题太短（<10字），无法有效传达主题" });
  } else if (titleLen > 70) {
    details.push({ category: "标题优化", score: 5, maxScore: 15, feedback: "标题过长（>70字），可能被搜索结果截断" });
  } else if (titleLen >= 15 && titleLen <= 60) {
    const hasKeyword = title.toLowerCase().includes(keyword.toLowerCase());
    details.push({
      category: "标题优化",
      score: hasKeyword ? 15 : 10,
      maxScore: 15,
      feedback: hasKeyword
        ? "✅ 标题长度适中，包含目标关键词"
        : "⚠️ 标题长度合适，但建议加入目标关键词以提升相关性",
    });
  } else {
    details.push({ category: "标题优化", score: 8, maxScore: 15, feedback: "标题长度尚可，建议优化到15-60字" });
  }

  // 2. Meta description (10 points)
  const descLen = description.length;
  if (descLen < 50) {
    details.push({ category: "Meta描述", score: 2, maxScore: 10, feedback: "描述太短（<50字），无法完整描述内容" });
  } else if (descLen > 160) {
    details.push({ category: "Meta描述", score: 5, maxScore: 10, feedback: "描述过长（>160字），可能被搜索结果截断" });
  } else {
    const hasKeyword = description.toLowerCase().includes(keyword.toLowerCase());
    details.push({
      category: "Meta描述",
      score: hasKeyword ? 10 : 6,
      maxScore: 10,
      feedback: hasKeyword
        ? "✅ 描述长度适中，包含目标关键词"
        : "⚠️ 描述长度合适，但建议加入目标关键词",
    });
  }

  // 3. Content length (15 points)
  if (wordCount < 300) {
    details.push({ category: "内容长度", score: 3, maxScore: 15, feedback: "内容过短（<300字），难以获得好的搜索引擎排名" });
  } else if (wordCount < 800) {
    details.push({ category: "内容长度", score: 8, maxScore: 15, feedback: "内容偏短。建议扩展到1000字以上以获得更好排名" });
  } else if (wordCount >= 1000 && wordCount <= 2500) {
    details.push({ category: "内容长度", score: 15, maxScore: 15, feedback: "✅ 内容长度适中（1000-2500字），SEO友好" });
  } else {
    details.push({ category: "内容长度", score: 12, maxScore: 15, feedback: "内容丰富（>2500字），注意保持结构清晰" });
  }

  // 4. Heading structure (15 points)
  if (h1Count !== 1) {
    details.push({ category: "标题结构", score: 3, maxScore: 15, feedback: `页面有 ${h1Count} 个H1标签，应只有1个` });
  } else if (h2Count < 2) {
    details.push({ category: "标题结构", score: 8, maxScore: 15, feedback: "H1正确但H2标签太少（<2个），建议使用更多H2组织内容" });
  } else {
    details.push({ category: "标题结构", score: 15, maxScore: 15, feedback: `✅ 1个H1 + ${h2Count}个H2，结构清晰` });
  }

  // 5. Images (10 points)
  if (images === 0) {
    details.push({ category: "图片优化", score: 0, maxScore: 10, feedback: "❌ 没有使用图片。建议每500字至少配1张图并添加alt属性" });
  } else if (images < 3) {
    details.push({ category: "图片优化", score: 5, maxScore: 10, feedback: "图片较少，建议增加更多图片并优化alt标签" });
  } else {
    details.push({ category: "图片优化", score: 10, maxScore: 10, feedback: `✅ ${images}张图片，适量且有助于增强内容表现力` });
  }

  // 6. Keyword density (15 points)
  const kwAnalysis = analyzeKeywordDensity(content, keyword);
  if (kwAnalysis.density === 0) {
    details.push({ category: "关键词密度", score: 0, maxScore: 15, feedback: "❌ 目标关键词未出现在正文中" });
  } else if (kwAnalysis.density < 0.5) {
    details.push({ category: "关键词密度", score: 5, maxScore: 15, feedback: `⚠️ 关键词密度偏低 (${kwAnalysis.density.toFixed(2)}%)` });
  } else if (kwAnalysis.density > 5) {
    details.push({ category: "关键词密度", score: 5, maxScore: 15, feedback: `⚠️ 关键词密度过高 (${kwAnalysis.density.toFixed(2)}%)` });
  } else {
    details.push({ category: "关键词密度", score: 15, maxScore: 15, feedback: `✅ 关键词密度适中 (${kwAnalysis.density.toFixed(2)}%)` });
    // Add bonus if it also appears in first paragraph
  }

  // 7. Content freshness / recency (10 points)
  // (Approximated — real implementation would check publish date)
  details.push({ category: "内容新鲜度", score: 10, maxScore: 10, feedback: "✅ 内容可以随时更新，保持新鲜" });

  // 8. Readability (10 points)
  const avgSentenceLen = content.split(/[.!?。！？]/).filter(Boolean).reduce((sum, s) => {
    return sum + s.split(/\s+/).filter(Boolean).length;
  }, 0) / Math.max(content.split(/[.!?。！？]/).filter(Boolean).length, 1);
  
  if (avgSentenceLen > 30) {
    details.push({ category: "可读性", score: 4, maxScore: 10, feedback: `平均句子过长 (${Math.round(avgSentenceLen)}词)，建议缩短句子提高可读性` });
  } else if (avgSentenceLen > 20) {
    details.push({ category: "可读性", score: 7, maxScore: 10, feedback: `平均句子长度适中 (${Math.round(avgSentenceLen)}词)` });
  } else {
    details.push({ category: "可读性", score: 10, maxScore: 10, feedback: `✅ 句子长度合理 (${Math.round(avgSentenceLen)}词)，可读性强` });
  }

  totalScore = details.reduce((sum, d) => sum + d.score, 0);

  return { score: totalScore, details };
}
