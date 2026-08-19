'use client';

import { useState, useMemo } from 'react';
import Header from '@/components/common/Header';
import RegionFilter from '@/components/common/RegionFilter';
import MainMap from '@/components/map/MainMap';
import FestivalCarousel from '@/components/festival/FestivalCarousel';
import FestivalBottomSheet, { BottomSheetMode } from '@/components/festival/FestivalBottomSheet';
import { MOCK_FESTIVALS } from '@/services/mockData';
import { Region } from '@/types';

export default function Home() {
  const [selectedRegion, setSelectedRegion] = useState<Region>('전체');
  const [selectedFestivalId, setSelectedFestivalId] = useState<string | null>(
    MOCK_FESTIVALS[0].id
  );
  const [bottomSheetMode, setBottomSheetMode] = useState<BottomSheetMode>('collapsed');

  // 선택된 권역에 따라 축제 데이터 필터링
  const filteredFestivals = useMemo(() => {
    if (selectedRegion === '전체') return MOCK_FESTIVALS;
    return MOCK_FESTIVALS.filter((f) => f.region === selectedRegion);
  }, [selectedRegion]);

  // 권역 변경 시 해당 권역 첫 번째 축제 선택
  const handleSelectRegion = (region: Region) => {
    setSelectedRegion(region);
    const newFiltered =
      region === '전체'
        ? MOCK_FESTIVALS
        : MOCK_FESTIVALS.filter((f) => f.region === region);

    if (newFiltered.length > 0) {
      setSelectedFestivalId(newFiltered[0].id);
    } else {
      setSelectedFestivalId(null);
    }
  };

  const selectedFestival = useMemo(() => {
    return MOCK_FESTIVALS.find((f) => f.id === selectedFestivalId) || null;
  }, [selectedFestivalId]);

  return (
    <main className="relative w-full h-screen overflow-hidden flex flex-col bg-slate-900 select-none">
      {/* 1. 상단 앱 헤더 */}
      <Header />

      {/* 2. 상단 권역 필터 탭 (헤더 바로 아래) */}
      <div className="pt-[57px]">
        <RegionFilter
          selectedRegion={selectedRegion}
          onSelectRegion={handleSelectRegion}
        />
      </div>

      {/* 3. 지도 중심 메인 영역 (60% 이상 노출) */}
      <div className="w-full flex-1 relative">
        <MainMap
          festivals={filteredFestivals}
          selectedFestivalId={selectedFestivalId}
          onSelectFestival={(id) => {
            setSelectedFestivalId(id);
          }}
        />

        {/* 지도 하단 오버레이 가로 축제 카드 캐러셀 (바텀시트가 접혀있을 때 노출) */}
        {bottomSheetMode === 'collapsed' && (
          <div className="absolute bottom-4 left-0 right-0 z-10">
            <FestivalCarousel
              festivals={filteredFestivals}
              selectedFestivalId={selectedFestivalId}
              onSelectFestival={(id) => {
                setSelectedFestivalId(id);
              }}
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
