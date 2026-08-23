'use client';

import React from 'react';
import { X, Navigation, ExternalLink, MapPin } from 'lucide-react';

interface NavigationModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetName: string;
  lat: number;
  lng: number;
  address?: string;
}

export default function NavigationModal({
  isOpen,
  onClose,
  targetName,
  lat,
  lng,
  address,
}: NavigationModalProps) {
  if (!isOpen) return null;

  const handleLaunchNavi = (type: 'kakao' | 'tmap' | 'naver') => {
    if (!lat || !lng) return;

    const encodedName = encodeURIComponent(targetName);

    if (type === 'kakao') {
      // 1. 카카오맵 / 카카오내비 (모바일 앱 설치 시 자동 연동, 미설치 시 웹 길찾기)
      const url = `https://map.kakao.com/link/to/${encodedName},${lat},${lng}`;
      window.open(url, '_blank');
    } else if (type === 'tmap') {
      // 2. 티맵 (TMAP) (모바일 웹/앱 통합 길찾기)
      const url = `https://smap.tmap.co.kr/route.html?name=${encodedName}&lat=${lat}&lon=${lng}`;
      window.open(url, '_blank');
    } else if (type === 'naver') {
      // 3. 네이버 지도 (네이버 지도 앱/웹 자동 감지 공식 링크)
      const url = `https://map.naver.com/v5/directions/-/-/${lng},${lat},${encodedName}/-/car`;
      window.open(url, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-fadeIn">
      <div
        className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 상단 헤더 */}
        <div className="px-5 pt-5 pb-3 flex items-start justify-between border-b border-slate-100">
          <div className="flex-1 pr-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 mb-0.5">
              <Navigation className="w-3.5 h-3.5" />
              <span>실시간 길찾기 내비게이션</span>
            </div>
            <h3 className="text-base font-extrabold text-slate-900 leading-snug break-keep">
              {targetName}
            </h3>
            {address && (
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-1 truncate">
                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{address}</span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 내비게이션 3사 선택 버튼 리스트 */}
        <div className="p-5 space-y-2.5">
          {/* 1. 카카오내비 */}
          <button
            onClick={() => handleLaunchNavi('kakao')}
            className="w-full flex items-center justify-between px-4 py-3 bg-[#FEE500] hover:bg-[#FADA0A] text-[#191919] font-extrabold text-sm rounded-xl shadow-xs transition-transform active:scale-98"
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-[#3C1E1E] text-[#FEE500] flex items-center justify-center font-black text-xs shrink-0">
                K
              </div>
              <div className="text-left leading-tight">
                <div>카카오내비 / 카카오맵</div>
                <div className="text-[11px] font-medium text-black/60">빠른 실시간 경로 안내</div>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-black/40" />
          </button>

          {/* 2. 티맵 (TMAP) */}
          <button
            onClick={() => handleLaunchNavi('tmap')}
            className="w-full flex items-center justify-between px-4 py-3 bg-[#0050FF] hover:bg-[#0043D6] text-white font-extrabold text-sm rounded-xl shadow-xs transition-transform active:scale-98"
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-white text-[#0050FF] flex items-center justify-center font-black text-xs shrink-0">
                T
              </div>
              <div className="text-left leading-tight">
                <div>티맵 (TMAP)</div>
                <div className="text-[11px] font-medium text-white/80">운전자 선호 1위 내비</div>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-white/60" />
          </button>

          {/* 3. 네이버지도 */}
          <button
            onClick={() => handleLaunchNavi('naver')}
            className="w-full flex items-center justify-between px-4 py-3 bg-[#03C75A] hover:bg-[#02B350] text-white font-extrabold text-sm rounded-xl shadow-xs transition-transform active:scale-98"
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-white text-[#03C75A] flex items-center justify-center font-black text-xs shrink-0">
                N
              </div>
              <div className="text-left leading-tight">
                <div>네이버 지도 내비</div>
                <div className="text-[11px] font-medium text-white/80">대중교통 & 차량 길찾기</div>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-white/60" />
          </button>
        </div>

        {/* 모달 하단 닫기 */}
        <div className="px-5 pb-5 pt-1">
          <button
            onClick={onClose}
            className="w-full py-2.5 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
