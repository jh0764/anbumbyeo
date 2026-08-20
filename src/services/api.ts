import { Festival } from '@/types';

interface FetchFestivalsParams {
  mapX?: number;
  mapY?: number;
  radius?: number;
}

export async function fetchFestivals(params?: FetchFestivalsParams): Promise<Festival[]> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.mapX) queryParams.set('mapX', params.mapX.toString());
    if (params?.mapY) queryParams.set('mapY', params.mapY.toString());
    if (params?.radius) queryParams.set('radius', params.radius.toString());

    const res = await fetch(`/api/festivals?${queryParams.toString()}`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch festivals: ${res.statusText}`);
    }

    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      return json.data;
    }

    return [];
  } catch (error) {
    console.error('Error fetching festivals:', error);
    return [];
  }
}
