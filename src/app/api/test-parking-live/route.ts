import { NextResponse } from 'next/server';

const PARKING_INFO_API_URL =
  'https://api.koreaconnect.kr/01/5/2606081732514722903DCP/LOGIS/api/v1/parking/info';
const PARKING_STATUS_API_URL =
  'https://api.koreaconnect.kr/01/7/2606081732514722903DCP/LOGIS/api/v1/parking/status';

export async function GET() {
  const apiKey = process.env.PARKING_API_KEY || process.env.TOUR_API_KEY || '';
  const headers = {
    api_user_key_id: apiKey,
    Accept: 'application/json',
  };

  try {
    const [infoRes, statusRes] = await Promise.all([
      fetch(`${PARKING_INFO_API_URL}?pageNo=1&pageSize=10`, { headers, cache: 'no-store' }),
      fetch(`${PARKING_STATUS_API_URL}?pageNo=1&pageSize=10`, { headers, cache: 'no-store' }),
    ]);

    const infoJson = await infoRes.json();
    const statusJson = await statusRes.json();

    return NextResponse.json({
      success: true,
      apiKeyLength: apiKey.length,
      infoApiStatus: infoRes.status,
      statusApiStatus: statusRes.status,
      infoSample: infoJson,
      statusSample: statusJson,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
