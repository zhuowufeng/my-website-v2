/**
 * 竞争对手快速对比页 — /competitor-analyzer/compare?urls=site1.com,site2.com,site3.com
 * 支持从 URL 参数直接加载对比
 */

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function CompareContent() {
  const searchParams = useSearchParams();
  const [redirected, setRedirected] = useState(false);

  useEffect(() => {
    const urlsParam = searchParams.get('urls');
    if (urlsParam && !redirected) {
      setRedirected(true);
      window.location.href = `/competitor-analyzer?compare=${encodeURIComponent(urlsParam)}`;
    }
  }, [searchParams, redirected]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4 animate-spin inline-block">🔄</div>
        <p className="text-slate-500">正在打开对比分析...</p>
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-spin inline-block">🔄</div>
          <p className="text-slate-500">加载中...</p>
        </div>
      </div>
    }>
      <CompareContent />
    </Suspense>
  );
}
