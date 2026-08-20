'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Festival, Parking } from '@/types';
import { LocateFixed, Plus, Minus } from 'lucide-react';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// 축제 마커 아이콘 (외부 배경/테두리 투명)
const createFestivalIcon = (crowdLevel: string, isSelected: boolean) => {
  let bgColor = 'bg-emerald-500';
  let borderColor = 'border-emerald-700';

  if (crowdLevel === '매우 혼잡') {
    bgColor = 'bg-red-500';
    borderColor = 'border-red-700';
  } else if (crowdLevel === '혼잡') {
    bgColor = 'bg-amber-500';
    borderColor = 'border-amber-700';
  } else if (crowdLevel === '보통') {
    bgColor = 'bg-blue-500';
    borderColor = 'border-blue-700';
  }

  const scale = isSelected ? 'scale-125 z-50 ring-4 ring-white/90 shadow-md' : 'hover:scale-110';

  const html = `
    <div class="relative flex items-center justify-center transition-all duration-200 ${scale} bg-transparent border-0 outline-none shadow-none">
      <div class="w-10 h-10 rounded-full ${bgColor} border-2 ${borderColor} text-white shadow-md flex items-center justify-center font-bold text-sm">
        🎉
      </div>
      <div class="absolute -bottom-1 w-2.5 h-2.5 ${bgColor} rotate-45"></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-festival-icon bg-transparent border-0 outline-none shadow-none',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
  });
};

// 주차장 마커 아이콘 (외부 배경/테두리 투명)
const createParkingIcon = (available: number) => {
  let bgColor = 'bg-emerald-600';
  let badgeText = `${available}면`;

  if (available === 0) {
    bgColor = 'bg-red-500';
    badgeText = '만차';
  } else if (available <= 5) {
    bgColor = 'bg-amber-500';
  }

  const html = `
    <div class="flex items-center gap-1 px-2.5 py-1 rounded-full ${bgColor} text-white text-xs font-extrabold shadow-md border-2 border-white transition-transform hover:scale-105 bg-transparent outline-none">
      <span>P</span>
      <span class="bg-white/20 px-1 rounded text-[11px] font-bold">${badgeText}</span>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-parking-icon bg-transparent border-0 outline-none shadow-none',
    iconSize: [64, 28],
    iconAnchor: [32, 14],
  });
};

// 지도 컨트롤러 및 '우측 상단 (top-24 right-4)' 플로팅 컨트롤 컴포넌트
function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.2, animate: true });
  }, [center, zoom, map]);

  return (
    <div className="absolute top-24 right-4 z-10 flex flex-col gap-2">
      {/* 줌 인/아웃 컨트롤 (top-24 right-4) */}
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-md border border-slate-200/80 p-1 flex flex-col items-center divide-y divide-slate-100">
        <button
          onClick={() => map.zoomIn()}
          className="p-2 text-slate-700 hover:bg-slate-100 rounded-t-xl transition-colors"
          title="확대"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={() => map.zoomOut()}
          className="p-2 text-slate-700 hover:bg-slate-100 rounded-b-xl transition-colors"
          title="축소"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>

      {/* 축제 위치 재정렬 버튼 */}
      <button
        onClick={() => map.flyTo(center, zoom, { duration: 1 })}
        className="p-2.5 bg-white/95 backdrop-blur-md text-emerald-700 hover:bg-emerald-50 rounded-2xl shadow-md border border-slate-200/80 transition-all active:scale-95 flex items-center justify-center"
        title="축제 위치로 이동"
      >
        <LocateFixed className="w-4.5 h-4.5" />
      </button>
    </div>
  );
}

interface LeafletMapInnerProps {
  festivals: Festival[];
  selectedFestivalId: string | null;
  onSelectFestival: (id: string) => void;
}

export default function LeafletMapInner({
  festivals,
  selectedFestivalId,
  onSelectFestival,
}: LeafletMapInnerProps) {
  const selectedFestival = festivals.find((f) => f.id === selectedFestivalId) || festivals[0];

  const mapCenter: [number, number] = selectedFestival
    ? [selectedFestival.lat, selectedFestival.lng]
    : [37.5283, 126.9328];

  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={mapCenter}
        zoom={14}
        scrollWheelZoom={true}
        className="w-full h-full z-0"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {mapCenter && <MapController center={mapCenter} zoom={14} />}

        {/* 축제 마커 (Popup 제거 처리) */}
        {festivals.map((festival) => (
          <Marker
            key={festival.id}
            position={[festival.lat, festival.lng]}
            icon={createFestivalIcon(festival.crowdLevel, festival.id === selectedFestivalId)}
            eventHandlers={{
              click: () => onSelectFestival(festival.id),
            }}
          />
        ))}

        {/* 선택된 축제 주변 주차장 마커 (Popup 제거 처리) */}
        {selectedFestival?.parkingLots.map((parking: Parking) => (
          <Marker
            key={parking.id}
            position={[parking.lat, parking.lng]}
            icon={createParkingIcon(parking.availableSpaces)}
          />
        ))}
      </MapContainer>
    </div>
  );
}
