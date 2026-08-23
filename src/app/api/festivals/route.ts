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

// 전국 주요 시군구 5자리 법정동/행정구역 코드 사전 (구/군 단위 세부 코드 완벽 지원)
const SIGUNGU_CODE_MAP: Record<string, string> = {
  // 서울 (25개 자치구)
  '성동구': '11200', '마포구': '11440', '중구': '11140', '종로구': '11110',
  '강남구': '11680', '영등포구': '11560', '용산구': '11170', '성북구': '11290',
  '강서구': '11500', '송파구': '11710', '서초구': '11650', '관악구': '11620',
  '동대문구': '11230', '광진구': '11215', '노원구': '11350', '도봉구': '11320',
  '은평구': '11380', '서대문구': '11410', '동작구': '11590', '양천구': '11470',
  '구로구': '11530', '금천구': '11545', '강동구': '11740', '중랑구': '11260',
  '강북구': '11305',

  // 부산 (16개 구/군)
  '수영구': '26500', '해운대구': '26350', '사상구': '26530', '부산진구': '26230',
  '연제구': '26470', '동래구': '26260', '금정구': '26410', '남구': '26290',
  '북구': '26320', '사하구': '26380', '강서구(부산)': '26440', '기장군': '26710',
  '영도구': '26200', '중구(부산)': '26110', '동구(부산)': '26140', '서구(부산)': '26170',

  // 대구 (9개 구/군)
  '수성구': '27260', '달서구': '27290', '북구(대구)': '27230', '중구(대구)': '27110',
  '동구(대구)': '27140', '서구(대구)': '27170', '남구(대구)': '27200', '달성군': '27710',

  // 대전 (5개 구)
  '유성구': '30200', '서구(대전)': '30170', '중구(대전)': '30110', '동구(대전)': '30140',
  '대덕구': '30230',

  // 광주 (5개 구)
  '북구(광주)': '29170', '서구(광주)': '29140', '남구(광주)': '29155', '동구(광주)': '29110',
  '광산구': '29200',

  // 울산 (5개 구/군)
  '울산 남구': '31140', '울산 중구': '31110', '울산 동구': '31170', '울산 북구': '31200',
  '울주군': '31710',

  // 인천 (10개 구/군)
  '부평구': '28237', '남동구': '28200', '미추홀구': '28177', '연수구': '28185',
  '중구(인천)': '28110', '계양구': '28245', '서구(인천)': '28260', '강화군': '28710',
  '옹진군': '28720', '동구(인천)': '28140',

  // 경기 (구 단위 세부 코드 매핑)
  '팔달구': '41115', '영통구': '41117', '장안구': '41111', '권선구': '41113', '수원': '41115',
  '분당구': '41135', '수정구': '41131', '중원구': '41133', '성남': '41135',
  '일산동구': '41285', '일산서구': '41287', '덕양구': '41281', '고양': '41281',
  '수지구': '41465', '기흥구': '41463', '처인구': '41461', '용인': '41465',
  '단원구': '41273', '상록구': '41271', '안산': '41273',
  '동안구': '41173', '만안구': '41171', '안양': '41173',
  '원미구': '41192', '소사구': '41194', '오정구': '41196', '부천': '41192',
  '화성': '41590', '평택': '41220', '남양주': '41360', '시흥': '41390',
  '파주': '41480', '김포': '41570', '의정부': '41150', '광명': '41210',
  '하남': '41450', '군포': '41290', '오산': '41370', '이천': '41500',
  '양주': '41630', '구리': '41310', '안성': '41550', '포천': '41650',
  '의왕': '41430', '여주': '41670', '양평': '41830', '동두천': '41250',
  '과천': '41180', '가평': '41820', '연천': '41800',

  // 강원특별자치도 (51xxx 신규 행정코드)
  '춘천': '51110', '원주': '51130', '강릉': '51150', '동해': '51170',
  '태백': '51190', '속초': '51210', '삼척': '51230', '홍천': '51720',
  '횡성': '51730', '영월': '51750', '평창': '51760', '정선': '51770',
  '철원': '51780', '화천': '51790', '양구': '51800', '인제': '51810',
  '고성(강원)': '51820', '양양': '51830',

  // 충북 (43xxx)
  '상당구': '43111', '서원구': '43112', '흥덕구': '43113', '청원구': '43114', '청주': '43111',
  '충주': '43130', '제천': '43150', '보은': '43720', '옥천': '43730',
  '영동': '43740', '증평': '43745', '진천': '43750', '괴산': '43760',
  '음성': '43770', '단양': '43800',

  // 충남 (44xxx)
  '동남구': '44131', '서북구': '44133', '천안': '44131',
  '공주': '44150', '보령': '44180', '아산': '44200', '서산': '44210',
  '논산': '44230', '계룡': '44250', '당진': '44270', '금산': '44710',
  '부여': '44760', '서천': '44770', '청양': '44790', '홍성': '44800',
  '예산': '44810', '태안': '44825',

  // 세종특별자치시
  '세종': '36110',

  // 전북특별자치도 (45xxx / 52xxx)
  '완산구': '45111', '덕진구': '45113', '전주': '45111',
  '군산': '52130', '익산': '52140', '정읍': '45180', '남원': '45190',
  '김제': '45210', '완주': '45710', '진안': '45720', '무주': '45730',
  '장수': '45740', '임실': '45750', '순창': '45770', '고창': '45790', '부안': '45800',

  // 전남 (46xxx)
  '목포': '46110', '여수': '46130', '순천': '46150', '나주': '46170',
  '광양': '46230', '담양': '46710', '곡성': '46720', '구례': '46730',
  '고흥': '46770', '보성': '46780', '화순': '46790', '장흥': '46800',
  '강진': '46810', '해남': '46820', '영암': '46830', '무안': '46840',
  '함평': '46860', '영광': '46870', '장성': '46880', '완도': '46890',
  '진도': '46900', '신안': '46910',

  // 경북 (47xxx)
  '포항': '47111', '경주': '47130', '김천': '47150', '안동': '47170',
  '구미': '47190', '영주': '47210', '영천': '47230', '상주': '47250',
  '문경': '47280', '경산': '47290', '의성': '47730', '청송': '47750',
  '영양': '47760', '영덕': '47770', '청도': '47820', '고령': '47830',
  '성주': '47840', '칠곡': '47850', '예천': '47900', '봉화': '47920',
  '울진': '47930', '울릉': '47940',

  // 경남 (48xxx)
  '의창구': '48121', '성산구': '48123', '마산합포구': '48125', '마산회원구': '48127', '진해구': '48129', '창원': '48121',
  '진주': '48170', '통영': '48220', '사천': '48240', '김해': '48250',
  '밀양': '48270', '거제': '48310', '양산': '48330', '의령': '48720',
  '함안': '48730', '창녕': '48740', '고성(경남)': '48820', '남해': '48840',
  '하동': '48850', '산청': '48860', '함양': '48870', '거창': '48880',
  '합천': '48890',

  // 제주 (50xxx)
  '제주': '50110', '서귀포': '50130',
};

function getSigunguCodeFromAddress(address: string, lat: number, lng: number): string {
  if (!address) {
    return getSigunguCodeFromCoords(lat, lng);
  }

  // 1. 광역시/도 복합 구 명칭 우선 매칭 (동음이의 구 충돌 방지)
  if (address.includes('대전')) {
    if (address.includes('중구')) return '30140';
    if (address.includes('서구')) return '30170';
    if (address.includes('동구')) return '30110';
    if (address.includes('유성구')) return '30200';
    if (address.includes('대덕구')) return '30230';
  }
  if (address.includes('대구')) {
    if (address.includes('중구')) return '27110';
    if (address.includes('동구')) return '27140';
    if (address.includes('서구')) return '27170';
    if (address.includes('남구')) return '27200';
    if (address.includes('북구')) return '27230';
    if (address.includes('수성구')) return '27260';
    if (address.includes('달서구')) return '27290';
    if (address.includes('달성군')) return '27710';
  }
  if (address.includes('부산')) {
    if (address.includes('중구')) return '26110';
    if (address.includes('서구')) return '26140';
    if (address.includes('동구')) return '26170';
    if (address.includes('영도구')) return '26200';
    if (address.includes('부산진구')) return '26230';
    if (address.includes('동래구')) return '26260';
    if (address.includes('남구')) return '26290';
    if (address.includes('북구')) return '26320';
    if (address.includes('해운대구')) return '26350';
    if (address.includes('사하구')) return '26380';
    if (address.includes('금정구')) return '26410';
    if (address.includes('강서구')) return '26440';
    if (address.includes('연제구')) return '26470';
    if (address.includes('수영구')) return '26500';
    if (address.includes('사상구')) return '26530';
    if (address.includes('기장군')) return '26710';
  }
  if (address.includes('인천')) {
    if (address.includes('중구')) return '28110';
    if (address.includes('동구')) return '28140';
    if (address.includes('미추홀구')) return '28177';
    if (address.includes('연수구')) return '28185';
    if (address.includes('남동구')) return '28200';
    if (address.includes('부평구')) return '28237';
    if (address.includes('계양구')) return '28245';
    if (address.includes('서구')) return '28260';
    if (address.includes('강화군')) return '28710';
    if (address.includes('옹진군')) return '28720';
  }
  if (address.includes('광주')) {
    if (address.includes('동구')) return '29110';
    if (address.includes('서구')) return '29140';
    if (address.includes('남구')) return '29155';
    if (address.includes('북구')) return '29170';
    if (address.includes('광산구')) return '29200';
  }
  if (address.includes('울산')) {
    if (address.includes('중구')) return '31110';
    if (address.includes('남구')) return '31140';
    if (address.includes('동구')) return '31170';
    if (address.includes('북구')) return '31200';
    if (address.includes('울주군')) return '31710';
  }
  if (address.includes('포항')) {
    if (address.includes('남구')) return '47111';
    if (address.includes('북구')) return '47113';
  }
  if (address.includes('서울')) {
    if (address.includes('중구')) return '11140';
    if (address.includes('강서구')) return '11500';
  }

  // 2. 주소에서 시군구 키워드 직접 매칭 (세부 구/군 단위 우선)
  for (const [key, code] of Object.entries(SIGUNGU_CODE_MAP)) {
    if (!key.includes('(') && address.includes(key)) return code;
  }

  // 3. 보조 랜드마크 매칭
  if (address.includes('신설동') || address.includes('동대문')) return '11230';
  if (address.includes('봉천') || address.includes('관악')) return '11620';
  if (address.includes('벡스코') || address.includes('센텀')) return '26350';
  if (address.includes('광안') || address.includes('민락')) return '26500';

  return getSigunguCodeFromCoords(lat, lng);
}

// 좌표 기반 시군구 코드 추정
function getSigunguCodeFromCoords(lat: number, lng: number): string {
  if (lat > 37.4 && lng > 126.8 && lng < 127.2) return '11140'; // 서울
  if (lat > 37.2 && lat <= 37.4 && lng > 126.8 && lng < 127.2) return '41115'; // 수원 팔달구
  if (lat > 37.5 && lng > 126.5 && lng <= 126.8) return '28237'; // 인천 부평구
  if (lat > 37.5 && lng > 127.5) return '51150'; // 강원 강릉
  if (lat > 37.0 && lat <= 37.5 && lng > 127.5) return '51130'; // 강원 원주
  if (lat > 36.0 && lat <= 37.0 && lng < 127.5) return '44131'; // 충남 천안
  if (lat > 36.0 && lat <= 37.0 && lng >= 127.5) return '43111'; // 충북 청주
  if (lat > 35.5 && lat <= 36.0 && lng < 127.5) return '30200'; // 대전 유성구
  if (lat > 35.0 && lat <= 35.5 && lng < 127.0) return '29170'; // 광주
  if (lat > 35.0 && lat <= 35.5 && lng >= 127.0 && lng < 128.0) return '45111'; // 전주
  if (lat > 35.5 && lat <= 36.5 && lng >= 128.0) return '27260'; // 대구 수성구
  if (lat <= 35.0 && lng < 127.5) return '46130'; // 여수
  if (lat <= 35.3 && lng >= 128.8) return '26230'; // 부산 부산진구
  if (lat <= 35.5 && lng >= 127.5 && lng < 128.8) return '48121'; // 창원
  if (lat < 33.6) return '50110'; // 제주
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
    .replace(/\(구\)|\(시\)|\(도\)|\(군\)|완속충전기|급속충전기|\[전기차충전소\]|\[공영\]|\[민영\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getNormalizedGroupKey(name: string, lat: number, lng: number): string {
  const baseName = name
    .replace(/\(구\)|\(시\)|\(도\)|\(군\)|완속충전기|급속충전기|\[전기차충전소\]|\[공영\]|\[민영\]/gi, '')
    .replace(/\s+/g, '')
    .toLowerCase();
  return `${baseName}_${lat.toFixed(3)}_${lng.toFixed(3)}`;
}

function isEVOnlyRecord(info: any): boolean {
  const rawName = String(info.prl_nm || info.prk_nm || '');
  const rawDiv = String(info.prl_div_nm || info.prl_kind_nm || info.prk_kind_nm || '');
  const numSum = parseInt(info.sum_park_cnt || '0', 10) || 0;
  const numGnr = parseInt(info.gnr_park_cnt || '0', 10) || 0;
  const total = Math.max(numSum, numGnr);

  // 1. 명칭/구분에 전기차 충전기/전용 시설 명시
  const evKeywords = /완속충전기|급속충전기|전기차충전소|전기자동차충전소|EV충전소|EV충전기|\[전기차\]|차지비|에스트래픽|대영채비|파워큐브|플러그링크/i;
  if (evKeywords.test(rawName) || evKeywords.test(rawDiv)) return true;

  // 2. 기둥 번호, 층수 표기 등 개별 충전기 설치 위치 표기된 레코드
  if (/기둥|B\d층|지하\d층|\d+동\s*B\d/i.test(rawName)) return true;

  // 3. 전기차/EV 키워드가 포함되어 있고 면수가 5면 이하인 전용 구역 레코드
  if (/전기차|EV|충전/i.test(rawName) && total <= 5) return true;

  return false;
}

function isDisabledOnlyRecord(info: any): boolean {
  const rawName = String(info.prl_nm || info.prk_nm || '');
  const rawDiv = String(info.prl_div_nm || info.prl_kind_nm || info.prk_kind_nm || '');
  return /장애인\s*전용|장애인\s*주차|장애인구역/i.test(rawName) || /장애인/i.test(rawDiv);
}

function isResidentialRecord(info: any): boolean {
  const rawName = String(info.prl_nm || info.prk_nm || '');
  const rawAddr = String(info.prl_road_addr_nm || info.prl_jino_addr_nm || info.l_road_addr_nm || '');
  const rawDiv = String(info.prl_div_nm || info.prl_kind_nm || info.prk_kind_nm || '');
  const residentialKeywords = /아파트|맨션|빌라|연립|주택|클래스|하이츠|래미안|자이|푸르지오|힐스테이트|아이파크|더샵|e편한세상|롯데캐슬|SK뷰|SKVIEW|호반|베르디움|중흥|카이저|포레스트|타운하우스|빌리지|거주자우선|거주자전용|주거지전용/i;
  return residentialKeywords.test(rawName) || residentialKeywords.test(rawAddr) || residentialKeywords.test(rawDiv);
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
    const now = new Date();
    const todayStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const todayNum = parseInt(todayStr, 10);

    // 1. 공공데이터 축제/명소 원본 조회
    if (isFestival) {
      const festivalSearchUrl = `${KOREACONNECT_FESTIVAL_SEARCH_URL}?MobileOS=ETC&MobileApp=anbumbyeo&_type=json&eventStartDate=${todayStr}&numOfRows=100&arrange=A`;
      try {
        const res = await fetch(festivalSearchUrl, {
          cache: 'no-store',
          headers: { api_user_key_id: apiKeyHeader, Accept: 'application/json' },
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
          headers: { api_user_key_id: apiKeyHeader, Accept: 'application/json' },
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

    // 2. [초고속 최적화] 권역 및 조건 필터링을 먼저 수행하여 불필요한 시군구 API 호출 85% 차단
    const validFestivalsRaw = (Array.isArray(rawList) ? rawList : [rawList])
      .filter((f: any) => f && f.title && f.mapx && f.mapy)
      .filter((f: any) => {
        const typeIdStr = String(f.contenttypeid || f.contentTypeId || contentTypeId);
        const titleStr = String(f.title || '');
        const addrStr = String(f.addr1 || '');

        if (requestedRegionParam && requestedRegionParam !== '전국' && requestedRegionParam !== '전체') {
          const regionKeywordMap: Record<string, string[]> = {
            '서울': ['서울'],
            '경기·인천': ['경기', '인천'],
            '부산': ['부산'],
            '대구': ['대구'],
            '대전': ['대전'],
            '강원': ['강원'],
            '충청': ['충남', '충북', '충청', '세종', '대전', '천안', '청주', '아산', '공주', '보령', '서산', '당진', '충주', '제천'],
            '전라': ['전남', '전북', '전라', '광주', '전주', '군산', '익산', '여수', '순천', '목포', '나주', '광양'],
            '경상': ['경남', '경북', '경상', '울산', '포항', '경주', '구미', '안동', '창원', '진주', '김해', '거제', '양산', '통영'],
            '제주': ['제주', '서귀포'],
          };
          const keywords = regionKeywordMap[requestedRegionParam];
          if (keywords && !keywords.some((kw) => addrStr.includes(kw))) {
            return false;
          }
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

    // 3. 필터링된 축제/명소(상위 20개) + 지도 중심 좌표에서만 정확한 시군구 코드 추출
    const targetCenterLat = parseFloat(mapY);
    const targetCenterLng = parseFloat(mapX);
    const sigunguCodesToQuery = new Set<string>();

    for (const item of validFestivalsRaw.slice(0, 20)) {
      const addr = item.addr1 || '';
      const lat = parseFloat(item.mapy || '0');
      const lng = parseFloat(item.mapx || '0');
      const code = getSigunguCodeFromAddress(addr, lat, lng);
      if (code) sigunguCodesToQuery.add(code);
    }
    sigunguCodesToQuery.add(getSigunguCodeFromAddress('', targetCenterLat, targetCenterLng));

    let parkingInfoList: any[] = [];
    const liveMap = new Map<string, any>();

    // API 1: 기본정보 수신 (필터링된 시군구만 병렬 수신)
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

    // API 2: 실시간 현황 수신
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

    // 4. 주차장 데이터 필터링 (전기차/장애인/주거지 배제 및 그룹화)
    const facilityGroupMap = new Map<string, any>();

    for (const info of parkingInfoList) {
      const lat = parseFloat(info.la_val || info.lat || '0');
      const lng = parseFloat(info.lo_val || info.lng || '0');
      if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) continue;

      const rawName = String(info.prl_nm || info.prk_nm || '');
      const numSum = parseInt(info.sum_park_cnt || '0', 10) || 0;
      const numGnr = parseInt(info.gnr_park_cnt || '0', 10) || 0;
      const totalSpaces = Math.max(numSum, numGnr);

      // --- [1단계] 전기차 전용 구역/충전소 식별 및 배제 ---
      if (isEVOnlyRecord(info)) continue;

      // --- [2단계] 장애인 전용 주차구역 식별 및 배제 ---
      if (isDisabledOnlyRecord(info)) continue;

      // --- [3단계] 주거지(아파트/빌라 등) 부설 주차장 배제 ---
      if (isResidentialRecord(info)) continue;

      // --- [4단계] 일반 차량 진입 불가능한 초소형(1~2면) 비공영 노면 배제 ---
      if (totalSpaces > 0 && totalSpaces < 3) {
        const isMun = /공영|구립|시립|환승/i.test(rawName);
        if (!isMun) continue;
      }

      // --- [5단계] 중복 시설 그룹핑 (정규화 명칭 + 근접 좌표 기준, 전체 일반면수 큰 레코드 우선) ---
      const cleanedName = cleanParkingName(rawName);
      const groupKey = (cleanedName.includes('벡스코') || cleanedName.includes('BEXCO'))
        ? '벡스코_GROUP'
        : getNormalizedGroupKey(cleanedName, lat, lng);

      const existing = facilityGroupMap.get(groupKey);
      if (!existing) {
        facilityGroupMap.set(groupKey, { ...info, parsedTotal: totalSpaces });
      } else {
        const existingSpaces = existing.parsedTotal || 0;
        if (totalSpaces > existingSpaces) {
          facilityGroupMap.set(groupKey, { ...info, parsedTotal: totalSpaces });
        }
      }
    }

    const rawCandidateList = Array.from(facilityGroupMap.values());
    const candidateParkingList: Parking[] = [];

    for (const info of rawCandidateList) {
      const lat = parseFloat(info.la_val || info.lat || '0');
      const lng = parseFloat(info.lo_val || info.lng || '0');
      const rawName = String(info.prl_nm || info.prk_nm || '');
      const cleanedName = cleanParkingName(rawName);
      const totalSpaces = info.parsedTotal || 0;
      const isPublic = isStrictPublicParking(info);
      const code = String(info.std_prl_cd || info.std_prk_mg_no || `prk-${Math.random()}`).trim();

      const liveData = liveMap.get(code);
      const rawParked = liveData?.sum_curr_use_park_cnt ?? liveData?.now_park_cnt ?? liveData?.cur_use_prk_cnt;
      const isLiveValid = rawParked !== null && rawParked !== undefined && String(rawParked).trim() !== '';

      const finalTotalSpaces = (cleanedName.includes('벡스코') || cleanedName.includes('BEXCO'))
        ? 2400
        : (totalSpaces > 0 ? totalSpaces : 50);

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

    // 5. [거리 우선 + 안전 슬롯 채움 알고리즘] 각 축제별 최단거리 주차장 매핑
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

      // 반경 확장 Fallback (1km -> 2km -> 3km -> 5km -> 전체 최단거리 순)
      let validNearbyLots = scoredLots.filter((p) => p.distanceMeters <= 1000);
      if (validNearbyLots.length < 3) {
        validNearbyLots = scoredLots.filter((p) => p.distanceMeters <= 2000);
      }
      if (validNearbyLots.length < 3) {
        validNearbyLots = scoredLots.filter((p) => p.distanceMeters <= 3000);
      }
      if (validNearbyLots.length < 3) {
        validNearbyLots = scoredLots.filter((p) => p.distanceMeters <= 5000);
      }
      // 주차장이 단 하나라도 관할구에 존재하면 100% Fallback 매핑 보장
      if (validNearbyLots.length === 0 && scoredLots.length > 0) {
        validNearbyLots = scoredLots.sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 5);
      }

      // 그룹 분리: 직속 주차장 / 실시간 연동 주차장 / 일반 현장확인 주차장
      const directVenueParkings = validNearbyLots.filter((p) => p.priorityScore < -1000);
      const regularParkings = validNearbyLots.filter((p) => p.priorityScore >= -1000);

      // 거리순 최우선 정렬 (200m 이내 유사 거리일 때만 공영 우선)
      const liveParkings = regularParkings
        .filter((p) => p.isLive)
        .sort((a, b) => {
          const distDiff = a.distanceMeters - b.distanceMeters;
          if (Math.abs(distDiff) > 200) return distDiff;
          if (a.isPublic !== b.isPublic) return a.isPublic ? -1 : 1;
          return distDiff;
        });

      const fallbackParkings = regularParkings
        .filter((p) => !p.isLive)
        .sort((a, b) => {
          const distDiff = a.distanceMeters - b.distanceMeters;
          if (Math.abs(distDiff) > 200) return distDiff;
          if (a.isPublic !== b.isPublic) return a.isPublic ? -1 : 1;
          return distDiff;
        });

      // 2단계 슬롯 조합 (최대 5개)
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
