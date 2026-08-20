'use client';

import { Region } from '@/types';
import { clsx } from 'clsx';

interface RegionFilterProps {
  selectedRegion: Region;
  onSelectRegion: (region: Region) => void;
}

const REGIONS: Region[] = [
  '서울',
  '경기·인천',
  '부산',
  '대구',
  '대전',
  '강원',
  '충청',
  '전라',
  '경상',
  '제주',
];

export default function RegionFilter({
  selectedRegion,
  onSelectRegion,
}: RegionFilterProps) {
  return (
    <div className="w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-2 overflow-x-auto no-scrollbar z-10 shadow-2xs">
      <div className="flex items-center gap-2">
        {REGIONS.map((region) => {
          const isSelected = selectedRegion === region;
          return (
            <button
              key={region}
              onClick={() => onSelectRegion(region)}
              className={clsx(
                'px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 shrink-0 border',
                isSelected
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs scale-105'
                  : 'bg-slate-100/80 text-slate-600 border-slate-200/60 hover:bg-slate-200/60 hover:text-slate-900'
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
