import { type ChangeEvent, type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe, type User } from '../api/auth'
import {
  deleteKnownRestaurantPost,
  fetchKnownRestaurantPost,
  updateKnownRestaurantPost,
  uploadCommunityImage,
  type KnownRestaurantPost,
} from '../api/community'
import { createRestaurantFromMyGPost } from '../api/restaurants'
import { notifyUserProfileRefresh } from '../authEvents'
import { fetchDistricts, type District } from '../api/districts'
import { ManageFormLocationMapSection } from '../components/ManageFormLocationMapSection'
import { BROG_ONLY } from '../config/features'
import { BROG_CATEGORIES, type BrogCategory, isBrogCategory } from '../lib/brogCategories'
import { coordsFieldsBothEmpty, readGpsFromImageFile } from '../lib/imageExifGps'
import { mapGeoHintMessage } from '../lib/mapGeoHint'
import { galleryUrlsFromMygPost } from '../lib/mygPostGallery'
import {
  clampMenuTextLineCount,
  MAX_MENU_LINES,
  parseMenuLinesText,
} from '../lib/menuLines'
import { recognizeMenuImageToMenuLines } from '../lib/menuOcr'
import { geolocationFailureMessage, requestGeolocation } from '../lib/requestGeolocation'
import { resolveCoordAddressForManageForm } from '../lib/resolveSeoulDistrictFromCoords'
import { runManageFormKakaoPlaceSearch } from '../lib/manageFormKakaoPlaceSearch'
import { assumeAdminUi, canDeleteKnownRestaurantPost, canEditCommunityPost } from '../lib/roles'
import { BROG_DISTRICT_ALL } from '../lib/deployStage1'
import { BrogCategoryPickerIcon } from '../lib/brogCategoryPickerIcons'
import { getMygListNavigatePath, mygListRefreshNavigateState } from '../lib/mygListNavigation'

const MAX_IMAGES = 6

function isBrogShapedPost(p: KnownRestaurantPost): boolean {
  return p.district_id != null && p.district_id >= 1
}

function mygListHref(post: KnownRestaurantPost | null): string {
  const d = post?.district?.trim()
  return d ? `/known-restaurants/list?district=${encodeURIComponent(d)}` : '/known-restaurants/list'
}

function mygMapHref(post: KnownRestaurantPost | null): string {
  const d = post?.district?.trim() || BROG_DISTRICT_ALL
  return `/known-restaurants/map?district=${encodeURIComponent(d)}`
}

export function KnownRestaurantPostEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const menuPhotoCameraInputRef = useRef<HTMLInputElement>(null)
  const menuPhotoFileInputRef = useRef<HTMLInputElement>(null)
  const mygImageInputRef = useRef<HTMLInputElement>(null)
  const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null

  const [user, setUser] = useState<User | null>(null)
  const [districts, setDistricts] = useState<District[]>([])
  const [post, setPost] = useState<KnownRestaurantPost | null>(null)
  const [brogMode, setBrogMode] = useState(false)

  const [name, setName] = useState('')
  const [city, setCity] = useState('서울특별시')
  const [districtId, setDistrictId] = useState(0)
  const [category, setCategory] = useState<BrogCategory | ''>('')
  const [summary, setSummary] = useState('')
  const [menuLinesText, setMenuLinesText] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [imageUrls, setImageUrls] = useState<string[]>([])

  const [legTitle, setLegTitle] = useState('')
  const [legBody, setLegBody] = useState('')
  const [legRestaurant, setLegRestaurant] = useState('')
  const [legDistrict, setLegDistrict] = useState('')
  const [legMainName, setLegMainName] = useState('')
  const [legMainPrice, setLegMainPrice] = useState(0)
  const [legImageUrl, setLegImageUrl] = useState<string | null>(null)

  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [busy, setBusy] = useState(false)
  const [mygImageBusy, setMygImageBusy] = useState(false)
  const [exifGpsHint, setExifGpsHint] = useState('')
  const [ocrBusy, setOcrBusy] = useState(false)
  const [brogRegisterBusy, setBrogRegisterBusy] = useState(false)
  const [mapLocateBusy, setMapLocateBusy] = useState(false)
  const [coordPickHint, setCoordPickHint] = useState('')
  const [managePlaceQuery, setManagePlaceQuery] = useState('')
  const [managePlaceBusy, setManagePlaceBusy] = useState(false)
  const [managePlaceHint, setManagePlaceHint] = useState('')

  const numericId = id ? Number(id) : NaN

  useEffect(() => {
    void fetchDistricts()
      .then(setDistricts)
      .catch(() => setDistricts([]))
  }, [])

  useEffect(() => {
    if (!token) return
    void fetchMe(token).then(setUser).catch(() => setUser(null))
  }, [token])

  useEffect(() => {
    if (!Number.isFinite(numericId)) {
      setLoadError('잘못된 글 ID입니다.')
      return
    }
    if (!token) return
    let cancelled = false
    setLoadError('')
    fetchKnownRestaurantPost(token, numericId)
      .then((p) => {
        if (cancelled) return
        setPost(p)
        const brog = isBrogShapedPost(p)
        setBrogMode(brog)
        if (brog) {
          setName(p.restaurant_name)
          setCity(p.city?.trim() || '서울특별시')
          setDistrictId(p.district_id ?? 0)
          setCategory((p.category as BrogCategory) || '')
          setSummary((p.summary ?? p.body).trim())
          setMenuLinesText(
            (p.menu_lines?.trim() || `${p.main_menu_name} : ${p.main_menu_price}`) as string,
          )
          setLatitude(p.latitude ?? null)
          setLongitude(p.longitude ?? null)
          setImageUrls(galleryUrlsFromMygPost(p).slice(0, MAX_IMAGES))
        } else {
          setLegTitle(p.title)
          setLegBody(p.body)
          setLegRestaurant(p.restaurant_name)
          setLegDistrict(p.district)
          setLegMainName(p.main_menu_name)
          setLegMainPrice(p.main_menu_price)
          setLegImageUrl(p.image_url)
        }
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : '글을 불러오지 못했습니다.')
      })
    return () => {
      cancelled = true
    }
  }, [numericId, token])

  const canEdit = Boolean(post && user && canEditCommunityPost(user, post.author_id, post.district))
  const canDelete = Boolean(
    post && canDeleteKnownRestaurantPost(user, post.author_id, post.district),
  )
  const isMyPost = Boolean(user && post && user.id === post.author_id)

  useEffect(() => {
    if (!post || !user) return
    if (!canEditCommunityPost(user, post.author_id, post.district)) {
      navigate(`/known-restaurants/${post.id}`, { replace: true })
    }
  }, [post, user, navigate])

  const onMapPickUserLocation = useCallback(
    async (lat: number, lng: number) => {
      const latR = Number(lat.toFixed(6))
      const lngR = Number(lng.toFixed(6))
      const r = await resolveCoordAddressForManageForm(lat, lng)
      const did = districts.find((d) => d.name === r.districtName)?.id
      setLatitude(latR)
      setLongitude(lngR)
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
      setSaveError('이미지 파일(jpeg, png, webp, gif)만 선택할 수 있습니다.')
      return
    }
    if (!token) {
      setSaveError(assumeAdminUi() ? '테스트 UI: 업로드는 로그인 후 가능합니다.' : '로그인이 필요합니다.')
      return
    }
    const room = MAX_IMAGES - imageUrls.length
    if (room <= 0) {
      setSaveError(`사진은 최대 ${MAX_IMAGES}장까지 등록할 수 있습니다.`)
      return
    }
    const slice = files.slice(0, room)
    setSaveError('')
    setExifGpsHint('')
    setMygImageBusy(true)
    try {
      const urls = await Promise.all(slice.map((file) => uploadCommunityImage(token, file, 'myg')))
      setImageUrls((prev) => [...prev, ...urls].slice(0, MAX_IMAGES))
      const gpsResults = await Promise.all(slice.map((file) => readGpsFromImageFile(file)))
      let filledFromExif = false
      if (brogMode && coordsFieldsBothEmpty(latitude, longitude)) {
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
      setSaveError(e instanceof Error ? e.message : '업로드 실패')
    } finally {
      setMygImageBusy(false)
    }
  }

  function removeImageAt(index: number) {
    setImageUrls((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleMenuPhotoChangeBrog(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    setSaveError('')
    setOcrBusy(true)
    try {
      const lines = await recognizeMenuImageToMenuLines(file)
      setMenuLinesText(clampMenuTextLineCount(lines))
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '사진 인식에 실패했습니다.')
    } finally {
      setOcrBusy(false)
    }
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    if (!post) return
    if (!token) {
      setSaveError(assumeAdminUi() ? '테스트 UI: 저장은 로그인 후 가능합니다.' : '로그인이 필요합니다.')
      return
    }
    setSaveError('')

    if (brogMode) {
      if (!districtId) {
        setSaveError('구(district)를 선택하세요.')
        return
      }
      if (!isBrogCategory(category)) {
        setSaveError('카테고리를 선택하세요.')
        return
      }
      const parsed = parseMenuLinesText(menuLinesText)
      if (parsed.errors.length > 0) {
        setSaveError(parsed.errors.join(' '))
        return
      }
      if (!parsed.main.name) {
        setSaveError('메뉴를 한 줄 이상 올바르게 입력하세요.')
        return
      }
    }

    setBusy(true)
    try {
      if (brogMode) {
        const trimmedImages = imageUrls.map((u) => u.trim()).filter(Boolean).slice(0, MAX_IMAGES)
        await updateKnownRestaurantPost(token, post.id, {
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
      } else {
        await updateKnownRestaurantPost(token, post.id, {
          title: legTitle.trim(),
          body: legBody.trim(),
          restaurant_name: legRestaurant.trim(),
          district: legDistrict.trim(),
          main_menu_name: legMainName.trim(),
          main_menu_price: Number(legMainPrice),
          image_url: legImageUrl,
        })
      }
      navigate(`/known-restaurants/${post.id}`)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setBusy(false)
    }
  }

  async function handleBrogRegister() {
    if (!post || !token) {
      setSaveError(assumeAdminUi() ? '테스트 UI: BroG 등록은 로그인 후 가능합니다.' : '로그인이 필요합니다.')
      return
    }
    if (!window.confirm('이 MyG 글 내용으로 공개 BroG 맛집을 새로 등록할까요?')) return
    setBrogRegisterBusy(true)
    setSaveError('')
    try {
      const r = await createRestaurantFromMyGPost(token, post.id)
      notifyUserProfileRefresh()
      navigate(`/restaurants/${r.id}`)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'BroG 등록에 실패했습니다.')
    } finally {
      setBrogRegisterBusy(false)
    }
  }

  async function handleDelete() {
    if (!post) return
    if (!token) {
      setSaveError(assumeAdminUi() ? '테스트 UI: 삭제는 로그인 후 가능합니다.' : '로그인이 필요합니다.')
      return
    }
    if (!window.confirm('이 글을 삭제할까요?')) return
    setBusy(true)
    setSaveError('')
    try {
      await deleteKnownRestaurantPost(token, post.id)
      navigate(getMygListNavigatePath(), { state: mygListRefreshNavigateState() })
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '삭제 실패')
    } finally {
      setBusy(false)
    }
  }

  if (loadError) {
    return (
      <div className="brog-detail brog-detail--error card">
        <h1>글을 불러올 수 없습니다</h1>
        <p className="description">{loadError}</p>
        <Link className="compact-link brog-detail__error-list-link" to="/known-restaurants/list">
          MyG 목록
        </Link>
      </div>
    )
  }

  if (!token && Number.isFinite(numericId)) {
    return (
      <div className="brog-detail brog-detail--error card">
        <h1>로그인이 필요합니다</h1>
        <p className="description">MyG 수정은 로그인 후 이용할 수 있습니다.</p>
        <Link className="compact-link brog-detail__error-list-link" to={`/known-restaurants/${numericId}`}>
          상세 보기
        </Link>
      </div>
    )
  }

  if (!post || (token && !user)) {
    return (
      <div className="brog-detail brog-detail--loading">
        <p>불러오는 중…</p>
      </div>
    )
  }

  if (!canEdit) {
    return (
      <div className="brog-detail brog-detail--loading">
        <p>상세 화면으로 이동합니다…</p>
      </div>
    )
  }

  return (
    <div className="home-layout home-layout--hub home-layout--map-home app-route-hub">
      <div className="brog-detail">
      <header className="brog-detail__topbar">
        <Link
          className="brog-detail__back"
          to={`/known-restaurants/${post.id}`}
          title="상세 보기"
          aria-label="MyG 상세로 이동"
        >
          <span className="brog-detail__back-label">상세 보기</span>
        </Link>
        <div className="brog-detail__topbar-links">
          <Link to={mygListHref(post)}>목록</Link>
          <Link to={mygMapHref(post)}>지도</Link>
          {!BROG_ONLY ? <Link to="/brog/list">BroG 리스트</Link> : null}
        </div>
      </header>

      <div className="brog-detail__body">
        {saveError ? (
          <p className="error brog-detail__action-error" role="alert">
            {saveError}
          </p>
        ) : null}
        <section className="brog-detail__section">
          <p className="brog-detail__eyebrow">MyG · 수정</p>
          <h2 className="brog-screen__title" style={{ margin: 0, fontSize: '1.35rem' }}>
            편집
          </h2>
        </section>

        <section className="brog-detail__section brog-list-body brog-brog-manage-form">
          {isMyPost && token ? (
            <p className="helper" style={{ marginTop: 0 }}>
              <button
                type="button"
                className="brog-screen__cta"
                style={{ marginTop: 4, marginBottom: 4 }}
                disabled={brogRegisterBusy}
                onClick={() => void handleBrogRegister()}
              >
                {brogRegisterBusy ? 'BroG 등록 중…' : 'BroG 등록'}
              </button>
            </p>
          ) : null}

          <form className="form brog-manage-form" onSubmit={handleSave}>
            {brogMode ? (
              <>
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
                  <span className="brog-manage-form__photos-label" id="myg-edit-photos-label">
                    사진 (최대 {MAX_IMAGES}장)
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
                  <div className="brog-manage-form__photo-toolbar" aria-labelledby="myg-edit-photos-label">
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
                      {imageUrls.length}/{MAX_IMAGES}
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
                    latitude != null && longitude != null ? { lat: latitude, lng: longitude } : null
                  }
                  mapLocateBusy={mapLocateBusy}
                  onMyLocationClick={onMapLocateGps}
                  onPickUserLocationOnMap={onMapPickUserLocation}
                  getDetailPath={(_rid) => `/known-restaurants/${post.id}`}
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
                    <span className="brog-manage-form__menu-heading-text" id="myg-edit-menu-label">
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
                        onChange={handleMenuPhotoChangeBrog}
                      />
                      <input
                        ref={menuPhotoFileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="visually-hidden"
                        aria-hidden
                        onChange={handleMenuPhotoChangeBrog}
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
                    aria-labelledby="myg-edit-menu-label"
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  제목
                  <input value={legTitle} onChange={(e) => setLegTitle(e.target.value)} maxLength={200} required />
                </label>
                <label>
                  내용
                  <textarea value={legBody} onChange={(e) => setLegBody(e.target.value)} rows={4} required />
                </label>
                <label>
                  식당 이름
                  <input value={legRestaurant} onChange={(e) => setLegRestaurant(e.target.value)} required />
                </label>
                <label>
                  구
                  <input value={legDistrict} onChange={(e) => setLegDistrict(e.target.value)} required />
                </label>
                <label>
                  대표 메뉴명
                  <input value={legMainName} onChange={(e) => setLegMainName(e.target.value)} required />
                </label>
                <label>
                  가격 (원)
                  <input
                    type="number"
                    min={0}
                    value={legMainPrice}
                    onChange={(e) => setLegMainPrice(Number(e.target.value))}
                    required
                  />
                </label>
                <label>
                  이미지 URL (비우면 제거)
                  <input
                    value={legImageUrl ?? ''}
                    onChange={(e) => setLegImageUrl(e.target.value.trim() || null)}
                  />
                </label>
              </>
            )}
            <p style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <button type="submit" disabled={busy}>
                {busy ? '저장 중…' : '저장'}
              </button>
              {canDelete ? (
                <button type="button" className="compact-link danger-text" disabled={busy} onClick={handleDelete}>
                  삭제
                </button>
              ) : null}
            </p>
          </form>
        </section>
      </div>
      </div>
    </div>
  )
}
