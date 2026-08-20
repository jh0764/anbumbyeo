import { NextResponse } from 'next/server';

const PARKING_INFO_API_URL =
  'https://api.koreaconnect.kr/01/5/2606081732514722903DCP/LOGIS/api/v1/parking/info';
const PARKING_STATUS_API_URL =
  'https://api.koreaconnect.kr/01/7/2606081732514722903DCP/LOGIS/api/v1/parking/status';

export async function GET() {
  const apiKey = process.env.PARKING_API_KEY || process.env.TOUR_API_KEY || '';
  const headers = {
    'api_user_key_id': apiKey,
    'Accept': 'application/json',
  };

  try {
    // 1. 부산 수영구 기본정보 조회
    const baseInfoUrl = `${PARKING_INFO_API_URL}?addr_cd=26500&addr_type=SIGUNGU&pageNo=1&pageSize=1000`;
    const baseRes = await fetch(baseInfoUrl, { headers, cache: 'no-store' });
    const baseJson = await baseRes.json();
    const rawList = baseJson?.data || baseJson?.response?.body?.items?.item || baseJson?.items || [];
    const baseItems = Array.isArray(rawList) ? rawList : [rawList];

    // 대상 주차장 키워드 필터링
    const targetKeywords = ['광안리해수욕장', '민락매립지'];
    const matchedBaseList = baseItems.filter((p: any) =>
      targetKeywords.some((kw) => (p.prl_nm || p.prk_nm || '').includes(kw))
    );

    // 2. 각 주차장의 std_prl_cd로 실시간 API 직접 쿼리
    const liveResults = await Promise.all(
      matchedBaseList.map(async (p: any) => {
        const code = p.std_prl_cd || p.std_prk_mg_no;
        const liveUrl = `${PARKING_STATUS_API_URL}?std_prl_cd=${code}`;
        const liveRes = await fetch(liveUrl, { headers, cache: 'no-store' });
        const liveJson = await liveRes.json();
        const liveRaw = liveJson?.data || liveJson?.response?.body?.items?.item || liveJson?.items || [];
        const liveData = Array.isArray(liveRaw) ? liveRaw[0] : liveRaw;

        const totalSpots = Number(p.sum_park_cnt || p.gnr_park_cnt || 0);
        const occupied = liveData ? Number(liveData.sum_curr_use_park_cnt || liveData.now_park_cnt || 0) : null;

        return {
          std_prl_cd: code,
          prl_nm: p.prl_nm || p.prk_nm,
          addr: p.prl_road_addr_nm || p.prl_jino_addr_nm || p.l_road_addr_nm,
          sum_park_cnt: totalSpots,
          park_crst_info_prvd_yn: p.park_crst_info_prvd_yn || p.is_realtime || 'N',
          liveStatusHttp: liveRes.status,
          liveRawData: liveData || null,
          parsedLive: liveData
            ? {
                sum_curr_use_park_cnt: occupied,
                availableSpots: Math.max(0, totalSpots - (occupied || 0)),
                updt_dt: liveData.updt_dt,
                souc_nm: liveData.souc_nm,
              }
            : '실시간 데이터 응답 없음 (센서 미연동/현장확인 대상)',
        };
      })
    );

    return NextResponse.json({
      success: true,
      testedCount: liveResults.length,
      parkingDetails: liveResults,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
