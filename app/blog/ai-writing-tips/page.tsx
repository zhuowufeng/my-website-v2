import type { Metadata } from "next";
import Link from "next/link";
import JsonLd, { breadcrumbLd, blogPostLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "AI写作入门：如何用AI工具快速写出高质量文章 | Sinmoniker 墨言",
  description:
    "掌握AI写作的核心技巧：Prompt工程、文章结构优化、风格控制。适合博客作者、自媒体运营和SEO内容创作者。免费使用墨言AI写作助手。",
  keywords: [
    "AI写作",
    "AI写作技巧",
    "Prompt工程",
    "AI写作入门教程",
    "如何用AI写文章",
    "免费AI写作工具",
    "墨言",
  ],
  openGraph: {
    title: "AI写作入门：如何用AI工具快速写出高质量文章",
    description:
      "掌握AI写作的核心技巧，从Prompt工程到文章结构优化。",
    type: "article",
    locale: "zh_CN",
    siteName: "Sinmoniker - 墨言",
    publishedTime: "2026-06-07",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI写作入门：如何用AI工具快速写出高质量文章",
    description:
      "掌握AI写作的核心技巧，从Prompt工程到文章结构优化。",
  },
  alternates: {
    canonical: "/blog/ai-writing-tips",
  },
};

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://sinmoniker.com";

export default function AiWritingTipsPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "首页", url: baseUrl },
          { name: "博客", url: `${baseUrl}/blog` },
          { name: "AI写作入门教程", url: `${baseUrl}/blog/ai-writing-tips` },
        ])}
      />
      <JsonLd
        data={blogPostLd({
          title: "AI写作入门：如何用AI工具快速写出高质量文章",
          description:
            "掌握AI写作的核心技巧，从Prompt工程到文章结构优化。",
          url: `${baseUrl}/blog/ai-writing-tips`,
          datePublished: "2026-06-07",
        })}
      />

      <article className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        {/* Navigation */}
        <nav className="bg-teal-900 text-white px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link href="/" className="font-bold hover:text-amber-300 transition-colors">
            Sinmoniker
          </Link>
          <Link href="/blog" className="text-teal-200 hover:text-white text-sm transition-colors">
            ← 返回博客
          </Link>
        </nav>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          {/* Breadcrumb JSON-LD already above */}
          <p className="text-xs sm:text-sm text-gray-500 mb-6">
            <Link href="/" className="hover:text-amber-600">首页</Link>
            <span className="mx-2">/</span>
            <Link href="/blog" className="hover:text-amber-600">博客</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-700">AI写作入门</span>
          </p>

          <h1 className="text-3xl sm:text-4xl font-bold text-teal-900 mb-4 leading-tight">
            AI写作入门：如何用AI工具快速写出高质量文章
          </h1>

          <div className="flex items-center gap-3 text-sm text-gray-500 mb-8 pb-6 border-b border-gray-200">
            <span className="bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full font-medium text-xs">
              AI写作教程
            </span>
            <span>2026-06-07</span>
            <span>· 8分钟阅读</span>
          </div>

          <div className="prose prose-gray prose-headings:text-teal-900 prose-a:text-amber-600 max-w-none space-y-5 text-gray-700 leading-relaxed text-sm sm:text-base">
            <p className="text-lg sm:text-xl text-gray-600 font-medium">
              你是不是也有这样的困扰：想写文章但不知道从哪下笔？写出来总觉得不对劲？花了一下午只憋出三段话？
            </p>
            <p>
              别担心，AI写作工具可以帮你解决这些问题。但很多人用AI写作时，直接输入"帮我写一篇文章"就指望AI能一次搞定——结果往往不尽人意。
            </p>
            <p>
              这篇文章会教你如何用好AI写作工具，写出真正高质量的文章。如果你还没试过AI写作，可以先用 <Link href="/writing-tool" className="text-amber-600 hover:text-amber-700 underline font-medium">墨言AI写作助手</Link> 免费体验。
            </p>

            <h2 className="text-2xl font-bold mt-10 mb-4">1. 写好Prompt，AI才能出好活</h2>
            <p>Prompt就是你给AI的指令。好的Prompt = 好的输出。这里有三个关键技巧：</p>
            <h3 className="text-xl font-semibold mt-6 mb-2">技巧一：给AI明确角色</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm">
              <p className="font-medium text-teal-800">❌ 不好的Prompt：</p>
              <p className="text-gray-600 mb-3">"帮我写一篇关于减肥的文章"</p>
              <p className="font-medium text-teal-800">✅ 好的Prompt：</p>
              <p className="text-gray-600">"你是一位资深健身教练和营养师，请为25-35岁的上班族写一篇关于科学减肥的科普文章。要求：800字左右，有数据支撑，语言轻松易懂。"</p>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-2">技巧二：指定输出格式</h3>
            <p>告诉AI你想要的格式。比如：博客文章要有引言、正文分段、总结；小红书文案要有标题、正文、标签。</p>

            <h3 className="text-xl font-semibold mt-6 mb-2">技巧三：一步一步引导</h3>
            <p>不要指望AI一步到位。先让它写大纲，你确认后再写正文。不满意就让AI修改某一段。</p>

            <h2 className="text-2xl font-bold mt-10 mb-4">2. 4种常见文章类型的AI写作方法</h2>

            <h3 className="text-xl font-semibold mt-6 mb-2">📝 博客文章</h3>
            <p>博客文章需要结构清晰、信息量大。用AI写博客时，重点在于：<strong>明确目标读者</strong>、<strong>列出关键要点</strong>、<strong>要求加入例证</strong>。</p>

            <h3 className="text-xl font-semibold mt-6 mb-2">📱 小红书文案</h3>
            <p>小红书用户喜欢真实、接地气的内容。用AI写小红书文案的关键：<strong>口语化表达</strong>、<strong>开头要有吸引力</strong>、<strong>多用emoji</strong>、<strong>结尾加上引导互动的话</strong>。</p>

            <h3 className="text-xl font-semibold mt-6 mb-2">🔍 SEO文章</h3>
            <p>SEO文章是为搜索引擎优化而写的。要点：<strong>自然融入关键词</strong>、<strong>H1-H3标题层级</strong>、<strong>1500字以上</strong>、<strong>内链外链</strong>。</p>

            <h3 className="text-xl font-semibold mt-6 mb-2">🏷️ 产品介绍</h3>
            <p>产品介绍要突出卖点、解决痛点。格式：痛点描述 → 产品方案 → 核心功能 → 案例 → 行动号召。</p>

            <h2 className="text-2xl font-bold mt-10 mb-4">3. AI写作常见误区</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>误区一：完全依赖AI</strong> — AI写出来的内容需要你审核修改，别直接复制粘贴</li>
              <li><strong>误区二：一次到位</strong> — 好的文章往往是多次迭代改出来的</li>
              <li><strong>误区三：忽略事实核查</strong> — AI可能编造数据，重要信息要自己核实</li>
              <li><strong>误区四：没有个性化</strong> — 加入自己的经历和见解，文章才有灵魂</li>
            </ul>

            <h2 className="text-2xl font-bold mt-10 mb-4">4. 常用AI写作工具推荐</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong><Link href="/writing-tool" className="text-amber-600 underline">墨言AI写作助手</Link></strong> — 免费，支持4种文章类型，流式输出
              </li>
              <li>
                <strong>ChatGPT</strong> — 通用能力强，但需要翻墙
              </li>
              <li>
                <strong>Claude</strong> — 写作质量高，适合长文
              </li>
              <li>
                <strong>通义千问</strong> — 国产免费，中文能力强
              </li>
            </ul>

            <h2 className="text-2xl font-bold mt-10 mb-4">总结</h2>
            <p>
              AI写作不是万能药，但它能帮你省下80%的创作时间。用好Prompt技巧，掌握不同文章类型的写作方法，你就是AI写作高手。
            </p>
            <div className="bg-gradient-to-r from-teal-50 to-amber-50 rounded-xl border border-teal-100 p-6 mt-8 text-center">
              <p className="text-lg font-bold text-teal-900 mb-2">
                现在就试试AI写作
              </p>
              <p className="text-sm text-gray-600 mb-4">
                输入主题，AI自动生成，支持博客/小红书/SEO/产品介绍
              </p>
              <Link
                href="/writing-tool"
                className="inline-block bg-teal-600 hover:bg-teal-700 text-white font-medium px-6 py-3 rounded-lg transition-colors"
              >
                免费使用墨言 →
              </Link>
            </div>
          </div>
        </div>

        <footer className="bg-teal-900 text-teal-300 text-xs px-4 sm:px-6 py-4 text-center">
          <p>© 2026 Sinmoniker — <Link href="/" className="hover:text-white">中文名生成</Link> · <Link href="/writing-tool" className="hover:text-white">AI写作助手</Link> · <Link href="/blog" className="hover:text-white">博客</Link></p>
        </footer>
      </article>
    </>
  );
}
