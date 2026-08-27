/**
 * Client-side Tour API — 사용자 브라우저에서 한국 공공데이터 API를 직접 호출
 *
 * Vercel 무료 플랜은 해외 서버에서 실행되므로 한국 공공 API가 차단됩니다.
 * 사용자의 브라우저는 한국에 있으므로 직접 호출하면 100% 정상 통신됩니다.
 */
import { Festival, Parking, Region, CategoryType } from '@/types';
import { calculateDistance, calculateRealCrowdStatus, formatWalkingDistanceText } from '@/lib/geoUtils';

// Koreaconnect DPG 게이트웨이 — 브라우저에서 직접 호출 (헤더 인증)
const TOUR_FESTIVAL_URL = 'https://api.koreaconnect.kr/01/1/2603101713597416530PDP/CULTR/B551011/KorService2/searchFestival2';
const TOUR_AREA_URL = 'https://api.koreaconnect.kr/01/1/2603101713597416530PDP/CULTR/B551011/KorService2/areaBasedList2';
const API_KEY = '6015a42e4d4c4696a6d14f9cd9bdd663';

// Koreaconnect 주차장 API (헤더 인증)
const PARKING_INFO_API = 'https://api.koreaconnect.kr/01/5/2606081732514722903DCP/LOGIS/api/v1/parking/info';
const PARKING_STATUS_API = 'https://api.koreaconnect.kr/01/7/2606081732514722903DCP/LOGIS/api/v1/parking/status';

// 지역 코드 매핑 (TourAPI areaCode)
const AREA_CODE_MAP: Record<Region, string> = {
  '서울': '1',
  '경기·인천': '31',
  '부산': '6',
  '대구': '4',
  '대전': '3',
  '강원': '32',
  '충청': '34',
  '전라': '37',
  '경상': '35',
  '제주': '39',
};

// 시군구 코드 매핑 (주차장 API용)
const SIGUNGU_CODE_MAP: Record<string, string> = {
  '성동구': '11200', '마포구': '11440', '중구': '11140', '종로구': '11110',
  '강남구': '11680', '영등포구': '11560', '용산구': '11170', '성북구': '11290',
  '강서구': '11500', '송파구': '11710', '서초구': '11650', '관악구': '11620',
  '동대문구': '11230', '광진구': '11215', '노원구': '11350', '도봉구': '11320',
  '은평구': '11380', '서대문구': '11410', '동작구': '11590', '양천구': '11470',
  '구로구': '11530', '금천구': '11545', '강동구': '11740', '중랑구': '11260', '강북구': '11305',
  '수영구': '26500', '해운대구': '26350', '사상구': '26530', '부산진구': '26230',
  '연제구': '26470', '동래구': '26260', '금정구': '26410',
  '수성구': '27260', '달서구': '27290',
  '유성구': '30200',
};

function getSigunguCodeFromAddress(address: string, lat: number, lng: number): string {
  if (!address) return getSigunguCodeFromCoords(lat, lng);
  for (const [key, code] of Object.entries(SIGUNGU_CODE_MAP)) {
    if (address.includes(key)) return code;
  }
  return getSigunguCodeFromCoords(lat, lng);
}

function getSigunguCodeFromCoords(lat: number, lng: number): string {
  if (lat > 37.4 && lng > 126.8 && lng < 127.2) return '11140';
  if (lat > 37.2 && lat <= 37.4 && lng > 126.8 && lng < 127.2) return '41115';
  if (lat > 37.5 && lng > 126.5 && lng <= 126.8) return '28237';
  if (lat <= 35.3 && lng >= 128.8) return '26230';
  if (lat > 35.5 && lat <= 36.5 && lng >= 128.0) return '27260';
  if (lat > 36.0 && lat <= 37.0 && lng < 127.5) return '44131';
  if (lat < 33.6) return '50110';
  return '11140';
}

function getRegionFromAddress(address: string, lat: number, lng: number): Region {
  if (!address) {
    if (lat > 37.3) return '서울';
    if (lng > 128.8 && lat < 35.5) return '부산';
    return '서울';
  }
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
  if (lat > 37.3) return '서울';
  if (lng > 128.8 && lat < 35.5) return '부산';
  return '서울';
}

function getCategoryTypeFromContentTypeId(id?: string): CategoryType {
  if (id === '15') return '축제';
  if (id === '14') return '문화시설';
  return '공원·나들이';
}

function isReligiousFacility(title: string, address: string): boolean {
  return /교회|성당|기도원|교구|순례지|선원|사찰|성지|천주교|대성당/i.test(title) ||
         /교회|성당|기도원|교구|순례지|선원|사찰|성지|천주교|대성당/i.test(address);
}

// === 주차장 유틸 ===
function cleanParkingName(name: string): string {
  if (!name) return '주차장';
  return name
    .replace(/완속충전기|급속충전기|\[전기차충전소\]|\[공영\]|\[민영\]/gi, '')
    .replace(/[\d\-_]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isEVOnlyRecord(info: any): boolean {
  const rawName = String(info.prl_nm || info.prk_nm || '');
  const rawDiv = String(info.prl_div_nm || info.prl_kind_nm || info.prk_kind_nm || '');
  const total = Math.max(parseInt(info.sum_park_cnt || '0', 10) || 0, parseInt(info.gnr_park_cnt || '0', 10) || 0);
  const evKeywords = /완속충전기|급속충전기|전기차충전소|전기자동차충전소|EV충전소|EV충전기|\[전기차\]|차지비|에스트래픽|대영채비|파워큐브|플러그링크|차징스테이션|charging/i;
  if (evKeywords.test(rawName) || evKeywords.test(rawDiv)) return true;
  if (/기둥|B\d층|지하\d층|\d+동\s*B\d/i.test(rawName)) return true;
  if (/전기차|EV|충전/i.test(rawName) && total <= 5) return true;
  return false;
}

function isResidentialRecord(info: any): boolean {
  const rawName = String(info.prl_nm || info.prk_nm || '');
  const rawAddr = String(info.prl_road_addr_nm || info.prl_jino_addr_nm || info.l_road_addr_nm || '');
  const residentialKeywords = /아파트|맨션|빌라|연립|주택|래미안|자이|푸르지오|힐스테이트|아이파크|더샵|롯데캐슬|거주자우선|거주자전용/i;
  return residentialKeywords.test(rawName) || residentialKeywords.test(rawAddr);
}

function isStrictPublicParking(info: any): boolean {
  const rawName = String(info.prl_nm || info.prk_nm || '');
  const rawDiv = String(info.prl_div_nm || info.prl_kind_nm || info.prk_kind_nm || info.prl_se_cd || '');
  const privateKeywords = /사옥|호텔|빌딩|타워|마트|백화점|민영|병원|교회|성당|아파트|빌라/i;
  if (privateKeywords.test(rawName) || rawDiv.includes('민영')) return false;
  const publicKeywords = /공영|구립|시립|공단|구청|시청|환승|노상|노외/;
  if (rawDiv.includes('공영') || publicKeywords.test(rawName)) return true;
  return false;
}

function parseFeeInfo(info: any, isPublic: boolean): string {
  const bscTime = info.bsc_park_tme || info.basic_time || info.gnr_basic_prk_time;
  const bscAmt = info.bsc_park_amt || info.basic_charge || info.gnr_basic_prk_chr;
  const numBscAmt = Number(bscAmt);
  if (!isPublic) {
    if (bscTime && bscAmt && !isNaN(numBscAmt) && numBscAmt > 0) {
      return `${bscTime}분당 ${numBscAmt.toLocaleString()}원`;
    }
    return '민영 현장 요금제';
  }
  const isFree = info.pchrg_free_nm === '무료' || (bscAmt !== undefined && numBscAmt === 0) || info.pay_type_nm === '무료';
  if (isFree) return '무료';
  if (bscTime && bscAmt && !isNaN(numBscAmt) && numBscAmt > 0) {
    return `${bscTime}분당 ${numBscAmt.toLocaleString()}원`;
  }
  return '현장 요금제';
}

// === API 호출 함수 ===

/**
 * TourAPI에서 축제/명소 데이터 직접 조회 (브라우저 → api.koreaconnect.kr DPG 게이트웨이)
 */
async function fetchTourData(params: {
  category: CategoryType;
  region: Region;
  areaCode: string;
}): Promise<any[]> {
  const { category, areaCode } = params;
  const now = new Date();
  const todayStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

  let url: string;

  if (category === '축제') {
    url = `${TOUR_FESTIVAL_URL}?MobileOS=ETC&MobileApp=anbumbyeo&_type=json&eventStartDate=${todayStr}&numOfRows=100&arrange=A&areaCode=${areaCode}`;
  } else {
    const contentTypeId = category === '문화시설' ? '14' : '12';
    url = `${TOUR_AREA_URL}?MobileOS=ETC&MobileApp=anbumbyeo&_type=json&numOfRows=50&arrange=E&contentTypeId=${contentTypeId}&areaCode=${areaCode}`;
  }

  try {
    const res = await fetch(url, {
      headers: { api_user_key_id: API_KEY, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn(`[TourAPI] HTTP ${res.status} for ${category}`);
      return [];
    }
    const rawText = await res.text();
    try {
      const json = JSON.parse(rawText);
      const items =
        json?.response?.body?.items?.item ||
        json?.items?.item ||
        json?.body?.items?.item ||
        json?.data;
      if (Array.isArray(items)) return items;
      if (items) return [items];
    } catch {
      console.warn('[TourAPI] JSON 파싱 실패');
    }
    return [];
  } catch (err) {
    console.error('[TourAPI] Fetch error:', err);
    return [];
  }
}

/**
 * 주차장 기본정보 조회 (브라우저 → api.koreaconnect.kr)
 */
async function fetchParkingInfo(sigunguCodes: string[]): Promise<any[]> {
  const allItems: any[] = [];
  const seenCodes = new Set<string>();

  const results = await Promise.allSettled(
    sigunguCodes.map(async (code) => {
      try {
        const res = await fetch(`${PARKING_INFO_API}?pageNo=1&pageSize=1000&addr_cd=${code}&addr_type=SIGUNGU`, {
          headers: { api_user_key_id: API_KEY, Accept: 'application/json' },
          signal: AbortSignal.timeout(4000),
        });
        if (!res.ok) return [];
        const json = await res.json();
        const data = json?.data || json?.response?.body?.items?.item || json?.items;
        return Array.isArray(data) ? data : data ? [data] : [];
      } catch {
        return [];
      }
    })
  );

  for (const r of results) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      for (const item of r.value) {
        const code = String(item.std_prl_cd || item.std_prk_mg_no || '').trim();
        if (code && !seenCodes.has(code)) {
          seenCodes.add(code);
          allItems.push(item);
        }
      }
    }
  }
  return allItems;
}

/**
 * 주차장 실시간 잔여석 조회 (브라우저 → api.koreaconnect.kr)
 */
async function fetchParkingStatus(stdCodes: string[]): Promise<Map<string, any>> {
  const liveMap = new Map<string, any>();
  await Promise.allSettled(
    stdCodes.slice(0, 80).map(async (code) => {
      try {
        const res = await fetch(`${PARKING_STATUS_API}?std_prl_cd=${code}`, {
          headers: { api_user_key_id: API_KEY, Accept: 'application/json' },
          signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) return;
        const json = await res.json();
        const sData = json?.data?.[0];
        if (sData) {
          liveMap.set(code, sData);
          if (sData.std_prl_cd) liveMap.set(String(sData.std_prl_cd).trim(), sData);
          if (sData.std_prk_mg_no) liveMap.set(String(sData.std_prk_mg_no).trim(), sData);
        }
      } catch { /* 실시간 조회 실패 시 기본정보로 Fallback */ }
    })
  );
  return liveMap;
}

/**
 * 주차장 원본 데이터를 Parking 배열로 변환
 */
function processParkingData(parkingInfoList: any[], liveMap: Map<string, any>): Parking[] {
  const result: Parking[] = [];
  const facilityMap = new Map<string, any>();

  for (const info of parkingInfoList) {
    const lat = parseFloat(info.la_val || info.lat || '0');
    const lng = parseFloat(info.lo_val || info.lng || '0');
    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) continue;
    if (isEVOnlyRecord(info)) continue;
    if (isResidentialRecord(info)) continue;

    const rawName = String(info.prl_nm || info.prk_nm || '');
    const totalSpaces = Math.max(parseInt(info.sum_park_cnt || '0', 10) || 0, parseInt(info.gnr_park_cnt || '0', 10) || 0);
    if (totalSpaces < 10) continue;

    const cleanedName = cleanParkingName(rawName);
    const groupKey = `${cleanedName}_${lat.toFixed(3)}_${lng.toFixed(3)}`;

    const existing = facilityMap.get(groupKey);
    if (!existing || totalSpaces > (existing.parsedTotal || 0)) {
      facilityMap.set(groupKey, { ...info, parsedTotal: totalSpaces, primaryName: cleanedName });
    }
  }

  for (const info of facilityMap.values()) {
    const lat = parseFloat(info.la_val || info.lat || '0');
    const lng = parseFloat(info.lo_val || info.lng || '0');
    const cleanedName = info.primaryName || '주차장';
    const totalSpaces = info.parsedTotal || 50;
    const isPublic = isStrictPublicParking(info);
    const code = String(info.std_prl_cd || info.std_prk_mg_no || `prk-${Math.random()}`).trim();

    const liveData = liveMap.get(code) ||
      (info.std_prl_cd ? liveMap.get(String(info.std_prl_cd).trim()) : null) ||
      (info.std_prk_mg_no ? liveMap.get(String(info.std_prk_mg_no).trim()) : null);

    const rawParked = liveData?.sum_curr_use_park_cnt ?? liveData?.now_park_cnt ?? liveData?.cur_use_prk_cnt;
    const isLiveValid = rawParked !== null && rawParked !== undefined && String(rawParked).trim() !== '' && !isNaN(Number(rawParked));

    let currentParked: number | null = null;
    let availableSpaces = totalSpaces;
    if (isLiveValid) {
      currentParked = Number(rawParked);
      availableSpaces = Math.max(0, totalSpaces - currentParked);
    }

    result.push({
      id: code,
      name: cleanedName,
      lat, lng,
      totalSpaces,
      availableSpaces,
      availableSpots: isLiveValid ? availableSpaces : null,
      currentParked: isLiveValid ? currentParked : null,
      distance: '',
      distanceMeters: 0,
      address: info.prl_road_addr_nm || info.prl_jino_addr_nm || info.l_road_addr_nm || '',
      isLive: isLiveValid,
      isRealtime: isLiveValid,
      isPublic,
      feeInfo: parseFeeInfo(info, isPublic),
    });
  }

  return result;
}

/**
 * 축제/명소별 최단거리 주차장 매핑
 */
function matchParkingsToFestival(
  festLat: number, festLng: number,
  candidateParkingList: Parking[]
): Parking[] {
  const scoredLots = candidateParkingList.map((p) => {
    const distM = calculateDistance(festLat, festLng, p.lat, p.lng);
    return { ...p, distanceMeters: distM, distance: formatWalkingDistanceText(distM) };
  });

  let validNearbyLots = scoredLots.filter((p) => p.distanceMeters <= 5000);
  if (validNearbyLots.length === 0 && scoredLots.length > 0) {
    validNearbyLots = scoredLots.sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 5);
  }

  const liveParkings = validNearbyLots.filter((p) => p.isLive).sort((a, b) => {
    const distDiff = a.distanceMeters - b.distanceMeters;
    if (Math.abs(distDiff) > 200) return distDiff;
    if (a.isPublic !== b.isPublic) return a.isPublic ? -1 : 1;
    return distDiff;
  });

  const fallbackParkings = validNearbyLots.filter((p) => !p.isLive).sort((a, b) => {
    const distDiff = a.distanceMeters - b.distanceMeters;
    if (Math.abs(distDiff) > 200) return distDiff;
    if (a.isPublic !== b.isPublic) return a.isPublic ? -1 : 1;
    return distDiff;
  });

  const merged = [...liveParkings, ...fallbackParkings];
  const finalLots: Parking[] = [];
  const seenNames = new Set<string>();

  for (const p of merged) {
    const norm = p.name.replace(/[\s\(\)\[\]\-_]/g, '').toLowerCase();
    if (seenNames.has(norm)) continue;
    seenNames.add(norm);
    finalLots.push(p);
    if (finalLots.length >= 5) break;
  }

  return finalLots;
}

// === 메인 공개 함수 ===

export interface ClientFetchParams {
  category?: CategoryType;
  region?: Region;
  mapX?: number;
  mapY?: number;
  radius?: number;
}

/**
 * 클라이언트 브라우저에서 직접 공공 API를 호출하여 축제/명소 + 주차장 데이터를 조합하여 반환합니다.
 * Vercel 해외 서버를 경유하지 않으므로 한국 공공 API 차단 문제가 완전히 해결됩니다.
 */
export async function fetchFestivalsClient(params: ClientFetchParams = {}): Promise<Festival[]> {
  const category = params.category || '축제';
  const region = params.region || '서울';
  const areaCode = AREA_CODE_MAP[region] || '1';

  const now = new Date();
  const todayStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const todayNum = parseInt(todayStr, 10);

  console.log(`[Client TourAPI] ${category} / ${region} (areaCode=${areaCode}) 직접 호출 시작`);

  // 1단계: 한국관광공사 TourAPI에서 축제/명소 데이터 직접 수신
  const rawList = await fetchTourData({ category, region, areaCode });
  console.log(`[Client TourAPI] 원본 수신: ${rawList.length}건`);

  // 2단계: 유효 데이터 필터링
  const contentTypeId = category === '축제' ? '15' : category === '문화시설' ? '14' : '12';
  const isFestival = contentTypeId === '15';

  const validItems = rawList.filter((f: any) => {
    if (!f || !f.title || !f.mapx || !f.mapy) return false;

    const titleStr = String(f.title || '');
    const addrStr = String(f.addr1 || '');

    // 종교시설 제외 (공원·나들이)
    if (contentTypeId === '12' && isReligiousFacility(titleStr, addrStr)) return false;

    // 축제: 종료일 체크
    if (isFestival) {
      const rawEnd = String(f.eventenddate || f.event_end_date || '');
      if (!rawEnd || rawEnd.length < 8) return false;
      const endNum = Number(rawEnd);
      if (isNaN(endNum) || endNum < todayNum) return false;
    }

    return true;
  });

  console.log(`[Client TourAPI] 유효 필터링 후: ${validItems.length}건`);

  // 3단계: 주차장 데이터 수집 (시군구 코드 기반)
  const sigunguCodes = new Set<string>();
  for (const item of validItems.slice(0, 20)) {
    const addr = item.addr1 || '';
    const lat = parseFloat(item.mapy || '0');
    const lng = parseFloat(item.mapx || '0');
    const code = getSigunguCodeFromAddress(addr, lat, lng);
    if (code) sigunguCodes.add(code);
  }

  let candidateParkingList: Parking[] = [];

  if (sigunguCodes.size > 0) {
    try {
      const parkingInfoList = await fetchParkingInfo(Array.from(sigunguCodes));
      console.log(`[Client 주차장] 기본정보 수신: ${parkingInfoList.length}건`);

      // 실시간 잔여석 조회
      const stdCodes = parkingInfoList
        .filter((info) => {
          const total = Math.max(parseInt(info.sum_park_cnt || '0', 10) || 0, parseInt(info.gnr_park_cnt || '0', 10) || 0);
          return total >= 10 || isStrictPublicParking(info);
        })
        .map((info) => String(info.std_prl_cd || info.std_prk_mg_no || '').trim())
        .filter(Boolean)
        .slice(0, 80);

      const liveMap = await fetchParkingStatus(stdCodes);
      console.log(`[Client 주차장] 실시간 연동: ${liveMap.size}건`);

      candidateParkingList = processParkingData(parkingInfoList, liveMap);
      console.log(`[Client 주차장] 최종 후보: ${candidateParkingList.length}곳`);
    } catch (err) {
      console.warn('[Client 주차장] 주차장 조회 실패, 주차장 없이 축제만 반환:', err);
    }
  }

  // 4단계: Festival 객체 조합
  const resultFestivals: Festival[] = validItems.map((f: any, idx: number) => {
    const festLat = parseFloat(f.mapy);
    const festLng = parseFloat(f.mapx);
    const festAddress = f.addr1 || '';

    const finalParkingLots = matchParkingsToFestival(festLat, festLng, candidateParkingList);
    const { crowdLevel, crowdMessage } = calculateRealCrowdStatus(finalParkingLots);
    const festRegion = getRegionFromAddress(festAddress, festLat, festLng);

    const typeIdStr = String(f.contenttypeid || f.contentTypeId || contentTypeId);
    const categoryType = getCategoryTypeFromContentTypeId(typeIdStr);

    const rawStart = String(f.eventstartdate || f.event_start_date || '');
    const rawEnd = String(f.eventenddate || f.event_end_date || '');

    const startDate = rawStart.length >= 8
      ? `${rawStart.slice(0, 4)}-${rawStart.slice(4, 6)}-${rawStart.slice(6, 8)}`
      : '';
    const endDate = rawEnd.length >= 8
      ? `${rawEnd.slice(0, 4)}-${rawEnd.slice(4, 6)}-${rawEnd.slice(6, 8)}`
      : '';

    const period = categoryType === '축제' && rawStart.length >= 8 && rawEnd.length >= 8
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
      region: festRegion,
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
      startNum: Number(rawStart) || 0,
      endNum: Number(rawEnd) || 0,
      weather: null,
    };
  });

  // 5단계: 정렬 (진행 중 우선, 이후 시작일 가까운 순)
  const sortedFestivals = resultFestivals.sort((a, b) => {
    const aStart = a.startNum || 0;
    const bStart = b.startNum || 0;
    const aIsUpcoming = aStart > todayNum;
    const bIsUpcoming = bStart > todayNum;
    if (aIsUpcoming && bIsUpcoming) return aStart - bStart;
    return bStart - aStart;
  });

  console.log(`[Client TourAPI] 최종 반환: ${sortedFestivals.length}건`);
  return sortedFestivals;
}
