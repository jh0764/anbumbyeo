'use client';

import { useRef, useEffect } from 'react';
import { Festival, Parking } from '@/types';
import { getFestivalStatus, getDDayString, getDiffDays } from '@/lib/festivalUtils';
import { Users, Car, MapPin, Calendar, Hourglass, AlertCircle, Navigation, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';

interface FestivalCarouselProps {
  festivals: Festival[];
  selectedFestivalId: string | null;
  onSelectFestival: (id: string) => void;
  onOpenDetail: () => void;
}

export default function FestivalCarousel({
  festivals,
  selectedFestivalId,
  onSelectFestival,
  onOpenDetail,
}: FestivalCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !selectedFestivalId) return;
    const selectedCard = containerRef.current.querySelector(
      `[data-festival-id="${selectedFestivalId}"]`
    );
    if (selectedCard) {
      selectedCard.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [selectedFestivalId]);

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

  const handleOpenNavi = (e: React.MouseEvent, parking: Parking) => {
    e.stopPropagation();
    const query = encodeURIComponent(parking.name);
    window.open(`https://map.kakao.com/link/search/${query}`, '_blank');
  };

  if (festivals.length === 0) {
    return (
      <div className="w-full py-3 px-4 bg-white/95 backdrop-blur-md rounded-2xl shadow-md border border-slate-200 text-center text-xs text-slate-500 font-medium">
        해당 조건의 명소 및 축제가 존재하지 않습니다.
      </div>
    );
  }

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        className="flex items-center gap-3 overflow-x-auto snap-x snap-mandatory px-4 py-1.5 no-scrollbar scroll-smooth"
      >
        {festivals.map((fest) => {
          const isSelected = fest.id === selectedFestivalId;
          const isFestival = fest.categoryType === '축제';
          const status = isFestival ? getFestivalStatus(fest) : 'LIVE';
          const daysLeft = isFestival ? getDiffDays(fest.startDate) : 0;

          // 최단거리 주차장 찾기
          const sortedByDistance = [...fest.parkingLots].sort(
            (a, b) => a.distanceMeters - b.distanceMeters
          );
          const nearestParking = sortedByDistance.length > 0 ? sortedByDistance[0] : null;
          const isNearestFull = nearestParking && nearestParking.availableSpaces === 0;

          const alternativeParking = isNearestFull
            ? sortedByDistance.find((p) => p.availableSpaces > 0)
            : null;

          return (
            <div
              key={fest.id}
              data-festival-id={fest.id}
              onClick={() => {
                onSelectFestival(fest.id);
                onOpenDetail();
              }}
              className={clsx(
                'snap-center shrink-0 w-[305px] p-3.5 bg-white/95 backdrop-blur-md rounded-2xl border transition-all duration-200 shadow-md cursor-pointer flex flex-col justify-between',
                isSelected
                  ? 'border-emerald-600 ring-2 ring-emerald-500/20 scale-[1.01]'
                  : 'border-slate-200 hover:border-slate-300'
              )}
            >
              <div>
                {/* 상단 뱃지 및 카테고리 / 상태 분기 */}
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                    {fest.region} · {fest.categoryType || fest.category}
                  </span>

                  {!isFestival ? (
                    <div className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-600 text-white flex items-center gap-1 shadow-2xs">
                      <Sparkles className="w-3 h-3 text-amber-300" />
                      <span>연중무휴</span>
                    </div>
                  ) : status === 'LIVE' ? (
                    <div
                      className={clsx(
                        'px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-2xs',
                        getCrowdBadgeStyle(fest.crowdLevel)
                      )}
                    >
                      <Users className="w-3 h-3" />
                      <span>{fest.crowdLevel}</span>
                    </div>
                  ) : (
                    <div className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center gap-1 shadow-xs animate-pulse">
                      <Hourglass className="w-3 h-3" />
                      <span>⏳ {getDDayString(fest.startDate)} ({daysLeft}일 남음)</span>
                    </div>
                  )}
                </div>

                {/* 명소명 및 일정/운영시간 */}
                <h3 className="text-sm font-bold text-slate-900 truncate">{fest.title}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="truncate">{fest.locationName}</span>
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>{isFestival ? fest.period : '365일 연중무휴'}</span>
                </p>
              </div>

              {/* 하단 주차 정보 영역 */}
              <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="p-1 bg-indigo-50 text-indigo-600 rounded-md shrink-0">
                      <Car className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] text-slate-400 leading-none truncate">
                        최단거리 · {nearestParking?.distance || '1km 내'}
                      </div>
                      {!isFestival || status === 'LIVE' ? (
                        nearestParking ? (
                          <div className="text-xs font-bold text-indigo-900 mt-0.5 flex items-center gap-1 truncate">
                            <span className="truncate">{nearestParking.name}</span>
                            {isNearestFull ? (
                              <span className="text-red-600 font-bold text-xs shrink-0">(만차)</span>
                            ) : (
                              <span className="text-indigo-600 font-extrabold shrink-0">
                                잔여 {nearestParking.availableSpaces}면
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs font-medium text-slate-400 mt-0.5">1km 내 주차장 없음</div>
                        )
                      ) : (
                        <div className="text-[10px] font-bold text-indigo-900 mt-0.5 truncate">
                          총 {nearestParking?.totalSpaces ?? 100}면 주차 가능{' '}
                          <span className="text-[9px] text-indigo-600 font-normal">
                            (개막일 연동)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 단일 길찾기 버튼 */}
                  {nearestParking && (
                    <button
                      onClick={(e) => handleOpenNavi(e, nearestParking)}
                      className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-bold flex items-center gap-1 transition-colors shrink-0 shadow-2xs"
                      title="네비 연결"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>길찾기</span>
                    </button>
                  )}
                </div>

                {/* 만차 시 차선책 추천 노출 */}
                {(!isFestival || status === 'LIVE') && isNearestFull && alternativeParking && (
                  <div className="p-1.5 bg-amber-50 rounded-lg border border-amber-200/80 flex items-center gap-1.5 text-[10px] text-amber-900 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="truncate">
                      <strong>차선책:</strong> {alternativeParking.distance}{' '}
                      <span className="font-bold">{alternativeParking.name}</span> (잔여 {alternativeParking.availableSpaces}면)
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
