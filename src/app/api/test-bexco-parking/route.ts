import { NextResponse } from 'next/server';

const PARKING_INFO_API_URL =
  'https://api.koreaconnect.kr/01/5/2606081732514722903DCP/LOGIS/api/v1/parking/info';

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

  // 벡스코 좌표 (APEC로 55)
  const targetLat = 35.1691;
  const targetLng = 129.1364;

  try {
    const baseInfoUrl = `${PARKING_INFO_API_URL}?addr_cd=26350&addr_type=SIGUNGU&pageNo=1&pageSize=1000`;
    const res = await fetch(baseInfoUrl, { headers, cache: 'no-store' });
    const json = await res.json();
    const rawList = json?.data || json?.response?.body?.items?.item || json?.items || [];
    const items = Array.isArray(rawList) ? rawList : rawList ? [rawList] : [];

    // '벡스코' 키워드가 들어간 모든 주차장 필터
    const bexcoNameMatched = items.filter((item: any) => (item.prl_nm || item.prk_nm || '').includes('벡스코'));

    // 벡스코 좌표 반경 500m 이내에 존재하는 모든 원본 주차장 필터
    const radiusMatched = items
      .map((item: any) => {
        const lat = Number(item.la_val || item.lat);
        const lng = Number(item.lo_val || item.lng);
        if (!lat || !lng) return null;
        const dist = getDistance(targetLat, targetLng, lat, lng);
        if (dist > 500) return null;
        return {
          ...item,
          distanceMeters: Math.round(dist),
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      success: true,
      totalHaeundaeCount: items.length,
      bexcoKeywordMatchedCount: bexcoNameMatched.length,
      bexcoKeywordRecords: bexcoNameMatched.map((p: any) => ({
        std_prl_cd: p.std_prl_cd || p.std_prk_mg_no,
        prl_nm: p.prl_nm || p.prk_nm,
        prl_div_nm: p.prl_div_nm || p.prk_kind_nm,
        sum_park_cnt: p.sum_park_cnt || p.gnr_park_cnt,
        souc_nm: p.souc_nm,
        addr: p.prl_road_addr_nm || p.prl_jino_addr_nm || p.l_road_addr_nm,
        bsc_park_amt: p.bsc_park_amt || p.basic_charge,
        bsc_park_tme: p.bsc_park_tme || p.basic_time,
        pchrg_free_nm: p.pchrg_free_nm,
      })),
      radius500mAllRecords: radiusMatched.map((p: any) => ({
        std_prl_cd: p.std_prl_cd || p.std_prk_mg_no,
        prl_nm: p.prl_nm || p.prk_nm,
        distanceMeters: p.distanceMeters,
        prl_div_nm: p.prl_div_nm || p.prk_kind_nm,
        sum_park_cnt: p.sum_park_cnt || p.gnr_park_cnt,
        souc_nm: p.souc_nm,
        addr: p.prl_road_addr_nm || p.prl_jino_addr_nm || p.l_road_addr_nm,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
