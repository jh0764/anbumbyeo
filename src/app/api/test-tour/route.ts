import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.TOUR_API_KEY || process.env.PARKING_API_KEY || '';
  const headers = {
    'api_user_key_id': apiKey,
    'Accept': 'application/json',
  };

  const results: Record<string, any> = {
    envKeyLength: apiKey.length,
  };

  // 1. searchFestival2 테스트 (20260101 기준)
  try {
    const url1 = `https://api.koreaconnect.kr/01/1/2603101713597416530PDP/CULTR/B551011/KorService2/searchFestival2?MobileOS=ETC&MobileApp=anbumbyeo&_type=json&eventStartDate=20260101&numOfRows=10&arrange=A`;
    const res1 = await fetch(url1, { headers, cache: 'no-store' });
    const text1 = await res1.text();
    results.searchFestival2 = {
      status: res1.status,
      rawText: text1.slice(0, 1000),
    };
  } catch (e: any) {
    results.searchFestival2 = { error: e.message };
  }

  // 2. locationBasedList2 (contentTypeId=15 축제) 테스트
  try {
    const url2 = `https://api.koreaconnect.kr/01/1/2603101713597416530PDP/CULTR/B551011/KorService2/locationBasedList2?MobileOS=ETC&MobileApp=anbumbyeo&_type=json&mapX=126.978&mapY=37.5665&radius=30000&contentTypeId=15&numOfRows=10&arrange=E`;
    const res2 = await fetch(url2, { headers, cache: 'no-store' });
    const text2 = await res2.text();
    results.locationBasedList2 = {
      status: res2.status,
      rawText: text2.slice(0, 1000),
    };
  } catch (e: any) {
    results.locationBasedList2 = { error: e.message };
  }

  // 3. areaBasedList2 (contentTypeId=15 전국 축제) 테스트
  try {
    const url3 = `https://api.koreaconnect.kr/01/1/2603101713597416530PDP/CULTR/B551011/KorService2/areaBasedList2?MobileOS=ETC&MobileApp=anbumbyeo&_type=json&contentTypeId=15&numOfRows=10&arrange=O`;
    const res3 = await fetch(url3, { headers, cache: 'no-store' });
    const text3 = await res3.text();
    results.areaBasedList2 = {
      status: res3.status,
      rawText: text3.slice(0, 1000),
    };
  } catch (e: any) {
    results.areaBasedList2 = { error: e.message };
  }

  return NextResponse.json(results);
}
