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
    // 1. 마포구(11440) 기본정보 수신
    const baseInfoUrl = `${PARKING_INFO_API_URL}?addr_cd=11440&addr_type=SIGUNGU&pageNo=1&pageSize=1000`;
    const baseRes = await fetch(baseInfoUrl, { headers, cache: 'no-store' });
    const baseJson = await baseRes.json();
    const rawList = baseJson?.data || baseJson?.response?.body?.items?.item || baseJson?.items || [];
    const baseItems: any[] = Array.isArray(rawList) ? rawList : (rawList ? [rawList] : []);

    // 2. 화면 노출 키워드 3개 주차장 필터링
    const targetKeywords = ['지남빌딩', '마포구청', '월드컵공원'];
    const matched = baseItems.filter((p: any) =>
      targetKeywords.some((kw) => (p.prl_nm || p.prk_nm || '').includes(kw))
    );

    // 3. 각각의 주차장 코드로 실시간 현황 API 직접 조회
    const liveChecks = await Promise.all(
      matched.map(async (p: any) => {
        const code = p.std_prl_cd || p.std_prk_mg_no;
        const liveUrl = `${PARKING_STATUS_API_URL}?std_prl_cd=${code}&pageNo=1&pageSize=10`;
        const liveRes = await fetch(liveUrl, { headers, cache: 'no-store' });
        const liveJson = await liveRes.json();
        const liveRaw = liveJson?.data || liveJson?.response?.body?.items?.item || liveJson?.items || [];
        const liveData = Array.isArray(liveRaw) ? liveRaw[0] : liveRaw;

        return {
          prl_nm: p.prl_nm || p.prk_nm,
          std_prl_cd: code,
          sum_park_cnt: p.sum_park_cnt || p.gnr_park_cnt,
          park_crst_info_prvd_yn: p.park_crst_info_prvd_yn,
          liveStatusHttpStatus: liveRes.status,
          liveRawPayload: liveData || null,
          hasLiveCount: liveData?.sum_curr_use_park_cnt !== undefined && liveData?.sum_curr_use_park_cnt !== null,
          currentUseCount: liveData?.sum_curr_use_park_cnt ?? '미제공',
        };
      })
    );

    return NextResponse.json({
      success: true,
      testedCount: liveChecks.length,
      parkingLiveResults: liveChecks,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
