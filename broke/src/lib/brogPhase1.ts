/**
 * 1단계 배포(서울 25개 구) — 상세는 `deployStage1.ts`.
 * 레거시 이름(`isBrogPhase1Restricted` 등)은 호환용 별칭으로 유지.
 */
export {
  BROG_DISTRICT_ALL,
  STAGE1_DEFAULT_DISTRICT as BROG_PHASE1_DISTRICT,
  brogDistrictOptionsForUi,
  clampStage1District as clampBrogDistrictForPhase1,
  isBrogAllDistrictsSelection,
  isFullMapDeploy,
  parseBrogDistrictUrlParam,
  isStage1LimitedDistricts as isBrogPhase1Restricted,
} from './deployStage1'

/** 1단계에서도 구 안의 BroG 전체를 노출한다(구 범위는 deployStage1). */
export function filterPhase1BrogRestaurants<T>(rows: T[]): T[] {
  return rows
}
