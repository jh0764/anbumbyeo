import { NextRequest, NextResponse } from 'next/server';

const FESTIVAL_API_URL =
  'https://api.koreaconnect.kr/01/1/2603101713597416530PDP/CULTR/B551011/KorService2/locationBasedList2';
const PARKING_INFO_API_URL =
  'https://api.koreaconnect.kr/01/5/2606081732514722903DCP/LOGIS/api/v1/parking/info';
const PARKING_STATUS_API_URL =
  'https://api.koreaconnect.kr/01/7/2606081732514722503DCP/LOGIS/api/v1/parking/status';

export async function GET(request: NextRequest) {
  const tourApiKey = process.env.TOUR_API_KEY || process.env.NEXT_PUBLIC_TOUR_API_KEY || '';
  const parkingApiKey = process.env.PARKING_API_KEY || tourApiKey;

  const testResults: Record<string, any> = {
    env: {
      TOUR_API_KEY_EXISTS: Boolean(process.env.TOUR_API_KEY),
      NEXT_PUBLIC_TOUR_API_KEY_EXISTS: Boolean(process.env.NEXT_PUBLIC_TOUR_API_KEY),
      PARKING_API_KEY_EXISTS: Boolean(process.env.PARKING_API_KEY),
      selectedTourApiKeyLength: tourApiKey.length,
      selectedParkingApiKeyLength: parkingApiKey.length,
    },
    apis: {},
  };

  // 1. API-1: 위치기반 축제/관광정보 (locationBasedList2)
  try {
    const params1 = new URLSearchParams({
      api_user_key_id: tourApiKey,
      MobileOS: 'ETC',
      MobileApp: 'anbumbyeo',
      _type: 'json',
      listYN: 'Y',
      arrange: 'A',
      contentTypeId: '12',
      mapX: '126.9780',
      mapY: '37.5665',
      radius: '20000',
      numOfRows: '10',
    });

    const res1 = await fetch(`${FESTIVAL_API_URL}?${params1.toString()}`, { cache: 'no-store' });
    const rawText1 = await res1.text();
    let json1 = null;
    try {
      json1 = JSON.parse(rawText1);
    } catch {}

    testResults.apis.locationBasedList2 = {
      status: res1.status,
      statusText: res1.statusText,
      url: `${FESTIVAL_API_URL}?api_user_key_id=HIDDEN&...`,
      rawText: rawText1.slice(0, 1000), // 최대 1000자
      parsedJson: json1,
    };
  } catch (err: any) {
    testResults.apis.locationBasedList2 = { error: err.message };
  }

  // 2. API-3: 주차장 기본 정보 (parking/info)
  try {
    const params3 = new URLSearchParams({
      api_user_key_id: parkingApiKey,
      page_no: '1',
      page_size: '10',
    });

    const res3 = await fetch(`${PARKING_INFO_API_URL}?${params3.toString()}`, { cache: 'no-store' });
    const rawText3 = await res3.text();
    let json3 = null;
    try {
      json3 = JSON.parse(rawText3);
    } catch {}

    testResults.apis.parkingInfo = {
      status: res3.status,
      statusText: res3.statusText,
      rawText: rawText3.slice(0, 1000),
      parsedJson: json3,
    };
  } catch (err: any) {
    testResults.apis.parkingInfo = { error: err.message };
  }

  // 3. API-2: 실시간 주차 현황 (parking/status)
  try {
    const params2 = new URLSearchParams({
      api_user_key_id: parkingApiKey,
      page_no: '1',
      page_size: '10',
    });

    const res2 = await fetch(`${PARKING_STATUS_API_URL}?${params2.toString()}`, { cache: 'no-store' });
    const rawText2 = await res2.text();
    let json2 = null;
    try {
      json2 = JSON.parse(rawText2);
    } catch {}

    testResults.apis.parkingStatus = {
      status: res2.status,
      statusText: res2.statusText,
      rawText: rawText2.slice(0, 1000),
      parsedJson: json2,
    };
  } catch (err: any) {
    testResults.apis.parkingStatus = { error: err.message };
  }

  console.log('[Test API Results Summary]:', {
    env: testResults.env,
    locationBasedStatus: testResults.apis.locationBasedList2?.status,
    parkingInfoStatus: testResults.apis.parkingInfo?.status,
    parkingStatusStatus: testResults.apis.parkingStatus?.status,
  });

  return NextResponse.json(testResults);
}
