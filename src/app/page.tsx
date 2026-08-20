'use client';

import { useState, useMemo, useEffect } from 'react';
import Header from '@/components/common/Header';
import RegionFilter from '@/components/common/RegionFilter';
import StatusFilter from '@/components/common/StatusFilter';
import MainMap from '@/components/map/MainMap';
import FestivalCarousel from '@/components/festival/FestivalCarousel';
import FestivalBottomSheet, { BottomSheetMode } from '@/components/festival/FestivalBottomSheet';
import { fetchFestivals } from '@/services/api';
import { Festival, Region, StatusFilterType } from '@/types';
import { getFestivalStatus } from '@/lib/festivalUtils';

export default function Home() {
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedRegion, setSelectedRegion] = useState<Region>('전체');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilterType>('LIVE');
  const [selectedFestivalId, setSelectedFestivalId] = useState<string | null>(null);
  const [bottomSheetMode, setBottomSheetMode] = useState<BottomSheetMode>('collapsed');

  // 지도 중심 좌표 (기본: 서울 중심)
  const [mapCenter, setMapCenter] = useState<{ mapX: number; mapY: number }>({
    mapX: 126.9780,
    mapY: 37.5665,
  });

  // 백엔드 API 연동 데이터 수집
  const loadFestivals = async (x?: number, y?: number) => {
    setIsLoading(true);
    try {
      const data = await fetchFestivals({ mapX: x || mapCenter.mapX, mapY: y || mapCenter.mapY });
      setFestivals(data);
      if (data.length > 0) {
        setSelectedFestivalId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load festivals from API:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFestivals();
  }, []);

  // LIVE / UPCOMING 축제 카운트 계산 (지역 필터 반영)
  const { liveCount, upcomingCount, filteredFestivals } = useMemo(() => {
    const regionFiltered =
      selectedRegion === '전체'
        ? festivals
        : festivals.filter((f) => f.region === selectedRegion);

    const validFestivals = regionFiltered.filter((f) => {
      const st = getFestivalStatus(f);
      return st === 'LIVE' || st === 'UPCOMING';
    });

    const lCount = validFestivals.filter((f) => getFestivalStatus(f) === 'LIVE').length;
    const uCount = validFestivals.filter((f) => getFestivalStatus(f) === 'UPCOMING').length;

    const finalFiltered = validFestivals.filter(
      (f) => getFestivalStatus(f) === selectedStatus
    );

    return {
      liveCount: lCount,
      upcomingCount: uCount,
      filteredFestivals: finalFiltered,
    };
  }, [festivals, selectedRegion, selectedStatus]);

  useEffect(() => {
    if (filteredFestivals.length > 0) {
      const exists = filteredFestivals.some((f) => f.id === selectedFestivalId);
      if (!exists) {
        setSelectedFestivalId(filteredFestivals[0].id);
      }
    } else {
      setSelectedFestivalId(null);
    }
  }, [filteredFestivals, selectedFestivalId]);

  const selectedFestival = useMemo(() => {
    return festivals.find((f) => f.id === selectedFestivalId) || null;
  }, [festivals, selectedFestivalId]);

  return (
    <main className="relative w-full h-screen overflow-hidden flex flex-col bg-slate-900 select-none">
      {/* 1. 상단 Safe-Area 적용 헤더 & 필터 바 영역 */}
      <div className="w-full flex flex-col shrink-0 z-20">
        <Header />
        <RegionFilter
          selectedRegion={selectedRegion}
          onSelectRegion={setSelectedRegion}
        />
        <StatusFilter
          selectedStatus={selectedStatus}
          onSelectStatus={setSelectedStatus}
          liveCount={liveCount}
          upcomingCount={upcomingCount}
        />
      </div>

      {/* 2. 지도 중심 메인 영역 */}
      <div className="w-full flex-1 relative z-0">
        {isLoading ? (
          <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center text-slate-500 gap-2">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-bold">공공데이터 실시간 축제/주차 정보를 불러오는 중...</p>
          </div>
        ) : (
          <MainMap
            festivals={filteredFestivals}
            selectedFestivalId={selectedFestivalId}
            onSelectFestival={setSelectedFestivalId}
          />
        )}

        {/* 지도 하단 오버레이 가로 축제 카드 캐러셀 (바텀시트가 접혀있을 때 노출) */}
        {!isLoading && bottomSheetMode === 'collapsed' && (
          <div className="absolute bottom-4 left-0 right-0 z-10">
            <FestivalCarousel
              festivals={filteredFestivals}
              selectedFestivalId={selectedFestivalId}
              onSelectFestival={setSelectedFestivalId}
              onOpenDetail={() => setBottomSheetMode('half')}
            />
          </div>
        )}
      </div>

      {/* 3. 3단계 제어 축제 상세 바텀시트 */}
      {!isLoading && (
        <FestivalBottomSheet
          festival={selectedFestival}
          mode={bottomSheetMode}
          onModeChange={setBottomSheetMode}
        />
      )}
    </main>
  );
}
