// app/page.tsx — Sinmoniker Landing Page
'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import AdBanner from '@/components/AdBanner';

const EXAMPLE_NAMES = [
  { english: 'Michael', chinese: '李明华', nickname: '小华', meaning: 'Bright wisdom & outstanding talent' },
  { english: 'Sarah', chinese: '林思悦', nickname: '悦悦', meaning: 'Thoughtful & joyful' },
  { english: 'David', chinese: '王志远', nickname: '远远', meaning: 'Ambitious & far-reaching' },
];

export default function LandingPage() {
  const [currentExample, setCurrentExample] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentExample((prev) => (prev + 1) % EXAMPLE_NAMES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const example = EXAMPLE_NAMES[currentExample];

  return (
    <div className="flex-1 flex flex-col animate-fade-in">
      {/* Navigation */}
      <nav className="bg-teal-900/95 backdrop-blur-sm text-white px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <span className="text-lg sm:text-xl font-bold shrink-0">Sinmoniker</span>
          <span className="text-teal-300 text-[10px] sm:text-xs hidden sm:inline">中文名生成器</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/blog-generator"
            className="text-teal-200 hover:text-white text-xs sm:text-sm hidden sm:inline transition-colors"
          >
            📝 博客生成
          </Link>
          <Link
            href="/title-generator"
            className="text-teal-200 hover:text-white text-xs sm:text-sm hidden sm:inline transition-colors"
          >
            🏷️ 标题生成
          </Link>
          <Link
            href="/writing-tool"
            className="text-teal-200 hover:text-white text-xs sm:text-sm hidden sm:inline transition-colors"
          >
            ✍️ AI文章助手
          </Link>
          <Link
            href="/blog"
            className="text-teal-200 hover:text-white text-xs sm:text-sm hidden sm:inline transition-colors"
          >
            📖 博客
          </Link>
          <Link href="/login" className="px-3 sm:px-4 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs sm:text-sm font-medium rounded-full transition-colors whitespace-nowrap">
            Get Started
          </Link>
          <Link href="/pricing" className="px-3 sm:px-4 py-2 border border-amber-400/50 text-amber-300 hover:text-white hover:border-amber-300 text-xs sm:text-sm font-medium rounded-full transition-colors whitespace-nowrap">
            ⭐ Pricing
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12 sm:py-16 bg-gradient-to-b from-cream via-cream to-white text-center">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold text-teal-900 leading-tight mb-3 sm:mb-4">
            Find Your
            <span className="block text-amber-600">Chinese Name</span>
          </h1>
          <p className="text-sm sm:text-base text-gray-600 leading-relaxed mb-6 sm:mb-8 max-w-lg mx-auto px-2">
            Discover a beautiful Chinese name that reflects your personality. 
            Each name comes with its meaning, pronunciation, and a cute nickname.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-10 sm:mb-12">
            <Link
              href="/login"
              className="bg-amber-600 hover:bg-amber-700 active:bg-amber-800 active:scale-[0.97] text-white font-medium rounded-lg transition-all duration-150 ease-out shadow-sm cursor-pointer w-full sm:w-auto px-6 sm:px-8 py-3.5 text-base sm:text-lg shadow-lg shadow-amber-600/20 text-center"
            >
              Get Your Chinese Name ✨
            </Link>
          </div>

          {/* Live Example */}
          <div className="bg-white rounded-xl border border-teal-100 shadow-sm p-4 sm:p-6 max-w-sm mx-auto transition-all duration-200">
            <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider font-medium">
              Example for <span className="text-amber-600 font-bold">{example.english}</span>
            </p>
            <div className="flex items-center justify-center gap-3 mb-2" key={currentExample}>
              <span className="text-3xl font-bold text-teal-900 animate-fade-in">{example.chinese}</span>
              <span className="text-amber-600 text-lg font-medium animate-fade-in animation-delay-100">({example.nickname})</span>
            </div>
            <p className="text-sm text-gray-500 italic" key={`meaning-${currentExample}`}>
              <span className="animate-fade-in">{example.meaning}</span>
            </p>
            <div className="mt-4 flex justify-center gap-2">
              {EXAMPLE_NAMES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentExample(i)}
                  className={`w-2 h-2 rounded-full transition-all duration-200 cursor-pointer ${
                    i === currentExample ? 'bg-teal-600 w-4' : 'bg-gray-300 hover:bg-gray-400'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Ad Banner */}
      <AdBanner position="bottom" source="seo" />

      {/* Blog Link */}
      <section className="bg-teal-50 px-4 sm:px-6 py-8 sm:py-10 border-t border-teal-100">
        <div className="max-w-3xl mx-auto text-center">
          <span className="text-2xl sm:text-3xl mb-1 sm:mb-2 block">📖</span>
          <h2 className="text-xl sm:text-2xl font-bold text-teal-900 mb-2 sm:mb-3">
            学习AI写作 & SEO优化技巧
          </h2>
          <p className="text-sm sm:text-base text-gray-600 leading-relaxed mb-4 px-2">
            免费教程：如何用AI工具写出高质量文章、小红书爆款笔记、SEO内容。
          </p>
          <Link
            href="/blog"
            className="bg-teal-600 hover:bg-teal-700 active:bg-teal-800 active:scale-[0.97] text-white font-medium rounded-lg transition-all duration-150 ease-out shadow-sm cursor-pointer inline-block w-full sm:w-auto px-6 py-3 text-sm sm:text-base text-center"
          >
            浏览博客文章 →
          </Link>
        </div>
      </section>

      {/* Blog Generator Promo */}
      <section className="bg-gradient-to-r from-teal-50 to-cyan-50 px-4 sm:px-6 py-10 sm:py-12 border-t border-teal-100">
        <div className="max-w-3xl mx-auto text-center">
          <span className="text-2xl sm:text-3xl mb-1 sm:mb-2 block">📝</span>
          <h2 className="text-xl sm:text-2xl font-bold text-teal-900 mb-2 sm:mb-3">
            新功能：文序 — AI博客文章生成器
          </h2>
          <p className="text-sm sm:text-base text-gray-600 leading-relaxed mb-4 px-2">
            输入主题，5种风格（教程/清单/分析/故事/观点）一键生成高质量博客文章。
            内含SEO元数据、关键词优化，写完直接发布。
          </p>
          <Link
            href="/blog-generator"
            className="bg-teal-600 hover:bg-teal-700 active:bg-teal-800 active:scale-[0.97] text-white font-medium rounded-lg transition-all duration-150 ease-out shadow-sm cursor-pointer inline-block w-full sm:w-auto px-6 py-3 text-sm sm:text-base text-center"
          >
            免费使用 →
          </Link>
        </div>
      </section>

      {/* AI Writing Tool Promo */}
      <section className="bg-gradient-to-r from-teal-50 to-amber-50 px-4 sm:px-6 py-10 sm:py-12 border-t border-teal-100">
        <div className="max-w-3xl mx-auto text-center">
          <span className="text-2xl sm:text-3xl mb-1 sm:mb-2 block">✍️</span>
          <h2 className="text-xl sm:text-2xl font-bold text-teal-900 mb-2 sm:mb-3">
            新功能：AI文章助手
          </h2>
          <p className="text-sm sm:text-base text-gray-600 leading-relaxed mb-4 px-2">
            输入主题，AI自动生成博客文章、小红书文案、SEO内容、产品介绍。
            写网站内容再也不用愁。
          </p>
          <Link
            href="/writing-tool"
            className="bg-teal-600 hover:bg-teal-700 active:bg-teal-800 active:scale-[0.97] text-white font-medium rounded-lg transition-all duration-150 ease-out shadow-sm cursor-pointer inline-block w-full sm:w-auto px-6 py-3 text-sm sm:text-base text-center"
          >
            免费使用 →
          </Link>
        </div>
      </section>

      {/* Title Generator Promo */}
      <section className="bg-gradient-to-r from-amber-50 to-teal-50 px-4 sm:px-6 py-10 sm:py-12 border-t border-teal-100">
        <div className="max-w-3xl mx-auto text-center">
          <span className="text-2xl sm:text-3xl mb-1 sm:mb-2 block">🏷️</span>
          <h2 className="text-xl sm:text-2xl font-bold text-teal-900 mb-2 sm:mb-3">
            新功能：AI标题生成器
          </h2>
          <p className="text-sm sm:text-base text-gray-600 leading-relaxed mb-4 px-2">
            输入主题，AI自动生成高点击率标题。博客、小红书、SEO、营销，四种风格一键切换。
          </p>
          <Link
            href="/title-generator"
            className="bg-teal-600 hover:bg-teal-700 active:bg-teal-800 active:scale-[0.97] text-white font-medium rounded-lg transition-all duration-150 ease-out shadow-sm cursor-pointer inline-block w-full sm:w-auto px-6 py-3 text-sm sm:text-base text-center"
          >
            免费生成 →
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white px-4 sm:px-6 py-12 sm:py-16 border-t border-teal-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl sm:text-2xl font-bold text-teal-900 text-center mb-8 sm:mb-10">
            How It Works
          </h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4 sm:gap-6">
            <div className="text-center bg-white rounded-xl border border-teal-100 shadow-sm p-4 sm:p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ease-out">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-200">
                <span className="text-2xl">✏️</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-teal-800 mb-2">1. Enter Your Name</h3>
              <p className="text-sm text-gray-500">Type your English name and choose your gender preference.</p>
            </div>
            <div className="text-center bg-white rounded-xl border border-teal-100 shadow-sm p-4 sm:p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ease-out animate-fade-in-up-delay-1">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔮</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-teal-800 mb-2">2. AI Generates</h3>
              <p className="text-sm text-gray-500">Our AI creates 3 unique Chinese names with beautiful meanings.</p>
            </div>
            <div className="text-center bg-white rounded-xl border border-teal-100 shadow-sm p-4 sm:p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ease-out animate-fade-in-up-delay-2">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🎉</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-teal-800 mb-2">3. Pick Your Favorite</h3>
              <p className="text-sm text-gray-500">Listen to pronunciation, learn the meaning, and share with friends!</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-teal-900 text-teal-300 text-[10px] sm:text-xs px-4 sm:px-6 py-3 sm:py-4 text-center">
        <p>© 2026 Sinmoniker — <Link href="/" className="hover:text-white">中文名生成</Link> · <Link href="/title-generator" className="hover:text-white">AI标题生成</Link> · <Link href="/writing-tool" className="hover:text-white">AI写作助手</Link> · <Link href="/blog" className="hover:text-white">博客</Link></p>
      </footer>
    </div>
  );
}
