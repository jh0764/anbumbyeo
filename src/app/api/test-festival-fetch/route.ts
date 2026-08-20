import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.TOUR_API_KEY || process.env.PARKING_API_KEY || '';
  const headers = { 'api_user_key_id': apiKey, 'Accept': 'application/json' };

  // 각 지역별 대표 지점에서 contentTypeId=15(축제) 100건 수집
  const regions = [
    { name: '경상(부산/대구)', x: 129.0756, y: 35.1796 },
    { name: '충청(서천/대전)', x: 126.6912, y: 36.0805 },
    { name: '수도권(서울)', x: 126.9780, y: 37.5665 },
    { name: '강원(강릉)', x: 128.8760, y: 37.7519 },
    { name: '제주', x: 126.5312, y: 33.4996 },
  ];

  const results: any[] = [];

  for (const r of regions) {
    try {
      const url = `https://api.koreaconnect.kr/01/1/2603101713597416530PDP/CULTR/B551011/KorService2/locationBasedList2?MobileOS=ETC&MobileApp=anbumbyeo&_type=json&mapX=${r.x}&mapY=${r.y}&radius=20000&contentTypeId=15&numOfRows=50&arrange=C`;
      const res = await fetch(url, { headers, cache: 'no-store' });
      const json = await res.json();
      const raw = json?.response?.body?.items?.item;
      const items = Array.isArray(raw) ? raw : raw ? [raw] : [];

      // 상세 날짜(detailIntro2) 조회
      const detailed = await Promise.all(
        items.slice(0, 10).map(async (item: any) => {
          const dUrl = `https://api.koreaconnect.kr/01/1/2603101713597416530PDP/CULTR/B551011/KorService2/detailIntro2?MobileOS=ETC&MobileApp=anbumbyeo&_type=json&contentId=${item.contentid}&contentTypeId=15`;
          const dRes = await fetch(dUrl, { headers, cache: 'no-store' });
          const dJson = await dRes.json();
          const dItem = Array.isArray(dJson?.response?.body?.items?.item) ? dJson.response.body.items.item[0] : dJson?.response?.body?.items?.item;
          return {
            title: item.title,
            startDate: dItem?.eventstartdate,
            endDate: dItem?.eventenddate,
            mapx: item.mapx,
            mapy: item.mapy,
          };
        })
      );

      results.push({ region: r.name, fetchedCount: items.length, validFestivals: detailed });
    } catch (e: any) {
      results.push({ region: r.name, error: e.message });
    }
  }

  return NextResponse.json({ today: '20260821', data: results });
}
