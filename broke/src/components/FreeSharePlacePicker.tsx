import { type ReactNode, useCallback, useId, useState } from 'react'

import { KAKAO_MAP_APP_KEY, KAKAO_REST_API_KEY } from '../api/config'
import { BrogKakaoMap } from './BrogKakaoMap'
import { fetchKakaoKeywordFirstPlace } from '../lib/kakaoKeywordSearch'
import { geolocationFailureMessage, requestGeolocation } from '../lib/requestGeolocation'
import { resolveCoordAddressForManageForm } from '../lib/resolveSeoulDistrictFromCoords'

export type FreeSharePlacePickerProps = {
  mode?: 'edit' | 'view'
  latitude: number | null
  longitude: number | null
  placeLabel: string
  onPlaceChange?: (lat: number | null, lng: number | null, label: string) => void
  /** 좌표로 서울 구가 확정될 때만(`ok`) API `district`에 넣을 구 이름. 장소 지우면 `null`. */
  onDistrictResolved?: (district: string | null) => void
  /** 상세 글 ID — 보기 모드 지도의 `getDetailPath`용 */
  detailPostId?: number
  pickHint?: ReactNode
  /** 바깥에 `map-page-map-section__title` 등이 있을 때 시각적 캡션 중복 방지(스크린리더용 캡션은 유지) */
  hideTableCaption?: boolean
}

const DEFAULT_PICK_HINT = (
  <>
    지도를 <strong>길게 누르거나</strong> <strong>우클릭</strong>하면 그 지점을 <strong>나눔 장소</strong>로 저장합니다. (드래그하면
    취소)
  </>
)

export function FreeSharePlacePicker({
  mode = 'edit',
  latitude,
  longitude,
  placeLabel,
  onPlaceChange,
  onDistrictResolved,
  detailPostId,
  pickHint,
  hideTableCaption = false,
}: FreeSharePlacePickerProps) {
  const [placeQuery, setPlaceQuery] = useState('')
  const [placeBusy, setPlaceBusy] = useState(false)
  const [placeHint, setPlaceHint] = useState('')
  const [mapLocateBusy, setMapLocateBusy] = useState(false)
  const viewSectionTitleId = useId()

  const applyCoords = useCallback(
    async (lat: number, lng: number, searchName?: string) => {
      const latR = Number(lat.toFixed(6))
      const lngR = Number(lng.toFixed(6))
      const r = await resolveCoordAddressForManageForm(latR, lngR)
      const labelFromApi = (r.addressLine || '').trim().slice(0, 200)
      const fromSearch = (searchName ?? '').trim().slice(0, 200)
      const label = (fromSearch || labelFromApi).slice(0, 200)
      onPlaceChange?.(latR, lngR, label)
      onDistrictResolved?.(r.reason === 'ok' ? r.districtName.trim() : null)
      const parts: string[] = []
      if (label) parts.push(label)
      setPlaceHint(parts.join(' · ') || '위치를 저장했습니다.')
    },
    [onPlaceChange, onDistrictResolved],
  )

  const handleSearch = useCallback(async () => {
    if (mode !== 'edit' || !onPlaceChange) return
    const q = placeQuery.trim()
    if (!q) {
      setPlaceHint('검색할 지명을 입력해 주세요.')
      return
    }
    if (!KAKAO_REST_API_KEY.trim()) {
      setPlaceHint('장소 검색에는 broke/.env 의 VITE_KAKAO_REST_API_KEY 가 필요합니다.')
      return
    }
    setPlaceBusy(true)
    setPlaceHint('')
    try {
      const p = await fetchKakaoKeywordFirstPlace(q)
      if (!p) {
        setPlaceHint('일치하는 장소를 찾지 못했습니다.')
        return
      }
      await applyCoords(p.lat, p.lng, p.placeName)
      setPlaceHint(`「${p.placeName}」 위치로 맞췄습니다.`)
    } catch (e) {
      setPlaceHint(e instanceof Error ? e.message : '장소 검색에 실패했습니다.')
    } finally {
      setPlaceBusy(false)
    }
  }, [mode, onPlaceChange, placeQuery, applyCoords])

  const onMapLocateGps = useCallback(async () => {
    if (mode !== 'edit' || !onPlaceChange) return
    if (!navigator.geolocation) {
      setPlaceHint('이 브라우저에서는 위치를 사용할 수 없습니다.')
      return
    }
    setMapLocateBusy(true)
    setPlaceHint('위치 확인 중…')
    try {
      const c = await requestGeolocation()
      await applyCoords(c.latitude, c.longitude)
    } catch (e) {
      setPlaceHint(geolocationFailureMessage(e))
    } finally {
      setMapLocateBusy(false)
    }
  }, [mode, onPlaceChange, applyCoords])

  const detailPath = detailPostId != null ? `/free-share/${detailPostId}` : '/free-share/write'

  const captionClass = hideTableCaption ? 'visually-hidden' : 'free-share-place-table__caption'
  const viewHeadingClass = hideTableCaption ? 'visually-hidden' : 'free-share-place-view__heading'

  if (mode === 'view') {
    if (latitude == null || longitude == null) {
      return (
        <section className="free-share-place-view" aria-labelledby={viewSectionTitleId}>
          <h3 id={viewSectionTitleId} className={viewHeadingClass}>
            나눔 장소
          </h3>
          <p className="free-share-place-view__empty">등록된 나눔 장소가 없습니다.</p>
        </section>
      )
    }
    return (
      <section className="free-share-place-view" aria-labelledby={viewSectionTitleId}>
        <h3 id={viewSectionTitleId} className={viewHeadingClass}>
          나눔 장소
        </h3>
        <div className="free-share-place-view__coords">
          <span className="free-share-place-view__coords-label">저장된 위치</span>
          <p className="free-share-place-view__saved">{placeLabel || `${latitude}, ${longitude}`}</p>
        </div>
        <div className="free-share-place-view__map-wrap">
          {KAKAO_MAP_APP_KEY ? (
            <BrogKakaoMap
              userCoords={{ lat: latitude, lng: longitude }}
              pins={[]}
              locating={false}
              onMyLocationClick={() => {}}
              getDetailPath={() => detailPath}
              mapAriaLabel="무료나눔 나눔 장소"
              shellClassName="kakao-map-embed"
              canvasClassName="kakao-map-container kakao-map-container--below"
              showInteractionHints={false}
            />
          ) : null}
        </div>
      </section>
    )
  }

  return (
    <table className="free-share-place-table">
      <caption className={captionClass}>나눔장소</caption>
      <tbody>
        <tr>
          <th scope="row">장소 검색</th>
          <td>
            <div className="free-share-place-table__search-row">
              <input
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                spellCheck={false}
                className="free-share-place-table__search-input"
                placeholder="예: 홍대입구역, 망원동"
                value={placeQuery}
                disabled={placeBusy}
                onChange={(e) => {
                  setPlaceQuery(e.target.value)
                  if (placeHint) setPlaceHint('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void handleSearch()
                  }
                }}
                aria-label="장소·지명 검색"
              />
              <button
                type="button"
                className="free-share-place-table__search-btn"
                disabled={placeBusy || !placeQuery.trim() || !KAKAO_REST_API_KEY.trim()}
                onClick={() => void handleSearch()}
              >
                {placeBusy ? '찾는 중…' : '이 위치로'}
              </button>
            </div>
            {placeHint ? (
              <p
                className={`helper free-share-place-table__hint${
                  placeHint.includes('실패') || placeHint.includes('못') || placeHint.includes('필요') ? ' free-share-place-table__hint--warn' : ''
                }`}
                role="status"
              >
                {placeHint}
              </p>
            ) : null}
          </td>
        </tr>
        <tr>
          <th scope="row">저장된 위치</th>
          <td>
            {latitude != null && longitude != null ? (
              <>
                <p className="free-share-place-table__saved">{placeLabel || `${latitude}, ${longitude}`}</p>
                <button
                  type="button"
                  className="compact-link"
                  onClick={() => {
                    onPlaceChange?.(null, null, '')
                    onDistrictResolved?.(null)
                    setPlaceHint('나눔 장소를 지웠습니다.')
                  }}
                >
                  나눔장소 지우기
                </button>
              </>
            ) : (
              <span className="muted" aria-hidden>
                —
              </span>
            )}
          </td>
        </tr>
        <tr>
          <th scope="row">지도</th>
          <td className="free-share-place-table__map-cell">
            {KAKAO_MAP_APP_KEY ? (
              <BrogKakaoMap
                userCoords={latitude != null && longitude != null ? { lat: latitude, lng: longitude } : null}
                pins={[]}
                locating={mapLocateBusy}
                onMyLocationClick={() => void onMapLocateGps()}
                onPickUserLocationOnMap={(la, ln) => void applyCoords(la, ln)}
                pickLocationHint={pickHint ?? DEFAULT_PICK_HINT}
                getDetailPath={() => detailPath}
                mapAriaLabel="무료나눔 나눔 장소 선택 지도"
                shellClassName="kakao-map-embed"
              canvasClassName="kakao-map-container kakao-map-container--below"
              showInteractionHints={false}
            />
          ) : null}
          </td>
        </tr>
      </tbody>
    </table>
  )
}
