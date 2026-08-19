'use client';

import { Region } from '@/types';
import { clsx } from 'clsx';

interface RegionFilterProps {
  selectedRegion: Region;
  onSelectRegion: (region: Region) => void;
}

const REGIONS: Region[] = ['전체', '서울·수도권', '강원', '충청', '전라', '경상', '제주'];

export default function RegionFilter({ selectedRegion, onSelectRegion }: RegionFilterProps) {
  return (
    <div className="w-full bg-white/95 backdrop-blur-md border-b border-slate-200/60 px-2.5 py-1 z-10 shadow-2xs">
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth">
        {REGIONS.map((region) => {
          const isSelected = selectedRegion === region;
          return (
            <button
              key={region}
              onClick={() => onSelectRegion(region)}
              className={clsx(
                'px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all duration-150 shrink-0 border',
                isSelected
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs scale-[1.02]'
                  : 'bg-slate-100/90 text-slate-600 border-slate-200/80 hover:bg-slate-200/80 hover:text-slate-900'
              )}
            >
              {region}
            </button>
          );
        })}
      </div>
    </div>
  );
}
