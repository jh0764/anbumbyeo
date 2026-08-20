import { CrowdLevel } from '@/types';

// Haversine 공식을 사용한 두 위경도 간 거리(m) 계산
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (!lat1 || !lon1 || !lat2 || !lon2 || isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
    return Infinity;
  }

  const R = 6371e3; // 지구 반지름 (m)
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

// 실제 매핑된 주변 주차장들의 잔여율 기반 실시간 혼잡도 산출
export function calculateRealCrowdStatus(
  parkingLots: { totalSpaces: number; availableSpaces: number }[]
): { crowdLevel: CrowdLevel; crowdMessage: string } {
  if (!parkingLots || parkingLots.length === 0) {
    return {
      crowdLevel: '보통',
      crowdMessage: '주변 1.5km 내 실시간 공영주차장 정보 없음 (대중교통 이용 권장)',
    };
  }

  const totalSpacesSum = parkingLots.reduce((sum, p) => sum + p.totalSpaces, 0);
  const availableSpacesSum = parkingLots.reduce((sum, p) => sum + p.availableSpaces, 0);

  if (totalSpacesSum === 0) {
    return {
      crowdLevel: '보통',
      crowdMessage: '주변 공영주차장 수용 면수 정보 확인 중입니다.',
    };
  }

  const availableRatio = availableSpacesSum / totalSpacesSum;

  if (availableSpacesSum === 0) {
    return {
      crowdLevel: '매우 혼잡',
      crowdMessage: '주변 공영주차장이 만차 상태입니다. 대중교통 이용을 적극 권장합니다.',
    };
  }

  if (availableRatio >= 0.5) {
    return {
      crowdLevel: '여유',
      crowdMessage: '주변 주차장에 잔여 여유석(50% 이상)이 충분합니다.',
    };
  }

  if (availableRatio >= 0.2) {
    return {
      crowdLevel: '보통',
      crowdMessage: '주변 주차장에 잔여 여유석이 존재합니다. 원활히 진입 가능합니다.',
    };
  }

  return {
    crowdLevel: '혼잡',
    crowdMessage: '주변 주차장 잔여석이 20% 미만으로 혼잡합니다. 서둘러 방문하세요.',
  };
}
