import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { ACCESS_TOKEN_KEY } from '../api/auth'
import { uploadCommunityImage } from '../api/community'
import {
  createSponsorPost,
  fetchSponsorPost,
  SPONSOR_MAX_IMAGES,
  updateSponsorPost,
  type SponsorPost,
} from '../api/sponsors'
import { ManageFormLocationMapSection } from '../components/ManageFormLocationMapSection'
import { normalizeFreeShareImageUrls } from '../lib/freeShareImages'
import { runManageFormKakaoPlaceSearch } from '../lib/manageFormKakaoPlaceSearch'
import { mapGeoHintMessage } from '../lib/mapGeoHint'
import { geolocationFailureMessage, requestGeolocation } from '../lib/requestGeolocation'
import { resolveCoordAddressForManageForm } from '../lib/resolveSeoulDistrictFromCoords'

export function SponsorWritePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editRaw = searchParams.get('edit')?.trim() || ''
  const editId = useMemo(() => {
    const n = Number.parseInt(editRaw, 10)
    return Number.isFinite(n) && n > 0 ? n : null
  }, [editRaw])
  const fileRef = useRef<HTMLInputElement>(null)
  const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null

  const [existing, setExisting] = useState<SponsorPost | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loadBusy, setLoadBusy] = useState(Boolean(editId))

  const [title, setTitle] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [body, setBody] = useState('')
  const [accent, setAccent] = useState('#c9a227')
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [externalUrl, setExternalUrl] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploadBusy, setUploadBusy] = useState(false)

  const [mapLocateBusy, setMapLocateBusy] = useState(false)
  const [coordPickHint, setCoordPickHint] = useState('')
  const [managePlaceQuery, setManagePlaceQuery] = useState('')
  const [managePlaceBusy, setManagePlaceBusy] = useState(false)
  const [managePlaceHint, setManagePlaceHint] = useState('')

  useEffect(() => {
    if (!editId || !token?.trim()) {
      setExisting(null)
      setLoadBusy(false)
      setLoadError(editId && !token?.trim() ? '로그인 후 수정할 수 있습니다.' : '')
      return
    }
    let cancelled = false
    setLoadBusy(true)
    setLoadError('')
    void fetchSponsorPost(editId)
      .then((p) => {
        if (cancelled) return
        setExisting(p)
        setTitle(p.title)
        setExcerpt(p.excerpt)
        setBody(p.body)
        setAccent(p.accent || '#c9a227')
        setImageUrls([...p.image_urls])
        setExternalUrl(p.external_url ?? '')
        setLatitude(p.latitude ?? null)
        setLongitude(p.longitude ?? null)
        setCoordPickHint('')
        setManagePlaceHint('')
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : '글을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) setLoadBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [editId, token])

  const urlsNorm = useMemo(
    () => normalizeFreeShareImageUrls(imageUrls).slice(0, SPONSOR_MAX_IMAGES),
    [imageUrls],
  )
  const room = SPONSOR_MAX_IMAGES - urlsNorm.length

  const onMapPickUserLocation = useCallback(async (lat: number, lng: number) => {
    const latR = Number(lat.toFixed(6))
    const lngR = Number(lng.toFixed(6))
    setLatitude(latR)
    setLongitude(lngR)
    const r = await resolveCoordAddressForManageForm(latR, lngR)
    const hintParts: string[] = []
    if (r.addressLine) hintParts.push(r.addressLine)
    hintParts.push(mapGeoHintMessage(r.reason, r.districtName))
    setCoordPickHint(hintParts.filter(Boolean).join(' · '))
  }, [])

  const onMapLocateGps = useCallback(async () => {
    if (!navigator.geolocation) {
      setCoordPickHint('이 브라우저에서는 위치를 사용할 수 없습니다.')
      return
    }
    setMapLocateBusy(true)
    setCoordPickHint('위치 확인 중…')
    try {
      const c = await requestGeolocation()
      await onMapPickUserLocation(c.latitude, c.longitude)
    } catch (e) {
      setCoordPickHint(geolocationFailureMessage(e))
    } finally {
      setMapLocateBusy(false)
    }
  }, [onMapPickUserLocation])

  const handleManagePlaceSearch = useCallback(async () => {
    await runManageFormKakaoPlaceSearch(managePlaceQuery, {
      setBusy: setManagePlaceBusy,
      setHint: setManagePlaceHint,
      onResolvedLatLng: onMapPickUserLocation,
    })
  }, [managePlaceQuery, onMapPickUserLocation])

  async function handleFilesChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'))
    e.target.value = ''
    if (!files.length) return
    if (!token?.trim()) {
      setError('로그인이 필요합니다.')
      return
    }
    const cap = SPONSOR_MAX_IMAGES - normalizeFreeShareImageUrls(imageUrls).slice(0, SPONSOR_MAX_IMAGES).length
    if (cap <= 0) {
      setError(`이미지는 최대 ${SPONSOR_MAX_IMAGES}장까지입니다.`)
      return
    }
    setError('')
    setUploadBusy(true)
    try {
      const slice = files.slice(0, cap)
      const uploaded = await Promise.all(slice.map((f) => uploadCommunityImage(token, f)))
      setImageUrls((prev) => normalizeFreeShareImageUrls([...prev, ...uploaded]).slice(0, SPONSOR_MAX_IMAGES))
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드 실패')
    } finally {
      setUploadBusy(false)
    }
  }

  function addUrlRow() {
    if (normalizeFreeShareImageUrls(imageUrls).length >= SPONSOR_MAX_IMAGES) return
    setImageUrls((prev) => [...prev, ''])
  }

  function setUrlAt(i: number, v: string) {
    setImageUrls((prev) => prev.map((u, j) => (j === i ? v : u)))
  }

  function removeUrlAt(i: number) {
    setImageUrls((prev) => prev.filter((_, j) => j !== i))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!token?.trim()) {
      setError('로그인이 필요합니다.')
      return
    }
    if (!title.trim() || !body.trim()) {
      setError('제목과 본문은 필수입니다.')
      return
    }
    const lat = latitude
    const lng = longitude
    if ((lat == null) !== (lng == null)) {
      setError('위도·경도는 둘 다 입력하거나 둘 다 비워 주세요.')
      return
    }
    setBusy(true)
    try {
      const payload = {
        title: title.trim(),
        excerpt: excerpt.trim() || title.trim().slice(0, 120),
        body: body.trim(),
        accent,
        image_urls: normalizeFreeShareImageUrls(imageUrls).slice(0, SPONSOR_MAX_IMAGES),
        external_url: externalUrl.trim() || null,
        latitude: lat,
        longitude: lng,
      }
      const row = existing
        ? await updateSponsorPost(token, existing.id, payload)
        : await createSponsorPost(token, payload)
      navigate(`/sponsor/view/${row.id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  if (loadBusy) {
    return (
      <div className="home-layout home-layout--hub app-route-hub sponsor-hub">
        <div className="brog-screen brog-screen--list">
          <p className="helper">불러오는 중…</p>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="home-layout home-layout--hub app-route-hub sponsor-hub">
        <div className="brog-screen brog-screen--list">
          <p className="error">{loadError}</p>
          <Link className="ghost-button" to="/sponsor">
            목록
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="home-layout home-layout--hub app-route-hub sponsor-hub">
      <div className="brog-screen brog-screen--list">
        <header className="brog-screen__header">
          <div>
            <p className="eyebrow">SPON · 스폰서</p>
            <h1 className="brog-screen__title">{existing ? '스폰서 글 수정' : '스폰서 글 등록'}</h1>
            <p className="description">
              서버에 저장됩니다. 등록·수정·삭제는 최종 관리자만 가능합니다. 대표 이미지는 URL·파일 합쳐 최대 {SPONSOR_MAX_IMAGES}
              장. 목록 거리 정렬용 좌표는 지도·장소 검색 또는 수동 입력으로 선택할 수 있습니다.
            </p>
          </div>
          <div className="brog-screen__header-actions">
            <Link className="ghost-button" to="/sponsor">
              목록
            </Link>
          </div>
        </header>

        <section className="brog-list-body brog-brog-manage-form" aria-label="스폰서 작성 폼">
          <form className="form brog-manage-form sponsor-write-form" onSubmit={(e) => void onSubmit(e)}>
            <label className="brog-manage-form__name-field brog-manage-form__name-field--block">
              제목
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
            </label>
            <label className="brog-manage-form__name-field brog-manage-form__name-field--block">
              한 줄 요약 (목록 카드용)
              <input value={excerpt} onChange={(e) => setExcerpt(e.target.value)} maxLength={300} />
            </label>
            <label className="brog-manage-form__name-field brog-manage-form__name-field--block">
              본문
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} maxLength={12000} required />
            </label>
            <label className="sponsor-write-form__color">
              밴드 포인트 컬러
              <span className="sponsor-write-form__color-row">
                <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} aria-label="포인트 컬러" />
                <input
                  className="sponsor-write-form__color-text"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  maxLength={32}
                  spellCheck={false}
                />
              </span>
            </label>

            <div className="brog-manage-form__photos-block brog-manage-form__photos-block--faq">
              <span className="brog-manage-form__photos-label" id="sponsor-write-images-label">
                대표 이미지 (파일·URL 합쳐 최대 {SPONSOR_MAX_IMAGES}장)
              </span>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                className="visually-hidden"
                aria-hidden
                onChange={handleFilesChange}
              />
              <div className="brog-manage-form__photo-toolbar" aria-labelledby="sponsor-write-images-label">
                <button
                  type="button"
                  className="brog-manage-icon-btn"
                  title="파일에서 추가"
                  aria-label="파일에서 추가"
                  disabled={uploadBusy || room <= 0}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploadBusy ? (
                    <span className="brog-manage-icon-btn__spinner" aria-hidden />
                  ) : (
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.5-4.5a2 2 0 0 1 2.8 0L15 16" />
                      <circle cx="9" cy="8" r="1.5" fill="currentColor" stroke="none" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 5h6M19 2v6" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 19V5a2 2 0 0 1 2-2h7" />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  className="brog-manage-icon-btn"
                  title="URL 줄 추가"
                  aria-label="URL 줄 추가"
                  disabled={room <= 0}
                  onClick={addUrlRow}
                >
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1"
                    />
                  </svg>
                </button>
                <span className="brog-manage-form__photo-count" aria-live="polite">
                  {urlsNorm.length}/{SPONSOR_MAX_IMAGES}
                </span>
              </div>
              {imageUrls.length > 0 ? (
                <ul className="brog-manage-form__photo-url-list">
                  {imageUrls.map((url, i) => (
                    <li key={`spon-img-${i}`} className="brog-manage-form__photo-url-row">
                      <span className="brog-manage-form__photo-url-index" aria-hidden>
                        {i + 1}.
                      </span>
                      <input
                        className="brog-manage-form__photo-url-input"
                        value={url}
                        onChange={(e) => setUrlAt(i, e.target.value)}
                        placeholder="https://… 또는 /uploads/…"
                        maxLength={500}
                        aria-label={`이미지 URL ${i + 1}`}
                      />
                      <button type="button" className="compact-link" onClick={() => removeUrlAt(i)}>
                        삭제
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <ManageFormLocationMapSection
              sectionTitle="목록 거리 정렬용 위치 (BroG와 동일 지도)"
              managePlaceQuery={managePlaceQuery}
              setManagePlaceQuery={setManagePlaceQuery}
              managePlaceBusy={managePlaceBusy}
              managePlaceHint={managePlaceHint}
              setManagePlaceHint={setManagePlaceHint}
              onManagePlaceSearch={handleManagePlaceSearch}
              userCoords={latitude != null && longitude != null ? { lat: latitude, lng: longitude } : null}
              mapLocateBusy={mapLocateBusy}
              onMyLocationClick={() => void onMapLocateGps()}
              onPickUserLocationOnMap={(la, ln) => void onMapPickUserLocation(la, ln)}
              getDetailPath={(_id) => '/sponsor/write'}
              mapAriaLabel="SPON 위치 선택 지도"
              coordPickHint={coordPickHint}
              latitude={latitude}
              longitude={longitude}
              onLatitudeChange={setLatitude}
              onLongitudeChange={setLongitude}
            />

            <label className="brog-manage-form__name-field brog-manage-form__name-field--block">
              외부 링크 (선택)
              <input
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://…"
                maxLength={800}
                spellCheck={false}
              />
            </label>
            {error ? <p className="error">{error}</p> : null}
            <button type="submit" disabled={busy}>
              {busy ? '저장 중…' : existing ? '저장' : '등록'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
