'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Header from '@/components/common/Header';
import RegionFilter from '@/components/common/RegionFilter';
import CategoryFilter from '@/components/common/CategoryFilter';
import StatusFilter from '@/components/common/StatusFilter';
import MainMap from '@/components/map/MainMap';
import FestivalCarousel from '@/components/festival/FestivalCarousel';
import FestivalBottomSheet, { BottomSheetMode } from '@/components/festival/FestivalBottomSheet';
import { fetchFestivals } from '@/services/api';
import { Festival, Region, CategoryType, StatusFilterType } from '@/types';
import { getFestivalStatus } from '@/lib/festivalUtils';
import { Info } from 'lucide-react';

const REGION_COORDINATES: Record<Region, { mapX: string; mapY: string }> = {
  서울: { mapX: '126.9780', mapY: '37.5665' },
  '경기·인천': { mapX: '127.0096', mapY: '37.2636' },
  부산: { mapX: '129.0756', mapY: '35.1796' },
  대구: { mapX: '128.6014', mapY: '35.8714' },
  대전: { mapX: '127.3845', mapY: '36.3504' },
  강원: { mapX: '128.8760', mapY: '37.7519' },
  충청: { mapX: '126.6912', mapY: '36.0805' },
  전라: { mapX: '126.9056', mapY: '35.1595' },
  경상: { mapX: '129.2247', mapY: '35.8562' },
  제주: { mapX: '126.5312', mapY: '33.4996' },
};

export default function Home() {
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedRegion, setSelectedRegion] = useState<Region>('서울');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('축제');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilterType>('LIVE');
  const [selectedFestivalId, setSelectedFestivalId] = useState<string | null>(null);
  const [bottomSheetMode, setBottomSheetMode] = useState<BottomSheetMode>('collapsed');
  const [autoSwitchedToUpcoming, setAutoSwitchedToUpcoming] = useState<boolean>(false);

  // 백엔드 API 호출 및 실데이터 수집 함수
  const loadFestivals = useCallback(async (cat: CategoryType, reg: Region, overrideCoords?: { mapX: number; mapY: number }) => {
    setIsLoading(true);
    try {
      const coords = overrideCoords
        ? { mapX: overrideCoords.mapX.toString(), mapY: overrideCoords.mapY.toString() }
        : REGION_COORDINATES[reg] || REGION_COORDINATES['서울'];

      const data = await fetchFestivals({
        category: cat,
        region: reg,
        mapX: parseFloat(coords.mapX),
        mapY: parseFloat(coords.mapY),
        radius: 20000,
      });

      if (data && Array.isArray(data)) {
        setFestivals(data);
      }
    } catch (err) {
      console.error('Failed to load festivals from API:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 카테고리 또는 권역 변경 시 백엔드 재호출 (선택 지역 중심 유지)
  useEffect(() => {
    loadFestivals(selectedCategory, selectedRegion);
  }, [selectedCategory, selectedRegion, loadFestivals]);

  // '이 지역에서 재검색' 처리 핸들러
  const handleSearchArea = useCallback((center: { lat: number; lng: number }) => {
    loadFestivals(selectedCategory, selectedRegion, { mapX: center.lng, mapY: center.lat });
    setSelectedFestivalId(null);
  }, [selectedCategory, selectedRegion, loadFestivals]);

  // 권역 -> 카테고리 -> 상태 순 필터링
  const { liveCount, upcomingCount, filteredFestivals } = useMemo(() => {
    let result = festivals.filter((f) => f.region === selectedRegion || !f.region);

    result = result.filter((f) => f.categoryType === selectedCategory);

    const validFestivals = result.filter((f) => {
      if (f.categoryType !== '축제') return true;
      const st = getFestivalStatus(f);
      return st === 'LIVE' || st === 'UPCOMING';
    });

    const lCount = validFestivals.filter(
      (f) => f.categoryType !== '축제' || getFestivalStatus(f) === 'LIVE'
    ).length;

    const uCount = validFestivals.filter(
      (f) => f.categoryType === '축제' && getFestivalStatus(f) === 'UPCOMING'
    ).length;

    const finalFiltered = validFestivals.filter((f) => {
      if (selectedCategory !== '축제') return true;
      return getFestivalStatus(f) === selectedStatus;
    });

    return {
      liveCount: lCount,
      upcomingCount: uCount,
      filteredFestivals: finalFiltered,
    };
  }, [festivals, selectedRegion, selectedCategory, selectedStatus]);

  // 지도 마커 슬라이싱 (최대 15개)
  const displayFestivals = useMemo(() => {
    return filteredFestivals.slice(0, 15);
  }, [filteredFestivals]);

  // 진행 중 축제가 0건이고 '축제' 카테고일 때만 UPCOMING 자동 전환
  useEffect(() => {
    if (!isLoading && festivals.length > 0 && selectedCategory === '축제') {
      if (liveCount === 0 && upcomingCount > 0 && selectedStatus === 'LIVE') {
        setSelectedStatus('UPCOMING');
        setAutoSwitchedToUpcoming(true);
      } else if (liveCount > 0 && autoSwitchedToUpcoming) {
        setAutoSwitchedToUpcoming(false);
      }
    } else {
      setAutoSwitchedToUpcoming(false);
    }
  }, [isLoading, festivals.length, liveCount, upcomingCount, selectedStatus, selectedCategory, autoSwitchedToUpcoming]);

  const selectedFestival = useMemo(() => {
    if (!selectedFestivalId) return null;
    return festivals.find((f) => f.id === selectedFestivalId) || null;
  }, [festivals, selectedFestivalId]);

  return (
    <main className="relative w-full h-screen overflow-hidden flex flex-col bg-slate-900 select-none">
      {/* 1. 상단 Safe-Area 적용 헤더 & 카테고리 / 상태 필터 영역 */}
      <div className="w-full flex flex-col shrink-0 z-20">
        <Header />
        <RegionFilter
          selectedRegion={selectedRegion}
          onSelectRegion={(reg) => {
            setSelectedRegion(reg);
            setSelectedFestivalId(null);
            setAutoSwitchedToUpcoming(false);
          }}
        />
        <CategoryFilter
          selectedCategory={selectedCategory}
          onSelectCategory={(cat) => {
            setSelectedCategory(cat);
            setSelectedFestivalId(null);
            setAutoSwitchedToUpcoming(false);
          }}
        />

        {/* 진행 상태(LIVE / UPCOMING) 탭은 '축제' 카테고일 때만 조건부 노출 */}
        {selectedCategory === '축제' && (
          <StatusFilter
            selectedStatus={selectedStatus}
            onSelectStatus={(st) => {
              setSelectedStatus(st);
              setSelectedFestivalId(null);
              setAutoSwitchedToUpcoming(false);
            }}
            liveCount={liveCount}
            upcomingCount={upcomingCount}
          />
        )}

        {/* 자동 전환 안내 토스트 배너 */}
        {autoSwitchedToUpcoming && (
          <div className="w-full bg-indigo-600 text-white px-3 py-1.5 text-xs font-bold flex items-center justify-between shadow-sm animate-fadeIn">
            <div className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>현재 조건의 진행 축제가 없어 가장 가까운 예정 축제를 안내합니다.</span>
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
            <p className="text-xs font-bold">365일 실시간 명소 & 공영주차장 정보를 불러오는 중...</p>
          </div>
        ) : (
          <MainMap
            festivals={displayFestivals}
            selectedFestivalId={selectedFestivalId}
            selectedRegion={selectedRegion}
            onSelectFestival={(id) => setSelectedFestivalId(id)}
            onSearchArea={handleSearchArea}
          />
        )}

        {/* 지도 하단 오버레이 가로 축제 카드 캐러셀 */}
        {!isLoading && bottomSheetMode === 'collapsed' && (
          <div className="absolute bottom-4 left-0 right-0 z-10">
            <FestivalCarousel
              festivals={displayFestivals}
              selectedFestivalId={selectedFestivalId}
              onSelectFestival={(id) => setSelectedFestivalId(id)}
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
          onClose={() => setSelectedFestivalId(null)}
        />
      )}
    </main>
  );
}
