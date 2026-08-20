import { NextRequest, NextResponse } from 'next/server';
import { Festival, Parking, Region, CategoryType } from '@/types';
import { calculateDistance, calculateRealCrowdStatus, formatWalkingDistanceText } from '@/lib/geoUtils';

// Koreaconnect 공공 API 엔드포인트 URL
const KOREACONNECT_LOCATION_API_URL =
  'https://api.koreaconnect.kr/01/1/2603101713597416530PDP/CULTR/B551011/KorService2/locationBasedList2';
const KOREACONNECT_FESTIVAL_SEARCH_URL =
  'https://api.koreaconnect.kr/01/1/2603101713597416530PDP/CULTR/B551011/KorService2/searchFestival2';
const PARKING_INFO_API_URL =
  'https://api.koreaconnect.kr/01/5/2606081732514722903DCP/LOGIS/api/v1/parking/info';
const PARKING_STATUS_API_URL =
  'https://api.koreaconnect.kr/01/7/2606081732514722903DCP/LOGIS/api/v1/parking/status';

function getRegionFromAddress(address: string, lat: number, lng: number): Exclude<Region, '전체'> {
  if (!address) return '서울·수도권';
  if (address.includes('서울') || address.includes('경기') || address.includes('인천')) {
    return '서울·수도권';
  }
  if (address.includes('강원')) {
    return '강원';
  }
  if (address.includes('충청') || address.includes('대전') || address.includes('세종')) {
    return '충청';
  }
  if (address.includes('전라') || address.includes('광주')) {
    return '전라';
  }
  if (address.includes('경상') || address.includes('부산') || address.includes('대구') || address.includes('울산')) {
    return '경상';
  }
  if (address.includes('제주')) {
    return '제주';
  }

  if (lat > 37.0) return '서울·수도권';
  if (lng > 128.3 && lat > 37.0) return '강원';
  if (lng > 128.3) return '경상';
  if (lat < 35.8) return '전라';
  return '서울·수도권';
}

// 카테고리에 따른 공공데이터 contentTypeId 매핑
function getContentTypeIdFromCategory(category?: string | null): string {
  if (category === '축제') return '15';       // 축제/공연/행사
  if (category === '문화시설') return '14';   // 박물관/미술관/공연장/문화재
  if (category === '공원·나들이') return '12'; // 관광지/자연명소/공원
  return '15';
}

function getCategoryTypeFromContentTypeId(contentTypeId?: string): CategoryType {
  if (contentTypeId === '15') return '축제';
  if (contentTypeId === '14') return '문화시설';
  return '공원·나들이';
}

// 주차장 명칭 정제 유틸
function cleanParkingName(name: string): string {
  if (!name) return '공영주차장';
  return name
    .replace(/\(구\)|\(시\)|\(도\)|완속충전기|급속충전기|\[전기차충전소\]/gi, '')
    .trim();
}

// 순수 공영주차장 엄격 필터링 유틸
function isStrictPublicParking(info: any): boolean {
  const kindName = info.prl_kind_nm || info.prk_kind_nm || info.prl_se_cd || '';
  const rawName = info.prl_nm || info.prk_nm || '';

  if (kindName.includes('민영') || kindName.includes('부설')) {
    return false;
  }

  const excludeRegex = /사옥|타워|센터|스퀘어|성당|교회|병원|호텔|아파트|오피스|파이낸스|빌딩|프라자|민영|몰|마트|상가|가톨릭|신협/i;
  if (excludeRegex.test(rawName)) {
    return false;
  }

  const allowRegex = /공영|노상|노외|환승|구청|시청|주민센터|행정복지센터|동사무소/;
  if (kindName.includes('공영') || allowRegex.test(rawName)) {
    return true;
  }

  return false;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mapX = searchParams.get('mapX') || '126.9780';
    const mapY = searchParams.get('mapY') || '37.5665';
    const radius = searchParams.get('radius') || '30000';
    const requestedContentTypeId = searchParams.get('contentTypeId');
    const categoryParam = searchParams.get('category');

    const tourApiKey = process.env.TOUR_API_KEY || process.env.NEXT_PUBLIC_TOUR_API_KEY || '';
    const parkingApiKey = process.env.PARKING_API_KEY || tourApiKey;
    const apiKeyHeader = tourApiKey || parkingApiKey;

    if (!apiKeyHeader) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // 1. 카테고리별 contentTypeId 파라미터 매핑
    const contentTypeId = requestedContentTypeId || getContentTypeIdFromCategory(categoryParam);
    const isFestivalCategory = contentTypeId === '15';

    let rawList: any[] = [];

    // 위치기반 locationBasedList2 API 호출 (mapX, mapY, radius, contentTypeId 적용)
    const locationUrl = `${KOREACONNECT_LOCATION_API_URL}?MobileOS=ETC&MobileApp=anbumbyeo&_type=json&mapX=${mapX}&mapY=${mapY}&radius=${radius}&contentTypeId=${contentTypeId}&numOfRows=50&arrange=E`;
    try {
      const res = await fetch(locationUrl, {
        cache: 'no-store',
        headers: {
          api_user_key_id: apiKeyHeader,
          Accept: 'application/json',
        },
      });

      if (res.ok) {
        const rawText = await res.text();
        try {
          const json = JSON.parse(rawText);
          const items =
            json?.response?.body?.items?.item ||
            json?.items?.item ||
            json?.body?.items?.item ||
            json?.data;
          const itemArr = Array.isArray(items) ? items : items ? [items] : [];
          rawList.push(...itemArr);
        } catch {}
      }
    } catch (err) {
      console.error('[API Error] locationBasedList2 호출 예외:', err);
    }

    // 만약 축제 카테고리인데 위치기반 결과가 0건이면 searchFestival2 전국 조회 병행 (예정 축제 0건 방지)
    if (isFestivalCategory && rawList.length === 0) {
      const festivalSearchUrl = `${KOREACONNECT_FESTIVAL_SEARCH_URL}?MobileOS=ETC&MobileApp=anbumbyeo&_type=json&eventStartDate=20260101&numOfRows=100&arrange=A`;
      try {
        const res = await fetch(festivalSearchUrl, {
          cache: 'no-store',
          headers: {
            api_user_key_id: apiKeyHeader,
            Accept: 'application/json',
          },
        });

        if (res.ok) {
          const rawText = await res.text();
          try {
            const json = JSON.parse(rawText);
            const items =
              json?.response?.body?.items?.item ||
              json?.items?.item ||
              json?.body?.items?.item ||
              json?.data;
            const itemArr = Array.isArray(items) ? items : items ? [items] : [];
            rawList.push(...itemArr);
          } catch {}
        }
      } catch (err) {
        console.error('[API Error] searchFestival2 2차 호출 예외:', err);
      }
    }

    // 2. API-2 & API-3: Koreaconnect 주차장 정보 & 실시간 현황 조인
    let parkingInfoList: any[] = [];
    const parkingStatusMap = new Map<string, any>();

    const [infoRes, statusRes] = await Promise.allSettled([
      fetch(`${PARKING_INFO_API_URL}?pageNo=1&pageSize=1000`, {
        cache: 'no-store',
        headers: { api_user_key_id: parkingApiKey, Accept: 'application/json' },
      }),
      fetch(`${PARKING_STATUS_API_URL}?pageNo=1&pageSize=1000`, {
        cache: 'no-store',
        headers: { api_user_key_id: parkingApiKey, Accept: 'application/json' },
      }),
    ]);

    if (infoRes.status === 'fulfilled' && infoRes.value.ok) {
      try {
        const infoJson = await infoRes.value.json();
        const rawInfo = infoJson?.data || infoJson?.items || infoJson?.response?.body?.items?.item;
        parkingInfoList = Array.isArray(rawInfo) ? rawInfo : rawInfo ? [rawInfo] : [];
      } catch (e) {
        console.error('[API Error] Parking Info JSON 파싱 예외:', e);
      }
    }

    if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
      try {
        const statusJson = await statusRes.value.json();
        const rawStatus = statusJson?.data || statusJson?.items || statusJson?.response?.body?.items?.item;
        const statusList = Array.isArray(rawStatus) ? rawStatus : rawStatus ? [rawStatus] : [];

        for (const st of statusList) {
          const code = st.std_prl_cd || st.std_prk_mg_no || st.std_prk_cd;
          if (code) {
            parkingStatusMap.set(code, st);
          }
        }
      } catch (e) {
        console.error('[API Error] Parking Status JSON 파싱 예외:', e);
      }
    }

    // 3. 순수 공영주차장 정제
    const combinedParkingLots: Parking[] = [];

    for (const info of parkingInfoList) {
      const lat = parseFloat(info.la_val || info.lat || '0');
      const lng = parseFloat(info.lo_val || info.lng || '0');
      if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) continue;

      if (!isStrictPublicParking(info)) continue;

      const totalSpaces = parseInt(info.sum_park_cnt || info.gnr_park_cnt || '0', 10);
      if (totalSpaces < 15) continue;

      const cleanedName = cleanParkingName(info.prl_nm || info.prk_nm || '');
      const code = info.std_prl_cd || info.std_prk_mg_no || `prk-${Math.random()}`;
      const status = parkingStatusMap.get(code);
      const isRealtime = Boolean(status);

      let occupied = 0;
      if (status) {
        occupied = parseInt(
          status.now_park_cnt || status.sum_curr_use_park_cnt || status.cur_use_prk_cnt || '0',
          10
        );
      } else {
        occupied = Math.floor(totalSpaces * 0.35);
      }

      const availableSpaces = Math.max(0, totalSpaces - occupied);

      combinedParkingLots.push({
        id: code,
        name: cleanedName,
        lat,
        lng,
        totalSpaces,
        availableSpaces,
        distance: '',
        distanceMeters: 0,
        address: info.prl_road_addr_nm || info.l_road_addr_nm || info.prl_jino_addr_nm || '',
        isRealtime,
      });
    }

    // 오늘 날짜 정수형 (YYYYMMDD: 20260821)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayNum = Number(`${year}${month}${day}`) || 20260821;

    // 4. 원본 날짜 파싱 및 1km 이내 주차장 조인
    const resultFestivals: Festival[] = rawList
      .filter((f: any) => f && f.title && f.mapx && f.mapy)
      .filter((f: any) => {
        const typeIdStr = String(f.contenttypeid || f.contentTypeId || contentTypeId);
        if (typeIdStr !== '15') return true;

        const rawStart = String(f.eventstartdate || f.event_start_date || '');
        const rawEnd = String(f.eventenddate || f.event_end_date || '');

        const startNum = Number(rawStart);
        const endNum = Number(rawEnd);

        // 유효 날짜가 아니면 제외
        if (isNaN(startNum) || isNaN(endNum) || rawStart.length < 8 || rawEnd.length < 8) {
          return false;
        }

        // [종료된 축제 100% 필터링]: endNum < todayNum 이면 무조건 제외
        if (endNum < todayNum) {
          return false;
        }

        return true;
      })
      .map((f: any, idx: number) => {
        const festLat = parseFloat(f.mapy);
        const festLng = parseFloat(f.mapx);
        const festAddress = f.addr1 || '';

        // 1km 이내 주차장 매핑
        const nearbyParkingLots: Parking[] = combinedParkingLots
          .map((p) => {
            const distM = calculateDistance(festLat, festLng, p.lat, p.lng);
            return {
              ...p,
              distanceMeters: distM,
              distance: formatWalkingDistanceText(distM),
            };
          })
          .filter((p) => p.distanceMeters <= 1000)
          .sort((a, b) => a.distanceMeters - b.distanceMeters)
          .slice(0, 5);

        const { crowdLevel, crowdMessage } = calculateRealCrowdStatus(nearbyParkingLots);
        const region = getRegionFromAddress(festAddress, festLat, festLng);

        const typeIdStr = String(f.contenttypeid || f.contentTypeId || contentTypeId);
        const categoryType = getCategoryTypeFromContentTypeId(typeIdStr);

        const rawStart = String(f.eventstartdate || f.event_start_date || '');
        const rawEnd = String(f.eventenddate || f.event_end_date || '');

        const startDate = rawStart.length >= 8
          ? `${rawStart.slice(0, 4)}-${rawStart.slice(4, 6)}-${rawStart.slice(6, 8)}`
          : '2026-08-21';
        const endDate = rawEnd.length >= 8
          ? `${rawEnd.slice(0, 4)}-${rawEnd.slice(4, 6)}-${rawEnd.slice(6, 8)}`
          : '2026-08-31';

        const period = categoryType === '축제'
          ? `${startDate.replace(/-/g, '.')} ~ ${endDate.replace(/-/g, '.')}`
          : '연중무휴';

        return {
          id: f.contentid || `api-spot-${idx}`,
          title: f.title,
          startDate,
          endDate,
          period,
          locationName: f.addr1 || '명소 행사장',
          address: f.addr1 || '',
          region,
          contentTypeId: typeIdStr,
          categoryType,
          lat: festLat,
          lng: festLng,
          crowdLevel,
          crowdMessage: nearbyParkingLots.length === 0
            ? '주변 1km 내 실시간 공영주차장 없음 (대중교통 이용 권장)'
            : crowdMessage,
          category: categoryType,
          imageUrl: f.firstimage || f.firstimage2 || undefined,
          parkingLots: nearbyParkingLots,
        };
      });

    console.log('[실제 수집 건수]', resultFestivals.length);

    return NextResponse.json({
      success: true,
      data: resultFestivals,
    });
  } catch (error: any) {
    console.error('[API Exception] /api/festivals 예외:', error);
    return NextResponse.json({
      success: true,
      data: [],
    });
  }
}
