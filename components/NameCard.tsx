// components/NameCard.tsx
'use client';

import PronounceButton from './PronounceButton';

interface NameData {
  chineseName: string;
  nickname: string;
  meaningCn: string;
  meaningEn: string;
  pinyin: string;
}

interface NameCardProps {
  name: NameData;
  index: number;
}

export default function NameCard({ name, index }: NameCardProps) {
  return (
    <div
      className="relative bg-white rounded-xl border border-teal-100 shadow-md overflow-hidden 
        hover:shadow-lg transition-shadow duration-200"
    >
      {/* Decorative top accent */}
      <div className="h-1.5 bg-gradient-to-r from-teal-600 via-amber-500 to-teal-600" />

      <div className="p-5">
        {/* Option number */}
        <div className="text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
          Option {index + 1}
        </div>

        {/* Chinese name */}
        <h3 className="text-2xl font-bold text-teal-900 mb-0.5 tracking-wider">
          {name.chineseName}
        </h3>

        {/* Pinyin */}
        <p className="text-sm text-gray-500 italic mb-2">{name.pinyin}</p>

        {/* Nickname */}
        {name.nickname && (
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              小名
            </span>
            <span className="text-base font-medium text-amber-800">{name.nickname}</span>
            <PronounceButton name={name.nickname} />
          </div>
        )}

        {/* Pronounce full name button */}
        <div className="mb-3">
          <PronounceButton name={name.chineseName} pinyin={name.pinyin} />
        </div>

        {/* Divider */}
        <div className="border-t border-teal-50 my-3" />

        {/* Meanings */}
        <div className="space-y-2">
          <div>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Meaning</span>
            <p className="text-sm text-gray-700 mt-0.5 leading-relaxed">{name.meaningEn}</p>
          </div>
          <div>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">寓意</span>
            <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{name.meaningCn}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
