'use client';

import { useState, useMemo, useEffect } from 'react';
import Header from '@/components/common/Header';
import RegionFilter from '@/components/common/RegionFilter';
import StatusFilter from '@/components/common/StatusFilter';
import MainMap from '@/components/map/MainMap';
import FestivalCarousel from '@/components/festival/FestivalCarousel';
import FestivalBottomSheet, { BottomSheetMode } from '@/components/festival/FestivalBottomSheet';
import { MOCK_FESTIVALS } from '@/services/mockData';
import { Region, StatusFilterType } from '@/types';
import { getFestivalStatus } from '@/lib/festivalUtils';

export default function Home() {
  const [selectedRegion, setSelectedRegion] = useState<Region>('전체');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilterType>('LIVE');
  const [selectedFestivalId, setSelectedFestivalId] = useState<string | null>(null);
  const [bottomSheetMode, setBottomSheetMode] = useState<BottomSheetMode>('collapsed');

  // LIVE / UPCOMING 축제 카운트 계산 (지역 필터 반영)
  const { liveCount, upcomingCount, filteredFestivals } = useMemo(() => {
    // 1차: 지역 필터
    const regionFiltered =
      selectedRegion === '전체'
        ? MOCK_FESTIVALS
        : MOCK_FESTIVALS.filter((f) => f.region === selectedRegion);

    // EXPIRED 및 FAR_FUTURE 제외한 유효 축제
    const validFestivals = regionFiltered.filter((f) => {
      const st = getFestivalStatus(f);
      return st === 'LIVE' || st === 'UPCOMING';
    });

    const lCount = validFestivals.filter((f) => getFestivalStatus(f) === 'LIVE').length;
    const uCount = validFestivals.filter((f) => getFestivalStatus(f) === 'UPCOMING').length;

    // 2차: 상태 필터 (LIVE vs UPCOMING)
    const finalFiltered = validFestivals.filter(
      (f) => getFestivalStatus(f) === selectedStatus
    );

    return {
      liveCount: lCount,
      upcomingCount: uCount,
      filteredFestivals: finalFiltered,
    };
  }, [selectedRegion, selectedStatus]);

  // 필터링 목록이 변경되거나 선택된 축제가 목록에 없으면 첫 번째 항목으로 자동 선택
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
    return MOCK_FESTIVALS.find((f) => f.id === selectedFestivalId) || null;
  }, [selectedFestivalId]);

  return (
    <main className="relative w-full h-screen overflow-hidden flex flex-col bg-slate-900 select-none">
      {/* 1. 상단 앱 헤더 */}
      <Header />

      {/* 2. 필터 영역 (지역 필터 + 상태 필터) */}
      <div className="pt-[57px]">
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

      {/* 3. 지도 중심 메인 영역 */}
      <div className="w-full flex-1 relative">
        <MainMap
          festivals={filteredFestivals}
          selectedFestivalId={selectedFestivalId}
          onSelectFestival={setSelectedFestivalId}
        />

        {/* 지도 하단 오버레이 가로 축제 카드 캐러셀 (바텀시트가 접혀있을 때 노출) */}
        {bottomSheetMode === 'collapsed' && (
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

      {/* 4. 3단계 제어 축제 상세 바텀시트 */}
      <FestivalBottomSheet
        festival={selectedFestival}
        mode={bottomSheetMode}
        onModeChange={setBottomSheetMode}
      />
    </main>
  );
}
