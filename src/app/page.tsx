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
import { Info } from 'lucide-react';

export default function Home() {
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedRegion, setSelectedRegion] = useState<Region>('전체');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilterType>('LIVE');
  const [selectedFestivalId, setSelectedFestivalId] = useState<string | null>(null);
  const [bottomSheetMode, setBottomSheetMode] = useState<BottomSheetMode>('collapsed');
  const [autoSwitchedToUpcoming, setAutoSwitchedToUpcoming] = useState<boolean>(false);

  // 백엔드 API 데이터 패칭
  const loadFestivals = async () => {
    setIsLoading(true);
    try {
      const data = await fetchFestivals();
      setFestivals(data);
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

  // 진행 중 축제가 0건일 때 개막 예정(UPCOMING)으로 자동 전환 로직
  useEffect(() => {
    if (!isLoading && festivals.length > 0) {
      if (liveCount === 0 && upcomingCount > 0 && selectedStatus === 'LIVE') {
        setSelectedStatus('UPCOMING');
        setAutoSwitchedToUpcoming(true);
      } else if (liveCount > 0 && autoSwitchedToUpcoming) {
        setAutoSwitchedToUpcoming(false);
      }
    }
  }, [isLoading, festivals, liveCount, upcomingCount, selectedStatus, autoSwitchedToUpcoming]);

  // 필터링 목록이 변경되면 첫 번째 항목 선택 및 포커스
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
          onSelectRegion={(reg) => {
            setSelectedRegion(reg);
            setAutoSwitchedToUpcoming(false);
          }}
        />
        <StatusFilter
          selectedStatus={selectedStatus}
          onSelectStatus={(st) => {
            setSelectedStatus(st);
            setAutoSwitchedToUpcoming(false);
          }}
          liveCount={liveCount}
          upcomingCount={upcomingCount}
        />

        {/* 자동 전환 안내 토스트 배너 */}
        {autoSwitchedToUpcoming && (
          <div className="w-full bg-indigo-600 text-white px-3 py-1.5 text-xs font-bold flex items-center justify-between shadow-sm animate-fadeIn">
            <div className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>현재 진행 중인 축제가 없어 가장 가까운 예정 축제를 안내합니다.</span>
            </div>
            <button
              onClick={() => setAutoSwitchedToUpcoming(false)}
              className="text-[10px] underline opacity-80 hover:opacity-100 shrink-0 ml-1"
            >
              닫기
            </button>
          </div>
        )}
      </div>

      {/* 2. 지도 중심 메인 영역 */}
      <div className="w-full flex-1 relative z-0 overflow-hidden">
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
