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

  if (address.includes('부산') || address.includes('해운대') || address.includes('수영') || address.includes('민락') || address.includes('기장') || address.includes('사상') || address.includes('황령산') || address.includes('부산진') || address.includes('연제') || address.includes('남구') || address.includes('센텀') || address.includes('벡스코')) {
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

  if (divName.includes('민영')) {
    return false;
  }
  if (divName.includes('공영') || divName.includes('부설') || divName.includes('노외') || rawName.includes('공영') || rawName.includes('벡스코') || rawName.includes('BEXCO') || rawName.includes('전시장') || rawName.includes('컨벤션') || rawName.includes('경기장') || rawName.includes('체육관') || rawName.includes('전망대') || rawName.includes('황령산') || rawName.includes('봉수대') || rawName.includes('쉼터')) {
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

    // 3. 통합 주차장 기본정보 수집
    const targetCodes = ['26350', '26500', '26530', '26230', '26290', '26470', '11110', '11140', '42150', '44770'];

    let parkingInfoList: any[] = [];
    const parkingStatusMap = new Map<string, any>();

    const fetchInfoPromises = targetCodes.map(async (code) => {
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

    const infoResults = await Promise.allSettled(fetchInfoPromises);

    const seenCodes = new Set<string>();
    for (const resObj of infoResults) {
      if (resObj.status === 'fulfilled' && Array.isArray(resObj.value)) {
        for (const item of resObj.value) {
          const code = item.std_prl_cd || item.std_prk_mg_no;
          if (code && !seenCodes.has(code)) {
            seenCodes.add(code);
            parkingInfoList.push(item);
          }
        }
      }
    }

    // 4. std_prl_cd 기반 실시간 현황 API 핀포인트 1:1 파이프라인
    const codesToFetchStatus = Array.from(seenCodes).slice(0, 100);

    const fetchStatusPromises = codesToFetchStatus.map(async (code) => {
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
        return sItems[0] || null;
      } catch {
        return null;
      }
    });

    const [pinpointResults, generalStatusRes] = await Promise.allSettled([
      Promise.all(fetchStatusPromises),
      fetch(`${PARKING_STATUS_API_URL}?pageNo=1&pageSize=1000`, {
        cache: 'no-store',
        headers: { api_user_key_id: parkingApiKey, Accept: 'application/json' },
      }),
    ]);

    if (pinpointResults.status === 'fulfilled' && Array.isArray(pinpointResults.value)) {
      for (const st of pinpointResults.value) {
        if (st) {
          const code = st.std_prl_cd || st.std_prk_mg_no || st.std_prk_cd;
          if (code) {
            parkingStatusMap.set(code, st);
          }
        }
      }
    }

    if (generalStatusRes.status === 'fulfilled' && generalStatusRes.value.ok) {
      try {
        const sJson = await generalStatusRes.value.json();
        const rawS = sJson?.data || sJson?.response?.body?.items?.item || sJson?.items;
        const sItems = Array.isArray(rawS) ? rawS : rawS ? [rawS] : [];
        for (const st of sItems) {
          const code = st.std_prl_cd || st.std_prk_mg_no || st.std_prk_cd;
          if (code && !parkingStatusMap.has(code)) {
            parkingStatusMap.set(code, st);
          }
        }
      } catch {}
    }

    // 5. [시설별 그룹화 & 일반 대형 면수 레코드 최우선 바인딩]
    const facilityGroupMap = new Map<string, any>();

    for (const info of parkingInfoList) {
      const lat = parseFloat(info.la_val || info.lat || '0');
      const lng = parseFloat(info.lo_val || info.lng || '0');
      if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) continue;

      const rawName = String(info.prl_nm || info.prk_nm || '');
      const rawSource = String(info.souc_nm || '');
      const totalSpaces = parseInt(info.sum_park_cnt || info.gnr_park_cnt || '0', 10);

      // 초소형 전기차 전용 충전 레코드(5면 이하, 한국환경공단)는 그룹 내에서 무시
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

    const combinedParkingLots: Parking[] = [];

    for (const info of Array.from(facilityGroupMap.values())) {
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
        cleanedName.includes('황령산');

      if (totalSpaces < 10 && !isDirectVenueParking) continue;

      const isPublic = isPublicParkingDiv(info);
      const code = info.std_prl_cd || info.std_prk_mg_no || `prk-${Math.random()}`;
      const status = parkingStatusMap.get(code);
      const isRealtime = Boolean(status);

      // 벡스코 본관/신관 대형 부설 주차장 (2,400면 규모)
      const finalTotalSpaces = (cleanedName.includes('벡스코') || cleanedName.includes('BEXCO'))
        ? 2400
        : (totalSpaces > 0 ? totalSpaces : (status?.sum_park_cnt ? parseInt(status.sum_park_cnt, 10) : 500));

      let availableSpaces = finalTotalSpaces;
      if (status) {
        const occupied = parseInt(
          status.now_park_cnt || status.sum_curr_use_park_cnt || status.cur_use_prk_cnt || '0',
          10
        );
        availableSpaces = Math.max(0, finalTotalSpaces - occupied);
      } else {
        availableSpaces = Math.floor(finalTotalSpaces * 0.65);
      }

      const feeInfo = parseFeeInfoFromApi(info, isPublic);

      combinedParkingLots.push({
        id: code,
        name: (cleanedName.includes('벡스코') || cleanedName.includes('BEXCO')) ? '벡스코 제1·2전시장 주차장' : cleanedName,
        lat,
        lng,
        totalSpaces: finalTotalSpaces,
        availableSpaces,
        distance: '',
        distanceMeters: 0,
        address: (cleanedName.includes('벡스코') || cleanedName.includes('BEXCO')) ? '부산광역시 해운대구 APEC로 55' : (info.prl_road_addr_nm || info.prl_jino_addr_nm || info.l_road_addr_nm || ''),
        isRealtime,
        isPublic,
        feeInfo,
      });
    }

    // 6. 벡스코 축제 및 대형 전시장 직속 주차장 1순위 최우선 고정 정렬
    const resultFestivals: Festival[] = rawList
      .filter((f: any) => f && f.title && f.mapx && f.mapy)
      .filter((f: any) => {
        const typeIdStr = String(f.contenttypeid || f.contentTypeId || contentTypeId);
        const titleStr = String(f.title || '');
        const addrStr = String(f.addr1 || '');

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

        const evaluatedLots = combinedParkingLots
          .map((p) => {
            const distM = calculateDistance(festLat, festLng, p.lat, p.lng);
            const parkingAddr = p.address || '';
            const isDirectVenueMatch =
              (festTitle.includes('벡스코') || festAddress.includes('APEC로') || festAddress.includes('벡스코')) &&
              (p.name.includes('벡스코') || p.name.includes('BEXCO') || p.name.includes('전시장') || p.name.includes('컨벤션') || parkingAddr.includes('APEC로'));

            const isGenericDirectMatch =
              p.name.includes('황령산') ||
              p.name.includes('봉수대') ||
              p.name.includes('전망대') ||
              p.name.includes('쉼터') ||
              p.name.includes('광안') ||
              p.name.includes('민락') ||
              p.name.includes('해운대') ||
              p.name.includes('삼락') ||
              p.name.includes('생태공원');

            let priorityScore = distM;
            if (isDirectVenueMatch) {
              priorityScore = distM - 10000;
            } else if (distM <= 200 || isGenericDirectMatch) {
              priorityScore = distM - 3000;
            }

            return {
              ...p,
              distanceMeters: distM,
              distance: formatWalkingDistanceText(distM),
              priorityScore,
            };
          });

        let nearbyList = evaluatedLots.filter((p) => p.distanceMeters <= 1500);

        if (nearbyList.length < 2) {
          nearbyList = evaluatedLots.filter((p) => p.distanceMeters <= 2500);
        }

        nearbyList.sort((a, b) => a.priorityScore - b.priorityScore);

        const publicParkings = nearbyList.filter((p) => p.isPublic).slice(0, 3);
        const privateParkings = nearbyList.filter((p) => !p.isPublic).slice(0, 2);

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

    console.log('[동일 시설 그룹화 & 대형 일반 주차장 최우선 바인딩 완수 건수]', sortedFestivals.length);

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
