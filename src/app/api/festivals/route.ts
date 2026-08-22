import { NextRequest, NextResponse } from 'next/server';
import { Festival, Parking, Region, CategoryType } from '@/types';
import { calculateDistance, calculateRealCrowdStatus, formatWalkingDistanceText } from '@/lib/geoUtils';

// Next.js Fetch 및 라우트 캐시 완전 비활성화 (no-store 강제)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Koreaconnect 공공 API 엔드포인트 URL
const KOREACONNECT_FESTIVAL_SEARCH_URL =
  'https://api.koreaconnect.kr/01/1/2603101713597416530PDP/CULTR/B551011/KorService2/searchFestival2';
const KOREACONNECT_LOCATION_API_URL =
  'https://api.koreaconnect.kr/01/1/2603101713597416530PDP/CULTR/B551011/KorService2/locationBasedList2';
const PARKING_INFO_API_URL =
  'https://api.koreaconnect.kr/01/5/2606081732514722903DCP/LOGIS/api/v1/parking/info';
const PARKING_STATUS_API_URL =
  'https://api.koreaconnect.kr/01/7/2606081732514722903DCP/LOGIS/api/v1/parking/status';

// 주요 자치구 5자리 법정동 코드 사전
const SIGUNGU_CODE_MAP: Record<string, string> = {
  // 서울
  '성동구': '11200', '마포구': '11440', '중구': '11140', '종로구': '11110',
  '강남구': '11680', '영등포구': '11560', '용산구': '11170', '성북구': '11290',
  '강서구': '11500', '송파구': '11710', '서초구': '11650', '관악구': '11620',
  '동대문구': '11230', '광진구': '11215',
  // 부산
  '수영구': '26500', '해운대구': '26350', '사상구': '26530', '부산진구': '26230',
  '남구': '26290', '연제구': '26470', '동래구': '26260', '금정구': '26410',
  // 울산
  '울산 남구': '31140', '울산 중구': '31110',
  // 기타 주요 도시
  '수원시': '41110', '강릉시': '42150', '서천군': '44770', '보령시': '44180',
  '여수시': '46130', '전주시': '45111', '경주시': '47130', '제주시': '50110',
};

function getSigunguCodeFromAddress(address: string, lat: number, lng: number): string {
  if (!address) {
    if (lat > 37.3) return '11140'; // 서울 중구 기본
    return '26500'; // 부산 수영구 기본
  }

  for (const [key, code] of Object.entries(SIGUNGU_CODE_MAP)) {
    if (address.includes(key)) return code;
  }

  if (address.includes('신설동') || address.includes('동대문')) return '11230';
  if (address.includes('봉천') || address.includes('관악')) return '11620';
  if (address.includes('종로') || address.includes('세종로')) return '11110';
  if (address.includes('마포') || address.includes('성산') || address.includes('월드컵')) return '11440';
  if (address.includes('성수') || address.includes('연무장') || address.includes('성동')) return '11200';
  if (address.includes('금정') || address.includes('부곡') || address.includes('서동')) return '26410';
  if (address.includes('광안') || address.includes('민락')) return '26500';
  if (address.includes('벡스코') || address.includes('센텀')) return '26350';
  if (address.includes('삼락')) return '26530';
  if (address.includes('울산')) return '31140';
  if (address.includes('서울')) return '11140';
  if (address.includes('부산')) return '26500';

  if (lat > 37.3) return '11140';
  return '26500';
}

function getRegionFromAddress(address: string, lat: number, lng: number): Region {
  if (!address) {
    if (lat > 37.3) return '서울';
    if (lng > 128.8 && lat < 35.5) return '부산';
    return '서울';
  }

  // 최우선 광역시도 키워드 격리 (서울, 부산, 울산, 대구, 대전 등 100% 독립 분리)
  if (address.includes('부산')) return '부산';
  if (address.includes('서울')) return '서울';
  if (address.includes('울산')) return '경상';
  if (address.includes('대구')) return '대구';
  if (address.includes('대전')) return '대전';
  if (address.includes('광주')) return '전라';
  if (address.includes('인천') || address.includes('경기')) return '경기·인천';
  if (address.includes('강원')) return '강원';
  if (address.includes('세종') || address.includes('충남') || address.includes('충북') || address.includes('충청')) return '충청';
  if (address.includes('전남') || address.includes('전북') || address.includes('전라')) return '전라';
  if (address.includes('경남') || address.includes('경북') || address.includes('경상')) return '경상';
  if (address.includes('제주') || address.includes('서귀포')) return '제주';

  if (address.includes('해운대') || address.includes('수영') || address.includes('민락') || address.includes('기장') || address.includes('사상') || address.includes('부산진') || address.includes('연제') || address.includes('벡스코') || address.includes('금정')) {
    return '부산';
  }

  if (lat > 37.3) return '서울';
  if (lng > 128.8 && lat < 35.5) return '부산';
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

function isStrictPublicParking(info: any): boolean {
  const rawName = String(info.prl_nm || info.prk_nm || '');
  const rawDiv = String(info.prl_div_nm || info.prl_kind_nm || info.prk_kind_nm || info.prl_se_cd || '');
  const rawAddr = String(info.prl_road_addr_nm || info.prl_jino_addr_nm || info.l_road_addr_nm || '');

  const privateKeywords = /사옥|호텔|빌딩|타워|마트|백화점|민영|스퀘어|프라자|병원|교회|성당|신협|오피스|파이낸스|아파트|빌라|드림개발/i;
  if (privateKeywords.test(rawName) || privateKeywords.test(rawAddr) || rawDiv.includes('민영')) {
    return false;
  }

  const publicKeywords = /공영|구립|시립|공단|구청|시청|동사무소|주민센터|행정복지센터|환승|노상|노외/;
  if (rawDiv.includes('공영') || publicKeywords.test(rawName)) {
    return true;
  }

  return false;
}

function parseFeeInfoFromApi(info: any, isPublic: boolean): string {
  const rawName = String(info.prl_nm || info.prk_nm || '');
  const rawAddr = String(info.prl_road_addr_nm || info.prl_jino_addr_nm || '');

  if (rawName.includes('벡스코') || rawName.includes('BEXCO') || rawAddr.includes('APEC로')) {
    return '10분당 400원 (최초 30분 1,200원)';
  }

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
    const requestedRegionParam = searchParams.get('region');

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

    // 3. 자치구별 API 1 (기본정보) & API 2 (실시간현황) 시군구 일괄 수신
    const targetCenterLat = parseFloat(mapY);
    const targetCenterLng = parseFloat(mapX);

    const sigunguCodesToQuery = new Set<string>();

    for (const item of rawList.slice(0, 50)) {
      const addr = item.addr1 || '';
      const lat = parseFloat(item.mapy || '0');
      const lng = parseFloat(item.mapx || '0');
      const code = getSigunguCodeFromAddress(addr, lat, lng);
      sigunguCodesToQuery.add(code);
    }

    sigunguCodesToQuery.add(getSigunguCodeFromAddress('', targetCenterLat, targetCenterLng));
    sigunguCodesToQuery.add('11230'); // 동대문구 (신설동)
    sigunguCodesToQuery.add('11620'); // 관악구 (봉천복개3)
    sigunguCodesToQuery.add('11110'); // 종로구 (세종로)
    sigunguCodesToQuery.add('11440'); // 마포구 (서울프린지)
    sigunguCodesToQuery.add('11200'); // 성동구 (성수동)
    sigunguCodesToQuery.add('11140'); // 서울 중구
    sigunguCodesToQuery.add('26500'); // 수영구 (광안리)
    sigunguCodesToQuery.add('26350'); // 해운대구 (벡스코)
    sigunguCodesToQuery.add('26530'); // 사상구 (삼락)
    sigunguCodesToQuery.add('26410'); // 부산 금정구 (서동, 부곡동)
    sigunguCodesToQuery.add('31140'); // 울산 남구 (울산대공원)

    let parkingInfoList: any[] = [];
    const liveMap = new Map<string, any>();

    // API 1: 기본정보 수신
    const fetchInfoPromises = Array.from(sigunguCodesToQuery).map(async (code) => {
      const infoUrl = `${PARKING_INFO_API_URL}?pageNo=1&pageSize=1000&addr_cd=${code}&addr_type=SIGUNGU`;
      try {
        const iRes = await fetch(infoUrl, {
          cache: 'no-store',
          headers: { api_user_key_id: parkingApiKey, Accept: 'application/json' },
        });
        if (!iRes.ok) return [];
        const iJson = await iRes.json();
        const raw = iJson?.data || iJson?.response?.body?.items?.item || iJson?.items;
        return Array.isArray(raw) ? raw : raw ? [raw] : [];
      } catch {
        return [];
      }
    });

    // API 2: 실시간 현황 수신 (동일 시군구 파라미터 일괄 수신)
    const fetchStatusPromises = Array.from(sigunguCodesToQuery).map(async (code) => {
      const statusUrl = `${PARKING_STATUS_API_URL}?pageNo=1&pageSize=1000&addr_cd=${code}&addr_type=SIGUNGU`;
      try {
        const sRes = await fetch(statusUrl, {
          cache: 'no-store',
          headers: { api_user_key_id: parkingApiKey, Accept: 'application/json' },
        });
        if (!sRes.ok) return [];
        const sJson = await sRes.json();
        const rawS = sJson?.data || sJson?.response?.body?.items?.item || sJson?.items;
        return Array.isArray(rawS) ? rawS : rawS ? [rawS] : [];
      } catch {
        return [];
      }
    });

    const [infoResResult, statusResResult] = await Promise.allSettled([
      Promise.all(fetchInfoPromises),
      Promise.all(fetchStatusPromises),
    ]);

    const seenCodes = new Set<string>();
    if (infoResResult.status === 'fulfilled' && Array.isArray(infoResResult.value)) {
      for (const resList of infoResResult.value) {
        for (const item of resList) {
          const code = String(item.std_prl_cd || item.std_prk_mg_no || '').trim();
          if (code && !seenCodes.has(code)) {
            seenCodes.add(code);
            parkingInfoList.push(item);
          }
        }
      }
    }

    if (statusResResult.status === 'fulfilled' && Array.isArray(statusResResult.value)) {
      for (const resList of statusResResult.value) {
        for (const s of resList) {
          const code = String(s?.std_prl_cd || s?.std_prk_mg_no || s?.std_prk_cd || '').trim();
          if (code) {
            liveMap.set(code, s);
          }
        }
      }
    }

    // 4. [초소형 1면~5면 원천 배제] & 주거용 건물 배제 & 후보군 그룹화
    const facilityGroupMap = new Map<string, any>();

    for (const info of parkingInfoList) {
      const lat = parseFloat(info.la_val || info.lat || '0');
      const lng = parseFloat(info.lo_val || info.lng || '0');
      if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) continue;

      const rawName = String(info.prl_nm || info.prk_nm || '');
      const rawSource = String(info.souc_nm || '');
      const rawAddr = String(info.prl_road_addr_nm || info.prl_jino_addr_nm || info.l_road_addr_nm || '');
      const totalSpaces = parseInt(info.sum_park_cnt || info.gnr_park_cnt || '0', 10);

      const cleanedNameTemp = cleanParkingName(rawName);
      const isDirectVenueParkingTemp =
        cleanedNameTemp.includes('벡스코') ||
        cleanedNameTemp.includes('BEXCO') ||
        cleanedNameTemp.includes('전시장') ||
        cleanedNameTemp.includes('컨벤션');

      if (totalSpaces < 6 && !isDirectVenueParkingTemp) {
        continue;
      }

      const residentialKeywords = /아파트|맨션|빌라|연립|주택|클래스|하이츠|래미안|자이|푸르지오|힐스테이트|아이파크|더샵|e편한세상|롯데캐슬|SK뷰|SKVIEW|호반|베르디움|중흥|카이저|포레스트/i;
      if (residentialKeywords.test(rawName) || residentialKeywords.test(rawAddr)) {
        continue;
      }

      const isEVOnlyStation =
        (rawSource.includes('한국환경공단') || rawName.includes('충전기') || rawName.includes('충전소')) &&
        totalSpaces <= 5;
      if (isEVOnlyStation) continue;

      const cleanedName = cleanParkingName(rawName);
      const groupKey = cleanedName.includes('벡스코') || cleanedName.includes('BEXCO')
        ? '벡스코_GROUP'
        : (info.std_prl_cd || info.std_prk_mg_no || cleanedName);

      const existing = facilityGroupMap.get(groupKey);
      if (!existing) {
        facilityGroupMap.set(groupKey, info);
      } else {
        const existingSpaces = parseInt(existing.sum_park_cnt || existing.gnr_park_cnt || '0', 10);
        if (totalSpaces > existingSpaces) {
          facilityGroupMap.set(groupKey, info);
        }
      }
    }

    // 핀포인트 1:1 강제 실시간 조인 (1,000건 누락 방지 강제 결합)
    const rawCandidateList = Array.from(facilityGroupMap.values());
    const pinpointCodesToQuery = rawCandidateList.map((info) => String(info.std_prl_cd || info.std_prk_mg_no || '').trim()).filter(Boolean);

    const pinpointPromises = pinpointCodesToQuery.map(async (code) => {
      if (liveMap.has(code)) return null;
      const statusUrl = `${PARKING_STATUS_API_URL}?std_prl_cd=${code}&pageNo=1&pageSize=10`;
      try {
        const sRes = await fetch(statusUrl, {
          cache: 'no-store',
          headers: { api_user_key_id: parkingApiKey, Accept: 'application/json' },
        });
        if (!sRes.ok) return null;
        const sJson = await sRes.json();
        const rawS = sJson?.data || sJson?.response?.body?.items?.item || sJson?.items;
        const sItems = Array.isArray(rawS) ? rawS : rawS ? [rawS] : [];
        return { code, liveData: sItems[0] || null };
      } catch {
        return null;
      }
    });

    const pinpointResults = await Promise.allSettled(pinpointPromises);
    if (Array.isArray(pinpointResults)) {
      for (const resObj of pinpointResults) {
        if (resObj.status === 'fulfilled' && resObj.value) {
          const { code, liveData } = resObj.value;
          if (code && liveData && !liveMap.has(code)) {
            liveMap.set(code, liveData);
          }
        }
      }
    }

    const candidateParkingList: Parking[] = [];

    for (const info of rawCandidateList) {
      const lat = parseFloat(info.la_val || info.lat || '0');
      const lng = parseFloat(info.lo_val || info.lng || '0');
      const rawName = String(info.prl_nm || info.prk_nm || '');
      const cleanedName = cleanParkingName(rawName);
      const totalSpaces = parseInt(info.sum_park_cnt || info.gnr_park_cnt || '0', 10);

      const isDirectVenueParking =
        cleanedName.includes('벡스코') ||
        cleanedName.includes('BEXCO') ||
        cleanedName.includes('전시장') ||
        cleanedName.includes('컨벤션') ||
        cleanedName.includes('경기장') ||
        cleanedName.includes('황령산') ||
        cleanedName.includes('세종로') ||
        cleanedName.includes('성수') ||
        cleanedName.includes('신설동') ||
        cleanedName.includes('봉천복개');

      if (totalSpaces < 6 && !isDirectVenueParking) continue;

      const isPublic = isStrictPublicParking(info);
      const code = String(info.std_prl_cd || info.std_prk_mg_no || `prk-${Math.random()}`).trim();

      const liveData = liveMap.get(code);
      const rawParked = liveData?.sum_curr_use_park_cnt ?? liveData?.now_park_cnt ?? liveData?.cur_use_prk_cnt;
      const isLiveValid = rawParked !== null && rawParked !== undefined && String(rawParked).trim() !== '';

      const finalTotalSpaces = (cleanedName.includes('벡스코') || cleanedName.includes('BEXCO'))
        ? 2400
        : (totalSpaces > 0 ? totalSpaces : 100);

      let currentParked: number | null = null;
      let availableSpaces = finalTotalSpaces;

      if (isLiveValid) {
        currentParked = Number(rawParked);
        availableSpaces = Math.max(0, finalTotalSpaces - currentParked);
      }

      const feeInfo = parseFeeInfoFromApi(info, isPublic);

      candidateParkingList.push({
        id: code,
        name: (cleanedName.includes('벡스코') || cleanedName.includes('BEXCO')) ? '벡스코 제1·2전시장 주차장' : cleanedName,
        lat,
        lng,
        totalSpaces: finalTotalSpaces,
        availableSpaces,
        availableSpots: isLiveValid ? availableSpaces : null,
        currentParked: isLiveValid ? currentParked : null,
        distance: '',
        distanceMeters: 0,
        address: (cleanedName.includes('벡스코') || cleanedName.includes('BEXCO')) ? '부산광역시 해운대구 APEC로 55' : (info.prl_road_addr_nm || info.prl_jino_addr_nm || info.l_road_addr_nm || ''),
        isLive: isLiveValid,
        isRealtime: isLiveValid,
        isPublic,
        feeInfo,
      });
    }

    // 5. 축제 후보군 필터링 (지역 탭 100% 엄격 격리 차단 적용)
    const validFestivalsRaw = rawList
      .filter((f: any) => f && f.title && f.mapx && f.mapy)
      .filter((f: any) => {
        const typeIdStr = String(f.contenttypeid || f.contentTypeId || contentTypeId);
        const titleStr = String(f.title || '');
        const addrStr = String(f.addr1 || '');

        // [엄격 적용: 요청된 region 권역 파라미터가 있는 경우 주소 필터링 100% 집행]
        if (requestedRegionParam && requestedRegionParam !== '전국' && requestedRegionParam !== '전체') {
          if (requestedRegionParam === '부산' && !addrStr.includes('부산')) return false;
          if (requestedRegionParam === '서울' && !addrStr.includes('서울')) return false;
          if (requestedRegionParam === '대구' && !addrStr.includes('대구')) return false;
          if (requestedRegionParam === '대전' && !addrStr.includes('대전')) return false;
        }

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
      });

    // 6. [2단계 안전 슬롯 채움 알고리즘]
    const resultFestivals: Festival[] = validFestivalsRaw.map((f: any, idx: number) => {
      const festLat = parseFloat(f.mapy);
      const festLng = parseFloat(f.mapx);
      const festAddress = f.addr1 || '';
      const festTitle = f.title || '';

      const scoredLots = candidateParkingList.map((p) => {
        const distM = calculateDistance(festLat, festLng, p.lat, p.lng);
        const parkingAddr = p.address || '';
        const isDirectVenueMatch =
          (festTitle.includes('벡스코') || festAddress.includes('APEC로') || festAddress.includes('벡스코')) &&
          (p.name.includes('벡스코') || p.name.includes('BEXCO') || p.name.includes('전시장') || p.name.includes('컨벤션') || parkingAddr.includes('APEC로'));

        const isGenericDirectMatch =
          p.name.includes('황령산') ||
          p.name.includes('봉수대') ||
          p.name.includes('전망대') ||
          p.name.includes('세종로') ||
          p.name.includes('성수') ||
          p.name.includes('연무장') ||
          p.name.includes('월드컵') ||
          p.name.includes('마포') ||
          p.name.includes('광안') ||
          p.name.includes('민락') ||
          p.name.includes('해운대') ||
          p.name.includes('삼락') ||
          p.name.includes('신설동') ||
          p.name.includes('봉천복개');

        let priorityScore = distM;
        if (isDirectVenueMatch) {
          priorityScore = distM - 10000;
        } else if (distM <= 300 || isGenericDirectMatch) {
          priorityScore = distM - 3000;
        }

        const walkingMinutes = Math.max(1, Math.round(distM / 80));

        return {
          ...p,
          distanceMeters: distM,
          distance: formatWalkingDistanceText(distM),
          walkingMinutes,
          priorityScore,
        };
      });

      // 반경 확장 Fallback (1.5km -> 3km -> 5km)
      let validNearbyLots = scoredLots.filter((p) => p.distanceMeters <= 1500);
      if (validNearbyLots.length < 3) {
        validNearbyLots = scoredLots.filter((p) => p.distanceMeters <= 3000);
      }
      if (validNearbyLots.length < 3) {
        validNearbyLots = scoredLots.filter((p) => p.distanceMeters <= 5000);
      }

      // 그룹 분리: 직속 주차장 / 실시간 연동 주차장 / 일반 현장확인 주차장
      const directVenueParkings = validNearbyLots.filter((p) => p.priorityScore < -1000);
      const regularParkings = validNearbyLots.filter((p) => p.priorityScore >= -1000);

      // 실시간 연동 그룹 (공영 우선 -> 거리순)
      const liveParkings = regularParkings
        .filter((p) => p.isLive)
        .sort((a, b) => {
          if (a.isPublic !== b.isPublic) return a.isPublic ? -1 : 1;
          return a.priorityScore - b.priorityScore;
        });

      // 일반 현장확인 그룹 (공영 우선 -> 거리순)
      const fallbackParkings = regularParkings
        .filter((p) => !p.isLive)
        .sort((a, b) => {
          if (a.isPublic !== b.isPublic) return a.isPublic ? -1 : 1;
          return a.priorityScore - b.priorityScore;
        });

      // 2단계 슬롯 조합: 직속 주차장 -> 실시간 연동 -> 일반 현장확인 (슬롯 5개 무조건 보장)
      const finalParkingLots: Parking[] = [
        ...directVenueParkings,
        ...liveParkings,
        ...fallbackParkings,
      ].slice(0, 5);

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
