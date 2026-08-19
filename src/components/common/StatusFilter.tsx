'use client';

import { StatusFilterType } from '@/types';
import { clsx } from 'clsx';
import { CalendarClock } from 'lucide-react';

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
    <div className="w-full bg-white/95 backdrop-blur-md px-2.5 py-1 border-b border-slate-200/60 z-10 flex items-center justify-between">
      <div className="flex items-center gap-1.5 w-full">
        {/* 실시간 진행 중 탭 */}
        <button
          onClick={() => onSelectStatus('LIVE')}
          className={clsx(
            'flex-1 py-1 px-2.5 rounded-lg text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-all border',
            selectedStatus === 'LIVE'
              ? 'bg-rose-50 text-rose-700 border-rose-300 shadow-2xs'
              : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
          )}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          </span>
          <span>실시간 진행 중</span>
          <span className="ml-0.5 px-1.5 py-0.1 rounded-full text-[9px] bg-rose-200/60 text-rose-800">
            {liveCount}
          </span>
        </button>

        {/* 개막 예정(D-7) 탭 */}
        <button
          onClick={() => onSelectStatus('UPCOMING')}
          className={clsx(
            'flex-1 py-1 px-2.5 rounded-lg text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-all border',
            selectedStatus === 'UPCOMING'
              ? 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-2xs'
              : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
          )}
        >
          <CalendarClock className="w-3 h-3 text-indigo-500" />
          <span>개막 예정 (D-7)</span>
          <span className="ml-0.5 px-1.5 py-0.1 rounded-full text-[9px] bg-indigo-200/60 text-indigo-800">
            {upcomingCount}
          </span>
        </button>
      </div>
    </div>
  );
}
