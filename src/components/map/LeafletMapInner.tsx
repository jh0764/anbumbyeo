'use client';

import { useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Festival, Parking } from '@/types';
import { Plus, Minus } from 'lucide-react';

interface LeafletMapInnerProps {
  festivals: Festival[];
  selectedFestivalId: string | null;
  onSelectFestival: (id: string | null) => void;
}

// 1. Leaflet Custom Icon 생성 함수
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
        ${isFestival ? '🎉' : '🌳'}
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
      <div class="w-7 h-7 rounded-full ${colorClass} text-white flex items-center justify-center font-extrabold text-xs shadow-md border shrink-0">
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
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

// 2. Focus Mode 시 선택 축제 + 주차장 좌표 FitBounds 카메라 조정
function FocusCameraController({
  selectedFestival,
  parkingLots,
}: {
  selectedFestival: Festival | null;
  parkingLots: Parking[];
}) {
  const map = useMap();
  const prevIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedFestival) {
      prevIdRef.current = null;
      return;
    }

    if (prevIdRef.current !== selectedFestival.id) {
      prevIdRef.current = selectedFestival.id;

      const points: [number, number][] = [[selectedFestival.lat, selectedFestival.lng]];
      for (const p of parkingLots) {
        if (!isNaN(p.lat) && !isNaN(p.lng)) {
          points.push([p.lat, p.lng]);
        }
      }

      if (points.length === 1) {
        map.flyTo(points[0], 15, { animate: true, duration: 0.8 });
      } else {
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, {
          padding: [60, 60],
          maxZoom: 15,
          animate: true,
          duration: 0.8,
        });
      }
    }
  }, [selectedFestival, parkingLots, map]);

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
  onSelectFestival,
}: LeafletMapInnerProps) {
  // 축제/명소 목록 중복 제거
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
    if (!selectedFestivalId) return null;
    return uniqueFestivals.find((f) => f.id === selectedFestivalId) || null;
  }, [uniqueFestivals, selectedFestivalId]);

  const centerCoordinates = useMemo<[number, number]>(() => {
    if (selectedFestival && !isNaN(selectedFestival.lat) && !isNaN(selectedFestival.lng)) {
      return [selectedFestival.lat, selectedFestival.lng];
    }
    return [37.5665, 126.9780];
  }, [selectedFestival]);

  // Focus Mode: 선택된 축제의 주변 반경 1.5km 주차장 상위 5개
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

    return sorted.slice(0, 5);
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

        <FocusCameraController
          selectedFestival={selectedFestival}
          parkingLots={displayParkingLots}
        />

        {/* 1. 마커 조건부 렌더링:
            - Focus Mode (selectedFestivalId 존재): 선택된 축제 1개만 노출
            - Overall Mode (selectedFestivalId null): 전체 축제 마커 노출 */}
        {selectedFestival ? (
          <Marker
            key={`fest-focus-${selectedFestival.id}`}
            position={[selectedFestival.lat, selectedFestival.lng]}
            icon={createFestivalIcon(selectedFestival, true)}
          />
        ) : (
          uniqueFestivals.map((fest, idx) => (
            <Marker
              key={`fest-all-${fest.id}-${idx}`}
              position={[fest.lat, fest.lng]}
              icon={createFestivalIcon(fest, false)}
              eventHandlers={{
                click: () => onSelectFestival(fest.id),
              }}
            />
          ))
        )}

        {/* 2. 주차장 마커 렌더링 (Focus Mode에서만 연계 5개 표시) */}
        {selectedFestival &&
          displayParkingLots.map((parking, idx) => {
            const parkingKey = `parking-${parking.id || 'prk'}-${idx}`;

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
            onSelectFestival(null);
          }}
        />
      </MapContainer>
    </div>
  );
}
