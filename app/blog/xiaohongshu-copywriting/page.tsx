import type { Metadata } from "next";
import Link from "next/link";
import JsonLd, { breadcrumbLd, blogPostLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "小红书文案生成指南：AI帮你写出爆款笔记 | Sinmoniker 墨言",
  description:
    "小红书笔记怎么写才有人看？选题技巧、标题公式、正文模板、标签策略全攻略。免费AI工具一键生成小红书文案。",
  keywords: [
    "小红书文案",
    "小红书笔记怎么写",
    "爆款笔记",
    "小红书运营",
    "AI生成小红书文案",
    "小红书标题",
    "小红书标签",
  ],
  openGraph: {
    title: "小红书文案生成指南：AI帮你写出爆款笔记",
    description:
      "小红书笔记怎么写才有人看？选题技巧、标题公式、正文模板、标签策略。",
    type: "article",
    locale: "zh_CN",
    publishedTime: "2026-06-07",
  },
  twitter: {
    card: "summary_large_image",
    title: "小红书文案生成指南：AI帮你写出爆款笔记",
    description: "小红书笔记怎么写才有人看？选题技巧、标题公式、正文模板。",
  },
  alternates: {
    canonical: "/blog/xiaohongshu-copywriting",
  },
};

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://sinmoniker.com";

export default function XiaohongshuPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "首页", url: baseUrl },
          { name: "博客", url: `${baseUrl}/blog` },
          { name: "小红书文案指南", url: `${baseUrl}/blog/xiaohongshu-copywriting` },
        ])}
      />
      <JsonLd
        data={blogPostLd({
          title: "小红书文案生成指南：AI帮你写出爆款笔记",
          description: "小红书笔记怎么写才有人看？选题技巧、标题公式、正文模板、标签策略。",
          url: `${baseUrl}/blog/xiaohongshu-copywriting`,
          datePublished: "2026-06-07",
        })}
      />

      <article className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <nav className="bg-teal-900 text-white px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link href="/" className="font-bold hover:text-amber-300 transition-colors">Sinmoniker</Link>
          <Link href="/blog" className="text-teal-200 hover:text-white text-sm transition-colors">
            ← 返回博客
          </Link>
        </nav>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <p className="text-xs sm:text-sm text-gray-500 mb-6">
            <Link href="/" className="hover:text-amber-600">首页</Link>
            <span className="mx-2">/</span>
            <Link href="/blog" className="hover:text-amber-600">博客</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-700">小红书文案指南</span>
          </p>

          <h1 className="text-3xl sm:text-4xl font-bold text-teal-900 mb-4 leading-tight">
            小红书文案生成指南：AI帮你写出爆款笔记
          </h1>

          <div className="flex items-center gap-3 text-sm text-gray-500 mb-8 pb-6 border-b border-gray-200">
            <span className="bg-pink-100 text-pink-800 px-2 py-0.5 rounded-full font-medium text-xs">小红书运营</span>
            <span>2026-06-07</span>
            <span>· 6分钟阅读</span>
          </div>

          <div className="prose prose-gray max-w-none space-y-5 text-gray-700 leading-relaxed text-sm sm:text-base">
            <p className="text-lg sm:text-xl text-gray-600 font-medium">
              小红书月活用户超过3亿，但每天有数百万条笔记被发布。没有好的文案，你的笔记根本没人看到。
            </p>
            <p>
              好消息是，AI可以帮你写出高质量的笔记。用 <Link href="/writing-tool" className="text-amber-600 underline font-medium">墨言AI写作助手</Link> 选择"小红书文案"类型，输入主题就能生成完整笔记。
            </p>

            <h2 className="text-2xl font-bold mt-10 mb-4">1. 小红书爆款笔记的结构</h2>
            <p>一条优秀的小红书笔记，通常包含这几个部分：</p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="font-medium text-teal-800">✨ 爆款笔记公式：</p>
              <p className="mt-1">吸引人的标题 + 抓人的开头 + 干货正文 + 引导结尾 + 精准标签</p>
            </div>

            <h2 className="text-2xl font-bold mt-10 mb-4">2. 标题公式（收藏这5种）</h2>
            <ul className="list-disc pl-5 space-y-3">
              <li><strong>数字型</strong>："一周见效的5个减肥方法"、"月入过万的3个副业"</li>
              <li><strong>痛点型</strong>："皮肤差到不敢素颜？这些方法真的有效"</li>
              <li><strong>对比型</strong>："用了10款粉底液后，我只推荐这2款"</li>
              <li><strong>教程型</strong>："手把手教你做XXX，新手也能学会"</li>
              <li><strong>情绪型</strong>："后悔没早知道的10个生活技巧！"</li>
            </ul>

            <h2 className="text-2xl font-bold mt-10 mb-4">3. 正文写作模板</h2>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="font-medium text-teal-800">📱 正文结构：</p>
              <ol className="list-decimal pl-5 mt-2 space-y-2">
                <li><strong>开头（1-2句）</strong> — 制造共鸣或勾起好奇心</li>
                <li><strong>背景（2-3句）</strong> — 你的经历或为什么要做这件事</li>
                <li><strong>干货（核心）</strong> — 分点列出方法和技巧，每点配一句解释</li>
                <li><strong>结尾</strong> — 互动引导："你觉得呢？评论区告诉我"</li>
              </ol>
            </div>

            <h2 className="text-2xl font-bold mt-10 mb-4">4. 标签策略</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>大标签（100万+笔记）：#护肤 #减肥 — 流量大但竞争激烈</li>
              <li>中标签（10万+笔记）：#平价护肤 #一周减肥 — 均衡</li>
              <li>小标签（1万+笔记）：#干皮敏感肌 #学生党减肥 — 精准，转化高</li>
              <li><strong>策略：2个大标签 + 3个中标签 + 3个小标签</strong></li>
            </ul>

            <h2 className="text-2xl font-bold mt-10 mb-4">5. 用AI生成小红书文案的技巧</h2>
            <p>使用 <Link href="/writing-tool" className="text-amber-600 underline font-medium">墨言AI写作助手</Link> 时，选择"小红书文案"类型，输入主题和关键词，AI就能自动生成完整的笔记。</p>
            <p>你可以进一步要求AI：</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>"更口语化一些"</li>
              <li>"加入更多emoji"</li>
              <li>"多写几个备选标题"</li>
              <li>"这部分改得更生动"</li>
            </ul>

            <div className="bg-gradient-to-r from-pink-50 to-amber-50 rounded-xl border border-pink-100 p-6 mt-8 text-center">
              <p className="text-lg font-bold text-teal-900 mb-2">
                用AI生成小红书文案
              </p>
              <p className="text-sm text-gray-600 mb-4">
                输入主题，一键生成完整笔记
              </p>
              <Link
                href="/writing-tool"
                className="inline-block bg-teal-600 hover:bg-teal-700 text-white font-medium px-6 py-3 rounded-lg transition-colors"
              >
                免费使用 →
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
