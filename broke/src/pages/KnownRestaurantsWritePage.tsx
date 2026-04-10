import { type ChangeEvent, type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe, type User } from '../api/auth'
import { createKnownRestaurantPost, uploadCommunityImage } from '../api/community'
import { KAKAO_MAP_APP_KEY, KAKAO_REST_API_KEY } from '../api/config'
import { fetchDistricts, type District } from '../api/districts'
import { BrogKakaoMap } from '../components/BrogKakaoMap'
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
import { fetchKakaoKeywordFirstPlace } from '../lib/kakaoKeywordSearch'
import { assumeAdminUi } from '../lib/roles'

/** BroG 등록 폼과 동일 장 수. 업로드만 `myg` 스코프로 MyG 저장소에 저장. */
const MAX_IMAGES = 5

export function KnownRestaurantsWritePage() {
  const navigate = useNavigate()
  const menuPhotoInputRef = useRef<HTMLInputElement>(null)
  const mygImageInputRef = useRef<HTMLInputElement>(null)
  const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null

  const [user, setUser] = useState<User | null>(null)
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
  const latLngRef = useRef({ lat: null as number | null, lng: null as number | null })
  latLngRef.current = { lat: latitude, lng: longitude }
  const [imageUrls, setImageUrls] = useState<string[]>([])
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

  useEffect(() => {
    if (!token) return
    void fetchMe(token).then(setUser).catch(() => setUser(null))
  }, [token])

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
    } catch (e) {
      setManagePlaceHint(e instanceof Error ? e.message : '장소 검색에 실패했습니다.')
    } finally {
      setManagePlaceBusy(false)
    }
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
      setImageUrls((prev) => [...prev, ...urls].slice(0, MAX_IMAGES))
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
      navigate('/known-restaurants/list')
    } catch (submitErr) {
      setSubmitError(submitErr instanceof Error ? submitErr.message : '작성에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="brog-screen brog-screen--list">
      <header className="brog-screen__header">
        <div>
          <p className="eyebrow">MyG · 작성</p>
          <h1 className="brog-screen__title">MyG 작성</h1>
          <p className="brog-screen__meta">
            입력 순서·항목은 BroG 등록과 동일합니다. 차이: 글은 <strong>MyG(개인) DB</strong>에만 저장되고, 사진은{' '}
            <strong>MyG 전용 업로드 경로</strong>(<code>/uploads/myg/</code>)에 저장됩니다. BroG로 옮길 때만 공개 맛집 DB·BroG
            이미지 경로 규칙이 적용됩니다.
          </p>
        </div>
      </header>

      <section className="brog-list-body" aria-label="MyG 작성">
        <section className="card board-form-card">
          <form className="form" onSubmit={handleSubmit}>
            <label>
              이름
              <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
              <p className="helper" style={{ marginTop: 6 }}>
                BroG 등록 화면과 같은 필드입니다. MyG에는 그대로 저장되며, 나중에 BroG로 옮길 때 BroG 쪽에서 이름 중복·표기
                규칙이 적용될 수 있습니다.
              </p>
            </label>
            <p className="helper">
              시·도는 지도에서 위치를 고르면 함께 맞춰지며, 기본값은 <strong>서울특별시</strong>입니다. (BroG 등록과 동일하게
              폼에는 별도 입력 칸을 두지 않습니다.)
            </p>
            <label>
              구 (district_id)
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
            <fieldset className="brog-category-fieldset">
              <legend>카테고리</legend>
              {category && !isBrogCategory(category) ? (
                <p className="helper" style={{ margin: 0 }}>
                  저장된 값 「{category}」은(는) 현재 표준 목록에 없습니다. 아래에서 카테고리를 다시 골라 주세요.
                </p>
              ) : null}
              <div className="brog-category-picker" role="group" aria-label="카테고리 선택">
                {BROG_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={
                      'brog-category-picker__btn' +
                      (category === c ? ' brog-category-picker__btn--active' : '')
                    }
                    onClick={() => setCategory(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </fieldset>
            <label>
              소개
              <textarea
                rows={4}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                required
                maxLength={8000}
              />
            </label>
            <label>
              사진 (최대 {MAX_IMAGES}장)
              <p className="helper" style={{ marginTop: 6, marginBottom: 8 }}>
                첫 장이 목록·지도 대표 썸네일입니다. 한 번에 최대 {MAX_IMAGES}장까지 선택해 동시에 올릴 수 있습니다(남은
                슬롯만큼만 업로드). 서버 저장(최대 5MB/장) 또는 아래 URL 입력도 가능합니다. GPS가 있는 사진은 위도·경도가 비어
                있을 때 EXIF로 채웁니다. 파일 업로드는 <strong>MyG 전용 API</strong>로 처리되어{' '}
                <code>/uploads/myg/</code>에 저장됩니다(BroG 사진과 저장 위치가 다릅니다).
              </p>
              <input
                ref={mygImageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                style={{ display: 'none' }}
                onChange={handleMygImagesChange}
              />
              <p style={{ marginBottom: 10, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                <button
                  type="button"
                  className="compact-link"
                  disabled={mygImageBusy || imageUrls.length >= MAX_IMAGES}
                  onClick={() => mygImageInputRef.current?.click()}
                >
                  {mygImageBusy ? '업로드 중…' : '파일에서 추가 (여러 장 선택 가능)'}
                </button>
                <span className="helper">
                  {imageUrls.length}/{MAX_IMAGES}장
                </span>
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px' }}>
                {imageUrls.map((url, i) => (
                  <li
                    key={`${i}-${url.slice(0, 40)}`}
                    style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}
                  >
                    <span className="helper" style={{ minWidth: 22 }}>
                      {i + 1}.
                    </span>
                    <input
                      style={{ flex: 1, minWidth: 0 }}
                      value={url}
                      onChange={(e) => {
                        const v = e.target.value
                        setImageUrls((prev) => prev.map((u, j) => (j === i ? v : u)))
                      }}
                      placeholder="https://… 또는 /uploads/…"
                    />
                    <button type="button" className="compact-link" onClick={() => removeImageAt(i)}>
                      삭제
                    </button>
                  </li>
                ))}
              </ul>
              {imageUrls.length < MAX_IMAGES ? (
                <button
                  type="button"
                  className="compact-link"
                  onClick={() => setImageUrls((prev) => [...prev, ''].slice(0, MAX_IMAGES))}
                >
                  URL 줄 추가
                </button>
              ) : null}
            </label>
            <div className="restaurant-manage-location-map">
              <div className="restaurant-manage-map-place-row" aria-label="지명 검색으로 지도 위치 맞추기">
                <span className="restaurant-manage-map-place-row__icon" aria-hidden>
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m21 21-4-4" />
                  </svg>
                </span>
                <span className="restaurant-manage-map-place-row__label">지명검색 위치로</span>
                <input
                  type="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  spellCheck={false}
                  className="restaurant-manage-map-place-row__input"
                  placeholder="예: 홍대입구역, 망원동"
                  value={managePlaceQuery}
                  disabled={managePlaceBusy}
                  onChange={(e) => {
                    setManagePlaceQuery(e.target.value)
                    if (managePlaceHint) setManagePlaceHint('')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void handleManagePlaceSearch()
                    }
                  }}
                  aria-label="지명 또는 장소 검색"
                />
                <button
                  type="button"
                  className="restaurant-manage-map-place-row__btn"
                  disabled={managePlaceBusy || !managePlaceQuery.trim() || !KAKAO_REST_API_KEY.trim()}
                  onClick={() => void handleManagePlaceSearch()}
                >
                  {managePlaceBusy ? '찾는 중…' : '이 위치로'}
                </button>
              </div>
              {managePlaceHint ? (
                <p
                  className={`helper restaurant-manage-map-place-row__hint${managePlaceHint.includes('실패') || managePlaceHint.includes('못') || managePlaceHint.includes('필요') ? ' restaurant-manage-map-place-row__hint--warn' : ''}`}
                  role="status"
                >
                  {managePlaceHint}
                </p>
              ) : null}
              {KAKAO_MAP_APP_KEY ? (
                <BrogKakaoMap
                  userCoords={
                    latitude != null && longitude != null ? { lat: latitude, lng: longitude } : null
                  }
                  pins={[]}
                  locating={mapLocateBusy}
                  onMyLocationClick={() => void onMapLocateGps()}
                  onPickUserLocationOnMap={(la, ln) => void onMapPickUserLocation(la, ln)}
                  getDetailPath={() => '/known-restaurants/write'}
                  mapAriaLabel="MyG 매장 위치 선택 지도"
                />
              ) : (
                <p className="helper">
                  지도를 쓰려면 <code>broke/.env</code>에 <code>VITE_KAKAO_MAP_APP_KEY</code>(JavaScript 키)를 넣으세요.
                  주소·구 자동 입력에는 <code>VITE_KAKAO_REST_API_KEY</code>도 필요합니다.
                </p>
              )}
              {coordPickHint ? (
                <p className="helper restaurant-manage-location-map__hint" role="status">
                  {coordPickHint}
                </p>
              ) : null}
            </div>
            <div className="form-coords-row">
              <label>
                위도
                <input
                  type="number"
                  step="any"
                  value={latitude ?? ''}
                  onChange={(e) =>
                    setLatitude(e.target.value === '' ? null : Number(e.target.value))
                  }
                />
              </label>
              <label>
                경도
                <input
                  type="number"
                  step="any"
                  value={longitude ?? ''}
                  onChange={(e) =>
                    setLongitude(e.target.value === '' ? null : Number(e.target.value))
                  }
                />
              </label>
            </div>
            {exifGpsHint ? <p className="helper form-exif-gps-hint">{exifGpsHint}</p> : null}
            <label>
              메뉴 목록 (최대 {MAX_MENU_LINES}줄)
              <p className="helper" style={{ marginTop: 6, marginBottom: 8 }}>
                한 줄에 <code>메뉴이름 : 가격</code> 형식(콜론 <code>:</code> 또는 <code>：</code> 가능). 첫 줄은 대표
                메뉴(BroG 전환 시 10,000원 이하로 맞춤), 2~4줄은 카드에 강조, 5~10줄은 상세 목록만. MyG 저장 시에는 가격
                상한이 없습니다.
              </p>
              <textarea
                rows={10}
                value={menuLinesText}
                onChange={(e) => setMenuLinesText(clampMenuTextLineCount(e.target.value))}
                placeholder={'수육국밥 : 9000\n순대 : 5000\n막국수 : 8000'}
                spellCheck={false}
              />
              <input
                ref={menuPhotoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={handleMenuPhotoChange}
              />
              <p style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                <button
                  type="button"
                  className="compact-link"
                  disabled={ocrBusy}
                  onClick={() => menuPhotoInputRef.current?.click()}
                >
                  {ocrBusy ? '사진에서 읽는 중…' : '메뉴판 사진에서 불러오기 → 메뉴 목록에 자동 반영'}
                </button>
              </p>
              <p className="helper" style={{ marginTop: 4 }}>
                인식 결과는 아래 메뉴 목록 텍스트에 <strong>덮어씁니다</strong>(기존 입력은 사라집니다). 로그인 상태에서{' '}
                <code>VITE_USE_CLOVA_OCR=1</code> 이고 서버에 CLOVA 키가 설정되어 있으면 JPEG/PNG는 네이버 CLOVA를 먼저
                쓰고, 실패·WebP 등은 브라우저 Tesseract(kor+eng)로 이어집니다. Tesseract는 첫 실행 시 모델 로딩이 걸릴 수
                있습니다. <code>메뉴명 : 가격</code> 형식인지 꼭 확인하세요.
              </p>
            </label>
            {user ? (
              <p className="helper">
                작성자: <strong>{user.nickname}</strong> ({user.email})
              </p>
            ) : null}
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? '작성 중…' : '작성'}
            </button>
          </form>
          {submitError ? <p className="error">{submitError}</p> : null}
        </section>
      </section>
    </div>
  )
}
