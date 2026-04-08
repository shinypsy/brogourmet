/**
 * 1단계 배포(6개 구 한정) — 상세는 `deployStage1.ts`.
 * 레거시 이름(`isBrogPhase1Restricted` 등)은 호환용 별칭으로 유지.
 */
export {
  STAGE1_DEFAULT_DISTRICT as BROG_PHASE1_DISTRICT,
  brogDistrictOptionsForUi,
  clampStage1District as clampBrogDistrictForPhase1,
  isFullMapDeploy,
  isStage1LimitedDistricts as isBrogPhase1Restricted,
} from './deployStage1'

/** 예전 시범 6곳 이름 필터는 제거됨. 1단계에서도 구 안의 BroG 전체를 노출한다. */
export function filterPhase1BrogRestaurants<T>(rows: T[]): T[] {
  return rows
}
