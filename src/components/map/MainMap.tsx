'use client';

import dynamic from 'next/dynamic';
import { Festival, Region } from '@/types';

interface MainMapProps {
  festivals: Festival[];
  selectedFestivalId: string | null;
  selectedRegion?: Region;
  onSelectFestival: (id: string | null) => void;
  onSearchArea?: (center: { lat: number; lng: number }) => void;
}

// Next.js dynamic import (SSR 방지)
const LeafletMapInner = dynamic(() => import('./LeafletMapInner'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center text-slate-400 gap-2">
      <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-xs font-bold">지도를 불러오는 중...</p>
    </div>
  ),
});

export default function MainMap({
  festivals,
  selectedFestivalId,
  selectedRegion,
  onSelectFestival,
  onSearchArea,
}: MainMapProps) {
  return (
    <div className="w-full h-full relative overflow-hidden">
      <LeafletMapInner
        festivals={festivals}
        selectedFestivalId={selectedFestivalId}
        selectedRegion={selectedRegion}
        onSelectFestival={onSelectFestival}
        onSearchArea={onSearchArea}
      />
    </div>
  );
}
