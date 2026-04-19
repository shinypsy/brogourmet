/**
 * BroG / MyG 제품 관계 (dial 합의)
 *
 * 저장 장소·백엔드 엔드포인트는 다르고, 아이콘·라벨명·일부 기능만 다름.
 * UI·흐름·지도·위치 규칙은 쌍둥이(동일 골격)로 유지한다.
 * 한쪽 지도/목록 UX를 바꾸면 다른 쪽도 같은 원칙으로 맞출 것.
 *
 * @see MapPage · KnownRestaurantsMapPage · useSeoulMapUserLocation
 */

/** GPS·수동 입력·지도에서 기준점 잡기 — 양쪽 지도 상단·규칙 문구 공통 */
export const BROG_MYG_MAP_LOCATION_RULE =
  'GPS·수동 좌표 또는 지도에서 내 위치 지정(길게 누르기·우클릭)이 있으면'

/** 기준점이 있을 때 반경 설명(MAP_NEAR_RADIUS_M 와 문구 일치) */
export const BROG_MYG_MAP_NEAR_RADIUS_COPY = '그 기준점 주변 가까운 순(약 2km 이내)'

/** onMapViewSettled 제거 후 공통 — 드래그만으로 목록/순서 갱신 없음 */
export const BROG_MYG_MAP_DRAG_NO_LIST_CHANGE = '지도만 드래그해도 목록은 바뀌지 않습니다.'

/** 지도 섹션: 핀 의미(쌍둥이 중 유일하게 주어가 다른 부분) */
export function brogMygMapPinSubjectLine(isMyg: boolean): string {
  return isMyg ? '깃발은 좌표가 있는 MyG 글입니다.' : '깃발 마커는 등록된 음식점 위치입니다.'
}

/** 지도 섹션: 롱프레스·우클릭 후 목록 갱신 문장 끝 */
export function brogMygMapPickRefreshSuffix(isMyg: boolean): string {
  return isMyg ? '그 기준으로 목록이 갱신됩니다.' : '그 기준으로 맛집 목록이 갱신됩니다.'
}

/** 지도 섹션 힌트 한 덩어리(BroG/MyG 동일 골격) */
export function brogMygMapSectionHint(isMyg: boolean): string {
  return `${brogMygMapPinSubjectLine(isMyg)} 클릭 시 상세로 이동합니다. ${BROG_MYG_MAP_DRAG_NO_LIST_CHANGE} 길게 누르거나 우클릭해 그 지점을 내 위치로 잡으면 ${brogMygMapPickRefreshSuffix(isMyg)}`
}
