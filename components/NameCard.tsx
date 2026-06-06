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
    <div className="relative bg-white rounded-xl border border-teal-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 ease-out overflow-hidden group">
      {/* Brand accent bar */}
      <div className="h-1.5 bg-gradient-to-r from-teal-600 via-amber-500 to-teal-600 group-hover:from-amber-500 group-hover:via-teal-600 group-hover:to-amber-500 transition-all duration-500" />

      <div className="flex flex-col gap-1.5 p-4 sm:p-5">
        {/* Option number */}
        <div className="text-xs text-gray-400 uppercase tracking-wider">
          Option {index + 1}
        </div>

        {/* Chinese name */}
        <h3 className="text-2xl font-bold text-teal-900 tracking-wider group-hover:text-amber-700 transition-colors duration-200">
          {name.chineseName}
        </h3>

        {/* Pinyin */}
        <p className="text-sm text-gray-500 italic">{name.pinyin}</p>

        {/* Nickname */}
        {name.nickname && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              小名
            </span>
            <span className="text-base font-medium text-amber-800">{name.nickname}</span>
            <PronounceButton name={name.nickname} />
          </div>
        )}

        {/* Pronounce full name button */}
        <div>
          <PronounceButton name={name.chineseName} pinyin={name.pinyin} />
        </div>

        {/* Divider */}
        <div className="border-t border-teal-50 my-1" />

        {/* Meanings */}
        <div className="flex flex-col gap-1">
          <div>
            <span className="text-xs text-gray-400 uppercase tracking-wider">Meaning</span>
            <p className="text-sm text-gray-600 leading-relaxed">{name.meaningEn}</p>
          </div>
          <div>
            <span className="text-xs text-gray-400 uppercase tracking-wider">寓意</span>
            <p className="text-sm text-gray-600 leading-relaxed">{name.meaningCn}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
