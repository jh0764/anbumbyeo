import { NextResponse } from 'next/server';

const PARKING_INFO_API_URL =
  'https://api.koreaconnect.kr/01/5/2606081732514722903DCP/LOGIS/api/v1/parking/info';
const PARKING_STATUS_API_URL =
  'https://api.koreaconnect.kr/01/7/2606081732514722903DCP/LOGIS/api/v1/parking/status';

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isPublicParkingDiv(info: any): boolean {
  const divName = String(info.prl_div_nm || info.prl_kind_nm || info.prk_kind_nm || info.prl_se_cd || '');
  const rawName = String(info.prl_nm || info.prk_nm || '');

  if (divName.includes('민영') || divName.includes('부설')) {
    return false;
  }
  if (divName.includes('공영') || rawName.includes('공영') || rawName.includes('구청') || rawName.includes('시청') || rawName.includes('동사무소') || rawName.includes('주민센터')) {
    return true;
  }
  return false;
}

function parseFeeInfoFromApi(info: any, isPublic: boolean): string {
  const bscTime = info.bsc_park_tme || info.basic_time || info.gnr_basic_prk_time;
  const bscAmt = info.bsc_park_amt || info.basic_charge || info.gnr_basic_prk_chr;
  const numBscAmt = Number(bscAmt);

  if (!isPublic) {
    if (bscTime && bscAmt && !isNaN(numBscAmt) && numBscAmt > 0) {
      return `${bscTime}분당 ${numBscAmt.toLocaleString()}원`;
    }
    return '민영 현장 요금제';
  }

  const isFree = info.pchrg_free_nm === '무료' || (bscAmt !== undefined && numBscAmt === 0);
  if (isFree) return '무료';

  if (bscTime && bscAmt && !isNaN(numBscAmt) && numBscAmt > 0) {
    return `${bscTime}분당 ${numBscAmt.toLocaleString()}원`;
  }
  return '현장 요금제';
}

export async function GET() {
  const apiKey = process.env.PARKING_API_KEY || process.env.TOUR_API_KEY || '';
  const headers = {
    'api_user_key_id': apiKey,
    'Accept': 'application/json',
  };

  const targetLat = 35.1532;
  const targetLng = 129.1185;

  try {
    const baseInfoUrlBusan = `${PARKING_INFO_API_URL}?pageNo=1&pageSize=1000&addr_cd=26500&addr_type=SIGUNGU`;
    const liveInfoUrlBusan = `${PARKING_STATUS_API_URL}?pageNo=1&pageSize=1000&addr_cd=26500&addr_type=SIGUNGU`;

    const [infoRes, liveRes] = await Promise.all([
      fetch(baseInfoUrlBusan, { headers, cache: 'no-store' }),
      fetch(liveInfoUrlBusan, { headers, cache: 'no-store' }),
    ]);

    const infoJson = await infoRes.json();
    const liveJson = await liveRes.json();

    const rawList = infoJson?.data || infoJson?.response?.body?.items?.item || infoJson?.items || [];
    const baseItems = Array.isArray(rawList) ? rawList : [rawList];

    const rawLiveList = liveJson?.data || liveJson?.response?.body?.items?.item || liveJson?.items || [];
    const liveItems = Array.isArray(rawLiveList) ? rawLiveList : [rawLiveList];

    const liveMap = new Map();
    liveItems.forEach((item: any) => {
      const code = item.std_prl_cd || item.std_prk_mg_no || item.std_prk_cd;
      if (code) liveMap.set(code, item);
    });

    const nearby = baseItems
      .map((item: any) => {
        const lat = Number(item.la_val || item.lat);
        const lng = Number(item.lo_val || item.lng);
        if (!lat || !lng) return null;

        const totalSpots = Number(item.sum_park_cnt || item.gnr_park_cnt || 0);
        // 10면 이상 유효 주차장만 추출
        if (totalSpots < 10) return null;

        const dist = getDistance(targetLat, targetLng, lat, lng);
        if (dist > 1000) return null;

        const code = item.std_prl_cd || item.std_prk_mg_no;
        const live = liveMap.get(code);
        const isPublic = isPublicParkingDiv(item);
        const currentParked = live ? Number(live.sum_curr_use_park_cnt || live.now_park_cnt || 0) : null;

        return {
          std_prl_cd: code,
          prl_nm: item.prl_nm || item.prk_nm,
          addr: item.prl_road_addr_nm || item.prl_jino_addr_nm || item.l_road_addr_nm,
          isPublic,
          prl_div_nm: isPublic ? '공영' : '민영',
          distanceMeters: Math.round(dist),
          walkMinutes: Math.ceil(dist / 67),
          totalSpots,
          currentParked,
          availableSpots: live ? Math.max(0, totalSpots - (currentParked || 0)) : null,
          feeInfo: parseFeeInfoFromApi(item, isPublic),
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.distanceMeters - b.distanceMeters);

    return NextResponse.json({
      success: true,
      apiKeyConfigured: !!apiKey,
      infoApiStatus: infoRes.status,
      infoCount: baseItems.length,
      liveApiStatus: liveRes.status,
      liveCount: liveItems.length,
      gwanganriNearbyCount: nearby.length,
      gwanganriParkingLots: nearby,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
