export type CrowdLevel = '여유' | '보통' | '혼잡' | '매우 혼잡';

export type Region = '전체' | '서울·수도권' | '강원' | '충청' | '전라' | '경상' | '제주';

export interface Parking {
  id: string;
  name: string;
  lat: number;
  lng: number;
  totalSpaces: number;
  availableSpaces: number;
  distance: string; // 예: "150m"
  distanceMeters: number; // 정렬용 거리 (m)
  address?: string;
}

export interface Festival {
  id: string;
  title: string;
  period: string;
  locationName: string;
  address: string;
  region: Exclude<Region, '전체'>;
  lat: number;
  lng: number;
  crowdLevel: CrowdLevel;
  crowdMessage: string;
  category: string;
  imageUrl?: string;
  parkingLots: Parking[];
}
