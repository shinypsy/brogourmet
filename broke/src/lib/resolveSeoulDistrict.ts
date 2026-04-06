import { KAKAO_REST_API_KEY } from '../api/config'
import { seoulDistricts } from '../data/regions'

type KakaoRegionDoc = {
  region_1depth_name?: string
  region_2depth_name?: string
}

/**
 * 위·경도로 서울 자치구 이름을 추정합니다. Kakao REST API 키가 없으면 null.
 */
export async function resolveSeoulDistrictFromCoords(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  if (!KAKAO_REST_API_KEY) {
    return null
  }

  const url = `https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${longitude}&y=${latitude}`
  const response = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
  })

  if (!response.ok) {
    return null
  }

  const data = (await response.json()) as { documents?: KakaoRegionDoc[] }
  const docs = data.documents ?? []

  for (const doc of docs) {
    const metro = doc.region_1depth_name ?? ''
    const gu = doc.region_2depth_name?.trim() ?? ''
    if (!gu) {
      continue
    }
    if (metro.includes('서울')) {
      const known = seoulDistricts.find((d) => d === gu)
      return known ?? gu
    }
  }

  return null
}
