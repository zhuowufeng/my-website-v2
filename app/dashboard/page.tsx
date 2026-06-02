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
    <div className="flex-1 bg-cream">
      {/* Header bar */}
      <header className="bg-teal-900 text-white px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold">Sinmoniker</h1>
          <span className="text-teal-300 text-xs">中文名生成器</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-amber-200">{user.email}</span>
          <span className="bg-teal-800 px-2 py-1 rounded text-xs">
            {remaining}/50 remaining today
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Generator form */}
        <div className="bg-white rounded-xl shadow-sm border border-teal-100 p-6 mb-8">
          <h2 className="text-xl font-bold text-teal-900 mb-1">Find Your Chinese Name</h2>
          <p className="text-sm text-gray-500 mb-5">
            Enter your English name and discover your perfect Chinese name with beautiful meanings.
          </p>

          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={englishName}
                  onChange={(e) => setEnglishName(e.target.value)}
                  placeholder="Enter your English name..."
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-gray-900"
                  maxLength={50}
                />
              </div>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className="px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-gray-700 bg-white"
              >
                <option value="any">Any gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              <button
                type="submit"
                disabled={isLoading || remaining <= 0}
                className="px-8 py-3 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 
                  text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                  whitespace-nowrap cursor-pointer"
              >
                {isLoading ? 'Generating...' : '🔮 Generate'}
              </button>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-teal-100 p-5 animate-pulse">
                <div className="h-1.5 bg-gradient-to-r from-teal-600 via-amber-500 to-teal-600 rounded-t-xl -mx-5 -mt-5 mb-4" />
                <div className="h-3 bg-gray-200 rounded w-16 mb-3" />
                <div className="h-7 bg-gray-200 rounded w-28 mb-1" />
                <div className="h-4 bg-gray-200 rounded w-20 mb-3" />
                <div className="h-4 bg-gray-200 rounded w-full mb-2" />
                <div className="h-4 bg-gray-200 rounded w-3/4" />
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {results && !isLoading && (
          <div className="mb-8">
            <h3 className="text-lg font-bold text-teal-900 mb-4">
              Your Chinese Names
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {results.map((name, i) => (
                <NameCard key={i} name={name} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div>
            <h3 className="text-lg font-bold text-teal-900 mb-4">History</h3>
            <div className="space-y-3">
              {history.map((entry: any) => (
                <details key={entry.id} className="bg-white rounded-lg border border-teal-50 p-4">
                  <summary className="cursor-pointer text-sm font-medium text-teal-800 hover:text-teal-900">
                    <span className="text-amber-600">{entry.english_name}</span>
                    {' · '}
                    <span className="text-gray-500 font-normal">
                      {new Date(entry.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </summary>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(entry.results || []).map((name: NameData, i: number) => (
                      <div key={i} className="text-sm">
                        <p className="font-bold text-teal-800">{name.chineseName}</p>
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
