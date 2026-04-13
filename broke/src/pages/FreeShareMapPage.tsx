import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { AUTH_CHANGE_EVENT } from '../authEvents'
import { fetchFreeSharePosts, type FreeSharePost } from '../api/community'
import { KAKAO_MAP_APP_KEY } from '../api/config'
import { BrogKakaoMap, type BrogKakaoMapPin } from '../components/BrogKakaoMap'
import { HomeStyleListToolbarGeo } from '../components/HomeStyleListSearchBlocks'
import { useSeoulMapUserLocation } from '../hooks/useSeoulMapUserLocation'
import { FREE_SHARE_CATEGORY_LABELS, normalizeFreeShareCategory } from '../lib/freeShareCategory'

function normalizePost(p: FreeSharePost): FreeSharePost {
  return {
    ...p,
    share_completed: Boolean(p.share_completed),
    share_category: normalizeFreeShareCategory(p.share_category),
  }
}

function postLatLng(p: FreeSharePost): { lat: number; lng: number } | null {
  const lat = p.share_latitude
  const lng = p.share_longitude
  const la = lat == null ? NaN : typeof lat === 'number' ? lat : Number(lat)
  const ln = lng == null ? NaN : typeof lng === 'number' ? lng : Number(lng)
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null
  return { lat: la, lng: ln }
}

export function FreeShareMapPage() {
  const setDistrictNoop = useCallback(() => {}, [])
  const {
    geoBusy,
    mapUserCoords,
    latInput,
    setLatInput,
    lngInput,
    setLngInput,
    coordApplyError,
    handleApplyManualCoords,
    myLocationFromDevice,
    applyLatLng,
  } = useSeoulMapUserLocation(setDistrictNoop, {
    initialGeolocationSetsDistrict: false,
  })

  const [posts, setPosts] = useState<FreeSharePost[]>([])
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)

  const reloadPosts = useCallback(() => {
    setLoading(true)
    setLoadError('')
    fetchFreeSharePosts()
      .then((rows) => {
        setPosts(rows.map(normalizePost))
        setLoadError('')
      })
      .catch((e) => {
        setPosts([])
        setLoadError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    void reloadPosts()
  }, [reloadPosts])

  useEffect(() => {
    function onAuth() {
      void reloadPosts()
    }
    window.addEventListener(AUTH_CHANGE_EVENT, onAuth)
    return () => window.removeEventListener(AUTH_CHANGE_EVENT, onAuth)
  }, [reloadPosts])

  const pins: BrogKakaoMapPin[] = useMemo(() => {
    const out: BrogKakaoMapPin[] = []
    for (const p of posts) {
      if (p.share_completed) continue
      const ll = postLatLng(p)
      if (!ll) continue
      const cat = normalizeFreeShareCategory(p.share_category)
      out.push({
        id: p.id,
        title: p.title,
        latitude: ll.lat,
        longitude: ll.lng,
        href: `/free-share/${p.id}`,
        markerKind: 'freeShare',
        mapSpeechLabel: FREE_SHARE_CATEGORY_LABELS[cat],
      })
    }
    return out
  }, [posts])

  const onPickUserLocationOnMap = useCallback(
    (lat: number, lng: number) => {
      void applyLatLng(lat, lng)
    },
    [applyLatLng],
  )

  const onMapLocate = useCallback(() => {
    void myLocationFromDevice()
  }, [myLocationFromDevice])

  return (
    <div className="home-layout home-layout--hub home-layout--map-home app-route-hub">
      <div className="map-layout map-layout--brog brog-screen brog-screen--map">
        <header className="brog-screen__header">
          <div>
            <p className="eyebrow">Community · 무료나눔</p>
            <h1 className="brog-screen__title">나눔 지도</h1>
          </div>
          <div className="brog-screen__header-actions">
            <Link className="ghost-button" to="/free-share">
              목록
            </Link>
            <Link className="brog-screen__cta" to="/free-share/write">
              작성
            </Link>
          </div>
        </header>

        <div className="map-page-toolbar map-card">
          <HomeStyleListToolbarGeo
            latInput={latInput}
            setLatInput={setLatInput}
            lngInput={lngInput}
            setLngInput={setLngInput}
            coordApplyError={coordApplyError}
            handleApplyManualCoords={handleApplyManualCoords}
            geoBusy={geoBusy}
            myLocationFromDevice={myLocationFromDevice}
          />
        </div>

        <section className="map-page-map-section map-card">
          <h3 className="map-page-map-section__title">나눔 위치</h3>
          {loadError ? <p className="error">{loadError}</p> : null}
          {loading ? <p className="helper">목록 불러오는 중…</p> : null}
          {KAKAO_MAP_APP_KEY ? (
            <BrogKakaoMap
              userCoords={mapUserCoords}
              pins={pins}
              locating={geoBusy}
              onMyLocationClick={onMapLocate}
              onPickUserLocationOnMap={onPickUserLocationOnMap}
              autoRefitWhenPinsChange
              getDetailPath={(id) => `/free-share/${id}`}
              mapSpeechBubbles
              mapAriaLabel="무료나눔 위치 지도"
              shellClassName="kakao-map-embed"
              canvasClassName="kakao-map-container kakao-map-container--below"
              showInteractionHints={false}
            />
          ) : (
            <>
              <div className="placeholder-box">MAP</div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
