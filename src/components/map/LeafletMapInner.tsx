'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Festival, Parking, Region } from '@/types';
import { renderParkingBadge } from '@/lib/parkingUtils';
import { Plus, Minus, Search, RefreshCw, Tag } from 'lucide-react';

interface LeafletMapInnerProps {
  festivals: Festival[];
  selectedFestivalId: string | null;
  selectedRegion?: Region;
  onSelectFestival: (id: string | null) => void;
  onSearchArea?: (center: { lat: number; lng: number }) => void;
}

// 10개 권역 대표 중심 카메라 좌표
const REGION_CAMERA: Record<Region, { lat: number; lng: number; zoom: number }> = {
  서울: { lat: 37.5665, lng: 126.9780, zoom: 11 },
  '경기·인천': { lat: 37.2636, lng: 127.0096, zoom: 10 },
  부산: { lat: 35.1796, lng: 129.0756, zoom: 11 }, // 해운대/광안리 중심
  대구: { lat: 35.8714, lng: 128.6014, zoom: 11 },
  대전: { lat: 36.3504, lng: 127.3845, zoom: 11 },
  강원: { lat: 37.7519, lng: 128.8760, zoom: 10 },
  충청: { lat: 36.0805, lng: 126.6912, zoom: 10 },
  전라: { lat: 35.1595, lng: 126.9056, zoom: 10 },
  경상: { lat: 35.8562, lng: 129.2247, zoom: 10 },
  제주: { lat: 33.4996, lng: 126.5312, zoom: 10 },
};

function createFestivalIcon(festival: Festival, isSelected: boolean) {
  const isFestival = festival.categoryType === '축제';

  let colorClass = 'bg-emerald-600 border-emerald-400';
  if (isSelected) {
    colorClass = 'bg-indigo-600 border-yellow-300 ring-4 ring-indigo-400/40 scale-125 z-[1000] animate-bounce';
  } else if (festival.crowdLevel === '매우 혼잡') {
    colorClass = 'bg-red-600 border-red-300';
  } else if (festival.crowdLevel === '혼잡') {
    colorClass = 'bg-amber-500 border-amber-300';
  } else if (!isFestival) {
    colorClass = 'bg-teal-600 border-teal-300';
  }

  const iconHtml = `
    <div class="relative group cursor-pointer flex flex-col items-center">
      <div class="w-9 h-9 rounded-full ${colorClass} text-white flex items-center justify-center font-bold text-sm shadow-lg border-2 transition-transform duration-200 hover:scale-110">
        ${isFestival ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.63-.69 1.08-1.36.97c-.43-.07-.77-.4-.84-.82c-.15-.9-1.12-1.45-1.98-1.11L13 13.01"/><path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.59 4.91 9.14 5.49 9.25 6.16c.07.43.4.77.82.84c.9.15 1.45 1.12 1.11 1.98L11 11.01"/></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.83V10a3 3 0 0 1 6 0Z"/><path d="M7 16v6"/><path d="M13 19v3"/><path d="M10.3 14H19a3 3 0 0 0 1-5.83V8a3 3 0 0 0-6 0v.2A3 3 0 0 0 13 14Z"/><path d="M16 14v2"/></svg>'}
      </div>
      <div class="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900/90 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-md border border-slate-700/50 max-w-[130px] truncate ${isSelected ? 'opacity-100 z-10 font-extrabold text-amber-300' : 'opacity-85 group-hover:opacity-100'}">
        ${festival.title}
      </div>
    </div>
  `;

  return L.divIcon({
    html: iconHtml,
    className: 'bg-transparent border-0 outline-none shadow-none',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

// 지도 위 'P' 파란색/인디고 커스텀 주차장 마커
function createParkingIcon(parking: Parking) {
  const isFull = parking.isRealtime && parking.availableSpaces === 0;
  const isCrowded = parking.isRealtime && parking.availableSpaces <= 5;
  const isPublic = parking.isPublic !== false;

  let colorClass = isPublic ? 'bg-indigo-600 border-indigo-200' : 'bg-slate-700 border-slate-300';
  if (isFull) {
    colorClass = 'bg-red-600 border-red-200';
  } else if (isCrowded) {
    colorClass = 'bg-amber-500 border-amber-200';
  }

  const iconHtml = `
    <div class="relative flex flex-col items-center group cursor-pointer">
      <div class="w-8 h-8 rounded-full ${colorClass} text-white flex items-center justify-center font-extrabold text-xs shadow-lg border-2 transition-transform duration-200 hover:scale-110">
        P
      </div>
      <div class="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white/95 text-slate-900 text-[9px] font-extrabold px-1.5 py-0.3 rounded border border-slate-300 shadow-md">
        ${parking.isRealtime ? (isFull ? '만차' : `${parking.availableSpaces}면`) : (parking.isPublic ? '공영' : '민영')}
      </div>
    </div>
  `;

  return L.divIcon({
    html: iconHtml,
    className: 'bg-transparent border-0 outline-none shadow-none z-[900]',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function CameraController({
  selectedFestival,
  selectedRegion,
  parkingLots,
}: {
  selectedFestival: Festival | null;
  selectedRegion?: Region;
  parkingLots: Parking[];
}) {
  const map = useMap();
  const prevFestIdRef = useRef<string | null>(null);
  const prevRegionRef = useRef<Region | undefined>(selectedRegion);

  useEffect(() => {
    if (!selectedFestival) {
      prevFestIdRef.current = null;
      return;
    }

    if (prevFestIdRef.current !== selectedFestival.id) {
      prevFestIdRef.current = selectedFestival.id;

      const points: [number, number][] = [[selectedFestival.lat, selectedFestival.lng]];
      for (const p of parkingLots) {
        if (!isNaN(p.lat) && !isNaN(p.lng)) {
          points.push([p.lat, p.lng]);
        }
      }

      if (points.length === 1) {
        map.flyTo(points[0], 16, { animate: true, duration: 0.8 });
      } else {
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 16,
          animate: true,
          duration: 0.8,
        });
      }
    }
  }, [selectedFestival, parkingLots, map]);

  useEffect(() => {
    if (selectedRegion && prevRegionRef.current !== selectedRegion && !selectedFestival) {
      prevRegionRef.current = selectedRegion;
      const cam = REGION_CAMERA[selectedRegion];
      if (cam) {
        map.flyTo([cam.lat, cam.lng], cam.zoom, { animate: true, duration: 1.0 });
      }
    }
  }, [selectedRegion, selectedFestival, map]);

  return null;
}

function MapEventsController({
  onSearchArea,
  onMapClick,
}: {
  onSearchArea?: (center: { lat: number; lng: number }) => void;
  onMapClick?: () => void;
}) {
  const map = useMap();
  const [showSearchBtn, setShowSearchBtn] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  useMapEvents({
    dragend: () => {
      setShowSearchBtn(true);
    },
    zoomend: () => {
      setShowSearchBtn(true);
    },
    click: () => {
      // 지도의 빈 배경 터치 시 선택 해제
      if (onMapClick) {
        onMapClick();
      }
    },
  });

  const handleSearch = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onSearchArea) return;
    setIsSearching(true);
    const center = map.getCenter();
    onSearchArea({ lat: center.lat, lng: center.lng });
    setTimeout(() => {
      setIsSearching(false);
      setShowSearchBtn(false);
    }, 600);
  };

  if (!showSearchBtn || !onSearchArea) return null;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto">
      <button
        onClick={handleSearch}
        disabled={isSearching}
        className="px-3.5 py-2 bg-slate-900/90 hover:bg-slate-900 text-white rounded-full text-xs font-extrabold shadow-lg backdrop-blur-md border border-slate-700/80 flex items-center gap-1.5 transition-all duration-200 hover:scale-105 active:scale-95"
      >
        {isSearching ? (
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
        ) : (
          <Search className="w-3.5 h-3.5 text-emerald-400" />
        )}
        <span>이 지역에서 재검색</span>
      </button>
    </div>
  );
}

function CustomMapControls({ onResetCenter }: { onResetCenter: () => void }) {
  const map = useMap();

  return (
    <div className="absolute top-24 right-4 z-[1000] flex flex-col gap-2 pointer-events-auto">
      <button
        onClick={onResetCenter}
        className="w-9 h-9 bg-white/95 backdrop-blur-md rounded-full shadow-md border border-slate-200/80 flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-colors font-bold text-xs"
        title="전체 축제 지도 보기"
      >
        N
      </button>

      <div className="flex flex-col rounded-xl bg-white/95 backdrop-blur-md shadow-md border border-slate-200/80 overflow-hidden">
        <button
          onClick={() => map.zoomIn()}
          className="w-9 h-9 flex items-center justify-center text-slate-700 hover:bg-slate-50 border-b border-slate-100 transition-colors"
          title="확대"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={() => map.zoomOut()}
          className="w-9 h-9 flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-colors"
          title="축소"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function LeafletMapInner({
  festivals,
  selectedFestivalId,
  selectedRegion = '서울',
  onSelectFestival,
  onSearchArea,
}: LeafletMapInnerProps) {
  // ID 중복 방지 (React key 중복 방어)
  const uniqueFestivals = useMemo(() => {
    const seen = new Set<string>();
    return festivals.filter((f) => {
      if (!f || !f.id || isNaN(f.lat) || isNaN(f.lng)) return false;
      if (seen.has(f.id)) return false;
      seen.add(f.id);
      return true;
    });
  }, [festivals]);

  const selectedFestival = useMemo(() => {
    if (!selectedFestivalId) return null;
    return uniqueFestivals.find((f) => f.id === selectedFestivalId) || null;
  }, [uniqueFestivals, selectedFestivalId]);

  const defaultCenter = useMemo(() => {
    const cam = REGION_CAMERA[selectedRegion] || REGION_CAMERA['서울'];
    return [cam.lat, cam.lng] as [number, number];
  }, [selectedRegion]);

  // selectedFestival 활성화 시에만 도보 1km 이내 공영/민영 주차장 렌더링
  const displayParkingLots = useMemo(() => {
    if (!selectedFestival || !selectedFestival.parkingLots) return [];

    const seenParking = new Set<string>();
    return [...selectedFestival.parkingLots]
      .filter((p) => {
        const key = `${p.id || p.name}-${p.lat.toFixed(4)}-${p.lng.toFixed(4)}`;
        if (seenParking.has(key)) return false;
        seenParking.add(key);
        return true;
      })
      .slice(0, 5);
  }, [selectedFestival]);

  return (
    <div className="w-full h-full relative overflow-hidden">
      <MapContainer
        center={defaultCenter}
        zoom={REGION_CAMERA[selectedRegion]?.zoom || 11}
        preferCanvas={true}
        zoomControl={false}
        className="w-full h-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapEventsController
          onSearchArea={onSearchArea}
          onMapClick={() => onSelectFestival(null)}
        />

        <CameraController
          selectedFestival={selectedFestival}
          selectedRegion={selectedRegion}
          parkingLots={displayParkingLots}
        />

        {/* 1. 모든 축제/명소 핀 마커 상시 렌더링 (선택된 항목은 강조 핀) */}
        {uniqueFestivals.map((fest, idx) => {
          const isSelected = fest.id === selectedFestivalId;
          return (
            <Marker
              key={`fest-${fest.id}-${idx}`}
              position={[fest.lat, fest.lng]}
              icon={createFestivalIcon(fest, isSelected)}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e as unknown as L.LeafletEvent);
                  onSelectFestival(fest.id);
                },
              }}
            />
          );
        })}

        {/* 2. 명소 선택 시에만 해당 명소의 주변 P 주차장 마커 동적 노출 */}
        {selectedFestival &&
          displayParkingLots.map((parking, idx) => {
            const parkingKey = `parking-${parking.id || 'prk'}-${idx}`;

            return (
              <Marker
                key={parkingKey}
                position={[parking.lat, parking.lng]}
                icon={createParkingIcon(parking)}
                eventHandlers={{
                  click: (e) => {
                    L.DomEvent.stopPropagation(e as unknown as L.LeafletEvent);
                  },
                }}
              >
                <Popup className="custom-popup" offset={[0, -10]}>
                  <div className="p-1.5 text-xs max-w-[200px]">
                    <div className="flex items-center gap-1 mb-1">
                      <span
                        className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded text-white ${
                          parking.isPublic !== false ? 'bg-indigo-600' : 'bg-slate-600'
                        }`}
                      >
                        {parking.isPublic !== false ? '공영' : '민영'}
                      </span>
                      <div className="font-extrabold text-slate-900 truncate leading-snug">
                        {parking.name}
                      </div>
                    </div>

                    <div className="text-[11px] font-extrabold my-1 flex items-center justify-between gap-1">
                      <span className="text-indigo-700 font-extrabold shrink-0">{parking.distance}</span>
                      {renderParkingBadge(parking)}
                    </div>

                    <div className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-medium truncate inline-flex items-center gap-1">
                      <Tag className="w-3 h-3 text-slate-500 shrink-0" />
                      <span>{parking.feeInfo || '요금 정보 현장확인'}</span>
                    </div>

                    {parking.address && (
                      <div className="text-[9px] text-slate-400 mt-1 truncate">
                        {parking.address}
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

        <CustomMapControls
          onResetCenter={() => {
            onSelectFestival(null);
          }}
        />
      </MapContainer>
    </div>
  );
}
