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

type KakaoCoordDoc = {
  address?: {
    address_name?: string
    region_1depth_name?: string
    region_2depth_name?: string
  }
  road_address?: {
    address_name?: string
    region_1depth_name?: string
    region_2depth_name?: string
  }
}

function pickSeoulDistrict(doc: KakaoCoordDoc): string | null {
  const a = doc.address
  const r = doc.road_address
  const tryPair = (d1?: string, d2?: string) => {
    if (d1 === '서울특별시' && d2 && SEOUL_SET.has(d2)) return d2
    return null
  }
  return tryPair(a?.region_1depth_name, a?.region_2depth_name) ?? tryPair(r?.region_1depth_name, r?.region_2depth_name)
}

function pickAddressLine(doc: KakaoCoordDoc): string {
  const road = doc.road_address?.address_name
  const jibun = doc.address?.address_name
  return (road || jibun || '').trim()
}

export type CoordAddressForForm = {
  /** 서울 구 이름(실패 시 기본 구) */
  districtName: string
  reason: ResolveDistrictReason
  /** 도로명·지번 등 표시용 한 줄 */
  addressLine: string
}

async function fetchKakaoCoordResolution(lat: number, lng: number): Promise<CoordAddressForForm> {
  const key = KAKAO_REST_API_KEY
  if (!key) {
    return { districtName: FALLBACK, reason: 'no_key', addressLine: '' }
  }

  try {
    const url = `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${encodeURIComponent(String(lng))}&y=${encodeURIComponent(String(lat))}`
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } })
    if (!res.ok) {
      return { districtName: FALLBACK, reason: 'network', addressLine: '' }
    }
    const data = (await res.json()) as { documents?: unknown[] }
    const doc = data.documents?.[0] as KakaoCoordDoc | undefined
    if (!doc) {
      return { districtName: FALLBACK, reason: 'unknown_address', addressLine: '' }
    }
    const addressLine = pickAddressLine(doc)
    const gu = pickSeoulDistrict(doc)
    if (!gu) {
      return { districtName: FALLBACK, reason: 'outside_seoul', addressLine }
    }
    return { districtName: gu, reason: 'ok', addressLine }
  } catch {
    return { districtName: FALLBACK, reason: 'network', addressLine: '' }
  }
}

/** BroG/MyG 작성 폼: 좌표 → 주소 한 줄 + 서울 구(드롭다운 연동용) */
export async function resolveCoordAddressForManageForm(lat: number, lng: number): Promise<CoordAddressForForm> {
  return fetchKakaoCoordResolution(lat, lng)
}

/**
 * 카카오 좌표→주소 API로 서울 시·구를 판별. REST 키 없으면 `no_key`, 서울이 아니면 `outside_seoul`.
 */
export async function resolveSeoulDistrictFromCoords(lat: number, lng: number): Promise<ResolveDistrictResult> {
  const r = await fetchKakaoCoordResolution(lat, lng)
  if (r.reason === 'ok') {
    return { district: r.districtName, reason: 'ok' }
  }
  return { district: r.districtName, reason: r.reason }
}

export const DEFAULT_HOME_DISTRICT = FALLBACK
