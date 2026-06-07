/**
 * ShareButton — 分享功能组件
 * 支持：Web Share API (手机微信/浏览器) + 复制链接
 */

'use client';

import { useState } from 'react';

interface ShareButtonProps {
  url?: string;
  title: string;
  text?: string;
  size?: 'sm' | 'md';
}

export default function ShareButton({ url, title, text, size = 'sm' }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');

  const handleShare = async () => {
    // Try Web Share API (works on mobile, WeChat browser, etc.)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title,
          text: text || title,
          url: shareUrl,
        });
        return;
      } catch (err: any) {
        // User cancelled or API failed — fall through to copy
        if (err.name !== 'AbortError') {
          console.log('[Share] Web Share API failed, fallback to copy');
        } else {
          return; // User cancelled
        }
      }
    }

    // Fallback: copy URL to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Final fallback: select text method
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const btnSize = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';

  return (
    <button
      onClick={handleShare}
      className={`inline-flex items-center gap-1.5 rounded-lg font-medium transition-all
        ${copied
          ? 'bg-green-100 text-green-700 border border-green-300'
          : 'bg-white/80 text-gray-600 border border-gray-200 hover:bg-gray-100 hover:text-gray-800'
        } ${btnSize}`}
      title={copied ? '✅ 链接已复制' : '分享此页面'}
    >
      {copied ? (
        <>
          <span>✅</span>
          <span>已复制</span>
        </>
      ) : (
        <>
          <span>📤</span>
          <span>分享</span>
        </>
      )}
    </button>
  );
}
