import { NextRequest, NextResponse } from 'next/server';

const KOREA_TOUR_API_URL = 'http://apis.data.go.kr/B551011/KorService1/locationBasedList1';
const PARKING_INFO_API_URL = 'https://api.koreaconnect.kr/01/5/2606081732514722903DCP/LOGIS/api/v1/parking/info';
const PARKING_STATUS_API_URL = 'https://api.koreaconnect.kr/01/7/2606081732514722503DCP/LOGIS/api/v1/parking/status';

export async function GET(request: NextRequest) {
  const rawTourApiKey = process.env.TOUR_API_KEY || process.env.NEXT_PUBLIC_TOUR_API_KEY || '';
  const parkingApiKey = process.env.PARKING_API_KEY || '';

  // TourAPI 인증키 이중 인코딩 보정
  const safeTourKey = encodeURIComponent(decodeURIComponent(rawTourApiKey));

  const testResults: Record<string, any> = {
    env: {
      TOUR_API_KEY_EXISTS: Boolean(rawTourApiKey),
      PARKING_API_KEY_EXISTS: Boolean(parkingApiKey),
      rawTourKeyLength: rawTourApiKey.length,
      safeTourKeyLength: safeTourKey.length,
      parkingApiKeyLength: parkingApiKey.length,
    },
    apis: {},
  };

  // 1. API-1: 한국관광공사 위치기반 관광/축제 정보 (apis.data.go.kr) - 1차: safeTourKey
  try {
    const url1 = `${KOREA_TOUR_API_URL}?serviceKey=${safeTourKey}&numOfRows=20&pageNo=1&MobileOS=ETC&MobileApp=anbumbyeo&_type=json&mapX=126.9780&mapY=37.5665&radius=20000&arrange=E`;
    const res1 = await fetch(url1, { cache: 'no-store' });
    const rawText1 = await res1.text();
    let json1 = null;
    try {
      json1 = JSON.parse(rawText1);
    } catch {}

    let items =
      json1?.response?.body?.items?.item ||
      json1?.items?.item ||
      json1?.body?.items?.item;

    let retryUsed = false;

    // 만약 1차 시도가 0건이거나 JSON 파싱 실패 시 원본 rawTourApiKey로 1회 재시도 (Fallback)
    if ((!items || (Array.isArray(items) && items.length === 0)) && rawTourApiKey !== safeTourKey) {
      retryUsed = true;
      const fallbackUrl = `${KOREA_TOUR_API_URL}?serviceKey=${rawTourApiKey}&numOfRows=20&pageNo=1&MobileOS=ETC&MobileApp=anbumbyeo&_type=json&mapX=126.9780&mapY=37.5665&radius=20000&arrange=E`;
      const fallbackRes = await fetch(fallbackUrl, { cache: 'no-store' });
      const fallbackText = await fallbackRes.text();
      try {
        json1 = JSON.parse(fallbackText);
        items = json1?.response?.body?.items?.item || json1?.items?.item || json1?.body?.items?.item;
      } catch {}
    }

    testResults.apis.koreaTourAPI = {
      status: res1.status,
      retryUsed,
      itemCount: Array.isArray(items) ? items.length : items ? 1 : 0,
      rawTextSample: rawText1.slice(0, 500),
      parsedJson: json1,
    };
  } catch (err: any) {
    testResults.apis.koreaTourAPI = { error: err.message };
  }

  // 2. API-2: 통합 주차장 기본 정보 (api.koreaconnect.kr)
  try {
    const url2 = `${PARKING_INFO_API_URL}?pageNo=1&pageSize=1000`;
    const res2 = await fetch(url2, {
      cache: 'no-store',
      headers: {
        api_user_key_id: parkingApiKey,
        Accept: 'application/json',
      },
    });
    const rawText2 = await res2.text();
    let json2 = null;
    try {
      json2 = JSON.parse(rawText2);
    } catch {}

    testResults.apis.parkingInfoAPI = {
      status: res2.status,
      itemCount: Array.isArray(json2?.data) ? json2.data.length : 0,
      rawTextSample: rawText2.slice(0, 500),
      parsedJson: json2,
    };
  } catch (err: any) {
    testResults.apis.parkingInfoAPI = { error: err.message };
  }

  // 3. API-3: 실시간 주차 현황 (api.koreaconnect.kr)
  try {
    const url3 = `${PARKING_STATUS_API_URL}?pageNo=1&pageSize=1000`;
    const res3 = await fetch(url3, {
      cache: 'no-store',
      headers: {
        api_user_key_id: parkingApiKey,
        Accept: 'application/json',
      },
    });
    const rawText3 = await res3.text();
    let json3 = null;
    try {
      json3 = JSON.parse(rawText3);
    } catch {}

    testResults.apis.parkingStatusAPI = {
      status: res3.status,
      itemCount: Array.isArray(json3?.data) ? json3.data.length : 0,
      rawTextSample: rawText3.slice(0, 500),
      parsedJson: json3,
    };
  } catch (err: any) {
    testResults.apis.parkingStatusAPI = { error: err.message };
  }

  return NextResponse.json(testResults);
}
