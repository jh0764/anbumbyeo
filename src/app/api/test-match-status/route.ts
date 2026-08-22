import { NextResponse } from 'next/server';

const PARKING_INFO_API_URL =
  'https://api.koreaconnect.kr/01/5/2606081732514722903DCP/LOGIS/api/v1/parking/info';
const PARKING_STATUS_API_URL =
  'https://api.koreaconnect.kr/01/7/2606081732514722903DCP/LOGIS/api/v1/parking/status';

export async function GET(req: Request) {
  const apiKey = process.env.PARKING_API_KEY || process.env.TOUR_API_KEY || '';
  const headers = {
    'api_user_key_id': apiKey,
    'Accept': 'application/json',
  };

  const { searchParams } = new URL(req.url);
  const addrCd = searchParams.get('addr_cd') || '11215'; // 기본: 광진구(뚝섬/자양동)

  try {
    // 1. 통합 주차장 기본 정보
    const infoUrl = `${PARKING_INFO_API_URL}?addr_cd=${addrCd}&addr_type=SIGUNGU&pageNo=1&pageSize=1000`;
    const infoRes = await fetch(infoUrl, { headers, cache: 'no-store' });
    const infoJson = await infoRes.json();
    const infoRaw = infoJson?.data || infoJson?.response?.body?.items?.item || infoJson?.items || [];
    const infoList: any[] = Array.isArray(infoRaw) ? infoRaw : (infoRaw ? [infoRaw] : []);

    // 2. 실시간 주차 가능 정보
    const statusUrl = `${PARKING_STATUS_API_URL}?addr_cd=${addrCd}&addr_type=SIGUNGU&pageNo=1&pageSize=1000`;
    const statusRes = await fetch(statusUrl, { headers, cache: 'no-store' });
    const statusJson = await statusRes.json();
    const statusRaw = statusJson?.data || statusJson?.response?.body?.items?.item || statusJson?.items || [];
    const statusList: any[] = Array.isArray(statusRaw) ? statusRaw : (statusRaw ? [statusRaw] : []);

    // Map 구성
    const liveMap = new Map<string, any>();
    statusList.forEach((s: any) => {
      const code = s.std_prl_cd || s.std_prk_mg_no || s.std_prk_cd;
      if (code) liveMap.set(code, s);
    });

    let matchedLiveCount = 0;
    const joinedResults = infoList.map((info: any) => {
      const code = info.std_prl_cd || info.std_prk_mg_no;
      const live = liveMap.get(code);
      const isLive = live && (live.sum_curr_use_park_cnt !== null && live.sum_curr_use_park_cnt !== undefined);
      if (isLive) matchedLiveCount++;

      return {
        std_prl_cd: code,
        prl_nm: info.prl_nm || info.prk_nm,
        prl_div_nm: info.prl_div_nm || info.prk_kind_nm,
        addr: info.prl_road_addr_nm || info.prl_jino_addr_nm || info.l_road_addr_nm,
        totalSpaces: info.sum_park_cnt || info.gnr_park_cnt,
        isLiveAvailable: !!isLive,
        currentParked: isLive ? live.sum_curr_use_park_cnt : null,
        availableSpots: isLive ? Math.max(0, Number(info.sum_park_cnt || 0) - Number(live.sum_curr_use_park_cnt || 0)) : null,
        updt_dt: isLive ? live.updt_dt : null,
      };
    });

    return NextResponse.json({
      targetAddrCd: addrCd,
      totalBasicInfoCount: infoList.length,
      totalLiveStatusCount: statusList.length,
      matchedLiveCount: matchedLiveCount,
      liveMatchRate: infoList.length ? `${((matchedLiveCount / infoList.length) * 100).toFixed(1)}%` : '0%',
      // 실시간 데이터가 정상 결합된 주차장 샘플
      liveMatchedSamples: joinedResults.filter((r) => r.isLiveAvailable).slice(0, 10),
      // 실시간 미제공(현장확인) 샘플
      noLiveSamples: joinedResults.filter((r) => !r.isLiveAvailable).slice(0, 5),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
