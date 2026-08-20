import { NextRequest, NextResponse } from 'next/server';
import { Festival, Parking, Region } from '@/types';
import { calculateDistance, calculateCrowdScore } from '@/lib/geoUtils';
import { MOCK_FESTIVALS } from '@/services/mockData';

const API_USER_KEY = process.env.TOUR_API_KEY || process.env.NEXT_PUBLIC_TOUR_API_KEY || '';

// Koreaconnect 공공 API 엔드포인트
const FESTIVAL_API_URL =
  'https://api.koreaconnect.kr/01/1/2603101713597416530PDP/CULTR/B551011/KorService2/locationBasedList2';
const PARKING_INFO_API_URL =
  'https://api.koreaconnect.kr/01/5/2606081732514722903DCP/LOGIS/api/v1/parking/info';
const PARKING_STATUS_API_URL =
  'https://api.koreaconnect.kr/01/7/2606081732514722503DCP/LOGIS/api/v1/parking/status';

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mapX = searchParams.get('mapX') || '126.9780';
    const mapY = searchParams.get('mapY') || '37.5665';
    const radius = searchParams.get('radius') || '20000';

    // 1. API 키 미등록 시 즉시 안전 시연용 폴백 리턴
    if (!API_USER_KEY) {
      console.warn('[API Notice] TOUR_API_KEY가 미설정되어 시연용 백업 데이터를 제공합니다.');
      return NextResponse.json({
        success: true,
        source: 'fallback-no-key',
        count: MOCK_FESTIVALS.length,
        data: MOCK_FESTIVALS,
      });
    }

    // 2. API-1 위치기반 축제 조회 호출
    const festivalParams = new URLSearchParams({
      api_user_key_id: API_USER_KEY,
      MobileOS: 'ETC',
      MobileApp: 'anbumbyeo',
      _type: 'json',
      contentTypeId: '15',
      mapX,
      mapY,
      radius,
      numOfRows: '50',
      arrange: 'E',
    });

    let festivalListArray: any[] = [];
    try {
      const festivalRes = await fetch(`${FESTIVAL_API_URL}?${festivalParams.toString()}`, {
        next: { revalidate: 60 },
      });

      if (!festivalRes.ok) {
        console.error(`[API Error] Festival API 호출 실패 - HTTP Status: ${festivalRes.status}`);
      } else {
        const festivalJson = await festivalRes.json();
        // 방어 코드: items.item이 배열, 단일 객체, 또는 null/undefined인 경우 안전하게 배열화
        const rawItems =
          festivalJson?.response?.body?.items?.item ||
          festivalJson?.items?.item ||
          festivalJson?.body?.items?.item ||
          festivalJson?.data;

        festivalListArray = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
      }
    } catch (err) {
      console.error('[API Error] Festival API fetch 예외 발생:', err);
    }

    // 축제 데이터가 0개인 경우 시연용 백업 제공
    if (festivalListArray.length === 0) {
      console.warn('[API Notice] 외부 축제 API 반환 결과가 0건이어서 시연용 데이터를 제공합니다.');
      return NextResponse.json({
        success: true,
        source: 'fallback-empty',
        count: MOCK_FESTIVALS.length,
        data: MOCK_FESTIVALS,
      });
    }

    // 3. API-3 및 API-2 (주차장 기본정보 & 실시간 주차현황) 호출 및 방어적 조인
    const parkingInfoParams = new URLSearchParams({
      api_user_key_id: API_USER_KEY,
      page_no: '1',
      page_size: '1000',
    });

    const parkingStatusParams = new URLSearchParams({
      api_user_key_id: API_USER_KEY,
      page_no: '1',
      page_size: '1000',
    });

    const [infoRes, statusRes] = await Promise.allSettled([
      fetch(`${PARKING_INFO_API_URL}?${parkingInfoParams.toString()}`, { next: { revalidate: 30 } }),
      fetch(`${PARKING_STATUS_API_URL}?${parkingStatusParams.toString()}`, { next: { revalidate: 30 } }),
    ]);

    let parkingInfoList: any[] = [];
    const parkingStatusMap = new Map<string, any>();

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

    // 주차장 데이터 통합
    const combinedParkingLots: Parking[] = [];
    for (const info of parkingInfoList) {
      const lat = parseFloat(info.la_val || info.lat || '0');
      const lng = parseFloat(info.lo_val || info.lng || '0');
      if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) continue;

      const code = info.std_prl_cd || info.std_prk_mg_no || `prk-${Math.random()}`;
      const status = parkingStatusMap.get(code);

      const totalSpaces = parseInt(info.sum_park_cnt || status?.sum_park_cnt || '100', 10);
      const curUseSpaces = parseInt(
        status?.sum_curr_use_park_cnt || status?.cur_use_prk_cnt || '0',
        10
      );
      const availableSpaces = Math.max(0, totalSpaces - curUseSpaces);

      combinedParkingLots.push({
        id: code,
        name: info.prl_nm || info.prk_nm || '공영주차장',
        lat,
        lng,
        totalSpaces,
        availableSpaces,
        distance: '',
        distanceMeters: 0,
        address: info.prl_road_addr_nm || info.l_road_addr_nm || info.prl_jino_addr_nm || '',
      });
    }

    // 4. 각 축제별 반경 1km 이내 주차장 매핑 & 혼잡도 엔지니어링 산출
    const resultFestivals: Festival[] = festivalListArray
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
          .filter((p) => p.distanceMeters <= 1000)
          .sort((a, b) => a.distanceMeters - b.distanceMeters);

        const crowdInput = nearbyParkingLots.map((p) => {
          const used = p.totalSpaces - p.availableSpaces;
          return {
            distanceMeters: p.distanceMeters,
            totalSpaces: p.totalSpaces,
            currentUsedSpaces: used,
          };
        });

        const { crowdLevel, crowdMessage } = calculateCrowdScore(crowdInput);
        const region = getRegionFromAddress(festAddress, festLat, festLng);

        const todayStr = '2026-08-20';
        const startDate = f.eventstartdate && f.eventstartdate.length >= 8
          ? `${f.eventstartdate.slice(0, 4)}-${f.eventstartdate.slice(4, 6)}-${f.eventstartdate.slice(6, 8)}`
          : todayStr;
        const endDate = f.eventenddate && f.eventenddate.length >= 8
          ? `${f.eventenddate.slice(0, 4)}-${f.eventenddate.slice(4, 6)}-${f.eventenddate.slice(6, 8)}`
          : '2026-08-28';

        const fallbackParking = MOCK_FESTIVALS[idx % MOCK_FESTIVALS.length].parkingLots;

        return {
          id: f.contentid || `api-fest-${idx}`,
          title: f.title,
          startDate,
          endDate,
          period: `${startDate.replace(/-/g, '.')} ~ ${endDate.replace(/-/g, '.')}`,
          locationName: f.addr1 || '축제 행사장',
          address: f.addr1 || '',
          region,
          lat: festLat,
          lng: festLng,
          crowdLevel,
          crowdMessage,
          category: '지역축제',
          imageUrl: f.firstimage || f.firstimage2 || undefined,
          parkingLots: nearbyParkingLots.length > 0 ? nearbyParkingLots : fallbackParking,
        };
      });

    const finalData = resultFestivals.length > 0 ? resultFestivals : MOCK_FESTIVALS;

    return NextResponse.json({
      success: true,
      source: 'api',
      count: finalData.length,
      data: finalData,
    });
  } catch (error: any) {
    console.error('[API Exception] /api/festivals 백엔드 예외 발생:', error);
    // 500 에러 대신 클라이언트 안전을 위해 200 OK + 시연용 백업 반환
    return NextResponse.json({
      success: true,
      source: 'fallback-exception',
      message: '서버 내부 예외로 인해 시연용 안전 데이터를 제공합니다.',
      count: MOCK_FESTIVALS.length,
      data: MOCK_FESTIVALS,
    });
  }
}
