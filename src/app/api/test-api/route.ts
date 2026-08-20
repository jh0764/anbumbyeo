import { NextRequest, NextResponse } from 'next/server';

const KOREA_TOUR_API_URL = 'http://apis.data.go.kr/B551011/KorService1/locationBasedList1';
const PARKING_INFO_API_URL = 'https://api.koreaconnect.kr/01/5/2606081732514722903DCP/LOGIS/api/v1/parking/info';
const PARKING_STATUS_API_URL = 'https://api.koreaconnect.kr/01/7/2606081732514722503DCP/LOGIS/api/v1/parking/status';

export async function GET(request: NextRequest) {
  const rawTourApiKey = process.env.TOUR_API_KEY || process.env.NEXT_PUBLIC_TOUR_API_KEY || '';
  const parkingApiKey = process.env.PARKING_API_KEY || '';

  // serviceKey 인코딩/디코딩 호환 처리
  const decodedTourKey = decodeURIComponent(rawTourApiKey);
  const encodedTourKey = encodeURIComponent(decodedTourKey);

  const testResults: Record<string, any> = {
    env: {
      TOUR_API_KEY_EXISTS: Boolean(rawTourApiKey),
      PARKING_API_KEY_EXISTS: Boolean(parkingApiKey),
      tourApiKeyLength: rawTourApiKey.length,
      parkingApiKeyLength: parkingApiKey.length,
    },
    apis: {},
  };

  // 1. API-1: 한국관광공사 위치기반 관광/축제 정보 (apis.data.go.kr)
  try {
    const url1 = `${KOREA_TOUR_API_URL}?serviceKey=${encodedTourKey}&numOfRows=10&pageNo=1&MobileOS=ETC&MobileApp=anbumbyeo&_type=json&mapX=126.9780&mapY=37.5665&radius=20000&arrange=E`;
    const res1 = await fetch(url1, { cache: 'no-store' });
    const rawText1 = await res1.text();
    let json1 = null;
    try {
      json1 = JSON.parse(rawText1);
    } catch {}

    testResults.apis.koreaTourAPI = {
      status: res1.status,
      statusText: res1.statusText,
      authMethod: 'QueryString (serviceKey)',
      rawTextSample: rawText1.slice(0, 500),
      parsedJson: json1,
    };
  } catch (err: any) {
    testResults.apis.koreaTourAPI = { error: err.message };
  }

  // 2. API-2: 디지털융합플랫폼 통합 주차장 기본 정보 (api.koreaconnect.kr)
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
      statusText: res2.statusText,
      authMethod: 'Header (api_user_key_id)',
      rawTextSample: rawText2.slice(0, 500),
      parsedJson: json2,
    };
  } catch (err: any) {
    testResults.apis.parkingInfoAPI = { error: err.message };
  }

  // 3. API-3: 디지털융합플랫폼 실시간 주차 현황 (api.koreaconnect.kr)
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
      statusText: res3.statusText,
      authMethod: 'Header (api_user_key_id)',
      rawTextSample: rawText3.slice(0, 500),
      parsedJson: json3,
    };
  } catch (err: any) {
    testResults.apis.parkingStatusAPI = { error: err.message };
  }

  console.log('[Test API Results Summary]:', {
    koreaTourAPIStatus: testResults.apis.koreaTourAPI?.status,
    parkingInfoStatus: testResults.apis.parkingInfoAPI?.status,
    parkingStatusStatus: testResults.apis.parkingStatusAPI?.status,
  });

  return NextResponse.json(testResults);
}
