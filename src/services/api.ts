import { Festival, CategoryType, Region } from '@/types';
import { fetchFestivalsClient } from '@/services/tourApi';

interface FetchFestivalsParams {
  category?: CategoryType;
  region?: Region;
  mapX?: number;
  mapY?: number;
  radius?: number;
}

/**
 * 축제/명소 데이터 조회 — 브라우저에서 직접 한국 공공 API 호출
 *
 * 기존: page.tsx → api.ts → /api/festivals (Vercel 해외 서버) → 한국 API ❌ 차단
 * 변경: page.tsx → api.ts → 브라우저에서 직접 apis.data.go.kr 호출 ✅ 정상
 */
export async function fetchFestivals(params: FetchFestivalsParams = {}): Promise<Festival[]> {
  try {
    return await fetchFestivalsClient({
      category: params.category,
      region: params.region,
      mapX: params.mapX,
      mapY: params.mapY,
      radius: params.radius,
    });
  } catch (error) {
    console.error('[fetchFestivals] Client-side fetch failed:', error);
    return [];
  }
}
