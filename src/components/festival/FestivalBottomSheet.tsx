'use client';

import { Festival } from '@/types';
import { getFestivalStatus, getDDayString } from '@/lib/festivalUtils';
import {
  X,
  MapPin,
  Calendar,
  Users,
  Car,
  Navigation,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Info,
  Clock,
} from 'lucide-react';
import { clsx } from 'clsx';

export type BottomSheetMode = 'collapsed' | 'half' | 'full';

interface FestivalBottomSheetProps {
  festival: Festival | null;
  mode: BottomSheetMode;
  onModeChange: (mode: BottomSheetMode) => void;
  onClose: () => void;
}

export default function FestivalBottomSheet({
  festival,
  mode,
  onModeChange,
  onClose,
}: FestivalBottomSheetProps) {
  if (!festival || mode === 'collapsed') {
    return null;
  }

  const isFestival = festival.categoryType === '축제';
  const status = isFestival ? getFestivalStatus(festival) : 'LIVE';

  const getCrowdBadgeStyle = (level: string) => {
    switch (level) {
      case '매우 혼잡':
        return 'bg-red-500 text-white';
      case '혼잡':
        return 'bg-amber-500 text-white';
      case '보통':
        return 'bg-blue-500 text-white';
      default:
        return 'bg-emerald-500 text-white';
    }
  };

  const handleOpenNavi = (parkingName: string) => {
    const query = encodeURIComponent(parkingName);
    window.open(`https://map.kakao.com/link/search/${query}`, '_blank');
  };

  const handleClose = () => {
    onModeChange('collapsed');
  };

  const sortedParkingLots = [...festival.parkingLots].sort(
    (a, b) => a.distanceMeters - b.distanceMeters
  );

  return (
    <div
      className={clsx(
        'fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl transition-all duration-300 flex flex-col border-t border-slate-200/80',
        mode === 'full' ? 'h-[92vh]' : 'h-[50vh]'
      )}
    >
      {/* 1. 상단 드래그 핸들 및 상태 변경 버튼 */}
      <div className="w-full flex flex-col items-center pt-2.5 pb-1 shrink-0 relative bg-slate-50/80 rounded-t-3xl">
        <div
          onClick={() => onModeChange(mode === 'half' ? 'full' : 'half')}
          className="w-12 h-1.5 bg-slate-300 rounded-full cursor-pointer hover:bg-slate-400 transition-colors"
        />
        <div className="w-full px-4 flex items-center justify-between mt-1">
          <button
            onClick={() => onModeChange(mode === 'half' ? 'full' : 'half')}
            className="text-xs text-slate-500 font-bold flex items-center gap-1 hover:text-slate-900"
          >
            {mode === 'half' ? (
              <>
                <span>상세 정보 더보기</span>
                <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>요약 정보로 축소</span>
                <ChevronDown className="w-4 h-4" />
              </>
            )}
          </button>
          <button
            onClick={handleClose}
            className="p-1 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
            title="축제 포커스 취소 및 전체 지도 보기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 2. 바텀시트 메인 스크롤 콘텐츠 */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-5 no-scrollbar">
        {/* 헤더 타이틀 및 대표 뱃지 */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-100 shrink-0">
              {festival.region} · {festival.categoryType || festival.category}
            </span>

            {!isFestival ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-600 text-white flex items-center gap-1 shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                연중무휴
              </span>
            ) : status === 'LIVE' ? (
              <span
                className={clsx(
                  'px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 shrink-0',
                  getCrowdBadgeStyle(festival.crowdLevel)
                )}
              >
                <Users className="w-3.5 h-3.5" />
                {festival.crowdLevel}
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center gap-1 shrink-0">
                <Clock className="w-3.5 h-3.5" />
                {getDDayString(festival.startDate)}
              </span>
            )}
          </div>

          <h2 className="text-xl font-extrabold text-slate-900 leading-snug break-keep">{festival.title}</h2>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="break-keep">{festival.address || festival.locationName}</span>
          </p>
        </div>

        {/* 인파 혼잡도 메시지 배너 */}
        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
          <p className="text-xs text-slate-700 font-medium leading-relaxed break-keep">
            {festival.crowdMessage}
          </p>
        </div>

        {/* 주차장 정보 리스트 영역 (공영/민영 뱃지 -> 명칭 -> 도보시간 -> 잔여석 -> 요금) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Car className="w-4 h-4 text-indigo-600" />
              <span>주변 공영·민영 주차장 현황 ({sortedParkingLots.length}곳)</span>
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">최단거리순</span>
          </div>

          {sortedParkingLots.length === 0 ? (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs text-slate-500 font-medium">
              반경 1km 이내 공영/민영 주차장 정보를 확인 중입니다. 대중교통 이용을 권장합니다.
            </div>
          ) : (
            <div className="space-y-2.5">
              {sortedParkingLots.map((parking) => {
                const isRealtime = parking.isRealtime;
                const isFull = isRealtime && parking.availableSpaces === 0;
                const isCrowded = isRealtime && parking.availableSpaces <= 5;
                const isPublic = parking.isPublic !== false;

                return (
                  <div
                    key={`bs-parking-${parking.id}`}
                    className="p-3 bg-slate-50/90 rounded-2xl border border-slate-200/70 flex items-start justify-between gap-3 hover:bg-slate-100/80 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      {/* [공영/민영] 뱃지 + 주차장 명칭 + 도보시간 */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={clsx(
                            'text-[9px] font-extrabold px-1.5 py-0.2 rounded text-white shrink-0',
                            isPublic ? 'bg-indigo-600' : 'bg-slate-600'
                          )}
                        >
                          {isPublic ? '공영' : '민영'}
                        </span>
                        <span className="text-xs font-bold text-slate-900 break-keep leading-snug">
                          {parking.name}
                        </span>
                        <span className="text-[10px] text-indigo-600 font-extrabold shrink-0">
                          ({parking.distance})
                        </span>
                      </div>

                      {/* 요금 태그 */}
                      <div className="text-[10px] text-slate-600 bg-slate-200/70 px-2 py-0.5 rounded-md font-medium inline-block mt-1">
                        🏷️ {parking.feeInfo || '요금 정보 현장확인'}
                      </div>

                      {parking.address && (
                        <div className="text-[10px] text-slate-400 mt-1 break-keep">
                          {parking.address}
                        </div>
                      )}
                    </div>

                    {/* 주차장 상태 뱃지 및 단일 길찾기 버튼 */}
                    <div className="flex items-center gap-2 shrink-0 mt-0.5">
                      {parking.isLive && parking.availableSpots !== undefined && parking.availableSpots !== null ? (
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 font-semibold text-xs rounded-full border border-emerald-200 shrink-0 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          잔여 {parking.availableSpots}/{parking.totalSpaces}면
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full border border-slate-200 shrink-0">
                          총 {parking.totalSpaces}면 (현장확인)
                        </span>
                      )}

                      <button
                        onClick={() => handleOpenNavi(parking.name)}
                        className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs shrink-0"
                        title="네비 연결"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">길찾기</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* full 모드 시 추가 상세 정보 노출 */}
        {mode === 'full' && (
          <div className="pt-3 border-t border-slate-200 space-y-4 text-xs text-slate-600">
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 text-xs">명소 관람 안내</h4>
              <div className="grid grid-cols-1 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>행사 기간: {festival.period}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>운영 시간: 상시 개방 (일부 연계 시설별 상이)</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
