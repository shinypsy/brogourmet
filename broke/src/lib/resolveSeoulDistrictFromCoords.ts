import { KAKAO_REST_API_KEY } from '../api/config'
import { seoulDistricts } from '../data/regions'

const SEOUL_SET = new Set<string>([...seoulDistricts])

export type ResolveDistrictReason =
  | 'ok'
  | 'no_key'
  | 'denied'
  | 'position_error'
  | 'network'
  | 'outside_seoul'
  | 'unknown_address'

export type ResolveDistrictResult =
  | { district: string; reason: 'ok' }
  | { district: string; reason: Exclude<ResolveDistrictReason, 'ok'> }

const FALLBACK = '마포구'

function pickSeoulDistrict(doc: {
  address?: { region_1depth_name?: string; region_2depth_name?: string }
  road_address?: { region_1depth_name?: string; region_2depth_name?: string }
}): string | null {
  const a = doc.address
  const r = doc.road_address
  const tryPair = (d1?: string, d2?: string) => {
    if (d1 === '서울특별시' && d2 && SEOUL_SET.has(d2)) return d2
    return null
  }
  return tryPair(a?.region_1depth_name, a?.region_2depth_name) ?? tryPair(r?.region_1depth_name, r?.region_2depth_name)
}

/**
 * 카카오 좌표→주소 API로 서울 시·구를 판별. REST 키 없으면 `no_key`, 서울이 아니면 `outside_seoul`.
 */
export async function resolveSeoulDistrictFromCoords(lat: number, lng: number): Promise<ResolveDistrictResult> {
  const key = KAKAO_REST_API_KEY
  if (!key) {
    return { district: FALLBACK, reason: 'no_key' }
  }

  try {
    const url = `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${encodeURIComponent(String(lng))}&y=${encodeURIComponent(String(lat))}`
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } })
    if (!res.ok) {
      return { district: FALLBACK, reason: 'network' }
    }
    const data = (await res.json()) as { documents?: unknown[] }
    const doc = data.documents?.[0] as Parameters<typeof pickSeoulDistrict>[0] | undefined
    if (!doc) {
      return { district: FALLBACK, reason: 'unknown_address' }
    }
    const gu = pickSeoulDistrict(doc)
    if (!gu) {
      return { district: FALLBACK, reason: 'outside_seoul' }
    }
    return { district: gu, reason: 'ok' }
  } catch {
    return { district: FALLBACK, reason: 'network' }
  }
}

export const DEFAULT_HOME_DISTRICT = FALLBACK
