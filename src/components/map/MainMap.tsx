'use client';

import dynamic from 'next/dynamic';
import { Festival } from '@/types';

interface MainMapProps {
  festivals: Festival[];
  selectedFestivalId: string | null;
  onSelectFestival: (id: string) => void;
}

const LeafletMapInner = dynamic(() => import('./LeafletMapInner'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center text-slate-400">
      <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
      <p className="text-xs font-medium text-slate-500">지도를 불러오는 중입니다...</p>
    </div>
  ),
});

export default function MainMap({ festivals, selectedFestivalId, onSelectFestival }: MainMapProps) {
  return (
    <div className="w-full h-full relative">
      <LeafletMapInner
        festivals={festivals}
        selectedFestivalId={selectedFestivalId}
        onSelectFestival={onSelectFestival}
      />
    </div>
  );
}
