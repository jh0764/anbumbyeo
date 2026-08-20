import { CrowdLevel } from '@/types';

/**
 * Haversine 공식을 사용한 두 좌표 간 직선 거리 (미터 단위) 계산
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // 지구 반지름 (미터)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export interface CalculateCrowdInput {
  distanceMeters: number;
  totalSpaces: number;
  currentUsedSpaces: number;
}

export interface CrowdCalculationResult {
  crowdLevel: CrowdLevel;
  occupancyRate: number; // 0 ~ 100
  crowdMessage: string;
}

/**
 * 주차장 점유율 및 거리 가중치 기반 인파 혼잡도 지수 산출
 */
export function calculateCrowdScore(parkingLots: CalculateCrowdInput[]): CrowdCalculationResult {
  if (parkingLots.length === 0) {
    return {
      crowdLevel: '보통',
      occupancyRate: 50,
      crowdMessage: '실시간 주변 주차장 데이터 수집 중입니다.',
    };
  }

  let totalWeightedOccupancy = 0;
  let totalWeight = 0;

  for (const parking of parkingLots) {
    if (parking.totalSpaces <= 0) continue;

    // 거리별 가중치 산출 (300m 이내: 1.0, 600m 이내: 0.7, 1km 이내: 0.4)
    let weight = 0.4;
    if (parking.distanceMeters <= 300) {
      weight = 1.0;
    } else if (parking.distanceMeters <= 600) {
      weight = 0.7;
    }

    const occupancyRate = Math.min(1, Math.max(0, parking.currentUsedSpaces / parking.totalSpaces));
    totalWeightedOccupancy += occupancyRate * weight;
    totalWeight += weight;
  }

  const finalRate = totalWeight > 0 ? (totalWeightedOccupancy / totalWeight) * 100 : 50;

  let crowdLevel: CrowdLevel = '보통';
  let crowdMessage = '원활한 관람이 가능합니다.';

  if (finalRate >= 85) {
    crowdLevel = '매우 혼잡';
    crowdMessage = '주변 주차장 점유율이 85% 이상으로 인파가 매우 혼잡합니다. 대중교통 이용을 강력히 권장합니다.';
  } else if (finalRate >= 65) {
    crowdLevel = '혼잡';
    crowdMessage = '주차 공간이 수용 인원에 임계점에 도달하고 있습니다. 서둘러 이동하거나 차선책 주차장을 이용하세요.';
  } else if (finalRate >= 40) {
    crowdLevel = '보통';
    crowdMessage = '주변 주차장 점유율이 보통 수준입니다. 통행에 유의하세요.';
  } else {
    crowdLevel = '여유';
    crowdMessage = '주변 주차장과 진입 도로가 매우 여유롭습니다.';
  }

  return {
    crowdLevel,
    occupancyRate: Math.round(finalRate),
    crowdMessage,
  };
}
