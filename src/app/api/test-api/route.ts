import { NextRequest, NextResponse } from 'next/server';

const KOREACONNECT_TOUR_API_URL =
  'https://api.koreaconnect.kr/01/1/2603101713597416530PDP/CULTR/B551011/KorService2/locationBasedList2';
const PARKING_INFO_API_URL =
  'https://api.koreaconnect.kr/01/5/2606081732514722903DCP/LOGIS/api/v1/parking/info';
const PARKING_STATUS_API_URL =
  'https://api.koreaconnect.kr/01/7/2606081732514722903DCP/LOGIS/api/v1/parking/status';

export async function GET(request: NextRequest) {
  const tourApiKey = process.env.TOUR_API_KEY || process.env.NEXT_PUBLIC_TOUR_API_KEY || '';
  const parkingApiKey = process.env.PARKING_API_KEY || tourApiKey;

  const testResults: Record<string, any> = {
    env: {
      TOUR_API_KEY_EXISTS: Boolean(tourApiKey),
      PARKING_API_KEY_EXISTS: Boolean(parkingApiKey),
      tourApiKeyLength: tourApiKey.length,
      parkingApiKeyLength: parkingApiKey.length,
    },
    apis: {},
  };

  // 1. API-1: Koreaconnect 관광/축제 정보 (locationBasedList2 Header 인증)
  try {
    const url1 = `${KOREACONNECT_TOUR_API_URL}?MobileOS=ETC&MobileApp=anbumbyeo&_type=json&mapX=126.9780&mapY=37.5665&radius=20000&numOfRows=30&arrange=E`;
    const res1 = await fetch(url1, {
      cache: 'no-store',
      headers: {
        api_user_key_id: tourApiKey || parkingApiKey,
        Accept: 'application/json',
      },
    });
    const rawText1 = await res1.text();
    let json1 = null;
    try {
      json1 = JSON.parse(rawText1);
    } catch {}

    const items =
      json1?.response?.body?.items?.item ||
      json1?.items?.item ||
      json1?.body?.items?.item ||
      json1?.data;

    testResults.apis.koreaconnectTourAPI = {
      status: res1.status,
      authMethod: 'Header (api_user_key_id)',
      itemCount: Array.isArray(items) ? items.length : items ? 1 : 0,
      rawTextSample: rawText1.slice(0, 500),
      parsedJson: json1,
    };
  } catch (err: any) {
    testResults.apis.koreaconnectTourAPI = { error: err.message };
  }

  // 2. API-2: 통합 주차장 기본 정보 (parking/info)
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

  // 3. API-3: 실시간 주차 현황 (parking/status) - 정규 URL 적용
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
