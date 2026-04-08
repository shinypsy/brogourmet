import { seoulDistricts } from '../data/regions'

/** 1단계 테스트·시범 배포: 구 선택 범위만 한정. gourmet `deploy_stage1.py` 와 맞출 것. */
/** gourmet `app/core/deploy_stage1.py` DEFAULT_STAGE1_DISTRICTS 와 동일 (순서·이름 유지). */
export const DEPLOY_STAGE1_DISTRICTS = [
  '마포구',
  '용산구',
  '서대문구',
  '영등포구',
  '종로구',
  '중구',
] as const

export type DeployStage1District = (typeof DEPLOY_STAGE1_DISTRICTS)[number]

const STAGE1_SET = new Set<string>(DEPLOY_STAGE1_DISTRICTS)

/** 서울 25개 구 전체 노출 빌드. `npm run build` 시 `VITE_BROG_FULL_MAP=1` 등. */
export function isFullMapDeploy(): boolean {
  const v = String(import.meta.env.VITE_BROG_FULL_MAP ?? '')
    .trim()
    .toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

/** 1단계 배포: 구 선택·노출을 위 6개로 한정. */
export function isStage1LimitedDistricts(): boolean {
  return !isFullMapDeploy()
}

export const STAGE1_DEFAULT_DISTRICT: DeployStage1District = '마포구'

export function clampStage1District(district: string): string {
  if (!isStage1LimitedDistricts()) return district
  if (STAGE1_SET.has(district)) return district
  return STAGE1_DEFAULT_DISTRICT
}

/** BroG 홈·지도·리스트 구 셀렉트 */
export function brogDistrictOptionsForUi(): readonly string[] {
  if (!isStage1LimitedDistricts()) return [...seoulDistricts]
  return [...DEPLOY_STAGE1_DISTRICTS]
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
