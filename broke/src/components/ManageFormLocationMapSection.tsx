import { KAKAO_MAP_APP_KEY, KAKAO_REST_API_KEY } from '../api/config'
import { BrogKakaoMap } from './BrogKakaoMap'

export type ManageFormLocationMapSectionProps = {
  managePlaceQuery: string
  setManagePlaceQuery: (v: string) => void
  managePlaceBusy: boolean
  managePlaceHint: string
  setManagePlaceHint: (v: string) => void
  onManagePlaceSearch: () => void | Promise<void>
  userCoords: { lat: number; lng: number } | null
  mapLocateBusy: boolean
  onMyLocationClick: () => void | Promise<void>
  onPickUserLocationOnMap: (lat: number, lng: number) => void | Promise<void>
  getDetailPath: (id: number) => string
  mapAriaLabel: string
  coordPickHint: string
  latitude: number | null
  longitude: number | null
  onLatitudeChange: (v: number | null) => void
  onLongitudeChange: (v: number | null) => void
  /** 기본: 위치 지도 */
  sectionTitle?: string
}

function parseCoordInput(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number(t.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function managePlaceHintClass(hint: string): string {
  const warn =
    hint.includes('실패') ||
    hint.includes('못했') ||
    hint.includes('필요') ||
    hint.includes('확인') ||
    hint.includes('못 찾')
  return warn
    ? 'map-page-map-search__helper map-page-map-search__helper--warn'
    : 'map-page-map-search__helper map-page-map-search__helper--ok'
}

/**
 * BroG/MyG 작성·수정 폼 — 홈 `MapPageBody`「위치 지도」와 동일 골격(map-card·장소 검색·kakao-map-embed·수동 위도·경도).
 */
export function ManageFormLocationMapSection({
  managePlaceQuery,
  setManagePlaceQuery,
  managePlaceBusy,
  managePlaceHint,
  setManagePlaceHint,
  onManagePlaceSearch,
  userCoords,
  mapLocateBusy,
  onMyLocationClick,
  onPickUserLocationOnMap,
  getDetailPath,
  mapAriaLabel,
  coordPickHint,
  latitude,
  longitude,
  onLatitudeChange,
  onLongitudeChange,
  sectionTitle = '위치 지도',
}: ManageFormLocationMapSectionProps) {
  const latStr =
    latitude == null || (typeof latitude === 'number' && Number.isNaN(latitude)) ? '' : String(latitude)
  const lngStr =
    longitude == null || (typeof longitude === 'number' && Number.isNaN(longitude)) ? '' : String(longitude)

  return (
    <div className="manage-form-map-stack map-layout map-layout--brog brog-screen brog-screen--map">
      <section className="map-page-map-section map-card manage-form-map-section" aria-label={sectionTitle}>
        <h3 className="map-page-map-section__title">{sectionTitle}</h3>
        <div className="map-page-map-search" aria-label="장소·지명 검색">
          <div className="map-page-map-search__field map-page-map-search__field--place">
            <span className="map-page-map-search__label-text">장소·지명</span>
            <div className="map-page-map-search__row">
              <input
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                spellCheck={false}
                className="map-page-map-search__input"
                placeholder="예: 홍대입구역, 망원동, 테헤란로"
                value={managePlaceQuery}
                disabled={managePlaceBusy}
                onChange={(e) => {
                  setManagePlaceQuery(e.target.value)
                  if (managePlaceHint) setManagePlaceHint('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void onManagePlaceSearch()
                  }
                }}
                aria-label="장소 또는 지명 검색"
              />
              <button
                type="button"
                className="map-page-map-search__action"
                disabled={managePlaceBusy || !managePlaceQuery.trim() || !KAKAO_REST_API_KEY.trim()}
                onClick={() => void onManagePlaceSearch()}
              >
                {managePlaceBusy ? '찾는 중…' : '이 위치로'}
              </button>
            </div>
            {managePlaceHint ? (
              <p className={managePlaceHintClass(managePlaceHint)} role="status">
                {managePlaceHint.includes('맞췄습니다') ? (
                  <span className="map-page-map-search__hint-ok-icon" aria-hidden>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                ) : null}
                {managePlaceHint}
              </p>
            ) : null}
          </div>
        </div>
        {KAKAO_MAP_APP_KEY ? (
          <BrogKakaoMap
            userCoords={userCoords}
            pins={[]}
            locating={mapLocateBusy}
            onMyLocationClick={() => void onMyLocationClick()}
            onPickUserLocationOnMap={(la, ln) => void onPickUserLocationOnMap(la, ln)}
            getDetailPath={getDetailPath}
            mapAriaLabel={mapAriaLabel}
            shellClassName="kakao-map-embed"
            canvasClassName="kakao-map-container kakao-map-container--below"
            showInteractionHints={false}
          />
        ) : null}
        {coordPickHint ? (
          <p className="helper manage-form-map-section__coord-status" role="status">
            {coordPickHint}
          </p>
        ) : null}
        <div
          className="home-hub__coord-edit map-page__coord-edit manage-form-map-section__manual-coords"
          aria-label="위도 경도 직접 입력"
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.preventDefault()
          }}
        >
          <div className="home-hub__coord-row map-page-toolbar__coord-row manage-form-map-section__coord-row--inline">
            <label className="home-hub__coord-field">
              위도
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                className="home-hub__coord-input"
                placeholder="예: 37.56650"
                value={latStr}
                onChange={(e) => onLatitudeChange(parseCoordInput(e.target.value))}
                aria-label="위도"
              />
            </label>
            <label className="home-hub__coord-field">
              경도
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                className="home-hub__coord-input"
                placeholder="예: 126.97800"
                value={lngStr}
                onChange={(e) => onLongitudeChange(parseCoordInput(e.target.value))}
                aria-label="경도"
              />
            </label>
          </div>
        </div>
      </section>
    </div>
  )
}
