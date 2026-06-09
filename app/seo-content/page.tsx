// SEO Content Scoring Tool — 关键词密度分析 & SEO内容评分
// Module 3 learning: 关键词策略与内容优化实践

'use client';

import { useState } from 'react';
import { analyzeKeywordDensity, scoreSeoContent } from '@/lib/seo';
import JsonLd, { siteNavigationLd, breadcrumbLd, softwareAppLd } from '@/components/JsonLd';

export default function SeoContentPage() {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [keyword, setKeyword] = useState('');
  const [description, setDescription] = useState('');
  const [results, setResults] = useState<{
    density: { count: number; density: number; recommendations: string[] };
    scoring: { score: number; details: { category: string; score: number; maxScore: number; feedback: string }[] } | null;
  } | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const analyze = () => {
    if (!content.trim() || !keyword.trim()) return;
    const density = analyzeKeywordDensity(content, keyword);
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const h1Count = (content.match(/^# .+/gm) || []).length;
    const h2Count = (content.match(/^## .+/gm) || []).length;
    const images = (content.match(/!\[.*?\]\(.*?\)/g) || []).length;

    const scoring = scoreSeoContent({
      title: title || 'Untitled',
      description: description || 'No description',
      content,
      h1Count: h1Count || 1,
      h2Count,
      images,
      wordCount,
      keyword,
    });

    setResults({ density, scoring });
    setShowAnalysis(true);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-50 border-green-200';
    if (score >= 60) return 'bg-amber-50 border-amber-200';
    return 'bg-red-50 border-red-200';
  };

  return (
    <>
      <JsonLd data={siteNavigationLd()} />
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', url: process.env.NEXT_PUBLIC_BASE_URL || 'https://sinmoniker.com' },
          { name: 'SEO Content Scoring', url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://sinmoniker.com'}/seo-content` },
        ])}
      />
      <JsonLd
        data={softwareAppLd({
          name: 'SEO Content Scoring Tool',
          description: 'Free SEO content scoring tool. Analyze keyword density, readability, heading structure, and get actionable SEO improvement suggestions.',
          url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://sinmoniker.com'}/seo-content`,
        })}
      />

      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        {/* Navigation */}
        <nav className="bg-teal-900/95 backdrop-blur-sm text-white px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2" aria-label="Main navigation">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <a href="/" className="text-lg sm:text-xl font-bold shrink-0 hover:text-teal-200 transition-colors">Sinmoniker</a>
            <span className="text-teal-300 text-[10px] sm:text-xs hidden sm:inline">SEO优化工具</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <a href="/keyword-research" className="text-teal-200 hover:text-white text-xs sm:text-sm transition-colors">🔑 关键词挖掘</a>
            <a href="/seo-diagnosis" className="text-teal-200 hover:text-white text-xs sm:text-sm transition-colors">🔍 SEO诊断</a>
            <a href="/blog" className="text-teal-200 hover:text-white text-xs sm:text-sm transition-colors">📖 博客</a>
          </div>
        </nav>

        {/* Hero Section */}
        <header className="bg-gradient-to-r from-teal-600 to-teal-800 text-white px-4 sm:px-6 py-10 sm:py-14">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl sm:text-4xl font-bold mb-2">🔍 SEO Content Scoring</h1>
            <p className="text-teal-100 text-sm sm:text-base max-w-2xl">
              Paste your content and target keyword. Get a detailed SEO score with actionable improvement suggestions.
              Analyze keyword density, readability, heading structure, and more.
            </p>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Input Form */}
            <section className="lg:col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6" aria-label="Content input form">
              <h2 className="text-lg font-bold text-gray-800 mb-4">输入内容</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="seo-title" className="block text-sm font-medium text-gray-700 mb-1">
                    文章标题
                  </label>
                  <input
                    id="seo-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="输入文章标题（用于评估标题SEO优化）"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-shadow"
                    maxLength={200}
                  />
                </div>
                <div>
                  <label htmlFor="seo-keyword" className="block text-sm font-medium text-gray-700 mb-1">
                    目标关键词 <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="seo-keyword"
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="输入你想优化的关键词"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-shadow"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="seo-desc" className="block text-sm font-medium text-gray-700 mb-1">
                    Meta描述
                  </label>
                  <input
                    id="seo-desc"
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="输入Meta Description（可选）"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-shadow"
                    maxLength={200}
                  />
                </div>
                <div>
                  <label htmlFor="seo-content" className="block text-sm font-medium text-gray-700 mb-1">
                    正文内容 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="seo-content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="粘贴文章正文内容..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-shadow resize-y"
                    rows={15}
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {content.split(/\s+/).filter(Boolean).length} 个词
                  </p>
                </div>
                <button
                  onClick={analyze}
                  disabled={!content.trim() || !keyword.trim()}
                  className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg py-3 transition-colors cursor-pointer"
                >
                  🚀 分析SEO效果
                </button>
              </div>
            </section>

            {/* Results */}
            <section className="lg:col-span-2 space-y-4" aria-label="SEO analysis results">
              {!showAnalysis && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center">
                  <div className="text-4xl mb-3">📊</div>
                  <h2 className="text-lg font-bold text-gray-800 mb-2">等待分析</h2>
                  <p className="text-sm text-gray-500">
                    输入内容和关键词，点击分析按钮查看SEO评分和优化建议。
                  </p>
                </div>
              )}

              {results && showAnalysis && (
                <>
                  {/* Overall Score */}
                  <div className={`rounded-xl border shadow-sm p-4 sm:p-5 ${getScoreBg(results.scoring!.score)}`}>
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-sm font-bold text-gray-700">综合SEO评分</h2>
                      <span className={`text-3xl font-black ${getScoreColor(results.scoring!.score)}`}>
                        {results.scoring!.score}/100
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full transition-all duration-500 ${
                          results.scoring!.score >= 80 ? 'bg-green-500' : results.scoring!.score >= 60 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${results.scoring!.score}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {results.scoring!.score >= 80
                        ? '🎉 内容SEO表现优秀！'
                        : results.scoring!.score >= 60
                        ? '💡 内容SEO基础良好，有改进空间'
                        : '⚠️ 内容SEO需要较大优化'}
                    </p>
                  </div>

                  {/* Keyword Density */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5">
                    <h2 className="text-sm font-bold text-gray-700 mb-3">🔑 关键词密度</h2>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">出现次数</span>
                        <span className="font-medium">{results.density.count} 次</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">密度</span>
                        <span className={`font-medium ${results.density.density >= 0.5 && results.density.density <= 5 ? 'text-green-600' : 'text-amber-600'}`}>
                          {results.density.density.toFixed(2)}%
                        </span>
                      </div>
                      <div className="mt-2">
                        {results.density.recommendations.map((rec, i) => (
                          <p key={i} className="text-xs text-gray-600 leading-relaxed">{rec}</p>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Detail Scores */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5">
                    <h2 className="text-sm font-bold text-gray-700 mb-3">📋 详细评分</h2>
                    <div className="space-y-2">
                      {results.scoring!.details.map((detail, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs py-1.5 border-b border-gray-50 last:border-0">
                          <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                            detail.score / detail.maxScore >= 0.8 ? 'bg-green-500' :
                            detail.score / detail.maxScore >= 0.5 ? 'bg-amber-500' : 'bg-red-500'
                          }`}>
                            {Math.round((detail.score / detail.maxScore) * 100)}%
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between">
                              <span className="font-medium text-gray-700">{detail.category}</span>
                              <span className="text-gray-400">{detail.score}/{detail.maxScore}</span>
                            </div>
                            <p className="text-gray-500 mt-0.5 leading-relaxed">{detail.feedback}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>

          {/* SEO Tips Section */}
          <section className="mt-10 bg-gradient-to-r from-teal-50 to-blue-50 rounded-xl border border-teal-100 p-4 sm:p-6" aria-label="SEO optimization tips">
            <h2 className="text-lg font-bold text-teal-800 mb-4">💡 SEO内容优化最佳实践</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm border border-teal-50">
                <div className="text-lg mb-1">📝</div>
                <h3 className="text-sm font-bold text-gray-700 mb-1">标题优化</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  标题15-60字最佳，包含目标关键词放在前部。使用有吸引力的修饰语（如何、最佳、完整指南）。
                </p>
              </div>
              <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm border border-teal-50">
                <div className="text-lg mb-1">📄</div>
                <h3 className="text-sm font-bold text-gray-700 mb-1">Meta描述</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  50-160字，自然包含关键词，带行动号召（CTA），描述页面核心价值。
                </p>
              </div>
              <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm border border-teal-50">
                <div className="text-lg mb-1">🔑</div>
                <h3 className="text-sm font-bold text-gray-700 mb-1">关键词密度</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  保持在1-3%之间。在H1/H2中自然出现，首段出现关键词，避免堆砌。
                </p>
              </div>
              <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm border border-teal-50">
                <div className="text-lg mb-1">🏗️</div>
                <h3 className="text-sm font-bold text-gray-700 mb-1">标题层级</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  每页只有1个H1，H2/H3按层级使用。清晰的标题结构帮助搜索引擎理解内容组织。
                </p>
              </div>
              <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm border border-teal-50">
                <div className="text-lg mb-1">📏</div>
                <h3 className="text-sm font-bold text-gray-700 mb-1">内容长度</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  建议1000-2500单词。长篇内容（丛集覆盖）在搜索引擎中排名更好，前提是内容质量高。
                </p>
              </div>
              <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm border border-teal-50">
                <div className="text-lg mb-1">🖼️</div>
                <h3 className="text-sm font-bold text-gray-700 mb-1">图片优化</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  每500字至少1张图。使用描述性文件名和alt属性。压缩图片（WebP）减小体积。
                </p>
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="bg-teal-900 text-teal-300 text-[10px] sm:text-xs px-4 sm:px-6 py-3 sm:py-4 text-center">
          <p>
            © 2026 Sinmoniker —{' '}
            <a href="/" className="hover:text-white">中文名生成</a> ·{' '}
            <a href="/keyword-research" className="hover:text-white">关键词挖掘</a> ·{' '}
            <a href="/seo-diagnosis" className="hover:text-white">SEO诊断</a> ·{' '}
            <a href="/seo-analytics" className="hover:text-white">SEO分析</a> ·{' '}
            <a href="/blog" className="hover:text-white">博客</a>
          </p>
        </footer>
      </div>
    </>
  );
}
