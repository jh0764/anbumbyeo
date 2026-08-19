'use client';

import { useRef, useEffect } from 'react';
import { Festival } from '@/types';
import { getFestivalStatus, getDDayString } from '@/lib/festivalUtils';
import { Users, Car, MapPin, Calendar, ChevronRight, Hourglass } from 'lucide-react';
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

  if (festivals.length === 0) {
    return (
      <div className="w-full py-4 px-4 bg-white/95 backdrop-blur-md rounded-2xl shadow-lg border border-slate-200 text-center text-xs text-slate-500 font-medium">
        해당 조건의 축제가 존재하지 않습니다.
      </div>
    );
  }

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        className="flex items-center gap-3 overflow-x-auto snap-x snap-mandatory px-4 py-2 no-scrollbar scroll-smooth"
      >
        {festivals.map((fest) => {
          const isSelected = fest.id === selectedFestivalId;
          const status = getFestivalStatus(fest);

          // 가장 가까운 주차장 찾기
          const nearestParking = fest.parkingLots.length > 0
            ? fest.parkingLots.reduce((prev, curr) =>
                curr.distanceMeters < prev.distanceMeters ? curr : prev
              , fest.parkingLots[0])
            : null;

          return (
            <div
              key={fest.id}
              data-festival-id={fest.id}
              onClick={() => onSelectFestival(fest.id)}
              className={clsx(
                'snap-center shrink-0 w-[295px] p-3.5 bg-white/95 backdrop-blur-md rounded-2xl border transition-all duration-200 shadow-md cursor-pointer flex flex-col justify-between',
                isSelected
                  ? 'border-emerald-600 ring-2 ring-emerald-500/20 scale-[1.01]'
                  : 'border-slate-200 hover:border-slate-300'
              )}
            >
              <div>
                {/* 상단 뱃지 및 카테고리 / 상태 분기 */}
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                    {fest.region} · {fest.category}
                  </span>

                  {status === 'LIVE' ? (
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
                    <div className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white flex items-center gap-1 shadow-2xs">
                      <Hourglass className="w-3 h-3" />
                      <span>개막 {getDDayString(fest.startDate)}</span>
                    </div>
                  )}
                </div>

                {/* 축제명 및 일정 */}
                <h3 className="text-sm font-bold text-slate-900 truncate">{fest.title}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="truncate">{fest.locationName}</span>
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>{fest.period}</span>
                </p>
              </div>

              {/* 하단 주차 잔여 및 상세 버튼 - 상태별 분기 */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="p-1 bg-indigo-50 text-indigo-600 rounded-md">
                    <Car className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 leading-none">최단거리 주차장</div>
                    {status === 'LIVE' ? (
                      nearestParking ? (
                        <div className="text-xs font-bold text-indigo-900 mt-0.5">
                          잔여{' '}
                          <span className="text-indigo-600 font-extrabold">
                            {nearestParking.availableSpaces}
                          </span>{' '}
                          / {nearestParking.totalSpaces}면
                        </div>
                      ) : (
                        <div className="text-xs font-medium text-slate-400 mt-0.5">정보 없음</div>
                      )
                    ) : (
                      <div className="text-[10px] font-bold text-indigo-700 mt-0.5">
                        총 {nearestParking?.totalSpaces ?? 100}면{' '}
                        <span className="text-[9px] text-slate-400 font-normal">
                          (축제 시작 시 연동)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectFestival(fest.id);
                    onOpenDetail();
                  }}
                  className="px-2.5 py-1.5 bg-slate-900 text-white rounded-lg text-[11px] font-bold flex items-center gap-0.5 hover:bg-slate-800 transition-colors shadow-2xs"
                >
                  <span>상세</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
