import { type CSSProperties, type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'

import { fetchSponsorPosts, type SponsorPost } from '../api/sponsors'
import { BrogRankGridCarousel } from '../components/BrogRankGridCarousel'
import { HomeStyleListToolbarGeo } from '../components/HomeStyleListSearchBlocks'
import { hexToRgba } from '../lib/hexRgba'
import { imgReferrerPolicyForResolvedSrc, resolveMediaUrl } from '../lib/mediaUrl'
import { geolocationFailureMessage, requestGeolocation } from '../lib/requestGeolocation'
import {
  brogDistrictOptionsForUi,
  clampBrogDistrictForPhase1,
  parseBrogDistrictUrlParam,
} from '../lib/brogPhase1'

function accentBandStyle(accent: string): CSSProperties {
  const a = accent.trim() || '#4a5568'
  return {
    background: `linear-gradient(105deg, ${hexToRgba(a, 0.35)} 0%, rgba(12, 16, 28, 0.94) 50%, rgba(12, 16, 28, 0.98) 100%)`,
    borderLeft: `3px solid ${a}`,
  }
}

function firstImageSrc(p: SponsorPost): string {
  const raw = p.image_urls[0] ?? null
  return raw ? resolveMediaUrl(raw) : ''
}

export function SponsorListPage() {
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const [toolbarMsg, setToolbarMsg] = useState('')
  const [geoBusy, setGeoBusy] = useState(false)
  const [coordApplyError, setCoordApplyError] = useState('')
  const [queryDraft, setQueryDraft] = useState(() => params.get('q') ?? '')
  const [latInput, setLatInput] = useState(() => params.get('lat') ?? '')
  const [lngInput, setLngInput] = useState(() => params.get('lng') ?? '')

  const [posts, setPosts] = useState<SponsorPost[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState('')

  const city = params.get('city') ?? '서울특별시'
  const districtUrlRaw = params.get('district')
  const district = clampBrogDistrictForPhase1(parseBrogDistrictUrlParam(districtUrlRaw))
  const brogDistrictOptions = useMemo(() => brogDistrictOptionsForUi(), [])

  const qApplied = params.get('q')?.trim() ?? ''
  const latRaw = params.get('lat')
  const lngRaw = params.get('lng')
  const latN = latRaw != null && latRaw !== '' ? Number.parseFloat(latRaw) : NaN
  const lngN = lngRaw != null && lngRaw !== '' ? Number.parseFloat(lngRaw) : NaN
  const sortLat = Number.isFinite(latN) ? latN : null
  const sortLng = Number.isFinite(lngN) ? lngN : null

  const setDistrict = useCallback(
    (gu: string) => {
      const next = clampBrogDistrictForPhase1(gu)
      setParams((prev) => {
        const p = new URLSearchParams(prev)
        p.set('city', city)
        p.set('district', next)
        return p
      }, { replace: true })
    },
    [city, setParams],
  )

  useEffect(() => {
    if ((districtUrlRaw ?? '') !== district) {
      setParams((prev) => {
        const p = new URLSearchParams(prev)
        p.set('city', city)
        p.set('district', district)
        return p
      }, { replace: true })
    }
  }, [city, districtUrlRaw, district, setParams])

  useEffect(() => {
    setQueryDraft(params.get('q') ?? '')
    setLatInput(params.get('lat') ?? '')
    setLngInput(params.get('lng') ?? '')
  }, [location.search])

  useEffect(() => {
    let cancelled = false
    setListLoading(true)
    setListError('')
    void fetchSponsorPosts({ q: qApplied, lat: sortLat, lng: sortLng })
      .then((rows) => {
        if (!cancelled) setPosts(rows)
      })
      .catch((e: unknown) => {
        if (!cancelled) setListError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) setListLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [qApplied, sortLat, sortLng])

  const carouselResetKey = `${qApplied}|${sortLat ?? ''}|${sortLng ?? ''}|${posts.map((p) => p.id).join(',')}`

  function commitQToUrl() {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      const qt = queryDraft.trim()
      if (qt) next.set('q', qt)
      else next.delete('q')
      return next
    }, { replace: true })
  }

  function onToolbarFormSubmit(e: FormEvent) {
    e.preventDefault()
    commitQToUrl()
  }

  function handleApplyManualCoords() {
    const lat = Number.parseFloat(latInput.trim().replace(',', '.'))
    const lng = Number.parseFloat(lngInput.trim().replace(',', '.'))
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setCoordApplyError('위도와 경도는 숫자로 입력해 주세요.')
      return
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setCoordApplyError('위도는 -90~90, 경도는 -180~180 범위여야 합니다.')
      return
    }
    setCoordApplyError('')
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('lat', String(lat))
      next.set('lng', String(lng))
      return next
    }, { replace: true })
  }

  async function myLocationFromDevice() {
    setToolbarMsg('')
    setGeoBusy(true)
    try {
      const c = await requestGeolocation()
      const la = Number(c.latitude.toFixed(5))
      const lo = Number(c.longitude.toFixed(5))
      setLatInput(String(la))
      setLngInput(String(lo))
      setCoordApplyError('')
      setParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('lat', String(la))
        next.set('lng', String(lo))
        return next
      }, { replace: true })
    } catch (err) {
      setToolbarMsg(geolocationFailureMessage(err))
    } finally {
      setGeoBusy(false)
    }
  }

  return (
    <div className="home-layout home-layout--hub app-route-hub sponsor-hub">
      <div className="brog-screen brog-screen--list">
        <header className="brog-screen__header sponsor-hub__header">
          <div>
            <p className="eyebrow">Sponsor · SPON</p>
            <h1 className="brog-screen__title">스폰서 스페이스</h1>
            <p className="description sponsor-hub__lead">
              4행·1열 스트립 + 페이지 넘김(한 슬라이드 4건). BroG 목록은 4×2(8건), SPON은 4행·1열(4건)로 구분됩니다. 검색·좌표로
              정렬이 바뀝니다.
            </p>
          </div>
          <div className="brog-screen__header-actions">
            <Link className="brog-screen__cta" to="/sponsor/write">
              글 작성
            </Link>
          </div>
        </header>

        <section className="brog-list-body sponsor-hub__list" aria-label="스폰서 목록">
          <p className="sponsor-hub__disclaimer">
            <span className="sponsor-hub__badge">스폰서 콘텐츠</span>
            서버에 저장된 스폰서 안내입니다. 등록·수정·삭제는 최종 관리자만 할 수 있습니다.
          </p>

          <div className="brog-list-body__map-stack map-layout map-layout--brog brog-screen--map">
            <form className="map-page-toolbar map-card" onSubmit={onToolbarFormSubmit}>
              <div className="map-page-toolbar__filters-row">
                <label className="price-filter map-page-toolbar__filter">
                  상호명
                  <input
                    type="text"
                    value={queryDraft}
                    onChange={(e) => setQueryDraft(e.target.value)}
                    onBlur={() => commitQToUrl()}
                    placeholder="제목·요약·본문"
                    maxLength={120}
                    spellCheck={false}
                    autoComplete="off"
                    aria-label="상호명 검색"
                  />
                </label>
                <label className="price-filter map-page-toolbar__filter">
                  서울시
                  <select value={district} onChange={(e) => setDistrict(e.target.value)}>
                    {brogDistrictOptions.map((gu) => (
                      <option key={gu} value={gu}>
                        {gu}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <HomeStyleListToolbarGeo
                latInput={latInput}
                setLatInput={setLatInput}
                lngInput={lngInput}
                setLngInput={setLngInput}
                coordApplyError={coordApplyError}
                handleApplyManualCoords={handleApplyManualCoords}
                geoBusy={geoBusy}
                myLocationFromDevice={() => void myLocationFromDevice()}
              />
            </form>
            <div className="sponsor-hub__toolbar-foot">
              <p className="helper sponsor-hub__toolbar-foot-hint">
                위도·경도가 모두 유효하면, 글에 저장된 좌표가 있는 항목을 <strong>가까운 순</strong>으로 정렬합니다. 좌표가 없는
                글은 뒤로 둡니다.
              </p>
            </div>
            {toolbarMsg ? <p className="helper sponsor-hub__toolbar-msg">{toolbarMsg}</p> : null}
          </div>

          {listError ? <p className="error">{listError}</p> : null}
          {listLoading ? <p className="helper">불러오는 중…</p> : null}
          {!listLoading && !listError && posts.length === 0 ? (
            <p className="helper">조건에 맞는 스폰서 글이 없습니다.</p>
          ) : null}
          {!listLoading && !listError && posts.length > 0 ? (
            <BrogRankGridCarousel
              items={posts}
              pageSize={4}
              resetKey={carouselResetKey}
              getItemKey={(p) => p.id}
              renderPage={(page) => (
                <ul className="sponsor-strip-page" aria-label="스폰서 카드 4행 1열 한 페이지">
                  {page.map((p) => {
                    const imgSrc = firstImageSrc(p)
                    const refPolicy = imgReferrerPolicyForResolvedSrc(imgSrc)
                    return (
                      <li key={p.id} className="sponsor-strip-card" style={accentBandStyle(p.accent)}>
                        <div className="sponsor-strip-card__visual">
                          {imgSrc ? (
                            <img
                              className="sponsor-strip-card__img"
                              src={imgSrc}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              referrerPolicy={refPolicy}
                            />
                          ) : (
                            <div className="sponsor-strip-card__img sponsor-strip-card__img--empty" aria-hidden>
                              —
                            </div>
                          )}
                        </div>
                        <div className="sponsor-strip-card__body">
                          <span className="sponsor-hub__badge sponsor-hub__badge--inline">스폰서</span>
                          <h2 className="sponsor-strip-card__title">{p.title}</h2>
                          <p className="sponsor-strip-card__excerpt">{p.excerpt}</p>
                          <div className="sponsor-strip-card__links">
                            <Link className="compact-link" to={`/sponsor/view/${p.id}`}>
                              자세히
                            </Link>
                            {p.external_url ? (
                              <a
                                className="compact-link"
                                href={p.external_url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                외부
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
              ariaLabel="스폰서 스트립, 4행 1열·한 슬라이드 4건"
            />
          ) : null}
        </section>
      </div>
    </div>
  )
}
