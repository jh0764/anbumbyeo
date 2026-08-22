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

  // 화면에 뜬 주차장들이 속한 자치구 코드 목록 (중구: 11140, 성동구: 11200, 동대문구: 11230, 관악구: 11620)
  const targetDistricts = [
    { name: '중구', code: '11140', targetKeyword: '서울시청' },
    { name: '성동구', code: '11200', targetKeyword: '성동구청' },
    { name: '동대문구', code: '11230', targetKeyword: '신설동' },
    { name: '관악구', code: '11620', targetKeyword: '봉천복개3' },
    { name: '관악구', code: '11620', targetKeyword: '롯데백화점 관악점' },
  ];

  try {
    const results = await Promise.all(
      targetDistricts.map(async (dist) => {
        // 1. 기본정보 호출
        const baseInfoUrl = `${PARKING_INFO_API_URL}?addr_cd=${dist.code}&addr_type=SIGUNGU&pageNo=1&pageSize=1000`;
        const baseRes = await fetch(baseInfoUrl, { headers, cache: 'no-store' });
        const baseJson = await baseRes.json();
        const baseItems = baseJson?.data || baseJson?.response?.body?.items?.item || baseJson?.items || [];
        const baseList: any[] = Array.isArray(baseItems) ? baseItems : (baseItems ? [baseItems] : []);

        // 타겟 주차장 검색
        const matched = baseList.find((p: any) =>
          (p.prl_nm || p.prk_nm || '').includes(dist.targetKeyword)
        );
        if (!matched) {
          return { district: dist.name, keyword: dist.targetKeyword, status: '기본정보에 주차장 없음' };
        }

        const code = String(matched.std_prl_cd || matched.std_prk_mg_no || '').trim();

        // 2. 실시간 API 호출
        const liveStatusUrl = `${PARKING_STATUS_API_URL}?addr_cd=${dist.code}&addr_type=SIGUNGU&pageNo=1&pageSize=1000`;
        const liveRes = await fetch(liveStatusUrl, { headers, cache: 'no-store' });
        const liveJson = await liveRes.json();
        const liveItems = liveJson?.data || liveJson?.response?.body?.items?.item || liveJson?.items || [];
        const liveList: any[] = Array.isArray(liveItems) ? liveItems : (liveItems ? [liveItems] : []);

        // std_prl_cd로 실시간 데이터 매칭
        let liveMatch = liveList.find((s: any) =>
          String(s.std_prl_cd || s.std_prk_mg_no || s.std_prk_cd || '').trim() === code
        );

        // 시군구 일괄 응답에 없으면 핀포인트 단건 추가 쿼리
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
        const isLiveValid = parkedCount !== null && parkedCount !== undefined && String(parkedCount).trim() !== '';

        return {
          district: dist.name,
          keyword: dist.targetKeyword,
          std_prl_cd: code,
          prl_nm: matched.prl_nm || matched.prk_nm,
          sum_park_cnt: matched.sum_park_cnt || matched.gnr_park_cnt,
          park_crst_info_prvd_yn: matched.park_crst_info_prvd_yn,
          liveDataExists: !!liveMatch,
          isLiveValid,
          liveRawPayload: liveMatch || null,
          parsedResult: isLiveValid ? {
            sum_curr_use_park_cnt: Number(parkedCount),
            availableSpots: Math.max(0, Number(matched.sum_park_cnt || 0) - Number(parkedCount)),
            updt_dt: liveMatch?.updt_dt || null,
          } : '실시간 API 응답 내 std_prl_cd 부재 (미연동/현장확인 대상)',
        };
      })
    );

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      testedParkings: results,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
