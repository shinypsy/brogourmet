import { seoulDistricts } from '../data/regions'

/** BroG 홈·지도·리스트·MyG: 구 미선택 = 서울 전체(백엔드는 stage1이면 허용 구 전부). */
export const BROG_DISTRICT_ALL = '전체 보기' as const

/** 예전 URL·북마크 호환 */
const LEGACY_BROG_DISTRICT_ALL_LABEL = '전체보기'

const SEOUL_DISTRICT_SET = new Set<string>(seoulDistricts)

/** 서울 25개 자치구 — gourmet `deploy_stage1.py` `DEFAULT_STAGE1_DISTRICTS` 와 동일 순서·이름. */
export const DEPLOY_STAGE1_DISTRICTS = seoulDistricts

export type DeployStage1District = (typeof seoulDistricts)[number]

const STAGE1_SET = new Set<string>(seoulDistricts as readonly string[])

/** 서울 25개 구 전체 노출 빌드. `npm run build` 시 `VITE_BROG_FULL_MAP=1` 등. */
export function isFullMapDeploy(): boolean {
  const v = String(import.meta.env.VITE_BROG_FULL_MAP ?? '')
    .trim()
    .toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

/** 1단계 배포: 구 선택·노출을 위 25개로 한정(VITE_BROG_FULL_MAP 으로만 전체 해제). */
export function isStage1LimitedDistricts(): boolean {
  return !isFullMapDeploy()
}

export const STAGE1_DEFAULT_DISTRICT: DeployStage1District = '마포구'

/** URL `district` 빈 값·누락 시 기본(전체 보기). 예전 `전체보기`·MyG `all` 은 정규화합니다. */
export function parseBrogDistrictUrlParam(raw: string | null): string {
  if (raw == null || raw.trim() === '') return BROG_DISTRICT_ALL
  const t = raw.trim()
  if (t === LEGACY_BROG_DISTRICT_ALL_LABEL || t === 'all') return BROG_DISTRICT_ALL
  return t
}

export function isBrogAllDistrictsSelection(district: string): boolean {
  const t = district.trim()
  return t === BROG_DISTRICT_ALL || t === LEGACY_BROG_DISTRICT_ALL_LABEL || t === 'all'
}

export function clampStage1District(district: string): string {
  let d = district.trim()
  if (d === LEGACY_BROG_DISTRICT_ALL_LABEL || d === 'all') d = BROG_DISTRICT_ALL
  if (d === '' || d === BROG_DISTRICT_ALL) return BROG_DISTRICT_ALL
  if (!isStage1LimitedDistricts()) {
    if (SEOUL_DISTRICT_SET.has(d)) return d
    return BROG_DISTRICT_ALL
  }
  if (STAGE1_SET.has(d)) return d
  return BROG_DISTRICT_ALL
}

/** BroG 홈·지도·리스트 구 셀렉트 */
export function brogDistrictOptionsForUi(): readonly string[] {
  const rest = isStage1LimitedDistricts() ? [...DEPLOY_STAGE1_DISTRICTS] : [...seoulDistricts]
  return [BROG_DISTRICT_ALL, ...rest]
}

/** MyG 지도 등 BroG와 동일 범위 */
export function mygDistrictOptionsForUi(): readonly string[] {
  return brogDistrictOptionsForUi()
}

export function restaurantDistrictVisibleInStage1(district: string | undefined): boolean {
  if (!isStage1LimitedDistricts()) return true
  if (!district) return false
  return STAGE1_SET.has(district.trim())
}

export function filterBrogsToStage1IfNeeded<T extends { district: string }>(rows: T[]): T[] {
  if (!isStage1LimitedDistricts()) return rows
  return rows.filter((r) => STAGE1_SET.has(r.district))
}

export function filterMygPostsToStage1IfNeeded<T extends { district: string | null }>(rows: T[]): T[] {
  if (!isStage1LimitedDistricts()) return rows
  return rows.filter((r) => r.district && STAGE1_SET.has(r.district.trim()))
}
