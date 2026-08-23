'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Search } from 'lucide-react';

export default function Header() {
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const updateTime = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    setLastUpdated(`${hours}:${minutes} 기준`);
  };

  useEffect(() => {
    updateTime();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    updateTime();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <header className="w-full pt-12 pb-3 px-4 bg-white/95 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between shadow-2xs shrink-0 z-20">
      <div className="flex items-center gap-2">
        <div className="w-6.5 h-6.5 rounded-lg bg-slate-900 flex items-center justify-center text-white font-black text-xs shadow-xs shrink-0 border border-slate-800">
          P
        </div>
        <div className="flex flex-col justify-center">
          <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none flex items-center gap-1.5">
            안붐벼
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
          </h1>
          <p className="text-[11px] text-slate-500 font-medium tracking-tight mt-0.5 leading-tight">
            실시간 축제 밀집도 & 주차
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {/* 실시간 갱신 타임스탬프 */}
        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md border border-slate-200/80 leading-none">
          {lastUpdated || '실시간'}
        </span>

        <button
          onClick={handleRefresh}
          className="p-1.5 rounded-full text-slate-600 hover:bg-slate-100 transition-colors"
          title="실시간 정보 갱신"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
        </button>

        <button
          className="p-1.5 rounded-full text-slate-600 hover:bg-slate-100 transition-colors"
          title="검색"
        >
          <Search className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
}
