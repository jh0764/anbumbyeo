import { NextResponse } from 'next/server';

const PARKING_STATUS_API_URL =
  'https://api.koreaconnect.kr/01/7/2606081732514722903DCP/LOGIS/api/v1/parking/status';
const PARKING_INFO_API_URL =
  'https://api.koreaconnect.kr/01/5/2606081732514722903DCP/LOGIS/api/v1/parking/info';

export async function GET() {
  const apiKey = process.env.PARKING_API_KEY || process.env.TOUR_API_KEY || '';
  const headers = {
    'api_user_key_id': apiKey,
    'Accept': 'application/json',
  };

  const urls = [
    {
      name: '부산 수영구 실시간 (status API)',
      url: `${PARKING_STATUS_API_URL}?addr_cd=26500&addr_type=SIGUNGU&pageNo=1&pageSize=50`,
    },
    {
      name: '부산광역시 전체 실시간 (status API)',
      url: `${PARKING_STATUS_API_URL}?addr_cd=26&addr_type=SIGUNGU&pageNo=1&pageSize=50`,
    },
    {
      name: '부산 수영구 기본정보 (info API)',
      url: `${PARKING_INFO_API_URL}?addr_cd=26500&addr_type=SIGUNGU&pageNo=1&pageSize=50`,
    },
  ];

  const results: any[] = [];

  for (const target of urls) {
    try {
      const res = await fetch(target.url, { headers, cache: 'no-store' });
      const json = await res.json();

      const rawList = json?.data || json?.response?.body?.items?.item || json?.items || [];
      const items = Array.isArray(rawList) ? rawList : rawList ? [rawList] : [];

      results.push({
        targetName: target.name,
        httpStatus: res.status,
        resultCode: json?.resultCode || json?.response?.header?.resultCode || 'SUCCESS',
        totalCount: json?.totalCount || items.length,
        sampleItems: items.slice(0, 5).map((item: any) => ({
          std_prl_cd: item.std_prl_cd || item.std_prk_mg_no,
          prl_nm: item.prl_nm || item.prk_nm,
          sum_park_cnt: item.sum_park_cnt,
          sum_curr_use_park_cnt: item.sum_curr_use_park_cnt || item.now_park_cnt,
          curr_use_gnr_park_cnt: item.curr_use_gnr_park_cnt,
          updt_dt: item.updt_dt,
          souc_nm: item.souc_nm,
        })),
      });
    } catch (e: any) {
      results.push({ targetName: target.name, error: e.message });
    }
  }

  return NextResponse.json({
    apiKeyConfigured: !!apiKey,
    testTime: new Date().toISOString(),
    results,
  });
}
