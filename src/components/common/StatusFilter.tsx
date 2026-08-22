'use client';

import { StatusFilterType } from '@/types';
import { clsx } from 'clsx';
import { Radio, Calendar } from 'lucide-react';

interface StatusFilterProps {
  selectedStatus: StatusFilterType;
  onSelectStatus: (status: StatusFilterType) => void;
  liveCount: number;
  upcomingCount: number;
}

export default function StatusFilter({
  selectedStatus,
  onSelectStatus,
  liveCount,
  upcomingCount,
}: StatusFilterProps) {
  return (
    <div className="w-full bg-white/95 backdrop-blur-md border-b border-slate-200/60 px-2.5 py-1 z-10 shadow-2xs">
      <div className="flex items-center gap-2">
        <button
          onClick={() => onSelectStatus('LIVE')}
          className={clsx(
            'flex-1 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border',
            selectedStatus === 'LIVE'
              ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
              : 'bg-slate-100/90 text-slate-600 border-slate-200 hover:bg-slate-200'
          )}
        >
          <Radio className="w-3.5 h-3.5 shrink-0 animate-pulse text-rose-300" />
          <span>실시간 진행 중</span>
          <span
            className={clsx(
              'px-1.5 py-0.2 rounded-full text-[10px] font-extrabold',
              selectedStatus === 'LIVE'
                ? 'bg-rose-700 text-white'
                : 'bg-slate-200 text-slate-700'
            )}
          >
            {liveCount}
          </span>
        </button>

        <button
          onClick={() => onSelectStatus('UPCOMING')}
          className={clsx(
            'flex-1 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border',
            selectedStatus === 'UPCOMING'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
              : 'bg-slate-100/90 text-slate-600 border-slate-200 hover:bg-slate-200'
          )}
        >
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          <span>개막 예정</span>
          <span
            className={clsx(
              'px-1.5 py-0.2 rounded-full text-[10px] font-extrabold',
              selectedStatus === 'UPCOMING'
                ? 'bg-indigo-700 text-white'
                : 'bg-slate-200 text-slate-700'
            )}
          >
            {upcomingCount}
          </span>
        </button>
      </div>
    </div>
  );
}
