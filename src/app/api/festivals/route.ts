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

// 주요 자치구 법정동 시군구 코드 (5자리) 사전 맵핑
const SIGUNGU_CODE_MAP: Record<string, string> = {
  // 부산
  '부산 수영구': '26500', '부산 해운대구': '26350', '부산 사상구': '26530', '부산 부산진구': '26230',
  '부산 강서구': '26440', '부산 동래구': '26260', '부산 남구': '26290', '부산 북구': '26320',
  '부산 사하구': '26380', '부산 금정구': '26410', '부산 연제구': '26470', '부산 기장군': '26710',
  '부산 중구': '26110', '부산 서구': '26140', '부산 동구': '26170', '부산 영도구': '26200',
  // 서울
  '서울 종로구': '11110', '서울 중구': '11140', '서울 용산구': '11170', '서울 성동구': '11200',
  '서울 마포구': '11440', '서울 강남구': '11680', '서울 영등포구': '11560', '서울 송파구': '11710',
  '서울 서초구': '11650', '서울 강서구': '11500', '서울 관악구': '11620', '서울 강동구': '11740',
  // 대구
  '대구 중구': '27110', '대구 동구': '27140', '대구 수성구': '27260', '대구 달서구': '27290',
  // 대전
  '대전 유성구': '30200', '대전 서구': '30170', '대전 중구': '30140', '대전 동구': '30110',
  // 강원
  '강원 강릉시': '42150', '강원 춘천시': '42110', '강원 속초시': '42210',
  // 충청
  '충남 서천군': '44770', '충남 보령시': '44180', '충북 청주시': '43110',
  // 전라
  '전남 여수시': '46130', '전북 전주시': '45111', '광주 동구': '29110',
  // 경상
  '경북 경주시': '47130', '울산 남구': '31140',
  // 제주
  '제주 제주시': '50110', '제주 서귀포시': '50130',
};

function getSigunguCodeFromAddress(address: string, lat: number, lng: number): string {
  if (!address) return '11110';

  for (const [key, code] of Object.entries(SIGUNGU_CODE_MAP)) {
    if (address.includes(key) || (key.split(' ')[1] && address.includes(key.split(' ')[1]))) {
      return code;
    }
  }

  if (address.includes('사상') || address.includes('삼락')) return '26530';
  if (address.includes('수영') || address.includes('광안')) return '26500';
  if (address.includes('해운대')) return '26350';
  if (address.includes('부산')) return '26500';

  if (address.includes('대구')) return '27110';
  if (address.includes('대전')) return '30200';
  if (address.includes('서울')) return '11110';

  if (lng > 129.0 && lat < 35.3) return '26500';
  return '11110';
}

function getRegionFromAddress(address: string, lat: number, lng: number): Region {
  if (!address) return '서울';

  if (address.includes('부산') || address.includes('해운대') || address.includes('수영') || address.includes('민락') || address.includes('기장') || address.includes('사상') || address.includes('삼락')) {
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
  if (!name) return '주차장';
  return name
    .replace(/\(구\)|\(시\)|\(도\)|완속충전기|급속충전기|\[전기차충전소\]/gi, '')
    .trim();
}

function isPublicParkingDiv(info: any): boolean {
  const divName = String(info.prl_div_nm || info.prl_kind_nm || info.prk_kind_nm || info.prl_se_cd || '');
  const rawName = String(info.prl_nm || info.prk_nm || '');

  if (divName.includes('민영') || divName.includes('부설')) {
    return false;
  }
  if (divName.includes('공영') || rawName.includes('공영') || rawName.includes('구청') || rawName.includes('시청') || rawName.includes('동사무소') || rawName.includes('주민센터') || rawName.includes('생태공원') || rawName.includes('체육공원')) {
    return true;
  }
  return false;
}

function parseFeeInfoFromApi(info: any, isPublic: boolean): string {
  const bscTime = info.bsc_park_tme || info.basic_time || info.gnr_basic_prk_time;
  const bscAmt = info.bsc_park_amt || info.basic_charge || info.gnr_basic_prk_chr;

  const addTime = info.add_unit_tme || info.add_time || info.gnr_add_prk_time;
  const addAmt = info.add_unit_amt || info.add_charge || info.gnr_add_prk_chr;

  const numBscAmt = Number(bscAmt);

  if (!isPublic) {
    if (bscTime && bscAmt && !isNaN(numBscAmt) && numBscAmt > 0) {
      let feeStr = `${bscTime}분당 ${numBscAmt.toLocaleString()}원`;
      if (addTime && addAmt && Number(addAmt) > 0) {
        feeStr += ` (추가 ${addTime}분당 ${Number(addAmt).toLocaleString()}원)`;
      }
      return feeStr;
    }
    return '민영 현장 요금제';
  }

  const isFree = info.pchrg_free_nm === '무료' || (bscAmt !== undefined && numBscAmt === 0) || info.pay_type_nm === '무료';
  if (isFree) return '무료';

  if (bscTime && bscAmt && !isNaN(numBscAmt) && numBscAmt > 0) {
    let feeStr = `${bscTime}분당 ${numBscAmt.toLocaleString()}원`;
    if (addTime && addAmt && Number(addAmt) > 0) {
      feeStr += ` (추가 ${addTime}분당 ${Number(addAmt).toLocaleString()}원)`;
    }
    return feeStr;
  }
  if (addTime && addAmt && Number(addAmt) > 0) {
    return `${addTime}분당 ${Number(addAmt).toLocaleString()}원`;
  }

  return '현장 요금제';
}

// 순수 종교시설 키워드 판별 유틸
function isReligiousFacility(title: string, address: string): boolean {
  const religiousRegex = /교회|성당|기도원|교구|순례지|선원|사찰|성지|천주교|대성당/i;
  return religiousRegex.test(title) || religiousRegex.test(address);
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

    // 3. 축제/명소 주소 기반 시군구 코드(addr_cd) 동적 파싱 & 주차장 API 수집
    const targetCenterLat = parseFloat(mapY);
    const targetCenterLng = parseFloat(mapX);

    // 수집된 항목들의 주소 기반 시군구 코드들 추출
    const dynamicSigunguCodes = new Set<string>();
    dynamicSigunguCodes.add(getSigunguCodeFromAddress('', targetCenterLat, targetCenterLng));

    for (const item of rawList.slice(0, 30)) {
      const addr = item.addr1 || '';
      const code = getSigunguCodeFromAddress(addr, parseFloat(item.mapy || '0'), parseFloat(item.mapx || '0'));
      dynamicSigunguCodes.add(code);
    }
    dynamicSigunguCodes.add('26530'); // 사상구(삼락공원)
    dynamicSigunguCodes.add('26500'); // 수영구(광안리)
    dynamicSigunguCodes.add('26350'); // 해운대구

    let parkingInfoList: any[] = [];
    const parkingStatusMap = new Map<string, any>();

    const fetchParkingPromises = Array.from(dynamicSigunguCodes).map(async (code) => {
      const infoUrl = `${PARKING_INFO_API_URL}?pageNo=1&pageSize=1000&addr_cd=${code}&addr_type=SIGUNGU`;
      const statusUrl = `${PARKING_STATUS_API_URL}?pageNo=1&pageSize=1000&addr_cd=${code}&addr_type=SIGUNGU`;

      try {
        const [iRes, sRes] = await Promise.all([
          fetch(infoUrl, { cache: 'no-store', headers: { api_user_key_id: parkingApiKey, Accept: 'application/json' } }),
          fetch(statusUrl, { cache: 'no-store', headers: { api_user_key_id: parkingApiKey, Accept: 'application/json' } }),
        ]);

        let iItems: any[] = [];
        if (iRes.ok) {
          const iJson = await iRes.json();
          const raw = iJson?.data || iJson?.response?.body?.items?.item || iJson?.items;
          iItems = Array.isArray(raw) ? raw : raw ? [raw] : [];
        }

        let sItems: any[] = [];
        if (sRes.ok) {
          const sJson = await sRes.json();
          const rawS = sJson?.data || sJson?.response?.body?.items?.item || sJson?.items;
          sItems = Array.isArray(rawS) ? rawS : rawS ? [rawS] : [];
        }

        return { iItems, sItems };
      } catch {
        return { iItems: [], sItems: [] };
      }
    });

    const infoResults = await Promise.allSettled(fetchParkingPromises);

    const seenCodes = new Set<string>();
    for (const resObj of infoResults) {
      if (resObj.status === 'fulfilled' && resObj.value) {
        const { iItems, sItems } = resObj.value;

        for (const item of iItems) {
          const code = item.std_prl_cd || item.std_prk_mg_no;
          if (code && !seenCodes.has(code)) {
            seenCodes.add(code);
            parkingInfoList.push(item);
          }
        }

        for (const st of sItems) {
          const code = st.std_prl_cd || st.std_prk_mg_no || st.std_prk_cd;
          if (code) {
            parkingStatusMap.set(code, st);
          }
        }
      }
    }

    // 4. 최소 주차면수(10면 이상) 필터링 & 요금 표기 적용
    const combinedParkingLots: Parking[] = [];

    for (const info of parkingInfoList) {
      const lat = parseFloat(info.la_val || info.lat || '0');
      const lng = parseFloat(info.lo_val || info.lng || '0');
      if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) continue;

      const isPublic = isPublicParkingDiv(info);
      const totalSpaces = parseInt(info.sum_park_cnt || info.gnr_park_cnt || '0', 10);

      // 1~9면 초소형 부설주차장 필터링 삭제
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

      const feeInfo = parseFeeInfoFromApi(info, isPublic);

      combinedParkingLots.push({
        id: code,
        name: cleanedName,
        lat,
        lng,
        totalSpaces,
        availableSpaces,
        distance: '',
        distanceMeters: 0,
        address: info.prl_road_addr_nm || info.prl_jino_addr_nm || info.l_road_addr_nm || '',
        isRealtime,
        isPublic,
        feeInfo,
      });
    }

    // 5. 공원·나들이 탭 종교시설 100% 필터링 삭제 및 대형공원 2차 거리 확장
    const resultFestivals: Festival[] = rawList
      .filter((f: any) => f && f.title && f.mapx && f.mapy)
      .filter((f: any) => {
        const typeIdStr = String(f.contenttypeid || f.contentTypeId || contentTypeId);
        const titleStr = String(f.title || '');
        const addrStr = String(f.addr1 || '');

        // [공원·나들이 탭 핵심 필터링]: 교회/성당/기도원 등 종교시설 100% 제거
        if (typeIdStr === '12' || categoryParam === '공원·나들이') {
          if (isReligiousFacility(titleStr, addrStr)) {
            return false;
          }
        }

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
        const festTitle = f.title || '';

        // 1차: 1km(1000m) 이내 주차장 수집
        let allNearby = combinedParkingLots
          .map((p) => {
            const distM = calculateDistance(festLat, festLng, p.lat, p.lng);
            return {
              ...p,
              distanceMeters: distM,
              distance: formatWalkingDistanceText(distM),
            };
          })
          .filter((p) => p.distanceMeters <= 1000)
          .sort((a, b) => a.distanceMeters - b.distanceMeters);

        // 삼락생태공원 등 넓은 야외 대형공원의 경우 1km 내 주차장이 0개이면 2km까지 2차 확장
        const isLargePark = festTitle.includes('생태공원') || festTitle.includes('삼락') || festTitle.includes('체육공원') || festTitle.includes('수변공원');
        if (allNearby.length === 0 && isLargePark) {
          allNearby = combinedParkingLots
            .map((p) => {
              const distM = calculateDistance(festLat, festLng, p.lat, p.lng);
              return {
                ...p,
                distanceMeters: distM,
                distance: formatWalkingDistanceText(distM),
              };
            })
            .filter((p) => p.distanceMeters <= 2000)
            .sort((a, b) => a.distanceMeters - b.distanceMeters);
        }

        const publicParkings = allNearby.filter((p) => p.isPublic).slice(0, 3);
        const privateParkings = allNearby.filter((p) => !p.isPublic).slice(0, 2);

        const finalParkingLots: Parking[] = [...publicParkings, ...privateParkings];
        const { crowdLevel, crowdMessage } = calculateRealCrowdStatus(finalParkingLots);
        const region = getRegionFromAddress(festAddress, festLat, festLng);

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

    console.log('[동적 시군구 & 종교시설 필터링 완수 건수]', sortedFestivals.length);

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
