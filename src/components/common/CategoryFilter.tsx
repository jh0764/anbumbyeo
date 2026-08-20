'use client';

import { CategoryType } from '@/types';
import { clsx } from 'clsx';

interface CategoryFilterProps {
  selectedCategory: CategoryType;
  onSelectCategory: (category: CategoryType) => void;
}

const CATEGORIES: { label: string; value: CategoryType }[] = [
  { label: '전체 명소', value: '전체' },
  { label: '🎉 축제', value: '축제' },
  { label: '🌳 공원·나들이', value: '공원·나들이' },
  { label: '🏛️ 문화시설', value: '문화시설' },
];

export default function CategoryFilter({
  selectedCategory,
  onSelectCategory,
}: CategoryFilterProps) {
  return (
    <div className="w-full bg-white/95 backdrop-blur-md border-b border-slate-200/60 px-2.5 py-1 z-10 shadow-2xs">
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth">
        {CATEGORIES.map((item) => {
          const isSelected = selectedCategory === item.value;
          return (
            <button
              key={item.value}
              onClick={() => onSelectCategory(item.value)}
              className={clsx(
                'px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all duration-150 shrink-0 border',
                isSelected
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs scale-[1.02]'
                  : 'bg-slate-100/90 text-slate-600 border-slate-200/80 hover:bg-slate-200/80 hover:text-slate-900'
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
