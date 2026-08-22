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

  // 캡처 화면에 등장한 주요 주차장 키워드와 관할 자치구 코드 (중구: 11140, 강남구: 11680)
  const targets = [
    { district: '중구', code: '11140', keyword: '한화생명 소공동사옥' },
    { district: '중구', code: '11140', keyword: '서울시청 본청사' },
    { district: '중구', code: '11140', keyword: '프레지던트호텔' },
    { district: '중구', code: '11140', keyword: '한국프레스센터' },
    { district: '강남구', code: '11680', keyword: '메리츠' },
  ];

  try {
    const results = await Promise.all(
      targets.map(async (t) => {
        // 1. 기본정보 수신
        const infoUrl = `${PARKING_INFO_API_URL}?addr_cd=${t.code}&addr_type=SIGUNGU&pageNo=1&pageSize=1000`;
        const res = await fetch(infoUrl, { headers, cache: 'no-store' });
        const json = await res.json();
        const items = json?.data || json?.response?.body?.items?.item || json?.items || [];
        const list: any[] = Array.isArray(items) ? items : (items ? [items] : []);

        const matched = list.find((p: any) =>
          (p.prl_nm || p.prk_nm || '').includes(t.keyword)
        );
        if (!matched) {
          return { target: t.keyword, status: '기본정보 목록에 없음' };
        }

        const code = String(matched.std_prl_cd || matched.std_prk_mg_no || '').trim();

        // 2. 실시간 현황 수신 (동일 자치구 데이터 풀에서 std_prl_cd 매칭)
        const liveUrl = `${PARKING_STATUS_API_URL}?addr_cd=${t.code}&addr_type=SIGUNGU&pageNo=1&pageSize=1000`;
        const liveRes = await fetch(liveUrl, { headers, cache: 'no-store' });
        const liveJson = await liveRes.json();
        const liveItems = liveJson?.data || liveJson?.response?.body?.items?.item || liveJson?.items || [];
        const liveList: any[] = Array.isArray(liveItems) ? liveItems : (liveItems ? [liveItems] : []);

        let liveMatch = liveList.find((s: any) =>
          String(s.std_prl_cd || s.std_prk_mg_no || s.std_prk_cd || '').trim() === code
        );

        // 핀포인트 1:1 보충 쿼리
        if (!liveMatch && code) {
          try {
            const pinpointUrl = `${PARKING_STATUS_API_URL}?std_prl_cd=${code}&pageNo=1&pageSize=10`;
            const ppRes = await fetch(pinpointUrl, { headers, cache: 'no-store' });
            const ppJson = await ppRes.json();
            const ppRaw = ppJson?.data || ppJson?.response?.body?.items?.item || ppJson?.items || [];
            const ppItems = Array.isArray(ppRaw) ? ppRaw : (ppRaw ? [ppRaw] : []);
            if (ppItems.length > 0) {
              liveMatch = ppItems[0];
            }
          } catch {}
        }

        const parkedCount = liveMatch?.sum_curr_use_park_cnt ?? liveMatch?.now_park_cnt ?? liveMatch?.cur_use_prk_cnt;
        const hasLive = parkedCount !== null && parkedCount !== undefined && String(parkedCount).trim() !== '';

        return {
          parkingName: matched.prl_nm || matched.prk_nm,
          std_prl_cd: code,
          totalSpaces: Number(matched.sum_park_cnt || matched.gnr_park_cnt || 0),
          providerYn: matched.park_crst_info_prvd_yn || 'N', // Y 또는 N
          hasLiveRecordInApi: hasLive,
          currentParkedCount: hasLive ? Number(parkedCount) : '데이터 없음 (현장확인 대상)',
          availableSpots: hasLive ? Math.max(0, Number(matched.sum_park_cnt || 0) - Number(parkedCount)) : null,
          rawLivePayload: liveMatch || null,
        };
      })
    );

    return NextResponse.json({
      success: true,
      description: '캡처 화면 주차장들의 실시간 현재 주차대수 수신 여부 진단 결과',
      results,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
