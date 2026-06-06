// app/page.tsx — Sinmoniker Landing Page
'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

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
    <div className="flex-1 flex flex-col">
      {/* Navigation */}
      <nav className="bg-teal-900/95 backdrop-blur-sm text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold">Sinmoniker</span>
          <span className="text-teal-300 text-xs">中文名生成器</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/writing-tool"
            className="text-teal-200 hover:text-white text-sm hidden sm:inline transition-colors"
          >
            ✍️ AI文章助手
          </Link>
          <Link
            href="/login"
            className="px-5 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 
              text-white text-sm font-medium rounded-full transition-colors"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-16 bg-gradient-to-b from-cream via-cream to-white text-center">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-teal-900 mb-4 leading-tight">
            Find Your
            <span className="block text-amber-600">Chinese Name</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-lg mx-auto leading-relaxed">
            Discover a beautiful Chinese name that reflects your personality. 
            Each name comes with its meaning, pronunciation, and a cute nickname.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link
              href="/login"
              className="px-8 py-3.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 
                text-white font-medium rounded-lg text-lg transition-colors shadow-lg shadow-amber-600/20"
            >
              Get Your Chinese Name ✨
            </Link>
          </div>

          {/* Live Example */}
          <div className="bg-white rounded-xl border border-teal-100 shadow-md p-6 max-w-sm mx-auto transition-all duration-500">
            <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider font-medium">
              Example for <span className="text-amber-600 font-bold">{example.english}</span>
            </p>
            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="text-3xl font-bold text-teal-900">{example.chinese}</span>
              <span className="text-amber-600 text-lg font-medium">({example.nickname})</span>
            </div>
            <p className="text-sm text-gray-500 italic">{example.meaning}</p>
            <div className="mt-4 flex justify-center gap-2">
              {EXAMPLE_NAMES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentExample(i)}
                  className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                    i === currentExample ? 'bg-teal-600 w-4' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* AI Writing Tool Promo */}
      <section className="bg-gradient-to-r from-teal-50 to-amber-50 px-6 py-12 border-t border-teal-100">
        <div className="max-w-3xl mx-auto text-center">
          <span className="text-3xl mb-2 block">✍️</span>
          <h2 className="text-2xl font-bold text-teal-900 mb-3">
            新功能：AI文章助手
          </h2>
          <p className="text-gray-600 mb-4">
            输入主题，AI自动生成博客文章、小红书文案、SEO内容、产品介绍。
            写网站内容再也不用愁。
          </p>
          <Link
            href="/writing-tool"
            className="inline-block px-6 py-3 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 
              text-white font-medium rounded-lg transition-colors shadow-md"
          >
            免费使用 →
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white px-6 py-16 border-t border-teal-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-teal-900 text-center mb-10">
            How It Works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="text-center p-6">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">✏️</span>
              </div>
              <h3 className="font-bold text-teal-800 mb-2">1. Enter Your Name</h3>
              <p className="text-sm text-gray-500">Type your English name and choose your gender preference.</p>
            </div>
            <div className="text-center p-6">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔮</span>
              </div>
              <h3 className="font-bold text-teal-800 mb-2">2. AI Generates</h3>
              <p className="text-sm text-gray-500">Our AI creates 3 unique Chinese names with beautiful meanings.</p>
            </div>
            <div className="text-center p-6">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🎉</span>
              </div>
              <h3 className="font-bold text-teal-800 mb-2">3. Pick Your Favorite</h3>
              <p className="text-sm text-gray-500">Listen to pronunciation, learn the meaning, and share with friends!</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-teal-900 text-teal-300 text-xs px-6 py-4 text-center">
        <p>© 2026 Sinmoniker — Discover your Chinese name</p>
      </footer>
    </div>
  );
}
