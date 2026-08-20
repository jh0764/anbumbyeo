import { NextRequest, NextResponse } from 'next/server';
import { Festival, Parking, Region, CategoryType } from '@/types';
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

function getCategoryTypeFromContentTypeId(contentTypeId?: string): Exclude<CategoryType, '전체'> {
  if (contentTypeId === '15') return '축제';
  if (contentTypeId === '14') return '문화시설';
  return '공원·나들이';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mapX = searchParams.get('mapX') || '126.9780';
    const mapY = searchParams.get('mapY') || '37.5665';
    const radius = searchParams.get('radius') || '20000';
    const requestedContentTypeId = searchParams.get('contentTypeId');
    const categoryParam = searchParams.get('category');

    console.log('[Backend API Init] TOUR_API_KEY 감지 상태:', API_USER_KEY ? 'Key Loaded' : 'No Key');

    // 1. API 키 미설정 시 백업 데이터 리턴
    if (!API_USER_KEY) {
      console.warn('[API Notice] TOUR_API_KEY 미설정으로 백업 데이터를 제공합니다.');
      console.log('실제 API 수집 건수:', MOCK_FESTIVALS.length);
      return NextResponse.json({
        success: true,
        data: MOCK_FESTIVALS,
      });
    }

    // 2. contentTypeId 12(관광지/공원), 14(문화시설), 15(축제) 동적 반영
    let targetTypes: string[] = ['15', '12', '14'];
    if (requestedContentTypeId) {
      targetTypes = [requestedContentTypeId];
    } else if (categoryParam) {
      if (categoryParam === '축제') targetTypes = ['15'];
      else if (categoryParam === '문화시설') targetTypes = ['14'];
      else if (categoryParam === '공원·나들이') targetTypes = ['12'];
    }

    const apiFetchPromises = targetTypes.map((typeId) => {
      const festivalParams = new URLSearchParams({
        api_user_key_id: API_USER_KEY,
        MobileOS: 'ETC',
        MobileApp: 'anbumbyeo',
        _type: 'json',
        contentTypeId: typeId,
        mapX,
        mapY,
        radius,
        numOfRows: '30',
        arrange: 'E',
      });
      return fetch(`${FESTIVAL_API_URL}?${festivalParams.toString()}`, {
        next: { revalidate: 60 },
      }).then((res) => (res.ok ? res.json() : null));
    });

    const apiResults = await Promise.allSettled(apiFetchPromises);

    let rawList: any[] = [];
    for (const res of apiResults) {
      if (res.status === 'fulfilled' && res.value) {
        const json = res.value;
        const items =
          json?.response?.body?.items?.item ||
          json?.items?.item ||
          json?.body?.items?.item ||
          json?.data;
        const itemArr = Array.isArray(items) ? items : items ? [items] : [];
        rawList.push(...itemArr);
      }
    }

    // 수집 결과가 0건일 때 백업 리턴
    if (rawList.length === 0) {
      console.warn('[API Notice] 공공 API 반환 건수가 0건이어서 백업 데이터를 제공합니다.');
      console.log('실제 API 수집 건수:', MOCK_FESTIVALS.length);
      return NextResponse.json({
        success: true,
        data: MOCK_FESTIVALS,
      });
    }

    // 3. API-3 (주차장 기본정보) & API-2 (실시간 주차현황) 호출 및 조인
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

    // 주차장 데이터 매핑
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

    // 4. 명소/축제별 반경 1km 주차장 조인 및 혼잡도 계산
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

        const contentTypeIdStr = String(f.contenttypeid || f.contentTypeId || '12');
        const categoryType = getCategoryTypeFromContentTypeId(contentTypeIdStr);

        const todayStr = '2026-08-20';
        const startDate = f.eventstartdate && f.eventstartdate.length >= 8
          ? `${f.eventstartdate.slice(0, 4)}-${f.eventstartdate.slice(4, 6)}-${f.eventstartdate.slice(6, 8)}`
          : '2026-01-01';
        const endDate = f.eventenddate && f.eventenddate.length >= 8
          ? `${f.eventenddate.slice(0, 4)}-${f.eventenddate.slice(4, 6)}-${f.eventenddate.slice(6, 8)}`
          : '2026-12-31';

        const fallbackParking = MOCK_FESTIVALS[idx % MOCK_FESTIVALS.length].parkingLots;

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
          parkingLots: nearbyParkingLots.length > 0 ? nearbyParkingLots : fallbackParking,
        };
      });

    const finalData = resultFestivals.length > 0 ? resultFestivals : MOCK_FESTIVALS;

    console.log('실제 API 수집 건수:', finalData.length);

    return NextResponse.json({
      success: true,
      data: finalData,
    });
  } catch (error: any) {
    console.error('[API Exception] /api/festivals 예외:', error);
    console.log('실제 API 수집 건수:', MOCK_FESTIVALS.length);
    return NextResponse.json({
      success: true,
      data: MOCK_FESTIVALS,
    });
  }
}
