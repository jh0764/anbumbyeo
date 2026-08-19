'use client';

import { MapPin, RefreshCw, Search } from 'lucide-react';

export default function Header() {
  return (
    <header className="absolute top-0 left-0 right-0 z-10 px-4 py-3 bg-white/90 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between shadow-2xs">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-black text-sm shadow-xs">
          안
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-900 leading-none flex items-center gap-1">
            안붐벼
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </h1>
          <p className="text-[10px] text-slate-500 font-medium mt-0.5">실시간 축제 밀집도 & 주차</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => window.location.reload()}
          className="p-2 rounded-full text-slate-600 hover:bg-slate-100 transition-colors"
          title="새로고침"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
        <button
          className="p-2 rounded-full text-slate-600 hover:bg-slate-100 transition-colors"
          title="검색"
        >
          <Search className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
