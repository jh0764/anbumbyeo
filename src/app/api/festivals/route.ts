import { NextRequest, NextResponse } from 'next/server';
import { Festival, Parking, Region, CategoryType } from '@/types';
import { calculateDistance, calculateRealCrowdStatus } from '@/lib/geoUtils';
import { MOCK_FESTIVALS } from '@/services/mockData';

// Koreaconnect 공공 API 엔드포인트 URL (정규 URL)
const KOREACONNECT_TOUR_API_URL =
  'https://api.koreaconnect.kr/01/1/2603101713597416530PDP/CULTR/B551011/KorService2/locationBasedList2';
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

    // 키 미설정 시 백업 데이터 반환
    if (!apiKeyHeader) {
      console.warn('[API Notice] TOUR_API_KEY 및 PARKING_API_KEY가 미설정되어 백업 데이터를 반환합니다.');
      return NextResponse.json({
        success: true,
        data: MOCK_FESTIVALS,
      });
    }

    // 1. API-1: Koreaconnect 위치기반 관광/축제 정보 수집 (Header 인증)
    let targetTypes: string[] = ['15', '12', '14'];
    if (requestedContentTypeId) {
      targetTypes = [requestedContentTypeId];
    } else if (categoryParam) {
      if (categoryParam === '축제') targetTypes = ['15'];
      else if (categoryParam === '문화시설') targetTypes = ['14'];
      else if (categoryParam === '공원·나들이') targetTypes = ['12'];
    }

    const tourFetchPromises = targetTypes.map(async (typeId) => {
      const url = `${KOREACONNECT_TOUR_API_URL}?MobileOS=ETC&MobileApp=anbumbyeo&_type=json&mapX=${mapX}&mapY=${mapY}&radius=${radius}&numOfRows=30&arrange=E&contentTypeId=${typeId}`;
      try {
        const res = await fetch(url, {
          cache: 'no-store',
          headers: {
            api_user_key_id: apiKeyHeader,
            Accept: 'application/json',
          },
        });

        if (!res.ok) return [];
        const rawText = await res.text();
        try {
          const json = JSON.parse(rawText);
          const items =
            json?.response?.body?.items?.item ||
            json?.items?.item ||
            json?.body?.items?.item ||
            json?.data;
          return Array.isArray(items) ? items : items ? [items] : [];
        } catch {
          return [];
        }
      } catch {
        return [];
      }
    });

    const tourResults = await Promise.allSettled(tourFetchPromises);
    let rawList: any[] = [];

    for (const res of tourResults) {
      if (res.status === 'fulfilled' && res.value) {
        rawList.push(...res.value);
      }
    }

    // 실제 수집 데이터가 0건일 때 백업 데이터 제공
    if (rawList.length === 0) {
      console.warn('[API Notice] Koreaconnect 관광 API 수집 결과가 0건이어서 백업 데이터를 반환합니다.');
      return NextResponse.json({
        success: true,
        data: MOCK_FESTIVALS,
      });
    }

    // 2. API-2 & API-3: Koreaconnect 주차장 정보 & 실시간 현황 조인 (std_prl_cd 기준)
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

    // 3. 순수 공영주차장 정제 & 실시간 잔여석 계산
    const combinedParkingLots: Parking[] = [];
    const excludeKeywords = ['호텔', '아파트', '빌딩', '오피스', '마트', '상가', '병원', '교회'];

    for (const info of parkingInfoList) {
      const lat = parseFloat(info.la_val || info.lat || '0');
      const lng = parseFloat(info.lo_val || info.lng || '0');
      if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) continue;

      const rawName = info.prl_nm || info.prk_nm || '';

      // 민영/부설 키워드 필터링
      if (excludeKeywords.some((kw) => rawName.includes(kw))) continue;

      // 총 주차면수 15면 미만 (소형 충전기 등 구획 노이즈) 제외
      const totalSpaces = parseInt(info.sum_park_cnt || info.gnr_park_cnt || '0', 10);
      if (totalSpaces < 15) continue;

      const cleanedName = cleanParkingName(rawName);
      const code = info.std_prl_cd || info.std_prk_mg_no || `prk-${Math.random()}`;
      const status = parkingStatusMap.get(code);
      const isRealtime = Boolean(status);

      // 점유 대수 및 실시간 잔여석 계산 (total - occupied)
      let occupied = 0;
      if (status) {
        occupied = parseInt(
          status.now_park_cnt || status.sum_curr_use_park_cnt || status.cur_use_prk_cnt || '0',
          10
        );
      } else {
        // 실시간 연동이 없는 공영주차장은 평균 30~45% 점유 가정
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

    // 4. 축제/명소 기준 주변 1.5km 이내 실제 주차장 매핑 & 혼잡도 산출
    const resultFestivals: Festival[] = rawList
      .filter((f: any) => f && f.title && f.mapx && f.mapy)
      .map((f: any, idx: number) => {
        const festLat = parseFloat(f.mapy);
        const festLng = parseFloat(f.mapx);
        const festAddress = f.addr1 || '';

        const nearbyParkingLots: Parking[] = combinedParkingLots
          .map((p) => {
            const distM = calculateDistance(festLat, festLng, p.lat, p.lng);
            return {
              ...p,
              distanceMeters: distM,
              distance: distM < 1000 ? `${distM}m` : `${(distM / 1000).toFixed(1)}km`,
            };
          })
          .filter((p) => p.distanceMeters <= 1500)
          .sort((a, b) => a.distanceMeters - b.distanceMeters)
          .slice(0, 5);

        const { crowdLevel, crowdMessage } = calculateRealCrowdStatus(nearbyParkingLots);
        const region = getRegionFromAddress(festAddress, festLat, festLng);

        const contentTypeIdStr = String(f.contenttypeid || f.contentTypeId || '12');
        const categoryType = getCategoryTypeFromContentTypeId(contentTypeIdStr);

        const startDate = f.eventstartdate && f.eventstartdate.length >= 8
          ? `${f.eventstartdate.slice(0, 4)}-${f.eventstartdate.slice(4, 6)}-${f.eventstartdate.slice(6, 8)}`
          : '2026-01-01';
        const endDate = f.eventenddate && f.eventenddate.length >= 8
          ? `${f.eventenddate.slice(0, 4)}-${f.eventenddate.slice(4, 6)}-${f.eventenddate.slice(6, 8)}`
          : '2026-12-31';

        return {
          id: f.contentid || `api-spot-${idx}`,
          title: f.title,
          startDate,
          endDate,
          period: categoryType === '축제' ? `${startDate.replace(/-/g, '.')} ~ ${endDate.replace(/-/g, '.')}` : '연중무휴',
          locationName: f.addr1 || '명소 행사장',
          address: f.addr1 || '',
          region,
          contentTypeId: contentTypeIdStr,
          categoryType,
          lat: festLat,
          lng: festLng,
          crowdLevel,
          crowdMessage,
          category: categoryType,
          imageUrl: f.firstimage || f.firstimage2 || undefined,
          parkingLots: nearbyParkingLots,
        };
      });

    const finalData = resultFestivals.length > 0 ? resultFestivals : MOCK_FESTIVALS;

    console.log('[실제 수집 건수]', finalData.length);

    return NextResponse.json({
      success: true,
      data: finalData,
    });
  } catch (error: any) {
    console.error('[API Exception] /api/festivals 예외:', error);
    return NextResponse.json({
      success: true,
      data: MOCK_FESTIVALS,
    });
  }
}
