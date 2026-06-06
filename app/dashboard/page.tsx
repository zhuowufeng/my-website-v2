// app/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import NameCard from '@/components/NameCard';

interface NameData {
  chineseName: string;
  nickname: string;
  meaningCn: string;
  meaningEn: string;
  pinyin: string;
}

export default function DashboardPage() {
  const [user, setUser] = useState<{ id: number; email: string; free_usage_today?: number } | null>(null);
  const [englishName, setEnglishName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'any'>('any');
  const [results, setResults] = useState<NameData[] | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(50);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      const u = JSON.parse(stored);
      setUser(u);
      setRemaining(50 - (u.free_usage_today || 0));
      fetchHistory(u.id);
    } else {
      window.location.href = '/login';
    }
  }, []);

  const fetchHistory = async (userId: number) => {
    try {
      const res = await fetch(`/api/name-history?userId=${userId}&limit=10`);
      const data = await res.json();
      if (data.history) setHistory(data.history);
    } catch {
      // Silently fail - history is non-critical
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setResults(null);

    if (!englishName.trim()) {
      setError('Please enter an English name');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/generate-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          englishName: englishName.trim(),
          gender,
          userId: user!.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        setIsLoading(false);
        return;
      }

      setResults(data.names);
      setRemaining((prev) => Math.max(prev - 1, 0));
      fetchHistory(user!.id);
    } catch {
      setError('Network error. Please try again.');
    }

    setIsLoading(false);
  };

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center bg-cream">
        <p className="text-teal-700">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-cream animate-fade-in">
      {/* Header bar */}
      <header className="bg-teal-900 text-white px-3 sm:px-6 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <h1 className="text-base sm:text-lg font-bold shrink-0">Sinmoniker</h1>
          <span className="text-teal-300 text-xs hidden sm:inline">中文名生成器</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 text-sm min-w-0">
          <span className="text-amber-200 text-xs sm:text-sm truncate max-w-[100px] sm:max-w-[200px]">
            {user.email}
          </span>
          <span className="bg-teal-800 px-2 py-1 rounded text-xs whitespace-nowrap">
            {remaining}/50
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {/* Generator form */}
        <div className="bg-white rounded-xl border border-teal-100 shadow-sm p-4 sm:p-6 mb-8 hover:shadow-md transition-shadow duration-200">
          <h2 className="text-xl font-bold text-teal-900 mb-1">Find Your Chinese Name</h2>
          <p className="text-sm sm:text-base text-gray-600 leading-relaxed mb-5">
            Enter your English name and discover your perfect Chinese name with beautiful meanings.
          </p>

          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={englishName}
                  onChange={(e) => setEnglishName(e.target.value)}
                  placeholder="Enter your English name..."
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-gray-900 bg-white"
                  maxLength={50}
                />
              </div>
              <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-3">
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                  className="w-full px-3 sm:px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-gray-700 bg-white text-sm"
                >
                  <option value="any">Any gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
                <button
                  type="submit"
                  disabled={isLoading || remaining <= 0}
                  className="bg-amber-600 hover:bg-amber-700 active:bg-amber-800 active:scale-[0.97] text-white font-medium rounded-lg transition-all duration-150 ease-out shadow-sm cursor-pointer w-full px-6 sm:px-8 py-3 whitespace-nowrap text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Generating...' : '🔮 Generate'}
                </button>
              </div>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            {remaining <= 0 && (
              <p className="text-amber-600 text-sm">
                You've reached the daily limit. Come back tomorrow!
              </p>
            )}
          </form>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 sm:gap-4 mb-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-teal-100 shadow-sm p-4 sm:p-6 animate-pulse">
                <div className="h-1.5 bg-gradient-to-r from-teal-600 via-amber-500 to-teal-600 rounded-t-xl -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-3 sm:mb-4" />
                {/* Shimmer skeleton */}
                <div className="relative overflow-hidden">
                  <div className="h-3 bg-gray-200 rounded w-16 mb-3" />
                  <div className="h-7 bg-gray-200 rounded w-28 mb-1" />
                  <div className="h-4 bg-gray-200 rounded w-20 mb-3" />
                  <div className="h-4 bg-gray-200 rounded w-full mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  {/* Shimmer overlay */}
                  <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {results && !isLoading && (
          <div className="mb-8">
            <h3 className="text-xl font-bold text-teal-900 mb-3 sm:mb-4">
              Your Chinese Names
            </h3>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 sm:gap-4">
              {results.map((name, i) => (
                <div key={i} className={`animate-fade-in-up${i > 0 ? `-delay-${Math.min(i, 3)}` : ''}`}>
                  <NameCard name={name} index={i} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div>
            <h3 className="text-xl font-bold text-teal-900 mb-3 sm:mb-4">History</h3>
            <div className="space-y-2 sm:space-y-3">
              {history.map((entry: any) => (
                <details key={entry.id} className="bg-white rounded-xl border border-teal-100 shadow-sm p-3 sm:p-4 hover:shadow-md transition-shadow duration-200">
                  <summary className="cursor-pointer text-sm font-medium text-teal-800 hover:text-teal-900 transition-colors duration-150">
                    <span className="text-amber-600 font-bold">{entry.english_name}</span>
                    {' · '}
                    <span className="text-gray-500 font-normal text-xs sm:text-sm">
                      {new Date(entry.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </summary>
                  <div className="flex flex-wrap gap-3 sm:gap-4 mt-2">
                    {(entry.results || []).map((name: NameData, i: number) => (
                      <div key={i} className="flex-1 min-w-[140px] sm:min-w-[160px] text-xs sm:text-sm">
                        <p className="font-bold text-teal-900">{name.chineseName}</p>
                        <p className="text-gray-500 italic">{name.pinyin}</p>
                        {name.nickname && (
                          <p className="text-amber-700 text-xs">小名 {name.nickname}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
