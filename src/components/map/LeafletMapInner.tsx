'use client';

import { useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Festival, Parking } from '@/types';
import { Navigation, Plus, Minus, Car } from 'lucide-react';

interface LeafletMapInnerProps {
  festivals: Festival[];
  selectedFestivalId: string | null;
  onSelectFestival: (id: string) => void;
}

// 1. Leaflet Custom Icon 생성 함수
function createFestivalIcon(festival: Festival, isSelected: boolean) {
  const isFestival = festival.categoryType === '축제';

  let colorClass = 'bg-emerald-600 border-emerald-400';
  if (isSelected) {
    colorClass = 'bg-indigo-600 border-yellow-300 scale-125 z-[1000]';
  } else if (festival.crowdLevel === '매우 혼잡') {
    colorClass = 'bg-red-600 border-red-300';
  } else if (festival.crowdLevel === '혼잡') {
    colorClass = 'bg-amber-500 border-amber-300';
  } else if (!isFestival) {
    colorClass = 'bg-teal-600 border-teal-300';
  }

  const iconHtml = `
    <div class="relative group cursor-pointer flex flex-col items-center">
      <div class="w-8 h-8 rounded-full ${colorClass} text-white flex items-center justify-center font-bold text-xs shadow-md border-2 transition-transform duration-200 hover:scale-110">
        ${isFestival ? '🎉' : '🌳'}
      </div>
      <div class="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md border border-slate-700/50 max-w-[120px] truncate ${isSelected ? 'opacity-100 z-10' : 'opacity-80 group-hover:opacity-100'}">
        ${festival.title}
      </div>
    </div>
  `;

  return L.divIcon({
    html: iconHtml,
    className: 'bg-transparent border-0 outline-none shadow-none',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function createParkingIcon(parking: Parking) {
  const isFull = parking.availableSpaces === 0;
  const isCrowded = parking.availableSpaces <= 5;

  let colorClass = 'bg-emerald-500 border-emerald-200';
  if (isFull) {
    colorClass = 'bg-red-500 border-red-200';
  } else if (isCrowded) {
    colorClass = 'bg-amber-500 border-amber-200';
  }

  const iconHtml = `
    <div class="relative flex flex-col items-center">
      <div class="w-6 h-6 rounded-full ${colorClass} text-white flex items-center justify-center font-bold text-[10px] shadow-sm border shrink-0">
        P
      </div>
      <div class="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white/95 text-slate-800 text-[9px] font-extrabold px-1.5 py-0.2 rounded border border-slate-200 shadow-2xs">
        ${isFull ? '만차' : `${parking.availableSpaces}면`}
      </div>
    </div>
  `;

  return L.divIcon({
    html: iconHtml,
    className: 'bg-transparent border-0 outline-none shadow-none',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

// 2. 단방향 카메라 컨트롤러 (Jittering 방지 및 flyTo 이동)
function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  const prevCenterRef = useRef<[number, number] | null>(null);

  useEffect(() => {
    if (!center || isNaN(center[0]) || isNaN(center[1])) return;
    if (
      !prevCenterRef.current ||
      prevCenterRef.current[0] !== center[0] ||
      prevCenterRef.current[1] !== center[1]
    ) {
      prevCenterRef.current = center;
      map.flyTo(center, 14, {
        animate: true,
        duration: 0.8,
      });
    }
  }, [center, map]);

  return null;
}

// 3. 우측 상단 플로팅 컨트롤 (나침반, 줌인/아웃)
function CustomMapControls({ onResetCenter }: { onResetCenter: () => void }) {
  const map = useMap();

  return (
    <div className="absolute top-24 right-4 z-[1000] flex flex-col gap-2 pointer-events-auto">
      <button
        onClick={onResetCenter}
        className="w-9 h-9 bg-white/95 backdrop-blur-md rounded-full shadow-md border border-slate-200/80 flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-colors font-bold text-xs"
        title="선택 위치 재정렬"
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
  onSelectFestival,
}: LeafletMapInnerProps) {
  // 축제/명소 목록 중복 제거 (De-duplication)
  const uniqueFestivals = useMemo(() => {
    const seen = new Set<string>();
    return festivals.filter((f) => {
      const key = `${f.id}-${f.lat.toFixed(4)}-${f.lng.toFixed(4)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [festivals]);

  const selectedFestival = useMemo(() => {
    return uniqueFestivals.find((f) => f.id === selectedFestivalId) || uniqueFestivals[0] || null;
  }, [uniqueFestivals, selectedFestivalId]);

  const centerCoordinates = useMemo<[number, number]>(() => {
    if (selectedFestival && !isNaN(selectedFestival.lat) && !isNaN(selectedFestival.lng)) {
      return [selectedFestival.lat, selectedFestival.lng];
    }
    return [37.5665, 126.9780];
  }, [selectedFestival]);

  // 지도 시각적 클린업: 선택된 축제의 주변 최단거리 주차장 상위 3~5개만 노출
  const displayParkingLots = useMemo(() => {
    if (!selectedFestival || !selectedFestival.parkingLots) return [];

    const seenParking = new Set<string>();
    const sorted = [...selectedFestival.parkingLots]
      .filter((p) => {
        const key = `${p.id || p.name}-${p.lat.toFixed(4)}-${p.lng.toFixed(4)}`;
        if (seenParking.has(key)) return false;
        seenParking.add(key);
        return true;
      })
      .sort((a, b) => a.distanceMeters - b.distanceMeters);

    return sorted.slice(0, 5); // 상위 5개만 핀 렌더링
  }, [selectedFestival]);

  return (
    <div className="w-full h-full relative overflow-hidden">
      <MapContainer
        center={centerCoordinates}
        zoom={14}
        preferCanvas={true}
        zoomControl={false}
        className="w-full h-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController center={centerCoordinates} />

        {/* 1. 축제/명소 마커 렌더링 (고유 key 적용) */}
        {uniqueFestivals.map((fest, idx) => {
          const isSelected = fest.id === selectedFestivalId;
          const markerKey = `fest-marker-${fest.id || 'id'}-${fest.lat}-${fest.lng}-${idx}`;

          return (
            <Marker
              key={markerKey}
              position={[fest.lat, fest.lng]}
              icon={createFestivalIcon(fest, isSelected)}
              eventHandlers={{
                click: () => onSelectFestival(fest.id),
              }}
            />
          );
        })}

        {/* 2. 선택된 축제의 주변 최단거리 주차장 상위 5개만 조건부 렌더링 (클린업 적용) */}
        {displayParkingLots.map((parking, idx) => {
          const parkingKey = `parking-marker-${parking.id || 'prk'}-${parking.lat}-${parking.lng}-${idx}`;

          return (
            <Marker
              key={parkingKey}
              position={[parking.lat, parking.lng]}
              icon={createParkingIcon(parking)}
            >
              <Popup className="custom-popup">
                <div className="p-1 text-xs">
                  <div className="font-bold text-slate-900">{parking.name}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    잔여: <span className="font-bold text-emerald-600">{parking.availableSpaces}면</span> / 총 {parking.totalSpaces}면
                  </div>
                  {parking.address && (
                    <div className="text-[9px] text-slate-400 mt-0.5 truncate">{parking.address}</div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        <CustomMapControls
          onResetCenter={() => {
            if (selectedFestival) {
              onSelectFestival(selectedFestival.id);
            }
          }}
        />
      </MapContainer>
    </div>
  );
}
