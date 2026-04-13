import { type ChangeEvent, type FormEvent, useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ACCESS_TOKEN_KEY } from '../api/auth'
import { createFreeSharePost, uploadCommunityImage } from '../api/community'
import { KAKAO_REST_API_KEY } from '../api/config'
import { ManageFormLocationMapSection } from '../components/ManageFormLocationMapSection'
import { coordsFieldsBothEmpty, readGpsFromImageFile } from '../lib/imageExifGps'
import { fetchKakaoKeywordFirstPlace } from '../lib/kakaoKeywordSearch'
import {
  FREE_SHARE_CATEGORY_LABELS,
  FREE_SHARE_CATEGORY_VALUES,
  type FreeShareCategoryValue,
} from '../lib/freeShareCategory'
import { FREE_SHARE_MAX_IMAGES, normalizeFreeShareImageUrls } from '../lib/freeShareImages'
import { mapGeoHintMessage } from '../lib/mapGeoHint'
import { geolocationFailureMessage, requestGeolocation } from '../lib/requestGeolocation'
import { resolveCoordAddressForManageForm } from '../lib/resolveSeoulDistrictFromCoords'

export function FreeShareWritePage() {
  const navigate = useNavigate()
  const freeImageInputRef = useRef<HTMLInputElement>(null)
  const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [shareCategory, setShareCategory] = useState<FreeShareCategoryValue>('other')
  const [mapCoords, setMapCoords] = useState<{ latitude: number | null; longitude: number | null }>({
    latitude: null,
    longitude: null,
  })
  const [resolvedDistrict, setResolvedDistrict] = useState<string | null>(null)
  const [sharePlaceLabel, setSharePlaceLabel] = useState('')

  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [freeImageBusy, setFreeImageBusy] = useState(false)
  const [exifGpsHint, setExifGpsHint] = useState('')

  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mapLocateBusy, setMapLocateBusy] = useState(false)
  const [coordPickHint, setCoordPickHint] = useState('')
  const [managePlaceQuery, setManagePlaceQuery] = useState('')
  const [managePlaceBusy, setManagePlaceBusy] = useState(false)
  const [managePlaceHint, setManagePlaceHint] = useState('')

  const onMapPickUserLocation = useCallback(async (lat: number, lng: number) => {
    const latR = Number(lat.toFixed(6))
    const lngR = Number(lng.toFixed(6))
    const r = await resolveCoordAddressForManageForm(latR, lngR)
    setMapCoords({ latitude: latR, longitude: lngR })
    setResolvedDistrict(r.reason === 'ok' ? r.districtName.trim() : null)
    const labelFromApi = (r.addressLine || '').trim().slice(0, 200)
    setSharePlaceLabel(labelFromApi)
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
    const q = managePlaceQuery.trim()
    if (!q) {
      setManagePlaceHint('검색할 지명을 입력해 주세요.')
      return
    }
    if (!KAKAO_REST_API_KEY.trim()) {
      setManagePlaceHint('지명 검색에는 broke/.env 의 VITE_KAKAO_REST_API_KEY 가 필요합니다.')
      return
    }
    setManagePlaceBusy(true)
    setManagePlaceHint('')
    try {
      const p = await fetchKakaoKeywordFirstPlace(q)
      if (!p) {
        setManagePlaceHint('일치하는 장소를 찾지 못했습니다.')
        return
      }
      await onMapPickUserLocation(p.lat, p.lng)
      setManagePlaceHint(`「${p.placeName}」 위치로 맞췄습니다.`)
      const line = (p.placeName || '').trim().slice(0, 200)
      if (line) setSharePlaceLabel(line)
    } catch (e) {
      setManagePlaceHint(e instanceof Error ? e.message : '장소 검색에 실패했습니다.')
    } finally {
      setManagePlaceBusy(false)
    }
  }, [managePlaceQuery, onMapPickUserLocation])

  async function handleFreeImagesChange(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? [])
    event.target.value = ''
    const files = chosen.filter((f) => f.type.startsWith('image/'))
    if (!chosen.length) return
    if (!files.length) {
      setError('이미지 파일(jpeg, png, webp, gif)만 선택할 수 있습니다.')
      return
    }
    if (!token) {
      setError('로그인이 필요합니다.')
      return
    }
    const room = FREE_SHARE_MAX_IMAGES - imageUrls.length
    if (room <= 0) {
      setError(`사진은 최대 ${FREE_SHARE_MAX_IMAGES}장까지 등록할 수 있습니다.`)
      return
    }
    const slice = files.slice(0, room)
    setError('')
    setExifGpsHint('')
    setFreeImageBusy(true)
    try {
      const urls = await Promise.all(slice.map((file) => uploadCommunityImage(token, file)))
      setImageUrls((prev) => [...prev, ...urls].slice(0, FREE_SHARE_MAX_IMAGES))
      const gpsResults = await Promise.all(slice.map((file) => readGpsFromImageFile(file)))
      let filledFromExif = false
      setMapCoords((prev) => {
        if (!coordsFieldsBothEmpty(prev.latitude, prev.longitude)) return prev
        for (const gps of gpsResults) {
          if (gps) {
            filledFromExif = true
            return { latitude: gps.latitude, longitude: gps.longitude }
          }
        }
        return prev
      })
      const parts: string[] = []
      if (filledFromExif) {
        parts.push('업로드한 사진 중 GPS가 있는 첫 파일로 위도·경도를 채웠습니다. 필요하면 수정하세요.')
      }
      if (files.length > slice.length) {
        parts.push(`${files.length}장 중 ${slice.length}장만 반영했습니다(최대 ${FREE_SHARE_MAX_IMAGES}장).`)
      }
      if (parts.length) setExifGpsHint(parts.join(' '))
    } catch (e) {
      setError(e instanceof Error ? e.message : '이미지 업로드에 실패했습니다.')
    } finally {
      setFreeImageBusy(false)
    }
  }

  function removeImageAt(index: number) {
    setImageUrls((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) {
      setError('로그인이 필요합니다.')
      return
    }
    setError('')
    setIsSubmitting(true)
    try {
      const trimmedImages = normalizeFreeShareImageUrls(imageUrls)
      const { latitude: shareLat, longitude: shareLng } = mapCoords
      await createFreeSharePost(token, {
        title,
        body,
        district: resolvedDistrict,
        share_category: shareCategory,
        image_urls: trimmedImages,
        share_latitude: shareLat,
        share_longitude: shareLng,
        share_place_label:
          shareLat != null && shareLng != null
            ? sharePlaceLabel.trim()
              ? sharePlaceLabel.trim().slice(0, 200)
              : null
            : null,
      })
      navigate('/free-share')
    } catch (e) {
      setError(e instanceof Error ? e.message : '작성에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="home-layout home-layout--hub home-layout--map-home app-route-hub">
      <div className="brog-screen brog-screen--list">
        <header className="brog-screen__header">
          <div>
            <p className="eyebrow">무료나눔 · 작성</p>
            <h1 className="brog-screen__title">무료나눔 작성</h1>
          </div>
        </header>

        <section className="brog-list-body brog-brog-manage-form" aria-label="무료나눔 등록 폼">
          <form className="form brog-manage-form" onSubmit={handleSubmit}>
            <div className="brog-manage-form__name-district-row">
              <label className="brog-manage-form__name-field">
                제목
                <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
              </label>
              <label className="brog-manage-form__district-field">
                구 (자동)
                <input
                  readOnly
                  value={resolvedDistrict ?? ''}
                  placeholder="나눔 장소 지정 시"
                  aria-label="행정구 (나눔 장소에서 자동)"
                />
              </label>
            </div>
            <fieldset className="brog-category-fieldset">
              <legend>분류</legend>
              <div className="brog-category-picker" role="group" aria-label="무료나눔 분류 선택">
                {FREE_SHARE_CATEGORY_VALUES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    title={FREE_SHARE_CATEGORY_LABELS[v]}
                    aria-label={FREE_SHARE_CATEGORY_LABELS[v]}
                    className={
                      'brog-category-picker__btn' +
                      (shareCategory === v ? ' brog-category-picker__btn--active' : '')
                    }
                    onClick={() => setShareCategory(v)}
                  >
                    <span className="brog-category-picker__label">{FREE_SHARE_CATEGORY_LABELS[v]}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <label>
              내용
              <textarea
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={8000}
                required
              />
            </label>
            <div className="brog-manage-form__photos-block">
              <span className="brog-manage-form__photos-label" id="free-share-manage-photos-label">
                사진 (최대 {FREE_SHARE_MAX_IMAGES}장)
              </span>
              <input
                ref={freeImageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                className="visually-hidden"
                aria-hidden
                onChange={handleFreeImagesChange}
              />
              <div className="brog-manage-form__photo-toolbar" aria-labelledby="free-share-manage-photos-label">
                <button
                  type="button"
                  className="brog-manage-icon-btn"
                  title="파일에서 사진 추가"
                  aria-label="파일에서 사진 추가"
                  disabled={freeImageBusy || imageUrls.length >= FREE_SHARE_MAX_IMAGES}
                  onClick={() => freeImageInputRef.current?.click()}
                >
                  {freeImageBusy ? (
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
                  title="URL 링크 입력칸 추가"
                  aria-label="URL 링크 입력칸 추가"
                  disabled={imageUrls.length >= FREE_SHARE_MAX_IMAGES}
                  onClick={() =>
                    setImageUrls((prev) => (prev.length < FREE_SHARE_MAX_IMAGES ? [...prev, ''] : prev))
                  }
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
                  {imageUrls.length}/{FREE_SHARE_MAX_IMAGES}
                </span>
              </div>
              {imageUrls.length > 0 ? (
                <ul className="brog-manage-form__photo-url-list">
                  {imageUrls.map((url, i) => (
                    <li key={`url-row-${i}`} className="brog-manage-form__photo-url-row">
                      <span className="brog-manage-form__photo-url-index" aria-hidden>
                        {i + 1}.
                      </span>
                      <input
                        className="brog-manage-form__photo-url-input"
                        value={url}
                        onChange={(e) => {
                          const v = e.target.value
                          setImageUrls((prev) => prev.map((u, j) => (j === i ? v : u)))
                        }}
                        placeholder="https://… 또는 /uploads/…"
                        aria-label={`이미지 URL ${i + 1}`}
                      />
                      <button type="button" className="compact-link" onClick={() => removeImageAt(i)}>
                        삭제
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <ManageFormLocationMapSection
              managePlaceQuery={managePlaceQuery}
              setManagePlaceQuery={setManagePlaceQuery}
              managePlaceBusy={managePlaceBusy}
              managePlaceHint={managePlaceHint}
              setManagePlaceHint={setManagePlaceHint}
              onManagePlaceSearch={handleManagePlaceSearch}
              userCoords={
                mapCoords.latitude != null && mapCoords.longitude != null
                  ? { lat: mapCoords.latitude, lng: mapCoords.longitude }
                  : null
              }
              mapLocateBusy={mapLocateBusy}
              onMyLocationClick={() => void onMapLocateGps()}
              onPickUserLocationOnMap={(la, ln) => void onMapPickUserLocation(la, ln)}
              getDetailPath={() => '/free-share/write'}
              mapAriaLabel="무료나눔 나눔 장소 선택 지도"
              coordPickHint={coordPickHint}
              latitude={mapCoords.latitude}
              longitude={mapCoords.longitude}
              onLatitudeChange={(v) => setMapCoords((c) => ({ ...c, latitude: v }))}
              onLongitudeChange={(v) => setMapCoords((c) => ({ ...c, longitude: v }))}
              sectionTitle="나눔 장소"
            />
            {exifGpsHint ? <p className="helper form-exif-gps-hint">{exifGpsHint}</p> : null}
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? '등록 중…' : '등록'}
            </button>
          </form>

          {error ? <p className="error">{error}</p> : null}
        </section>
      </div>
    </div>
  )
}
