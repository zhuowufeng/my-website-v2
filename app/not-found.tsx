import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "404 - 页面未找到 | Sinmoniker",
  description: "抱歉，您访问的页面不存在。返回首页或试试其他页面。",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-white px-4 text-center">
      <span className="text-6xl sm:text-8xl mb-4">🔍</span>
      <h1 className="text-3xl sm:text-5xl font-bold text-teal-900 mb-3">
        404 — 页面走丢了
      </h1>
      <p className="text-gray-600 text-base sm:text-lg max-w-md mb-8">
        抱歉，你要找的页面不存在。可能被移动了，或者链接有误。
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/"
          className="bg-teal-600 hover:bg-teal-700 text-white font-medium px-6 py-3 rounded-lg transition-colors"
        >
          返回首页
        </Link>
        <Link
          href="/writing-tool"
          className="bg-amber-600 hover:bg-amber-700 text-white font-medium px-6 py-3 rounded-lg transition-colors"
        >
          试试AI写作工具
        </Link>
        <Link
          href="/blog"
          className="bg-white border border-gray-300 hover:border-teal-400 text-gray-700 font-medium px-6 py-3 rounded-lg transition-colors"
        >
          浏览博客
        </Link>
      </div>
    </div>
  );
}
