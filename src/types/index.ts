export type CrowdLevel = '여유' | '보통' | '혼잡' | '매우 혼잡';

export type Region = '전체' | '서울·수도권' | '강원' | '충청' | '전라' | '경상' | '제주';

export type CategoryType = '축제' | '공원·나들이' | '문화시설';

export type FestivalStatusType = 'LIVE' | 'UPCOMING' | 'EXPIRED' | 'FAR_FUTURE';

export type StatusFilterType = 'LIVE' | 'UPCOMING';

export interface Parking {
  id: string;
  name: string;
  lat: number;
  lng: number;
  totalSpaces: number;
  availableSpaces: number;
  distance: string;
  distanceMeters: number;
  address?: string;
  isRealtime?: boolean; // 실시간 현황 연동 여부
}

export interface Festival {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  period: string;
  locationName: string;
  address: string;
  region: Exclude<Region, '전체'>;
  contentTypeId?: string; // '12': 관광지/공원, '14': 문화시설, '15': 축제
  categoryType: CategoryType;
  lat: number;
  lng: number;
  crowdLevel: CrowdLevel;
  crowdMessage: string;
  category: string;
  imageUrl?: string;
  parkingLots: Parking[];
}
