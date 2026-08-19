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
    <header className="w-full pt-9 pb-2 px-3.5 bg-white/95 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between shadow-2xs shrink-0 z-20">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-black text-xs shadow-xs">
          안
        </div>
        <div>
          <h1 className="text-sm font-extrabold text-slate-900 leading-none flex items-center gap-1">
            안붐벼
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </h1>
          <p className="text-[9px] text-slate-500 font-medium mt-0.5">실시간 축제 밀집도 & 주차</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* 실시간 갱신 타임스탬프 */}
        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80">
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
