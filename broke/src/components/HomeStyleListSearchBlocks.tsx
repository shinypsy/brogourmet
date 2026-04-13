import { KAKAO_REST_API_KEY } from '../api/config'

export type HomeStyleListSearchVariant = 'brog' | 'myg'

type HomeStyleListToolbarGeoProps = {
  latInput: string
  setLatInput: (v: string) => void
  lngInput: string
  setLngInput: (v: string) => void
  coordApplyError: string
  handleApplyManualCoords: () => void
  geoBusy: boolean
  myLocationFromDevice: () => void
}

/** 홈 `MapPageBody` 툴바의 좌표 입력·GPS 블록과 동일 마크업 */
export function HomeStyleListToolbarGeo({
  latInput,
  setLatInput,
  lngInput,
  setLngInput,
  coordApplyError,
  handleApplyManualCoords,
  geoBusy,
  myLocationFromDevice,
}: HomeStyleListToolbarGeoProps) {
  return (
    <div className="map-page-toolbar__geo">
      <div
        className="home-hub__coord-edit map-page__coord-edit"
        aria-label="위도 경도 직접 입력"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void handleApplyManualCoords()
          }
        }}
      >
        <div className="home-hub__coord-row map-page-toolbar__coord-row">
          <label className="home-hub__coord-field">
            위도
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              className="home-hub__coord-input"
              value={latInput}
              onChange={(e) => setLatInput(e.target.value)}
              placeholder="예: 37.56650"
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
              value={lngInput}
              onChange={(e) => setLngInput(e.target.value)}
              placeholder="예: 126.97800"
              aria-label="경도"
            />
          </label>
          <button type="button" className="home-hub__coord-apply" onClick={() => void handleApplyManualCoords()}>
            좌표 적용
          </button>
          {navigator.geolocation ? (
            <button
              type="button"
              className="map-page-toolbar__geo-icon-btn"
              disabled={geoBusy}
              title="위치 다시 받기"
              aria-label={geoBusy ? '위치 받는 중' : '위치 다시 받기'}
              onClick={() => void myLocationFromDevice()}
            >
              <span className="map-page-toolbar__geo-icon-btn-inner" aria-hidden>
                {geoBusy ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" className="map-page-toolbar__geo-spinner">
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeDasharray="42"
                      strokeLinecap="round"
                      opacity="0.35"
                    />
                    <path
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      d="M12 3a9 9 0 0 1 9 9"
                    />
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path
                      strokeLinecap="round"
                      d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
                    />
                  </svg>
                )}
              </span>
            </button>
          ) : null}
        </div>
        {coordApplyError ? <p className="error home-hub__coord-error">{coordApplyError}</p> : null}
      </div>
    </div>
  )
}

type HomeStyleListMapSearchCardProps = {
  variant: HomeStyleListSearchVariant
  mapPlaceQuery: string
  setMapPlaceQuery: (v: string) => void
  placeSearchBusy: boolean
  placeSearchHint: string
  setPlaceSearchHint: (v: string) => void
  handlePlaceSearchSubmit: () => void
  mapBroSearchQuery: string
  setMapBroSearchQuery: (v: string) => void
  broSearchTrimmed: string
  visibleMatchCount: number
  listTotalCount: number
}

/** 홈 지도 섹션의 장소·글 이중 검색과 동일 마크업(지도 제외) */
export function HomeStyleListMapSearchCard({
  variant,
  mapPlaceQuery,
  setMapPlaceQuery,
  placeSearchBusy,
  placeSearchHint,
  setPlaceSearchHint,
  handlePlaceSearchSubmit,
  mapBroSearchQuery,
  setMapBroSearchQuery,
  broSearchTrimmed,
  visibleMatchCount,
  listTotalCount,
}: HomeStyleListMapSearchCardProps) {
  const broLabel = variant === 'myg' ? 'MyG 글 검색' : 'BroG 글 검색'
  const ariaBro = variant === 'myg' ? 'MyG 상호·본문·작성자 검색' : 'BroG 상호·등록자 닉네임·메뉴·소개 검색'

  return (
    <section className="map-page-map-section map-card home-style-list-search-card" aria-label="장소·글 검색">
      <h3 className="map-page-map-section__title">장소·글 검색</h3>
      <div className="map-page-map-search map-page-map-search--dual" aria-label={broLabel}>
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
              value={mapPlaceQuery}
              disabled={placeSearchBusy}
              onChange={(e) => {
                setMapPlaceQuery(e.target.value)
                if (placeSearchHint) setPlaceSearchHint('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handlePlaceSearchSubmit()
                }
              }}
              aria-label="장소 또는 지명 검색"
            />
            <button
              type="button"
              className="map-page-map-search__action"
              disabled={placeSearchBusy || !mapPlaceQuery.trim() || !KAKAO_REST_API_KEY.trim()}
              onClick={() => void handlePlaceSearchSubmit()}
            >
              {placeSearchBusy ? '찾는 중…' : '이 위치로'}
            </button>
          </div>
          {!KAKAO_REST_API_KEY.trim() ? (
            <p className="map-page-map-search__helper map-page-map-search__helper--warn">
              장소 검색: <code>VITE_KAKAO_REST_API_KEY</code>를 넣으면 카카오 키워드 검색으로 이동할 수 있습니다.
            </p>
          ) : null}
          {placeSearchHint ? (
            <p
              className={
                placeSearchHint.includes('실패') ||
                placeSearchHint.includes('못했') ||
                placeSearchHint.includes('필요') ||
                placeSearchHint.includes('확인') ||
                placeSearchHint.includes('못 찾')
                  ? 'map-page-map-search__helper map-page-map-search__helper--warn'
                  : 'map-page-map-search__helper map-page-map-search__helper--ok'
              }
            >
              {placeSearchHint.includes('맞췄습니다') ? (
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
              {placeSearchHint}
            </p>
          ) : null}
        </div>
        <div className="map-page-map-search__field map-page-map-search__field--bro">
          <div className="map-page-map-search__label-row">
            <span className="map-page-map-search__label-text">{broLabel}</span>
            {broSearchTrimmed ? (
              <span
                className={
                  visibleMatchCount > 0
                    ? 'map-page-map-search__bro-badge map-page-map-search__bro-badge--ok'
                    : listTotalCount > 0
                      ? 'map-page-map-search__bro-badge map-page-map-search__bro-badge--warn'
                      : 'map-page-map-search__bro-badge'
                }
                title="현재 불러온 목록 기준 필터 결과(공백 무시·토큰 AND)"
              >
                {visibleMatchCount > 0 ? (
                  <svg
                    className="map-page-map-search__status-icon"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : (
                  <svg
                    className="map-page-map-search__status-icon"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M8 8l8 8M16 8l-8 8" />
                  </svg>
                )}
                {visibleMatchCount > 0
                  ? `${visibleMatchCount}곳 일치`
                  : listTotalCount > 0
                    ? '일치 없음'
                    : '목록 없음'}
              </span>
            ) : null}
          </div>
          <div className="map-page-map-search__row">
            <input
              type="text"
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
              className="map-page-map-search__input map-page-map-search__input--bro"
              placeholder={
                variant === 'myg'
                  ? '상호·제목·본문·닉네임·메뉴·구 — 공백으로 AND'
                  : '상호·닉네임·메뉴·소개·구·시 — 공백으로 AND(상호 내 공백 무시)'
              }
              value={mapBroSearchQuery}
              onChange={(e) => setMapBroSearchQuery(e.target.value)}
              aria-label={ariaBro}
            />
            {broSearchTrimmed ? (
              <button
                type="button"
                className="map-page-map-search__clear map-page-map-search__clear--inline"
                onClick={() => setMapBroSearchQuery('')}
              >
                지우기
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
