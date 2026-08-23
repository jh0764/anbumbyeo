'use client';

import { useRef, useEffect } from 'react';
import { Festival, Parking } from '@/types';
import { getFestivalStatus, getDDayString } from '@/lib/festivalUtils';
import { renderParkingBadge } from '@/lib/parkingUtils';
import { Users, Car, MapPin, Calendar, Clock, AlertCircle, Navigation, Sparkles, Tag, Copy } from 'lucide-react';
import { clsx } from 'clsx';

interface FestivalCarouselProps {
  festivals: Festival[];
  selectedFestivalId: string | null;
  onSelectFestival: (id: string) => void;
  onOpenDetail: () => void;
  onOpenNavi?: (target: { name: string; lat: number; lng: number; address?: string }) => void;
  onCopyAddress?: (addr: string) => void;
}

export default function FestivalCarousel({
  festivals,
  selectedFestivalId,
  onSelectFestival,
  onOpenDetail,
  onOpenNavi,
  onCopyAddress,
}: FestivalCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = 0;
    }
  }, [festivals]);

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
    if (onOpenNavi) {
      onOpenNavi({
        name: parking.name,
        lat: parking.lat,
        lng: parking.lng,
        address: parking.address,
      });
    } else {
      const query = encodeURIComponent(parking.name);
      window.open(`https://map.kakao.com/link/search/${query}`, '_blank');
    }
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

          const sortedByDistance = [...fest.parkingLots].sort(
            (a, b) => a.distanceMeters - b.distanceMeters
          );
          const nearestParking = sortedByDistance.length > 0 ? sortedByDistance[0] : null;
          const isNearestFull = nearestParking && nearestParking.isRealtime && nearestParking.availableSpaces === 0;

          const alternativeParking = isNearestFull
            ? sortedByDistance.find((p) => p.availableSpaces > 0)
            : null;

          return (
            <div
              key={fest.id}
              data-festival-id={fest.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                onSelectFestival(fest.id);
                onOpenDetail();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectFestival(fest.id);
                  onOpenDetail();
                }
              }}
              aria-label={`${fest.title} 상세보기`}
              className={clsx(
                'snap-center shrink-0 w-[85vw] max-w-[320px] h-[225px] min-h-[225px] p-3.5 bg-white/95 backdrop-blur-md rounded-2xl border transition-all duration-200 shadow-md cursor-pointer flex flex-col justify-between',
                isSelected
                  ? 'border-emerald-600 ring-2 ring-emerald-500/20 scale-[1.01]'
                  : 'border-slate-200 hover:border-slate-300'
              )}
            >
              {/* 상단 섹션: 뱃지 + 타이틀 (고정 높이 h-[105px]) */}
              <div className="h-[105px] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 shrink-0">
                        {fest.region} · {fest.categoryType || fest.category}
                      </span>

                      {fest.weather && (
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-100 shrink-0 inline-flex items-center gap-0.5">
                          <span>{fest.weather.emoji || '☀️'}</span>
                          <span>{fest.weather.temp}℃</span>
                        </span>
                      )}
                    </div>

                    {!isFestival ? (
                      <div className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-600 text-white flex items-center gap-1 shadow-2xs shrink-0">
                        <Sparkles className="w-3 h-3 text-amber-300 shrink-0" />
                        <span>연중무휴</span>
                      </div>
                    ) : status === 'LIVE' ? (
                      <div
                        className={clsx(
                          'px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-2xs shrink-0',
                          getCrowdBadgeStyle(fest.crowdLevel)
                        )}
                      >
                        <Users className="w-3 h-3 shrink-0" />
                        <span>{fest.crowdLevel}</span>
                      </div>
                    ) : (
                      <div className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center gap-1 shadow-xs shrink-0">
                        <Clock className="w-3 h-3 shrink-0" />
                        <span>{getDDayString(fest.startDate)}</span>
                      </div>
                    )}
                  </div>

                  <h3 className="text-sm font-extrabold text-slate-900 leading-snug break-keep line-clamp-1">{fest.title}</h3>
                </div>

                <div className="space-y-0.5">
                  <p className="text-[11px] text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="break-keep truncate">{fest.locationName}</span>
                  </p>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{isFestival ? fest.period : '365일 연중무휴'}</span>
                  </p>
                </div>
              </div>

              {/* 하단 주차 정보 섹션 */}
              <div className="h-[76px] min-h-[76px] pt-2 border-t border-slate-100 flex flex-col justify-center">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-1.5 min-w-0 flex-1">
                    <div className="p-1 bg-indigo-50 text-indigo-600 rounded-md shrink-0 mt-0.5">
                      <Car className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      {nearestParking ? (
                        <div>
                          <div className="flex items-center gap-1 flex-wrap">
                            <span
                              className={clsx(
                                'text-[9px] font-extrabold px-1.5 py-0.2 rounded text-white shrink-0',
                                nearestParking.isPublic !== false ? 'bg-indigo-600' : 'bg-slate-600'
                              )}
                            >
                              {nearestParking.isPublic !== false ? '공영' : '민영'}
                            </span>
                            <span className="text-xs font-bold text-slate-900 leading-snug break-keep line-clamp-1">
                              {nearestParking.name}
                            </span>
                            <span className="text-[10px] text-indigo-600 font-extrabold shrink-0">
                              ({nearestParking.distance})
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[10px] mt-0.5 flex-wrap">
                            {renderParkingBadge(nearestParking)}
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-600 font-medium inline-flex items-center gap-1">
                              <Tag className="w-3 h-3 text-slate-500 shrink-0" />
                              <span>{nearestParking.feeInfo || '현장 요금제'}</span>
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs font-medium text-slate-400 h-full flex items-center">
                          1km 내 공영주차장 정보 확인 중
                        </div>
                      )}
                    </div>
                  </div>

                  {nearestParking && (
                    <button
                      onClick={(e) => handleOpenNavi(e, nearestParking)}
                      className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-bold flex items-center gap-1 transition-colors shrink-0 shadow-2xs mt-0.5"
                      title="3대 내비 길찾기"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>길찾기</span>
                    </button>
                  )}
                </div>

                {isNearestFull && alternativeParking && (
                  <div className="p-1 mt-1 bg-amber-50 rounded border border-amber-200/80 flex items-center gap-1 text-[9px] text-amber-900 font-medium truncate">
                    <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                    <span className="truncate">
                      <strong>차선책:</strong> {alternativeParking.distance} {alternativeParking.name}
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
