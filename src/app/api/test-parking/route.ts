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

export async function GET() {
  const apiKey = process.env.PARKING_API_KEY || process.env.TOUR_API_KEY || '';
  const headers = {
    'api_user_key_id': apiKey,
    'Accept': 'application/json',
  };

  // 광안리 드론 라이트쇼 좌표
  const targetLat = 35.1532;
  const targetLng = 129.1185;

  try {
    // 1. 부산 수영구(26500) 및 부산광역시(26) 주차장 기본정보 호출
    const baseInfoUrlBusan = `${PARKING_INFO_API_URL}?pageNo=1&pageSize=1000&addr_cd=26500&addr_type=SIGUNGU`;
    const baseInfoUrlSido = `${PARKING_INFO_API_URL}?pageNo=1&pageSize=1000&addr_cd=26&addr_type=SIDO`;

    const [sigunguRes, sidoRes, liveRes] = await Promise.all([
      fetch(baseInfoUrlBusan, { headers, cache: 'no-store' }),
      fetch(baseInfoUrlSido, { headers, cache: 'no-store' }),
      fetch(`${PARKING_STATUS_API_URL}?pageNo=1&pageSize=1000`, { headers, cache: 'no-store' }),
    ]);

    const sigunguJson = await sigunguRes.json();
    const sidoJson = await sidoRes.json();
    const liveJson = await liveRes.json();

    const sigunguList = sigunguJson?.data || sigunguJson?.response?.body?.items?.item || sigunguJson?.items || [];
    const sidoList = sidoJson?.data || sidoJson?.response?.body?.items?.item || sidoJson?.items || [];
    const liveList = liveJson?.data || liveJson?.response?.body?.items?.item || liveJson?.items || [];

    const baseItems = [
      ...(Array.isArray(sigunguList) ? sigunguList : [sigunguList]),
      ...(Array.isArray(sidoList) ? sidoList : [sidoList]),
    ];

    // 실시간 Map 구축 (std_prl_cd 기준)
    const liveItems = Array.isArray(liveList) ? liveList : [liveList];
    const liveMap = new Map();
    liveItems.forEach((item: any) => {
      const code = item.std_prl_cd || item.std_prk_mg_no || item.std_prk_cd;
      if (code) liveMap.set(code, item);
    });

    // 2. 광안리 1km(1000m) 이내 필터링 & Join
    const nearby = baseItems
      .map((item: any) => {
        const lat = Number(item.la_val || item.lat);
        const lng = Number(item.lo_val || item.lng);
        if (!lat || !lng) return null;
        const dist = getDistance(targetLat, targetLng, lat, lng);
        if (dist > 1500) return null; // 1.5km 테스트 시도

        const code = item.std_prl_cd || item.std_prk_mg_no;
        const live = liveMap.get(code);
        const currentParked = live ? Number(live.sum_curr_use_park_cnt || live.now_park_cnt || 0) : null;
        const totalSpots = Number(item.sum_park_cnt || item.gnr_park_cnt || live?.sum_park_cnt || 0);

        return {
          std_prl_cd: code,
          prl_nm: item.prl_nm || item.prk_nm,
          addr: item.prl_road_addr_nm || item.prl_jino_addr_nm || item.l_road_addr_nm,
          prl_div_nm: item.prl_div_nm || item.prl_kind_nm || '주차장',
          distanceMeters: Math.round(dist),
          walkMinutes: Math.ceil(dist / 67),
          totalSpots,
          currentParked,
          availableSpots: live ? Math.max(0, totalSpots - (currentParked || 0)) : null,
          feeInfo: item.pchrg_free_nm === '무료' ? '무료' : `${item.bsc_park_tme || item.basic_time || 30}분당 ${item.bsc_park_amt || item.basic_charge || 0}원`,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.distanceMeters - b.distanceMeters);

    return NextResponse.json({
      success: true,
      apiKeyConfigured: !!apiKey,
      sigunguApiStatus: sigunguRes.status,
      sigunguCount: Array.isArray(sigunguList) ? sigunguList.length : 0,
      sidoApiStatus: sidoRes.status,
      sidoCount: Array.isArray(sidoList) ? sidoList.length : 0,
      gwanganriNearbyCount: nearby.length,
      gwanganriParkingLots: nearby,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
