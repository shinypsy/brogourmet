import { KAKAO_REST_API_KEY } from '../api/config'

type KakaoKeywordDoc = {
  place_name?: string
  address_name?: string
  road_address_name?: string
  y?: string
  x?: string
}

type KakaoKeywordResponse = {
  documents?: KakaoKeywordDoc[]
}

/**
 * 카카오 로컬 키워드 검색 첫 결과 좌표(브라우저에서 KakaoAK 호출).
 * @see https://developers.kakao.com/docs/latest/ko/local/dev-guide#search-by-keyword
 */
export async function fetchKakaoKeywordFirstPlace(
  keyword: string,
): Promise<{ lat: number; lng: number; placeName: string } | null> {
  const key = KAKAO_REST_API_KEY.trim()
  const q = keyword.trim()
  if (!key || !q) return null

  const params = new URLSearchParams({
    query: q,
    size: '5',
    sort: 'accuracy',
  })
  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?${params}`
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(
      res.status === 401 || res.status === 403
        ? '카카오 REST API 키를 확인해 주세요. (broke/.env VITE_KAKAO_REST_API_KEY)'
        : `장소 검색 요청 실패 (${res.status})${t ? `: ${t.slice(0, 120)}` : ''}`,
    )
  }
  const data = (await res.json()) as KakaoKeywordResponse
  const docs = data.documents ?? []
  const pick =
    docs.find((d) => {
      const addr = (d.address_name ?? d.road_address_name ?? '').trim()
      return addr.startsWith('서울') || addr.includes('서울특별시')
    }) ?? docs[0]

  if (!pick?.y || !pick?.x) return null
  const lat = Number.parseFloat(pick.y)
  const lng = Number.parseFloat(pick.x)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const placeName = (pick.place_name ?? pick.address_name ?? q).trim() || q
  return { lat, lng, placeName }
}
