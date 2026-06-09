// Dynamic Sitemap — SEO优化：自动包含所有公开页面和博客文章
// 支持 changeFrequency 和 priority 策略

import { MetadataRoute } from "next";
import { getPublishedPosts } from "@/models/BlogPost.js";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://sinmoniker.com";

// ======== 核心页面定义（手动维护，保证SEO关键页面永远在sitemap中） ========
const CORE_PAGES: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1.0, freq: "weekly" },
  { path: "/login", priority: 0.5, freq: "monthly" },
  { path: "/pricing", priority: 0.9, freq: "weekly" },
  { path: "/blog", priority: 0.8, freq: "daily" },
  { path: "/writing-tool", priority: 0.9, freq: "weekly" },
  { path: "/title-generator", priority: 0.9, freq: "weekly" },
  { path: "/blog-generator", priority: 0.9, freq: "weekly" },
  { path: "/keyword-research", priority: 0.8, freq: "daily" },
  { path: "/seo-diagnosis", priority: 0.8, freq: "daily" },
  { path: "/seo-diagnosis/batch", priority: 0.7, freq: "daily" },
  { path: "/seo-analytics", priority: 0.8, freq: "daily" },
  { path: "/scheduler", priority: 0.7, freq: "weekly" },
  { path: "/data-browser", priority: 0.6, freq: "weekly" },
  { path: "/http-checker", priority: 0.7, freq: "daily" },
  { path: "/link-checker", priority: 0.7, freq: "daily" },
  { path: "/dashboard", priority: 0.4, freq: "monthly" },
  { path: "/dns-detective", priority: 0.7, freq: "daily" },
  { path: "/page-speed", priority: 0.8, freq: "daily" },
  { path: "/tech-analyzer", priority: 0.7, freq: "daily" },
  { path: "/social-preview", priority: 0.7, freq: "daily" },
  { path: "/content-analyzer", priority: 0.7, freq: "daily" },
  { path: "/blog/ai-writing-tips", priority: 0.6, freq: "monthly" },
  { path: "/blog/xiaohongshu-copywriting", priority: 0.6, freq: "monthly" },
  { path: "/blog/seo-content-writing", priority: 0.6, freq: "monthly" },
  { path: "/search", priority: 0.5, freq: "monthly" },
  { path: "/seo-content", priority: 0.7, freq: "daily" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = CORE_PAGES.map((page) => ({
    url: `${BASE_URL}${page.path}`,
    lastModified: new Date(),
    changeFrequency: page.freq,
    priority: page.priority,
  }));

  // ======== 动态博客文章（从数据库读取已发布的文章） ========
  try {
    const posts = await getPublishedPosts({ limit: 500, offset: 0 });
    for (const post of posts) {
      entries.push({
        url: `${BASE_URL}/blog/${post.slug}`,
        lastModified: post.updated_at || post.published_at || new Date(),
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  } catch (err) {
    // DB not available? Skip dynamic posts, core pages are enough
    console.warn("[Sitemap] Could not fetch blog posts:", err);
  }

  return entries;
}
