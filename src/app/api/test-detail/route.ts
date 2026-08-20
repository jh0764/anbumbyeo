import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.TOUR_API_KEY || process.env.PARKING_API_KEY || '';
  const headers = {
    'api_user_key_id': apiKey,
    'Accept': 'application/json',
  };

  try {
    // 1. 서울 중심 반경 20km 내 축제(contentTypeId=15) 목록 5건 조회
    const listUrl = `https://api.koreaconnect.kr/01/1/2603101713597416530PDP/CULTR/B551011/KorService2/locationBasedList2?MobileOS=ETC&MobileApp=anbumbyeo&_type=json&mapX=126.978&mapY=37.5665&radius=20000&contentTypeId=15&numOfRows=5&arrange=E`;
    const listRes = await fetch(listUrl, { headers, cache: 'no-store' });
    const listJson = await listRes.json();

    const rawItems = listJson?.response?.body?.items?.item;
    const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

    // 2. 각 축제의 contentId로 detailIntro2 호출하여 실제 날짜 수집
    const detailedResults = await Promise.all(
      items.map(async (item: any) => {
        const detailUrl = `https://api.koreaconnect.kr/01/1/2603101713597416530PDP/CULTR/B551011/KorService2/detailIntro2?MobileOS=ETC&MobileApp=anbumbyeo&_type=json&contentId=${item.contentid}&contentTypeId=15`;
        const detailRes = await fetch(detailUrl, { headers, cache: 'no-store' });
        const detailJson = await detailRes.json();
        const dItem = Array.isArray(detailJson?.response?.body?.items?.item)
          ? detailJson.response.body.items.item[0]
          : detailJson?.response?.body?.items?.item;

        return {
          contentid: item.contentid,
          title: item.title,
          addr: item.addr1,
          eventstartdate: dItem?.eventstartdate || '없음',
          eventenddate: dItem?.eventenddate || '없음',
          eventplace: dItem?.eventplace || '없음',
          detailStatus: detailRes.status,
        };
      })
    );

    return NextResponse.json({
      success: true,
      totalListCount: items.length,
      festivals: detailedResults,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
