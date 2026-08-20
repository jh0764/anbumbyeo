import { Festival, CategoryType, Region } from '@/types';

interface FetchFestivalsParams {
  category?: CategoryType;
  region?: Region;
  mapX?: number;
  mapY?: number;
  radius?: number;
}

export async function fetchFestivals(params: FetchFestivalsParams = {}): Promise<Festival[]> {
  try {
    const searchParams = new URLSearchParams();
    if (params.category) searchParams.set('category', params.category);
    if (params.region) searchParams.set('region', params.region);
    if (params.mapX) searchParams.set('mapX', params.mapX.toString());
    if (params.mapY) searchParams.set('mapY', params.mapY.toString());
    if (params.radius) searchParams.set('radius', params.radius.toString());

    const response = await fetch(`/api/festivals?${searchParams.toString()}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await response.json();
    return json.data || [];
  } catch (error) {
    console.error('Failed to fetch festivals:', error);
    return [];
  }
}
