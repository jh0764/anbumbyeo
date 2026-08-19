'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Festival, Parking } from '@/types';

// Leaflet 기본 아이콘 이슈 방지
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// 커스텀 축제 마커 아이콘
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

  const scale = isSelected ? 'scale-125 z-50 ring-4 ring-white/80' : 'hover:scale-110';

  const html = `
    <div class="relative flex items-center justify-center transition-all duration-200 ${scale}">
      <div class="w-10 h-10 rounded-full ${bgColor} border-2 ${borderColor} text-white shadow-xl flex items-center justify-center font-bold text-sm">
        🎉
      </div>
      <div class="absolute -bottom-1 w-2.5 h-2.5 ${bgColor} rotate-45"></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-festival-icon',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
  });
};

// 커스텀 주차장 마커 아이콘
const createParkingIcon = (available: number) => {
  const isFull = available === 0;
  const bgColor = isFull ? 'bg-slate-700' : available < 10 ? 'bg-orange-500' : 'bg-indigo-600';

  const html = `
    <div class="flex items-center gap-1 px-2.5 py-1 rounded-full ${bgColor} text-white text-xs font-extrabold shadow-lg border-2 border-white">
      <span>P</span>
      <span class="bg-white/20 px-1 rounded text-[11px] font-bold">${available}면</span>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-parking-icon',
    iconSize: [64, 28],
    iconAnchor: [32, 14],
    popupAnchor: [0, -14],
  });
};

// 지도의 중심점을 변경하는 내부 컨트롤러
function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.2, animate: true });
  }, [center, zoom, map]);
  return null;
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
        zoom={13}
        scrollWheelZoom={true}
        className="w-full h-full z-0"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {mapCenter && <MapController center={mapCenter} zoom={13} />}

        {/* 축제 마커 */}
        {festivals.map((festival) => (
          <Marker
            key={festival.id}
            position={[festival.lat, festival.lng]}
            icon={createFestivalIcon(festival.crowdLevel, festival.id === selectedFestivalId)}
            eventHandlers={{
              click: () => onSelectFestival(festival.id),
            }}
          >
            <Popup>
              <div className="p-1 min-w-[180px]">
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                  {festival.region}
                </span>
                <div className="font-bold text-sm text-slate-900 mt-1">{festival.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{festival.locationName}</div>
                <div className="mt-2 inline-block px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800">
                  혼잡도: {festival.crowdLevel}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* 선택된 축제 주변 주차장 마커 */}
        {selectedFestival?.parkingLots.map((parking: Parking) => (
          <Marker
            key={parking.id}
            position={[parking.lat, parking.lng]}
            icon={createParkingIcon(parking.availableSpaces)}
          >
            <Popup>
              <div className="p-1 min-w-[160px]">
                <div className="font-bold text-xs text-indigo-900">{parking.name}</div>
                <div className="text-xs text-slate-600 mt-1">
                  잔여 주차면수:{' '}
                  <span className="font-extrabold text-indigo-600">
                    {parking.availableSpaces} / {parking.totalSpaces}면
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">축제장 거리: {parking.distance}</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
