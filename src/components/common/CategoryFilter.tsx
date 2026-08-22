'use client';

import { CategoryType } from '@/types';
import { clsx } from 'clsx';
import { PartyPopper, Trees, Landmark } from 'lucide-react';

interface CategoryFilterProps {
  selectedCategory: CategoryType;
  onSelectCategory: (category: CategoryType) => void;
}

const CATEGORIES: { label: string; value: CategoryType; icon: React.ElementType }[] = [
  { label: '축제', value: '축제', icon: PartyPopper },
  { label: '공원·나들이', value: '공원·나들이', icon: Trees },
  { label: '문화시설', value: '문화시설', icon: Landmark },
];

export default function CategoryFilter({
  selectedCategory,
  onSelectCategory,
}: CategoryFilterProps) {
  return (
    <div className="w-full bg-white/95 backdrop-blur-md border-b border-slate-200/60 px-2.5 py-1 z-10 shadow-2xs">
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
        {CATEGORIES.map((item) => {
          const isSelected = selectedCategory === item.value;
          const Icon = item.icon;
          return (
            <button
              key={item.value}
              onClick={() => onSelectCategory(item.value)}
              className={clsx(
                'px-3.5 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-150 shrink-0 border inline-flex items-center gap-1.5',
                isSelected
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs scale-[1.02]'
                  : 'bg-slate-100/90 text-slate-600 border-slate-200/80 hover:bg-slate-200/80 hover:text-slate-900'
              )}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
