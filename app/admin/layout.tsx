// app/admin/layout.tsx — 管理后台布局（需要登录）
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // 检查登录状态
    const cookies = document.cookie.split('; ');
    const userIdCookie = cookies.find(c => c.startsWith('user_id='));
    const tokenCookie = cookies.find(c => c.startsWith('mo-yan-token='));

    if (userIdCookie || tokenCookie) {
      setIsLoggedIn(true);
      if (userIdCookie) {
        setUserId(parseInt(userIdCookie.split('=')[1]));
      }
    } else {
      // 检查 localStorage（旧版登录方式）
      try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          if (user && user.id) {
            setIsLoggedIn(true);
            setUserId(user.id);
          }
        }
      } catch {
        // ignore
      }
    }

    // 如果还没检测到登录，标记为未登录
    if (isLoggedIn === null) {
      setIsLoggedIn(false);
    }
  }, []);

  if (isLoggedIn === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isLoggedIn === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white">
        <h1 className="text-2xl font-bold mb-4">需要登录</h1>
        <p className="text-gray-400 mb-6">请先登录再访问管理后台</p>
        <Link
          href="/login"
          className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition"
        >
          去登录 →
        </Link>
      </div>
    );
  }

  const navLinks = [
    { href: '/admin/ads', label: '📢 广告管理', active: pathname === '/admin/ads' },
    { href: '/admin/analytics', label: '📊 数据分析', active: pathname === '/admin/analytics' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header */}
      <header className="bg-gray-900 text-white border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-6">
              <Link href="/" className="text-lg font-bold text-amber-400">
                Sinmoniker
              </Link>
              <span className="text-gray-500 text-sm hidden sm:inline">管理后台</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="text-sm text-gray-400 hover:text-white transition"
              >
                ← 返回网站
              </Link>
              <span className="text-xs text-gray-600">
                ID: {userId}
              </span>
            </div>
          </div>
          {/* Navigation */}
          <nav className="flex gap-1 pb-0">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`
                  px-4 py-2 text-sm font-medium rounded-t-lg transition
                  ${link.active
                    ? 'bg-white text-gray-900'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }
                `}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>
    </div>
  );
}
