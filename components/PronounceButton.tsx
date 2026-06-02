// components/PronounceButton.tsx
'use client';

import { useState } from 'react';

interface PronounceButtonProps {
  name: string;
  pinyin?: string;
}

export default function PronounceButton({ name, pinyin }: PronounceButtonProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = () => {
    if (isPlaying) return;

    setIsPlaying(true);

    try {
      const utterance = new SpeechSynthesisUtterance(name);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.9;
      utterance.pitch = 1.1;

      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);

      window.speechSynthesis.speak(utterance);
    } catch {
      setIsPlaying(false);
    }
  };

  return (
    <button
      onClick={handlePlay}
      disabled={isPlaying}
      title={pinyin ? `Listen to pronunciation (${pinyin})` : 'Listen to pronunciation'}
      className="inline-flex items-center gap-1 px-2 py-1 text-sm rounded-full 
        bg-amber-100 hover:bg-amber-200 active:bg-amber-300 
        text-amber-800 transition-colors disabled:opacity-50 cursor-pointer"
    >
      {isPlaying ? (
        <svg className="w-4 h-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.25L18.75 18.75M18.75 5.25L5.25 18.75" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
        </svg>
      )}
      <span>{isPlaying ? 'Playing...' : '🔊 Listen'}</span>
    </button>
  );
}
