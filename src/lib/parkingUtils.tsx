import React from 'react';

export function isParkingLive(parking: any): boolean {
  if (!parking) return false;
  return Boolean(
    parking.isLive === true ||
    parking.isRealtime === true ||
    parking.park_crst_info_prvd_yn === 'Y'
  );
}

export function getParkingAvailableSpots(parking: any): number | null {
  if (!parking) return null;
  const avail = parking.availableSpots ?? parking.availableSpaces;
  if (avail !== null && avail !== undefined && String(avail).trim() !== '' && !isNaN(Number(avail))) {
    return Number(avail);
  }
  return null;
}

export function renderParkingBadge(parking: any) {
  if (!parking) return null;

  const isLive = isParkingLive(parking);
  const available = getParkingAvailableSpots(parking);
  const total = Number(parking.totalSpaces ?? parking.sum_park_cnt ?? 0);

  if (isLive && available !== null) {
    if (available === 0) {
      return (
        <span className="bg-rose-100 text-rose-700 font-semibold px-2.5 py-1 rounded-full text-xs shrink-0 border border-rose-200 inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          만차 (0/{total}면)
        </span>
      );
    }

    return (
      <span className="bg-emerald-100 text-emerald-700 font-semibold px-2.5 py-1 rounded-full text-xs shrink-0 border border-emerald-200 inline-flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        잔여 {available}/{total}면
      </span>
    );
  }

  return (
    <span className="bg-slate-100 text-slate-600 font-medium px-2.5 py-1 rounded-full text-xs shrink-0 border border-slate-200 inline-flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
      총 {total}면 (현장확인)
    </span>
  );
}
