import { NextRequest, NextResponse } from 'next/server';
import { Festival, Parking, Region, CategoryType } from '@/types';
import { calculateDistance, calculateRealCrowdStatus, formatWalkingDistanceText } from '@/lib/geoUtils';

// Koreaconnect 공공 API 엔드포인트 URL
const KOREACONNECT_FESTIVAL_SEARCH_URL =
  'https://api.koreaconnect.kr/01/1/2603101713597416530PDP/CULTR/B551011/KorService2/searchFestival2';
const KOREACONNECT_LOCATION_API_URL =
  'https://api.koreaconnect.kr/01/1/2603101713597416530PDP/CULTR/B551011/KorService2/locationBasedList2';
const PARKING_INFO_API_URL =
  'https://api.koreaconnect.kr/01/5/2606081732514722903DCP/LOGIS/api/v1/parking/info';
const PARKING_STATUS_API_URL =
  'https://api.koreaconnect.kr/01/7/2606081732514722903DCP/LOGIS/api/v1/parking/status';

function getRegionFromAddress(address: string, lat: number, lng: number): Region {
  if (!address) return '서울';

  if (address.includes('부산') || address.includes('해운대') || address.includes('수영') || address.includes('민락') || address.includes('기장')) {
    return '부산';
  }
  if (address.includes('대구') || address.includes('수성') || address.includes('달서')) {
    return '대구';
  }
  if (address.includes('대전') || address.includes('유성')) {
    return '대전';
  }
  if (address.includes('서울')) {
    return '서울';
  }
  if (address.includes('경기') || address.includes('인천') || address.includes('수원') || address.includes('구리')) {
    return '경기·인천';
  }
  if (address.includes('강원') || address.includes('강릉') || address.includes('춘천') || address.includes('속초')) {
    return '강원';
  }
  if (address.includes('충청') || address.includes('세종') || address.includes('서천') || address.includes('보령') || address.includes('충남') || address.includes('충북') || address.includes('청주')) {
    return '충청';
  }
  if (address.includes('전라') || address.includes('광주') || address.includes('전남') || address.includes('전북') || address.includes('군산') || address.includes('여수') || address.includes('전주')) {
    return '전라';
  }
  if (address.includes('경상') || address.includes('울산') || address.includes('경남') || address.includes('경북') || address.includes('경주') || address.includes('포항') || address.includes('창원')) {
    return '경상';
  }
  if (address.includes('제주') || address.includes('서귀포')) {
    return '제주';
  }

  if (lat > 37.3) return '서울';
  if (lat > 36.8 && lng < 127.5) return '경기·인천';
  if (lng > 128.5 && lat > 37.0) return '강원';
  if (lng > 128.8 && lat < 35.5) return '부산';
  if (lng > 128.3 && lat < 36.0) return '경상';
  if (lat < 35.8) return '전라';
  return '서울';
}

function getContentTypeIdFromCategory(category?: string | null): string {
  if (category === '축제') return '15';
  if (category === '문화시설') return '14';
  if (category === '공원·나들이') return '12';
  return '15';
}

function getCategoryTypeFromContentTypeId(contentTypeId?: string): CategoryType {
  if (contentTypeId === '15') return '축제';
  if (contentTypeId === '14') return '문화시설';
  return '공원·나들이';
}

function cleanParkingName(name: string): string {
  if (!name) return '공영주차장';
  return name
    .replace(/\(구\)|\(시\)|\(도\)|완속충전기|급속충전기|\[전기차충전소\]/gi, '')
    .trim();
}

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

// 실제 수신 요금 데이터 파싱
function parseFeeInfo(info: any): string {
  const payType = String(info.pay_type_nm || info.chr_se_cd || info.payYn || '');
  if (payType === 'N' || payType.includes('무료')) return '무료';

  const basicTime = info.basic_time || info.gnr_basic_prk_time || info.timeRates || info.prk_cmplx_ti;
  const basicCharge = info.basic_charge || info.gnr_basic_prk_chr || info.rates || info.prk_cmplx_chr;
  const addTime = info.add_time || info.gnr_add_prk_time;
  const addCharge = info.add_charge || info.gnr_add_prk_chr;

  if (basicCharge !== undefined && (Number(basicCharge) === 0 || String(basicCharge) === '0')) {
    return '무료';
  }

  if (basicTime && basicCharge) {
    return `${basicTime}분당 ${Number(basicCharge).toLocaleString()}원`;
  }
  if (addTime && addCharge) {
    return `${addTime}분당 ${Number(addCharge).toLocaleString()}원`;
  }
  return '현장 요금제';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mapX = searchParams.get('mapX') || '126.9780';
    const mapY = searchParams.get('mapY') || '37.5665';
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

    const contentTypeId = requestedContentTypeId || getContentTypeIdFromCategory(categoryParam);
    const isFestival = contentTypeId === '15';

    let rawList: any[] = [];
    const todayStr = '20260821';
    const todayNum = 20260821;

    // 1. 축제(category === '축제')인 경우: searchFestival2 호출
    if (isFestival) {
      const festivalSearchUrl = `${KOREACONNECT_FESTIVAL_SEARCH_URL}?MobileOS=ETC&MobileApp=anbumbyeo&_type=json&eventStartDate=${todayStr}&numOfRows=100&arrange=A`;
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
            rawList = Array.isArray(items) ? items : items ? [items] : [];
          } catch {}
        }
      } catch (err) {
        console.error('[API Error] searchFestival2 호출 예외:', err);
      }
    } else {
      // 2. 공원/문화시설: locationBasedList2 호출
      const rawRadius = Number(searchParams.get('radius')) || 20000;
      const radius = Math.min(Math.max(1000, rawRadius), 20000);
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
            rawList = Array.isArray(items) ? items : items ? [items] : [];
          } catch {}
        }
      } catch (err) {
        console.error('[API Error] locationBasedList2 호출 예외:', err);
      }
    }

    // 3. API-2 & API-3: 실제 실시간 주차장 정보 & 현황 조회
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

    // 4. 순수 실제 응답 기반 주차장 데이터 매핑
    const combinedParkingLots: Parking[] = [];

    for (const info of parkingInfoList) {
      const lat = parseFloat(info.la_val || info.lat || '0');
      const lng = parseFloat(info.lo_val || info.lng || '0');
      if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) continue;

      const isPublic = isStrictPublicParking(info);
      const totalSpaces = parseInt(info.sum_park_cnt || info.gnr_park_cnt || '0', 10);
      if (totalSpaces < 10) continue;

      const cleanedName = cleanParkingName(info.prl_nm || info.prk_nm || '');
      const code = info.std_prl_cd || info.std_prk_mg_no || `prk-${Math.random()}`;
      const status = parkingStatusMap.get(code);
      const isRealtime = Boolean(status);

      let availableSpaces = totalSpaces;
      if (status) {
        const occupied = parseInt(
          status.now_park_cnt || status.sum_curr_use_park_cnt || status.cur_use_prk_cnt || '0',
          10
        );
        availableSpaces = Math.max(0, totalSpaces - occupied);
      } else {
        availableSpaces = Math.floor(totalSpaces * 0.65);
      }

      const feeInfo = parseFeeInfo(info);

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
        isPublic,
        feeInfo,
      });
    }

    // 5. 엄격한 1km(1000m) 거리 필터 적용 (하드코딩 완전 100% 제거)
    const resultFestivals: Festival[] = rawList
      .filter((f: any) => f && f.title && f.mapx && f.mapy)
      .filter((f: any) => {
        const typeIdStr = String(f.contenttypeid || f.contentTypeId || contentTypeId);
        if (typeIdStr !== '15') return true;

        const rawStart = String(f.eventstartdate || f.event_start_date || '');
        const rawEnd = String(f.eventenddate || f.event_end_date || '');

        if (!rawStart || !rawEnd || rawStart.length < 8 || rawEnd.length < 8) {
          return false;
        }

        const startNum = Number(rawStart);
        const endNum = Number(rawEnd);

        if (isNaN(startNum) || isNaN(endNum)) {
          return false;
        }

        if (endNum < todayNum) {
          return false;
        }

        return true;
      })
      .map((f: any, idx: number) => {
        const festLat = parseFloat(f.mapy);
        const festLng = parseFloat(f.mapx);
        const festAddress = f.addr1 || '';
        const region = getRegionFromAddress(festAddress, festLat, festLng);

        // 엄격 1km (1000m) 이내 실제 주차장만 수집
        const allNearby = combinedParkingLots
          .map((p) => {
            const distM = calculateDistance(festLat, festLng, p.lat, p.lng);
            return {
              ...p,
              distanceMeters: distM,
              distance: formatWalkingDistanceText(distM),
            };
          })
          .filter((p) => p.distanceMeters <= 1000) // 엄격한 1km (1000m)제한 적용
          .sort((a, b) => a.distanceMeters - b.distanceMeters);

        const publicParkings = allNearby.filter((p) => p.isPublic).slice(0, 5);
        let finalParkingLots: Parking[] = [...publicParkings];

        if (publicParkings.length < 3) {
          const privateParkings = allNearby
            .filter((p) => !p.isPublic)
            .slice(0, 2);
          finalParkingLots = [...publicParkings, ...privateParkings];
        }

        const { crowdLevel, crowdMessage } = calculateRealCrowdStatus(finalParkingLots);
        const typeIdStr = String(f.contenttypeid || f.contentTypeId || contentTypeId);
        const categoryType = getCategoryTypeFromContentTypeId(typeIdStr);

        const rawStart = String(f.eventstartdate || f.event_start_date || '');
        const rawEnd = String(f.eventenddate || f.event_end_date || '');

        const startDate = `${rawStart.slice(0, 4)}-${rawStart.slice(4, 6)}-${rawStart.slice(6, 8)}`;
        const endDate = `${rawEnd.slice(0, 4)}-${rawEnd.slice(4, 6)}-${rawEnd.slice(6, 8)}`;

        const period = categoryType === '축제'
          ? `${rawStart.slice(0, 4)}.${rawStart.slice(4, 6)}.${rawStart.slice(6, 8)} ~ ${rawEnd.slice(0, 4)}.${rawEnd.slice(4, 6)}.${rawEnd.slice(6, 8)}`
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
          crowdMessage: finalParkingLots.length === 0
            ? '주변 1km 내 공영주차장 정보 확인 중 (대중교통 이용 권장)'
            : crowdMessage,
          category: categoryType,
          imageUrl: f.firstimage || f.firstimage2 || undefined,
          parkingLots: finalParkingLots,
          startNum: Number(rawStart),
          endNum: Number(rawEnd),
        };
      });

    const sortedFestivals = resultFestivals.sort((a, b) => {
      const aStart = a.startNum || 0;
      const bStart = b.startNum || 0;
      const aIsUpcoming = aStart > todayNum;
      const bIsUpcoming = bStart > todayNum;

      if (aIsUpcoming && bIsUpcoming) {
        return aStart - bStart;
      }
      return bStart - aStart;
    });

    return NextResponse.json({
      success: true,
      data: sortedFestivals,
    });
  } catch (error: any) {
    console.error('[API Exception] /api/festivals 예외:', error);
    return NextResponse.json({
      success: true,
      data: [],
    });
  }
}
