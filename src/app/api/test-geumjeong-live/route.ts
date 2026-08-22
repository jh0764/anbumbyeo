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
    // 부산 금정구(26410) 주차장 기본정보 및 실시간 현황 수신
    const geumjeongCode = '26410';
    const infoUrl = `${PARKING_INFO_API_URL}?addr_cd=${geumjeongCode}&addr_type=SIGUNGU&pageNo=1&pageSize=1000`;
    const statusUrl = `${PARKING_STATUS_API_URL}?addr_cd=${geumjeongCode}&addr_type=SIGUNGU&pageNo=1&pageSize=1000`;

    const [iRes, sRes] = await Promise.all([
      fetch(infoUrl, { headers, cache: 'no-store' }),
      fetch(statusUrl, { headers, cache: 'no-store' }),
    ]);

    const iJson = await iRes.json();
    const sJson = await sRes.json();

    const iList = iJson?.data || iJson?.response?.body?.items?.item || iJson?.items || [];
    const sList = sJson?.data || sJson?.response?.body?.items?.item || sJson?.items || [];

    const baseArr: any[] = Array.isArray(iList) ? iList : (iList ? [iList] : []);
    const statusArr: any[] = Array.isArray(sList) ? sList : (sList ? [sList] : []);

    const statusMap = new Map<string, any>();
    statusArr.forEach((s: any) => {
      const code = String(s?.std_prl_cd || s?.std_prk_mg_no || s?.std_prk_cd || '').trim();
      if (code) statusMap.set(code, s);
    });

    const targetNames = ['서1동제3', '부곡4동', '부곡4동삼차로', '서2동오차로', '서1동제2'];

    const targetResults = baseArr
      .filter((info: any) =>
        targetNames.some((name) => (info.prl_nm || info.prk_nm || '').includes(name))
      )
      .map((info: any) => {
        const code = String(info.std_prl_cd || info.std_prk_mg_no || '').trim();
        const live = statusMap.get(code);
        const parked = live?.sum_curr_use_park_cnt ?? live?.now_park_cnt ?? live?.cur_use_prk_cnt;
        const total = Number(info.sum_park_cnt || info.gnr_park_cnt || 0);
        const isLiveValid = parked !== null && parked !== undefined && String(parked).trim() !== '';

        return {
          prl_nm: info.prl_nm || info.prk_nm,
          std_prl_cd: code,
          addr: info.prl_road_addr_nm || info.prl_jino_addr_nm || info.l_road_addr_nm || '',
          totalSpaces: total,
          park_crst_info_prvd_yn: info.park_crst_info_prvd_yn || 'N',
          liveMatched: !!live,
          isLiveValid,
          rawParkedCount: isLiveValid ? Number(parked) : '데이터 없음 (현장확인 대상)',
          calculatedAvailable: isLiveValid ? Math.max(0, total - Number(parked)) : null,
        };
      });

    return NextResponse.json({
      success: true,
      description: '부산 금정구 타겟 5개 공영주차장 실시간 현황 수검 결과',
      targetResults,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
