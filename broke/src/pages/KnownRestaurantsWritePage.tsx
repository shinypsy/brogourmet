import { type ChangeEvent, type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ACCESS_TOKEN_KEY } from '../api/auth'
import { createKnownRestaurantPost, uploadCommunityImage } from '../api/community'
import { fetchDistricts, type District } from '../api/districts'
import { ManageFormLocationMapSection } from '../components/ManageFormLocationMapSection'
import { coordsFieldsBothEmpty, readGpsFromImageFile } from '../lib/imageExifGps'
import {
  clampMenuTextLineCount,
  MAX_MENU_LINES,
  parseMenuLinesText,
} from '../lib/menuLines'
import { mapGeoHintMessage } from '../lib/mapGeoHint'
import { geolocationFailureMessage, requestGeolocation } from '../lib/requestGeolocation'
import { resolveCoordAddressForManageForm } from '../lib/resolveSeoulDistrictFromCoords'
import { recognizeMenuImageToMenuLines } from '../lib/menuOcr'
import { BROG_CATEGORIES, type BrogCategory, isBrogCategory } from '../lib/brogCategories'
import { BrogCategoryPickerIcon } from '../lib/brogCategoryPickerIcons'
import { runManageFormKakaoPlaceSearch } from '../lib/manageFormKakaoPlaceSearch'
import { getMygListNavigatePath, mygListRefreshNavigateState } from '../lib/mygListNavigation'
import { assumeAdminUi } from '../lib/roles'
import {
  BROG_MYG_REQUIRED_PHOTO_COUNT,
  BROG_MYG_REQUIRED_PHOTO_LABELS,
  brogMygRequiredPhotosError,
  mergeUploadedImageUrls,
} from '../lib/brogMygPhotoSlots'

/** BroG 등록 폼과 동일 장 수. 업로드만 `myg` 스코프로 MyG 저장소에 저장. */
const MAX_IMAGES = 6

export function KnownRestaurantsWritePage() {
  const navigate = useNavigate()
  const menuPhotoCameraInputRef = useRef<HTMLInputElement>(null)
  const menuPhotoFileInputRef = useRef<HTMLInputElement>(null)
  const mygImageInputRef = useRef<HTMLInputElement>(null)
  const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null

  const [districts, setDistricts] = useState<District[]>([])
  const [name, setName] = useState('')
  /** BroG 등록과 같이 폼에 시·도 입력은 두지 않음. 저장 시 항상 서울 기본. */
  const city = '서울특별시'
  const [districtId, setDistrictId] = useState(0)
  const [category, setCategory] = useState<BrogCategory | ''>('')
  const [summary, setSummary] = useState('')
  const [menuLinesText, setMenuLinesText] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [imageUrls, setImageUrls] = useState<string[]>(() => ['', '', ''])
  const [mygImageBusy, setMygImageBusy] = useState(false)
  const [exifGpsHint, setExifGpsHint] = useState('')
  const [ocrBusy, setOcrBusy] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mapLocateBusy, setMapLocateBusy] = useState(false)
  const [coordPickHint, setCoordPickHint] = useState('')
  const [managePlaceQuery, setManagePlaceQuery] = useState('')
  const [managePlaceBusy, setManagePlaceBusy] = useState(false)
  const [managePlaceHint, setManagePlaceHint] = useState('')

  useEffect(() => {
    void fetchDistricts()
      .then(setDistricts)
      .catch(() => setDistricts([]))
  }, [])

  useEffect(() => {
    if (!districts.length) return
    const m = districts.find((d) => d.name === '마포구')
    setDistrictId((id) => id || m?.id || districts[0]?.id || 0)
  }, [districts])

  const onMapPickUserLocation = useCallback(
    async (lat: number, lng: number) => {
      const latR = Number(lat.toFixed(6))
      const lngR = Number(lng.toFixed(6))
      const r = await resolveCoordAddressForManageForm(lat, lng)
      const did = districts.find((d) => d.name === r.districtName)?.id
      setLatitude(latR)
      setLongitude(lngR)
      // 실패·비서울 등은 districtName이 마포 폴백이므로, 확실할 때만 구 드롭다운을 덮어쓴다.
      if (r.reason === 'ok' && did) setDistrictId(did)
      const hintParts: string[] = []
      if (r.addressLine) hintParts.push(r.addressLine)
      hintParts.push(mapGeoHintMessage(r.reason, r.districtName))
      setCoordPickHint(hintParts.filter(Boolean).join(' · '))
    },
    [districts],
  )

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

  async function handleMygImagesChange(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? [])
    event.target.value = ''
    const files = chosen.filter((f) => f.type.startsWith('image/'))
    if (!chosen.length) return
    if (!files.length) {
      setSubmitError('이미지 파일(jpeg, png, webp, gif)만 선택할 수 있습니다.')
      return
    }
    if (!token) {
      setSubmitError(assumeAdminUi() ? '테스트 UI: 이미지 업로드는 로그인 후 가능합니다.' : '로그인이 필요합니다.')
      return
    }
    const room = MAX_IMAGES - imageUrls.length
    if (room <= 0) {
      setSubmitError(`사진은 최대 ${MAX_IMAGES}장까지 등록할 수 있습니다.`)
      return
    }
    const slice = files.slice(0, room)
    setSubmitError('')
    setExifGpsHint('')
    setMygImageBusy(true)
    try {
      const urls = await Promise.all(slice.map((file) => uploadCommunityImage(token, file, 'myg')))
      setImageUrls((prev) => mergeUploadedImageUrls(prev, urls, MAX_IMAGES, true))
      const gpsResults = await Promise.all(slice.map((file) => readGpsFromImageFile(file)))
      let filledFromExif = false
      if (coordsFieldsBothEmpty(latitude, longitude)) {
        for (const gps of gpsResults) {
          if (gps) {
            filledFromExif = true
            setLatitude(gps.latitude)
            setLongitude(gps.longitude)
            break
          }
        }
      }
      const parts: string[] = []
      if (filledFromExif) {
        parts.push('업로드한 사진 중 GPS가 있는 첫 파일로 위도·경도를 채웠습니다. 필요하면 수정하세요.')
      }
      if (files.length > slice.length) {
        parts.push(`${files.length}장 중 ${slice.length}장만 반영했습니다(최대 ${MAX_IMAGES}장).`)
      }
      if (parts.length) setExifGpsHint(parts.join(' '))
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : '이미지 업로드에 실패했습니다.')
    } finally {
      setMygImageBusy(false)
    }
  }

  function removeImageAt(index: number) {
    if (index < BROG_MYG_REQUIRED_PHOTO_COUNT) {
      setImageUrls((prev) => prev.map((u, i) => (i === index ? '' : u)))
      return
    }
    setImageUrls((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleMenuPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    setSubmitError('')
    setOcrBusy(true)
    try {
      const lines = await recognizeMenuImageToMenuLines(file)
      setMenuLinesText(clampMenuTextLineCount(lines))
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : '사진 인식에 실패했습니다.')
    } finally {
      setOcrBusy(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) {
      setSubmitError('로그인이 필요합니다.')
      return
    }
    if (!districtId) {
      setSubmitError('구(district)를 선택하세요.')
      return
    }
    if (!isBrogCategory(category)) {
      setSubmitError('카테고리를 선택하세요.')
      return
    }
    const parsed = parseMenuLinesText(menuLinesText)
    if (parsed.errors.length > 0) {
      setSubmitError(parsed.errors.join(' '))
      return
    }
    if (!parsed.main.name) {
      setSubmitError('메뉴를 한 줄 이상 올바르게 입력하세요.')
      return
    }
    const photoErr = brogMygRequiredPhotosError(imageUrls)
    if (photoErr) {
      setSubmitError(photoErr)
      return
    }

    setSubmitError('')
    setIsSubmitting(true)
    try {
      const trimmedImages = imageUrls.map((u) => u.trim()).filter(Boolean).slice(0, MAX_IMAGES)
      await createKnownRestaurantPost(token, {
        restaurant_name: name.trim(),
        district_id: districtId,
        city: city.trim() || '서울특별시',
        category,
        summary: summary.trim(),
        menu_lines: clampMenuTextLineCount(menuLinesText).trim(),
        latitude: latitude == null || Number.isNaN(Number(latitude)) ? null : Number(latitude),
        longitude: longitude == null || Number.isNaN(Number(longitude)) ? null : Number(longitude),
        image_urls: trimmedImages,
      })
      navigate(getMygListNavigatePath(), { state: mygListRefreshNavigateState() })
    } catch (submitErr) {
      setSubmitError(submitErr instanceof Error ? submitErr.message : '작성에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="home-layout home-layout--hub home-layout--map-home app-route-hub">
      <div className="brog-screen brog-screen--list">
        <header className="brog-screen__header">
          <div>
            <p className="eyebrow">MyG · 작성</p>
            <h1 className="brog-screen__title">MyG 작성</h1>
          </div>
        </header>

        <section className="brog-list-body brog-brog-manage-form" aria-label="MyG 작성">
          <form className="form brog-manage-form" onSubmit={handleSubmit}>
            <div className="brog-manage-form__name-district-row">
              <label className="brog-manage-form__name-field">
                상호명
                <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
              </label>
              <label className="brog-manage-form__district-field">
                구
                <select
                  value={districtId || ''}
                  onChange={(e) => setDistrictId(Number(e.target.value))}
                  required
                >
                  <option value="">선택</option>
                  {districts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <fieldset className="brog-category-fieldset">
              <legend>카테고리</legend>
              {category && !isBrogCategory(category) ? (
                <p className="error" style={{ margin: '0 0 8px' }} role="status">
                  저장된 카테고리 「{category}」를 다시 선택해 주세요.
                </p>
              ) : null}
              <div
                className="brog-category-picker brog-category-picker--with-icons"
                role="group"
                aria-label="카테고리 선택"
              >
                {BROG_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    aria-label={c}
                    className={
                      'brog-category-picker__btn' +
                      (category === c ? ' brog-category-picker__btn--active' : '')
                    }
                    onClick={() => setCategory(c)}
                  >
                    <span className="brog-category-picker__icon-wrap" aria-hidden>
                      <BrogCategoryPickerIcon category={c} />
                    </span>
                    <span className="brog-category-picker__label">{c}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <label>
              소개
              <textarea rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} required />
            </label>
            <div className="brog-manage-form__photos-block">
              <span className="brog-manage-form__photos-label" id="myg-write-photos-label">
                사진 (최대 {MAX_IMAGES}장) · {BROG_MYG_REQUIRED_PHOTO_LABELS.join('·')} 각 1장 필수, 그 외 추가 선택
              </span>
              <input
                ref={mygImageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                className="visually-hidden"
                aria-hidden
                onChange={handleMygImagesChange}
              />
              <div className="brog-manage-form__photo-toolbar" aria-labelledby="myg-write-photos-label">
                <button
                  type="button"
                  className="brog-manage-icon-btn"
                  title="파일에서 사진 추가"
                  aria-label="파일에서 사진 추가"
                  disabled={mygImageBusy || imageUrls.length >= MAX_IMAGES}
                  onClick={() => mygImageInputRef.current?.click()}
                >
                  {mygImageBusy ? (
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
                  disabled={imageUrls.length >= MAX_IMAGES}
                  onClick={() =>
                    setImageUrls((prev) => (prev.length < MAX_IMAGES ? [...prev, ''] : prev))
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
                  {imageUrls.filter((u) => u.trim()).length}/{MAX_IMAGES}
                </span>
              </div>
              {imageUrls.length > 0 ? (
                <ul className="brog-manage-form__photo-url-list">
                  {imageUrls.map((url, i) => (
                    <li key={`url-row-${i}`} className="brog-manage-form__photo-url-row">
                      <span
                        className={
                          'brog-manage-form__photo-url-index' +
                          (i < BROG_MYG_REQUIRED_PHOTO_COUNT ? ' brog-manage-form__photo-url-index--role' : '')
                        }
                      >
                        {i < BROG_MYG_REQUIRED_PHOTO_COUNT ? (
                          <>
                            {BROG_MYG_REQUIRED_PHOTO_LABELS[i]}
                            <span className="brog-manage-form__photo-url-required-mark"> · 필수</span>
                          </>
                        ) : (
                          <>추가 {i - BROG_MYG_REQUIRED_PHOTO_COUNT + 1}</>
                        )}
                      </span>
                      <input
                        className="brog-manage-form__photo-url-input"
                        value={url}
                        onChange={(e) => {
                          const v = e.target.value
                          setImageUrls((prev) => prev.map((u, j) => (j === i ? v : u)))
                        }}
                        placeholder="https://… 또는 /uploads/…"
                        aria-label={
                          i < BROG_MYG_REQUIRED_PHOTO_COUNT
                            ? `${BROG_MYG_REQUIRED_PHOTO_LABELS[i]} 이미지 URL`
                            : `이미지 URL ${i + 1}`
                        }
                      />
                      <button type="button" className="compact-link" onClick={() => removeImageAt(i)}>
                        {i < BROG_MYG_REQUIRED_PHOTO_COUNT ? '비우기' : '삭제'}
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
                latitude != null && longitude != null ? { lat: latitude, lng: longitude } : null
              }
              mapLocateBusy={mapLocateBusy}
              onMyLocationClick={onMapLocateGps}
              onPickUserLocationOnMap={onMapPickUserLocation}
              getDetailPath={(_rid) => '/known-restaurants/write'}
              mapAriaLabel="MyG 매장 위치 선택 지도"
              coordPickHint={coordPickHint}
              latitude={latitude}
              longitude={longitude}
              onLatitudeChange={setLatitude}
              onLongitudeChange={setLongitude}
            />
            {exifGpsHint ? <p className="helper form-exif-gps-hint">{exifGpsHint}</p> : null}
            <label className="brog-manage-form__menu-block">
              <div className="brog-manage-form__menu-heading">
                <span className="brog-manage-form__menu-heading-text" id="myg-write-menu-label">
                  메뉴 목록 (최대 {MAX_MENU_LINES}줄)
                </span>
                <div className="brog-manage-form__menu-heading-tools" role="group" aria-label="메뉴판 이미지 인식">
                  <input
                    ref={menuPhotoCameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="visually-hidden"
                    aria-hidden
                    onChange={handleMenuPhotoChange}
                  />
                  <input
                    ref={menuPhotoFileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="visually-hidden"
                    aria-hidden
                    onChange={handleMenuPhotoChange}
                  />
                  <button
                    type="button"
                    className="brog-manage-icon-btn"
                    title={ocrBusy ? '메뉴 인식 중' : '카메라로 메뉴판 촬영'}
                    aria-label={ocrBusy ? '메뉴 사진 인식 중' : '카메라로 메뉴판 촬영'}
                    disabled={ocrBusy}
                    onClick={() => menuPhotoCameraInputRef.current?.click()}
                  >
                    {ocrBusy ? (
                      <span className="brog-manage-icon-btn__spinner" aria-hidden />
                    ) : (
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4 7h3l1.2-2h7.6L17 7h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"
                        />
                        <circle cx="12" cy="13" r="3.5" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    className="brog-manage-icon-btn"
                    title={ocrBusy ? '메뉴 인식 중' : '앨범·파일에서 메뉴판 선택'}
                    aria-label={ocrBusy ? '메뉴 사진 인식 중' : '앨범·파일에서 메뉴판 선택'}
                    disabled={ocrBusy}
                    onClick={() => menuPhotoFileInputRef.current?.click()}
                  >
                    {ocrBusy ? (
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
                </div>
              </div>
              <textarea
                rows={10}
                value={menuLinesText}
                onChange={(e) => setMenuLinesText(clampMenuTextLineCount(e.target.value))}
                placeholder={'수육국밥 : 9000\n순대 : 5000\n막국수 : 8000'}
                spellCheck={false}
                aria-labelledby="myg-write-menu-label"
              />
            </label>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? '작성 중…' : '작성'}
            </button>
          </form>
          {submitError ? <p className="error">{submitError}</p> : null}
        </section>
      </div>
    </div>
  )
}
