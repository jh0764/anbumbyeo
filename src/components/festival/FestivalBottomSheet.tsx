'use client';

import { useState } from 'react';
import { Festival, Parking } from '@/types';
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
  Phone,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { clsx } from 'clsx';

export type BottomSheetMode = 'collapsed' | 'half' | 'full';

interface FestivalBottomSheetProps {
  festival: Festival | null;
  mode: BottomSheetMode;
  onModeChange: (mode: BottomSheetMode) => void;
}

export default function FestivalBottomSheet({
  festival,
  mode,
  onModeChange,
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
            onClick={() => onModeChange('collapsed')}
            className="p-1 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
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
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-100">
              {festival.region} · {festival.categoryType || festival.category}
            </span>

            {!isFestival ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-600 text-white flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                연중무휴
              </span>
            ) : status === 'LIVE' ? (
              <span
                className={clsx(
                  'px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1',
                  getCrowdBadgeStyle(festival.crowdLevel)
                )}
              >
                <Users className="w-3.5 h-3.5" />
                {festival.crowdLevel}
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center gap-1">
                ⏳ {getDDayString(festival.startDate)}
              </span>
            )}
          </div>

          <h2 className="text-xl font-extrabold text-slate-900 leading-snug">{festival.title}</h2>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{festival.address || festival.locationName}</span>
          </p>
        </div>

        {/* 인파 혼잡도 메시지 배너 */}
        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
          <p className="text-xs text-slate-700 font-medium leading-relaxed">
            {festival.crowdMessage}
          </p>
        </div>

        {/* 주차장 정보 리스트 영역 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Car className="w-4 h-4 text-indigo-600" />
              <span>주변 공영주차장 현황 ({sortedParkingLots.length}곳)</span>
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">최단거리순</span>
          </div>

          {sortedParkingLots.length === 0 ? (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs text-slate-500 font-medium">
              반경 1.5km 이내에 연계된 공영주차장이 없습니다. 대중교통 이용을 권장합니다.
            </div>
          ) : (
            <div className="space-y-2">
              {sortedParkingLots.map((parking) => {
                const isFull = parking.availableSpaces === 0;
                const isCrowded = parking.availableSpaces <= 5;

                return (
                  <div
                    key={`bs-parking-${parking.id}`}
                    className="p-3 bg-slate-50/90 rounded-2xl border border-slate-200/70 flex items-center justify-between gap-3 hover:bg-slate-100/80 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {parking.name}
                        </span>
                        <span className="text-[10px] text-indigo-600 font-extrabold bg-indigo-50 px-1.5 py-0.5 rounded shrink-0">
                          {parking.distance}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                        <span>총 {parking.totalSpaces}면</span>
                        {parking.address && (
                          <span className="text-slate-400 truncate">· {parking.address}</span>
                        )}
                      </div>
                    </div>

                    {/* 주차장 상태 뱃지 및 단일 길찾기 버튼 */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isFull ? (
                        <span className="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-extrabold rounded-xl border border-red-200">
                          만차 ({parking.availableSpaces}/{parking.totalSpaces})
                        </span>
                      ) : isCrowded ? (
                        <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-extrabold rounded-xl border border-amber-200">
                          혼잡 ({parking.availableSpaces}/{parking.totalSpaces})
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-extrabold rounded-xl border border-emerald-200">
                          잔여 {parking.availableSpaces}/{parking.totalSpaces}면
                        </span>
                      )}

                      <button
                        onClick={() => handleOpenNavi(parking.name)}
                        className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs"
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
                  <span>운영 기간: {festival.period}</span>
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
