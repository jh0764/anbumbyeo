'use client';

import { useState } from 'react';
import { Festival, Parking } from '@/types';
import { getFestivalStatus, getDDayString } from '@/lib/festivalUtils';
import {
  MapPin,
  Calendar,
  Car,
  Users,
  ChevronUp,
  ChevronDown,
  Navigation,
  X,
  ShieldAlert,
  Hourglass,
  CalendarClock,
  AlertTriangle,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
  const [sortOrder, setSortOrder] = useState<'distance' | 'available'>('distance');

  if (!festival || mode === 'collapsed') {
    return null;
  }

  const status = getFestivalStatus(festival);

  // 주차장 정렬
  const sortedParkingLots = [...festival.parkingLots].sort((a, b) => {
    if (sortOrder === 'distance') {
      return a.distanceMeters - b.distanceMeters;
    } else {
      return b.availableSpaces - a.availableSpaces;
    }
  });

  const displayedParkingLots = mode === 'half' ? sortedParkingLots.slice(0, 2) : sortedParkingLots;

  const getCrowdBadgeStyle = (level: string) => {
    switch (level) {
      case '매우 혼잡':
        return 'bg-red-100 text-red-700 border-red-200';
      case '혼잡':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case '보통':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    }
  };

  const handleOpenKakaoMap = (parking: Parking) => {
    const query = encodeURIComponent(`${parking.name}`);
    window.open(`https://map.kakao.com/link/search/${query}`, '_blank');
  };

  return (
    <div
      className={twMerge(
        'absolute bottom-0 left-0 right-0 z-20 bg-white rounded-t-3xl shadow-[0_-6px_25px_rgba(0,0,0,0.18)] transition-all duration-300 ease-out flex flex-col',
        mode === 'full' ? 'h-[82vh]' : 'h-[48vh]'
      )}
    >
      {/* 바텀시트 상단 컨트롤 핸들 */}
      <div className="w-full py-2 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 rounded-t-3xl border-b border-slate-100 shrink-0 relative">
        <div
          onClick={() => onModeChange(mode === 'full' ? 'half' : 'full')}
          className="w-full flex flex-col items-center justify-center py-1"
        >
          <div className="w-10 h-1 bg-slate-300 rounded-full mb-1" />
          <div className="flex items-center text-[11px] font-bold text-slate-500 gap-1">
            {mode === 'full' ? (
              <>
                <span>요약 보기</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                <span>전체 공영주차장 보기</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </>
            )}
          </div>
        </div>

        {/* 닫기 버튼 */}
        <button
          onClick={() => onModeChange('collapsed')}
          className="absolute right-3 top-2.5 p-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
          title="닫기"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 바텀시트 본문 영역 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 축제 타이틀 & 상태별 뱃지 */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 inline-block mb-1">
                {festival.region} · {festival.category}
              </span>
              <h2 className="text-lg font-black text-slate-900 leading-snug">
                {festival.title}
              </h2>
            </div>

            {status === 'LIVE' ? (
              <div
                className={clsx(
                  'px-2.5 py-1 rounded-xl text-xs font-extrabold border shrink-0 flex items-center gap-1 shadow-2xs',
                  getCrowdBadgeStyle(festival.crowdLevel)
                )}
              >
                <Users className="w-3.5 h-3.5" />
                <span>{festival.crowdLevel}</span>
              </div>
            ) : (
              <div className="px-2.5 py-1 rounded-xl text-xs font-extrabold bg-indigo-600 text-white shrink-0 flex items-center gap-1 shadow-2xs">
                <Hourglass className="w-3.5 h-3.5" />
                <span>개막 {getDDayString(festival.startDate)}</span>
              </div>
            )}
          </div>

          <div className="mt-2 space-y-1 text-xs text-slate-600">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-medium">{festival.locationName} ({festival.address})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-medium">{festival.period}</span>
            </div>
          </div>
        </div>

        {/* 상태별 안내 카드 */}
        {status === 'LIVE' ? (
          <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200/80 flex items-start gap-2.5">
            <div className="p-1.5 bg-amber-500 text-white rounded-xl shrink-0 mt-0.5 shadow-2xs">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900">실시간 혼잡도 안내</h4>
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                {festival.crowdMessage}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-indigo-50/80 rounded-2xl border border-indigo-200/80 flex items-start gap-2.5">
            <div className="p-1.5 bg-indigo-600 text-white rounded-xl shrink-0 mt-0.5 shadow-2xs">
              <CalendarClock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-indigo-900">개막 예정 안내</h4>
              <p className="text-xs text-indigo-800 mt-0.5 leading-relaxed">
                본 축제는 개막 예정 축제입니다. 축제 시작 시 실시간 주차장 잔여면수 및 인파 밀집도 데이터가 자동 연동됩니다.
              </p>
            </div>
          </div>
        )}

        {/* 주차장 리스트 */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
              <Car className="w-4 h-4 text-indigo-600" />
              <span>주변 공영주차장 현황</span>
            </h3>

            {status === 'LIVE' && (
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                <button
                  onClick={() => setSortOrder('distance')}
                  className={clsx(
                    'px-2 py-0.5 rounded-md transition-all',
                    sortOrder === 'distance'
                      ? 'bg-white text-indigo-900 shadow-2xs font-extrabold'
                      : 'text-slate-500 hover:text-slate-800'
                  )}
                >
                  거리순
                </button>
                <button
                  onClick={() => setSortOrder('available')}
                  className={clsx(
                    'px-2 py-0.5 rounded-md transition-all',
                    sortOrder === 'available'
                      ? 'bg-white text-indigo-900 shadow-2xs font-extrabold'
                      : 'text-slate-500 hover:text-slate-800'
                  )}
                >
                  잔여석순
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {displayedParkingLots.map((parking) => {
              const isFull = parking.availableSpaces === 0;
              const isLow = parking.availableSpaces > 0 && parking.availableSpaces <= 5;
              const isEnough = parking.availableSpaces >= 6;

              return (
                <div
                  key={parking.id}
                  className="p-3 rounded-2xl border border-slate-200 bg-white hover:border-indigo-300 transition-all shadow-2xs flex items-center justify-between gap-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-extrabold text-slate-900 truncate">
                        {parking.name}
                      </h4>
                      {isFull && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-red-100 text-red-700 flex items-center gap-0.5">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          만차
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Navigation className="w-3 h-3 text-slate-400" />
                        도보 {Math.ceil(parking.distanceMeters / 60)}분 ({parking.distance})
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {status === 'LIVE' ? (
                      <div
                        className={clsx(
                          'text-xs font-bold px-2.5 py-1 rounded-xl text-center min-w-[72px]',
                          isFull
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : isLow
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        )}
                      >
                        {isFull ? (
                          <span className="font-extrabold">만차</span>
                        ) : (
                          <>
                            <span className="text-[9px] text-slate-500 font-medium block leading-none mb-0.5">잔여</span>
                            <span className="text-xs font-black">{parking.availableSpaces}</span>
                            <span className="text-[9px] font-medium text-slate-400">/{parking.totalSpaces}면</span>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="text-[10px] font-bold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-600 text-right">
                        <div>총 {parking.totalSpaces}면</div>
                        <div className="text-[9px] text-indigo-600 font-medium">축제 시작 시 연동</div>
                      </div>
                    )}

                    <button
                      onClick={() => handleOpenKakaoMap(parking)}
                      className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1 transition-colors"
                      title="네비 길찾기 연결"
                    >
                      <Navigation className="w-3.5 h-3.5 text-indigo-600" />
                      <span>길찾기</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {mode === 'half' && festival.parkingLots.length > 2 && (
              <button
                onClick={() => onModeChange('full')}
                className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1 border border-slate-200"
              >
                <span>전체 주차장 {festival.parkingLots.length}곳 모두 보기</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
