import { KAKAO_REST_API_KEY } from '../api/config'
import { fetchKakaoKeywordFirstPlace } from './kakaoKeywordSearch'

export type ManageFormKakaoPlaceSearchCallbacks = {
  setBusy: (v: boolean) => void
  setHint: (s: string) => void
  onResolvedLatLng: (lat: number, lng: number) => void | Promise<void>
}

/** BroG 매장 등록·MyG·SPON 등 `ManageFormLocationMapSection` 지명 검색 — `api/config`의 `KAKAO_REST_API_KEY` (= broke/.env `VITE_KAKAO_REST_API_KEY`). */
export async function runManageFormKakaoPlaceSearch(
  rawQuery: string,
  cbs: ManageFormKakaoPlaceSearchCallbacks,
): Promise<void> {
  const q = rawQuery.trim()
  if (!q) {
    cbs.setHint('검색할 지명을 입력해 주세요.')
    return
  }
  if (!KAKAO_REST_API_KEY.trim()) {
    cbs.setHint('지명 검색에는 broke/.env 의 VITE_KAKAO_REST_API_KEY 가 필요합니다.')
    return
  }
  cbs.setBusy(true)
  cbs.setHint('')
  try {
    const p = await fetchKakaoKeywordFirstPlace(q)
    if (!p) {
      cbs.setHint('일치하는 장소를 찾지 못했습니다.')
      return
    }
    await cbs.onResolvedLatLng(p.lat, p.lng)
    cbs.setHint(`「${p.placeName}」 위치로 맞췄습니다.`)
  } catch (e) {
    cbs.setHint(e instanceof Error ? e.message : '장소 검색에 실패했습니다.')
  } finally {
    cbs.setBusy(false)
  }
}
