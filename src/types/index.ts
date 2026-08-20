export type CrowdLevel = '여유' | '보통' | '혼잡' | '매우 혼잡';

export type Region =
  | '서울'
  | '경기·인천'
  | '부산'
  | '대구'
  | '대전'
  | '강원'
  | '충청'
  | '전라'
  | '경상'
  | '제주';

export type CategoryType = '축제' | '공원·나들이' | '문화시설';

export type FestivalStatusType = 'LIVE' | 'UPCOMING' | 'EXPIRED';

export type StatusFilterType = 'LIVE' | 'UPCOMING';

export interface Parking {
  id: string;
  name: string;
  lat: number;
  lng: number;
  totalSpaces: number;
  availableSpaces: number;
  distance: string; // 예: "도보 4분 (250m)"
  distanceMeters: number;
  address?: string;
  isRealtime?: boolean;
  isPublic?: boolean; // true: 공영, false: 민영
  feeInfo?: string;  // 예: "10분당 500원" 또는 "무료"
}

export interface Festival {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  period: string; // 예: "2026.09.05 ~ 2026.09.10" 또는 "연중무휴"
  locationName: string;
  address: string;
  region: Region | string;
  contentTypeId?: string;
  categoryType: CategoryType;
  lat: number;
  lng: number;
  crowdLevel: CrowdLevel;
  crowdMessage: string;
  category: CategoryType;
  imageUrl?: string;
  parkingLots: Parking[];
  startNum?: number;
  endNum?: number;
}
