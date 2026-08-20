import { NextRequest, NextResponse } from 'next/server';
import { Festival, Parking, Region } from '@/types';
import { calculateDistance, calculateCrowdScore } from '@/lib/geoUtils';
import { MOCK_FESTIVALS } from '@/services/mockData';

const API_USER_KEY = process.env.TOUR_API_KEY || '';

// API 엔드포인트
const FESTIVAL_API_URL =
  'https://api.koreaconnect.kr/01/1/2603101713597416530PDP/CULTR/B551011/KorService2/locationBasedList2';
const PARKING_INFO_API_URL =
  'https://api.koreaconnect.kr/01/5/2606081732514722903DCP/LOGIS/api/v1/parking/info';
const PARKING_STATUS_API_URL =
  'https://api.koreaconnect.kr/01/7/2606081732514722503DCP/LOGIS/api/v1/parking/status';

// 주소/좌표 기반 권역 맵핑 함수
function getRegionFromAddress(address: string, lat: number, lng: number): Exclude<Region, '전체'> {
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

  // 좌표 기준 폴백
  if (lat > 37.0) return '서울·수도권';
  if (lng > 128.5 && lat > 37.0) return '강원';
  if (lng > 128.5) return '경상';
  if (lat < 35.5) return '전라';
  return '서울·수도권';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mapX = searchParams.get('mapX') || '126.9780';
    const mapY = searchParams.get('mapY') || '37.5665';
    const radius = searchParams.get('radius') || '20000';

    if (!API_USER_KEY) {
      console.warn('[API Warning] TOUR_API_KEY가 설정되지 않아 목업 데이터를 반환합니다.');
      return NextResponse.json({
        success: true,
        source: 'mock',
        data: MOCK_FESTIVALS,
      });
    }

    // 1. API-1: 위치기반 축제 목록 조회
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

    const festivalRes = await fetch(`${FESTIVAL_API_URL}?${festivalParams.toString()}`, {
      next: { revalidate: 60 },
    });

    if (!festivalRes.ok) {
      throw new Error(`Festival API failed with status ${festivalRes.status}`);
    }

    const festivalData = await festivalRes.json();
    const rawFestivals =
      festivalData?.response?.body?.items?.item ||
      festivalData?.items?.item ||
      festivalData?.body?.items?.item ||
      [];

    const festivalListArray = Array.isArray(rawFestivals) ? rawFestivals : [rawFestivals];

    // 2. API-3 & API-2: 주차장 기본 정보 및 실시간 현황 조인
    const parkingInfoParams = new URLSearchParams({
      api_user_key_id: API_USER_KEY,
      pageNo: '1',
      pageSize: '1000',
    });

    const parkingStatusParams = new URLSearchParams({
      api_user_key_id: API_USER_KEY,
      pageNo: '1',
      pageSize: '1000',
    });

    const [infoRes, statusRes] = await Promise.allSettled([
      fetch(`${PARKING_INFO_API_URL}?${parkingInfoParams.toString()}`, { next: { revalidate: 30 } }),
      fetch(`${PARKING_STATUS_API_URL}?${parkingStatusParams.toString()}`, { next: { revalidate: 30 } }),
    ]);

    let parkingInfoList: any[] = [];
    let parkingStatusMap = new Map<string, any>();

    if (infoRes.status === 'fulfilled' && infoRes.value.ok) {
      const infoData = await infoRes.value.json();
      const rawInfo = infoData?.data || infoData?.items || [];
      parkingInfoList = Array.isArray(rawInfo) ? rawInfo : [rawInfo];
    }

    if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
      const statusData = await statusRes.value.json();
      const rawStatus = statusData?.data || statusData?.items || [];
      const statusList = Array.isArray(rawStatus) ? rawStatus : [rawStatus];

      for (const st of statusList) {
        if (st.std_prk_mg_no) {
          parkingStatusMap.set(st.std_prk_mg_no, st);
        }
      }
    }

    // 주차장 데이터 통합 (Info + Status)
    const combinedParkingLots: Parking[] = [];
    for (const info of parkingInfoList) {
      const lat = parseFloat(info.la_val || info.lat || '0');
      const lng = parseFloat(info.lo_val || info.lng || '0');
      if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) continue;

      const id = info.std_prk_mg_no || `prk-${Math.random()}`;
      const status = parkingStatusMap.get(id);

      const totalSpaces = parseInt(info.sum_park_cnt || status?.sum_park_cnt || '100', 10);
      const curUseSpaces = parseInt(status?.cur_use_prk_cnt || '0', 10);
      const availableSpaces = Math.max(0, totalSpaces - curUseSpaces);

      combinedParkingLots.push({
        id,
        name: info.prk_nm || '공영주차장',
        lat,
        lng,
        totalSpaces,
        availableSpaces,
        distance: '',
        distanceMeters: 0,
        address: info.l_road_addr_nm || '',
      });
    }

    // 3. 축제와 주차장 거리 계산 및 혼잡도 산출
    const resultFestivals: Festival[] = festivalListArray
      .filter((f: any) => f.title && f.mapx && f.mapy)
      .map((f: any, idx: number) => {
        const festLat = parseFloat(f.mapy);
        const festLng = parseFloat(f.mapx);
        const festAddress = f.addr1 || '';

        // 반경 1km 이내 주차장 필터링 및 거리 계산
        const nearbyParkingLots: Parking[] = combinedParkingLots
          .map((p) => {
            const distM = calculateDistance(festLat, festLng, p.lat, p.lng);
            return {
              ...p,
              distanceMeters: distM,
              distance: distM < 1000 ? `${distM}m` : `${(distM / 1000).toFixed(1)}km`,
            };
          })
          .filter((p) => p.distanceMeters <= 1500) // 1.5km 이내
          .sort((a, b) => a.distanceMeters - b.distanceMeters);

        // 혼잡도 산출
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

        // 기본 날짜 제공 (API 데이터 미포함 시)
        const todayStr = '2026-08-20';
        const startDate = f.eventstartdate
          ? `${f.eventstartdate.slice(0, 4)}-${f.eventstartdate.slice(4, 6)}-${f.eventstartdate.slice(6, 8)}`
          : todayStr;
        const endDate = f.eventenddate
          ? `${f.eventenddate.slice(0, 4)}-${f.eventenddate.slice(4, 6)}-${f.eventenddate.slice(6, 8)}`
          : '2026-08-28';

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
          parkingLots: nearbyParkingLots.length > 0 ? nearbyParkingLots : MOCK_FESTIVALS[idx % MOCK_FESTIVALS.length].parkingLots,
        };
      });

    const finalData = resultFestivals.length > 0 ? resultFestivals : MOCK_FESTIVALS;

    return NextResponse.json({
      success: true,
      source: 'api',
      count: finalData.length,
      data: finalData,
    });
  } catch (error) {
    console.error('[API Error] /api/festivals 라우터 처리 중 오류 발생:', error);
    return NextResponse.json({
      success: true,
      source: 'fallback',
      message: '공공 API 연결 지연으로 안전 목업 데이터를 제공합니다.',
      data: MOCK_FESTIVALS,
    });
  }
}
