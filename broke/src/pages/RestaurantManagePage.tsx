import { type ChangeEvent, type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe, type User } from '../api/auth'
import { notifyUserProfileRefresh } from '../authEvents'
import { fetchDistricts, type District } from '../api/districts'
import { copyBrogToMyGPost, uploadCommunityImage } from '../api/community'
import {
  createRestaurant,
  fetchRestaurant,
  fetchRestaurantForManage,
  purgeRestaurantPermanent,
  restoreRestaurant,
  updateRestaurant,
  type RestaurantWritePayload,
} from '../api/restaurants'
import { ManageFormLocationMapSection } from '../components/ManageFormLocationMapSection'
import {
  clampMenuTextLineCount,
  MAX_MENU_LINES,
  menuItemsToMenuLinesText,
  parseMenuLinesText,
} from '../lib/menuLines'
import { coordsFieldsBothEmpty, readGpsFromImageFile } from '../lib/imageExifGps'
import { mapGeoHintMessage } from '../lib/mapGeoHint'
import { geolocationFailureMessage, requestGeolocation } from '../lib/requestGeolocation'
import { resolveCoordAddressForManageForm } from '../lib/resolveSeoulDistrictFromCoords'
import { recognizeMenuImageToMenuLines } from '../lib/menuOcr'
import { BROG_CATEGORIES, type BrogCategory, isBrogCategory } from '../lib/brogCategories'
import { BrogCategoryPickerIcon } from '../lib/brogCategoryPickerIcons'
import { runManageFormKakaoPlaceSearch } from '../lib/manageFormKakaoPlaceSearch'
import { BROG_ONLY } from '../config/features'
import {
  brogListRefreshNavigateState,
  getBrogListNavigatePath,
} from '../lib/brogListNavigation'
import {
  assumeAdminUi,
  canAccessBrogManageForRestaurant,
  isSuperAdmin,
  ROLE_SUPER_ADMIN,
} from '../lib/roles'
import { TEST_UI_SUPER_ADMIN_PERSONA } from '../lib/testUiAdminPersona'
import {
  BROG_MYG_REQUIRED_PHOTO_COUNT,
  BROG_NEW_REQUIRED_PHOTO_LABELS,
  brogNewRegisterRequiredPhotosError,
  mergeUploadedImageUrls,
} from '../lib/brogMygPhotoSlots'

const MAX_BROG_IMAGES = 6

type RestaurantManageFormState = Omit<RestaurantWritePayload, 'category'> & {
  category: BrogCategory | ''
}

export function RestaurantManagePage() {
  const { id } = useParams()
  const isNewBrog = !id
  const navigate = useNavigate()
  const menuPhotoInputRef = useRef<HTMLInputElement>(null)
  const brogImageInputRef = useRef<HTMLInputElement>(null)
  const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null
  const [user, setUser] = useState<User | null>(null)
  const [districts, setDistricts] = useState<District[]>([])
  const [form, setForm] = useState<RestaurantManageFormState>({
    name: '',
    city: '서울특별시',
    district_id: 0,
    category: '',
    summary: '',
    latitude: null,
    longitude: null,
    main_menu_name: '',
    main_menu_price: 10000,
    extra_card_menus: [],
    more_menu_items: [],
    status: 'published',
  })
  const [menuLinesText, setMenuLinesText] = useState('')
  const [imageUrls, setImageUrls] = useState<string[]>(() => (isNewBrog ? ['', '', ''] : []))
  const [brogImageBusy, setBrogImageBusy] = useState(false)
  const [exifGpsHint, setExifGpsHint] = useState('')
  const [ocrBusy, setOcrBusy] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(Boolean(id))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadedIsDeleted, setLoadedIsDeleted] = useState(false)
  const [mapLocateBusy, setMapLocateBusy] = useState(false)
  const [coordPickHint, setCoordPickHint] = useState('')
  const [managePlaceQuery, setManagePlaceQuery] = useState('')
  const [managePlaceBusy, setManagePlaceBusy] = useState(false)
  const [managePlaceHint, setManagePlaceHint] = useState('')
  const [manageAclRow, setManageAclRow] = useState<{
    district_id: number
    submitted_by_user_id?: number | null
  } | null>(null)
  const [mygCopyBusy, setMygCopyBusy] = useState(false)

  const onMapPickUserLocation = useCallback(
    async (lat: number, lng: number) => {
      const latR = Number(lat.toFixed(6))
      const lngR = Number(lng.toFixed(6))
      const r = await resolveCoordAddressForManageForm(lat, lng)
      const did = districts.find((d) => d.name === r.districtName)?.id
      setForm((f) => ({
        ...f,
        latitude: latR,
        longitude: lngR,
        ...(r.reason === 'ok' && did ? { district_id: did } : {}),
      }))
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

  useEffect(() => {
    if (!id) {
      setLoadedIsDeleted(false)
    }
  }, [id])

  useEffect(() => {
    void fetchDistricts()
      .then(setDistricts)
      .catch(() => setDistricts([]))
  }, [])

  useEffect(() => {
    if (!token) {
      if (assumeAdminUi()) {
        setUser(TEST_UI_SUPER_ADMIN_PERSONA)
        setError('')
        return
      }
      setUser(null)
      setError('로그인이 필요합니다.')
      setIsLoading(false)
      return
    }

    let cancelled = false
    fetchMe(token)
      .then((me) => {
        if (!cancelled) {
          setUser(me)
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '권한 확인에 실패했습니다.')
      })

    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (!districts.length || id) return
    setForm((f) => {
      if (f.district_id) return f
      if (user?.role !== ROLE_SUPER_ADMIN && user?.managed_district_id) {
        return { ...f, district_id: user.managed_district_id! }
      }
      const m = districts.find((d) => d.name === '마포구')
      if (m) return { ...f, district_id: m.id }
      return f
    })
  }, [districts, user, id])

  useEffect(() => {
    const numericId = Number(id)
    if (!id || !Number.isFinite(numericId)) {
      setManageAclRow(null)
      setIsLoading(false)
      return
    }
    if (!token && !assumeAdminUi()) return

    let cancelled = false
    setIsLoading(true)
    const load = token ? fetchRestaurantForManage(token, numericId) : fetchRestaurant(numericId)
    load
      .then((restaurant) => {
        if (cancelled) return
        setManageAclRow({
          district_id: restaurant.district_id,
          submitted_by_user_id: restaurant.submitted_by_user_id ?? null,
        })
        setLoadedIsDeleted(Boolean(restaurant.is_deleted))
        setMenuLinesText(menuItemsToMenuLinesText(restaurant.menu_items))
        const imgs =
          restaurant.image_urls && restaurant.image_urls.length > 0
            ? restaurant.image_urls
            : restaurant.image_url
              ? [restaurant.image_url]
              : []
        setImageUrls(imgs.slice(0, MAX_BROG_IMAGES))
        setForm({
          name: restaurant.name,
          city: restaurant.city,
          district_id: restaurant.district_id,
          category: restaurant.category as RestaurantManageFormState['category'],
          summary: restaurant.summary,
          latitude: restaurant.latitude,
          longitude: restaurant.longitude,
          main_menu_name: '',
          main_menu_price: 10000,
          extra_card_menus: [],
          more_menu_items: [],
          status: restaurant.status === 'draft' ? 'draft' : 'published',
        })
        if (user && !canAccessBrogManageForRestaurant(user, restaurant)) {
          setError('이 BroG를 수정할 권한이 없습니다.')
        } else {
          setError((msg) => (msg === '이 BroG를 수정할 권한이 없습니다.' ? '' : msg))
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'BroG 정보를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id, token, user])

  async function handleBrogImagesChange(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? [])
    event.target.value = ''
    const files = chosen.filter((f) => f.type.startsWith('image/'))
    if (!chosen.length) return
    if (!files.length) {
      setError('이미지 파일(jpeg, png, webp, gif)만 선택할 수 있습니다.')
      return
    }
    if (!token) {
      setError(assumeAdminUi() ? '테스트 UI: 이미지 업로드는 로그인 후 가능합니다.' : '로그인이 필요합니다.')
      return
    }
    const filled = imageUrls.filter((u) => u.trim()).length
    const room = MAX_BROG_IMAGES - filled
    if (room <= 0) {
      setError(`사진은 최대 ${MAX_BROG_IMAGES}장까지 등록할 수 있습니다.`)
      return
    }
    const slice = files.slice(0, room)
    setError('')
    setExifGpsHint('')
    setBrogImageBusy(true)
    try {
      const urls = await Promise.all(
        slice.map((file) => uploadCommunityImage(token, file, 'brog')),
      )
      setImageUrls((prev) =>
        mergeUploadedImageUrls(prev, urls, MAX_BROG_IMAGES, isNewBrog),
      )
      const gpsResults = await Promise.all(slice.map((file) => readGpsFromImageFile(file)))
      let filledFromExif = false
      setForm((prev) => {
        if (!coordsFieldsBothEmpty(prev.latitude, prev.longitude)) return prev
        for (const gps of gpsResults) {
          if (gps) {
            filledFromExif = true
            return { ...prev, latitude: gps.latitude, longitude: gps.longitude }
          }
        }
        return prev
      })
      const parts: string[] = []
      if (filledFromExif) {
        parts.push('업로드한 사진 중 GPS가 있는 첫 파일로 위도·경도를 채웠습니다. 필요하면 수정하세요.')
      }
      if (files.length > slice.length) {
        parts.push(`${files.length}장 중 ${slice.length}장만 반영했습니다(최대 ${MAX_BROG_IMAGES}장).`)
      }
      if (parts.length) setExifGpsHint(parts.join(' '))
    } catch (e) {
      setError(e instanceof Error ? e.message : '이미지 업로드에 실패했습니다.')
    } finally {
      setBrogImageBusy(false)
    }
  }

  function removeImageAt(index: number) {
    if (isNewBrog && index < BROG_MYG_REQUIRED_PHOTO_COUNT) {
      setImageUrls((prev) => prev.map((u, i) => (i === index ? '' : u)))
      return
    }
    setImageUrls((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleMenuPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    setError('')
    setOcrBusy(true)
    try {
      const lines = await recognizeMenuImageToMenuLines(file)
      setMenuLinesText(clampMenuTextLineCount(lines))
    } catch (e) {
      setError(e instanceof Error ? e.message : '사진 인식에 실패했습니다.')
    } finally {
      setOcrBusy(false)
    }
  }

  async function handlePurgePermanent() {
    if (!id || !isSuperAdmin(user?.role)) return
    if (!token) {
      setError(assumeAdminUi() ? '테스트 UI: 영구 삭제는 로그인 후 가능합니다.' : '로그인이 필요합니다.')
      return
    }
    if (!window.confirm('DB에서 이 BroG와 메뉴 행을 완전히 지웁니다. 되돌릴 수 없습니다. 계속할까요?')) {
      return
    }
    setError('')
    try {
      await purgeRestaurantPermanent(token, Number(id))
      navigate(getBrogListNavigatePath(), { replace: true, state: brogListRefreshNavigateState() })
    } catch (e) {
      setError(e instanceof Error ? e.message : '영구 삭제에 실패했습니다.')
    }
  }

  async function handleRestoreVisible() {
    if (!id || !isSuperAdmin(user?.role)) return
    if (!token) {
      setError(assumeAdminUi() ? '테스트 UI: 다시 공개는 로그인 후 가능합니다.' : '로그인이 필요합니다.')
      return
    }
    if (!window.confirm('지도·목록에 이 BroG를 다시 보이게 할까요?')) return
    setError('')
    try {
      await restoreRestaurant(token, Number(id))
      setLoadedIsDeleted(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '복구에 실패했습니다.')
    }
  }

  async function handleCopyBrogToMyG() {
    if (!id || !token) {
      setError(assumeAdminUi() ? '테스트 UI: MyG 복사는 로그인 후 가능합니다.' : '로그인이 필요합니다.')
      return
    }
    setMygCopyBusy(true)
    setError('')
    try {
      const post = await copyBrogToMyGPost(token, Number(id))
      navigate(`/known-restaurants/${post.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'MyG로 내려받지 못했습니다.')
    } finally {
      setMygCopyBusy(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) {
      setError(assumeAdminUi() ? '테스트 UI: 저장하려면 로그인하세요.' : '로그인이 필요합니다.')
      return
    }
    if (!form.district_id) {
      setError('구(district)를 선택하세요.')
      return
    }
    if (
      user?.role !== ROLE_SUPER_ADMIN &&
      user?.managed_district_id &&
      form.district_id !== user.managed_district_id
    ) {
      setError('담당 구에만 BroG를 등록할 수 있습니다.')
      return
    }
    const parsed = parseMenuLinesText(menuLinesText)
    if (parsed.errors.length > 0) {
      setError(parsed.errors.join(' '))
      return
    }
    if (!parsed.main.name) {
      setError('메뉴를 한 줄 이상 올바르게 입력하세요.')
      return
    }
    const { category: chosenCategory, ...formFields } = form
    if (!isBrogCategory(chosenCategory)) {
      setError('카테고리를 선택하세요.')
      return
    }
    if (isNewBrog) {
      const photoErr = brogNewRegisterRequiredPhotosError(imageUrls)
      if (photoErr) {
        setError(photoErr)
        return
      }
    }

    setError('')
    setIsSubmitting(true)
    try {
      const trimmedImages = imageUrls.map((u) => u.trim()).filter(Boolean).slice(0, MAX_BROG_IMAGES)
      const payload: RestaurantWritePayload = {
        ...formFields,
        category: chosenCategory,
        status: user?.role === ROLE_SUPER_ADMIN ? (form.status ?? 'published') : 'published',
        image_urls: trimmedImages,
        image_url: trimmedImages[0] ?? null,
        latitude: form.latitude == null || Number.isNaN(Number(form.latitude)) ? null : Number(form.latitude),
        longitude:
          form.longitude == null || Number.isNaN(Number(form.longitude)) ? null : Number(form.longitude),
        main_menu_name: parsed.main.name,
        main_menu_price: parsed.main.price_krw,
        extra_card_menus: parsed.extras,
        more_menu_items: parsed.more,
      }
      const saved = id ? await updateRestaurant(token, Number(id), payload) : await createRestaurant(token, payload)
      if (!id) {
        notifyUserProfileRefresh()
      }
      if (saved.status === 'published') {
        navigate(`/restaurants/${saved.id}`)
      } else {
        navigate(`/restaurants/manage/${saved.id}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const canCopyToMyG = Boolean(id) && !BROG_ONLY && Boolean(token) && manageAclRow != null && !loadedIsDeleted

  /** 빈 URL 슬롯(필수칸·URL 추가칸)은 길이만 늘리므로, 업로드 한도는 “채워진 장수” 기준. */
  const brogImageFilledCount = imageUrls.filter((u) => u.trim()).length

  const manageDetailPath = id ? `/restaurants/manage/${id}` : '/restaurants/manage/new'

  return (
    <div className="home-layout home-layout--hub home-layout--map-home app-route-hub">
      <div className="brog-screen brog-screen--list">
        <header className="brog-screen__header">
          <div>
            <p className="eyebrow">{id ? 'BroG · 수정' : 'BroG · 작성'}</p>
            <h1 className="brog-screen__title">{id ? 'BroG 수정' : 'BroG 작성'}</h1>
          </div>
        </header>

        <section
          className="brog-list-body brog-brog-manage-form"
          aria-label={id ? 'BroG 수정 폼' : 'BroG 등록 폼'}
        >
          {id ? (
            <p className="helper" style={{ margin: 0 }}>
              <Link className="compact-link" to={`/restaurants/${id}`}>
                공개 상세 보기
              </Link>
            </p>
          ) : null}
          {canCopyToMyG ? (
            <p className="helper" style={{ margin: 0 }}>
              <button
                type="button"
                className="compact-link"
                disabled={mygCopyBusy}
                onClick={() => void handleCopyBrogToMyG()}
              >
                {mygCopyBusy ? '내려받는 중…' : 'MyG로  내려받기'}
              </button>
            </p>
          ) : null}

          {isLoading ? <p>불러오는 중...</p> : null}
          {loadedIsDeleted ? (
            <p className="error" role="status">
              이 BroG는 목록·지도에서 숨겨진 상태입니다. 슈퍼는 다시 공개하거나 DB에서만 영구 삭제할 수 있습니다.
            </p>
          ) : null}
          {loadedIsDeleted && isSuperAdmin(user?.role) ? (
            <p className="helper" style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <button type="button" className="compact-link" onClick={handleRestoreVisible}>
                다시 공개
              </button>
              <button type="button" className="compact-link danger-text" onClick={handlePurgePermanent}>
                DB 영구 삭제
              </button>
            </p>
          ) : null}
          {!isLoading ? (
            <form className="form brog-manage-form" onSubmit={handleSubmit}>
              {user?.role === ROLE_SUPER_ADMIN ? (
                <label>
                  공개 상태
                  <select
                    value={form.status ?? 'published'}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        status: e.target.value === 'draft' ? 'draft' : 'published',
                      })
                    }
                  >
                    <option value="draft">초안 (지도·목록에 안 보임)</option>
                    <option value="published">공개 (지도·목록 노출)</option>
                  </select>
                </label>
              ) : null}
              <div className="brog-manage-form__name-district-row">
                <label className="brog-manage-form__name-field">
                  상호명
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    maxLength={200}
                  />
                </label>
                <label className="brog-manage-form__district-field">
                  구
                  <select
                    value={form.district_id || ''}
                    onChange={(e) => setForm({ ...form, district_id: Number(e.target.value) })}
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
                {form.category && !isBrogCategory(form.category) ? (
                  <p className="error" style={{ margin: '0 0 8px' }} role="status">
                    저장된 카테고리 「{form.category}」를 다시 선택해 주세요.
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
                        (form.category === c ? ' brog-category-picker__btn--active' : '')
                      }
                      onClick={() => setForm({ ...form, category: c })}
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
                <textarea
                  rows={4}
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                  required
                />
              </label>
              <div className="brog-manage-form__photos-block">
                <span className="brog-manage-form__photos-label" id="brog-manage-photos-label">
                  사진 (최대 {MAX_BROG_IMAGES}장)
                  {isNewBrog ? (
                    <>
                      {' '}
                      · 신규는 {BROG_NEW_REQUIRED_PHOTO_LABELS.join('·')} 각 1장 필수, 그 외 추가 선택
                    </>
                  ) : null}
                </span>
                <input
                  ref={brogImageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  multiple
                  className="visually-hidden"
                  aria-hidden
                  onChange={handleBrogImagesChange}
                />
                <div className="brog-manage-form__photo-toolbar" aria-labelledby="brog-manage-photos-label">
                  <button
                    type="button"
                    className="brog-manage-icon-btn"
                    title="파일에서 사진 추가"
                    aria-label="파일에서 사진 추가"
                    disabled={brogImageBusy || brogImageFilledCount >= MAX_BROG_IMAGES}
                    onClick={() => brogImageInputRef.current?.click()}
                  >
                    {brogImageBusy ? (
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
                    disabled={imageUrls.length >= MAX_BROG_IMAGES}
                    onClick={() =>
                      setImageUrls((prev) => (prev.length < MAX_BROG_IMAGES ? [...prev, ''] : prev))
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
                    {imageUrls.filter((u) => u.trim()).length}/{MAX_BROG_IMAGES}
                  </span>
                </div>
                {imageUrls.length > 0 ? (
                  <ul className="brog-manage-form__photo-url-list">
                    {imageUrls.map((url, i) => (
                      <li key={`url-row-${i}`} className="brog-manage-form__photo-url-row">
                        <span
                          className={
                            'brog-manage-form__photo-url-index' +
                            (isNewBrog && i < BROG_MYG_REQUIRED_PHOTO_COUNT
                              ? ' brog-manage-form__photo-url-index--role'
                              : '')
                          }
                        >
                          {isNewBrog && i < BROG_MYG_REQUIRED_PHOTO_COUNT ? (
                            <>
                              {BROG_NEW_REQUIRED_PHOTO_LABELS[i]}
                              <span className="brog-manage-form__photo-url-required-mark"> · 필수</span>
                            </>
                          ) : (
                            <>{isNewBrog ? `추가 ${i - BROG_MYG_REQUIRED_PHOTO_COUNT + 1}` : `${i + 1}.`}</>
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
                            isNewBrog && i < BROG_MYG_REQUIRED_PHOTO_COUNT
                              ? `${BROG_NEW_REQUIRED_PHOTO_LABELS[i]} 이미지 URL`
                              : `이미지 URL ${i + 1}`
                          }
                        />
                        <button type="button" className="compact-link" onClick={() => removeImageAt(i)}>
                          {isNewBrog && i < BROG_MYG_REQUIRED_PHOTO_COUNT ? '비우기' : '삭제'}
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
                  form.latitude != null && form.longitude != null
                    ? { lat: form.latitude, lng: form.longitude }
                    : null
                }
                mapLocateBusy={mapLocateBusy}
                onMyLocationClick={() => void onMapLocateGps()}
                onPickUserLocationOnMap={(la, ln) => void onMapPickUserLocation(la, ln)}
                getDetailPath={() => manageDetailPath}
                mapAriaLabel="BroG 매장 위치 선택 지도"
                coordPickHint={coordPickHint}
                latitude={form.latitude ?? null}
                longitude={form.longitude ?? null}
                onLatitudeChange={(v) => setForm((f) => ({ ...f, latitude: v }))}
                onLongitudeChange={(v) => setForm((f) => ({ ...f, longitude: v }))}
              />
              {exifGpsHint ? <p className="helper form-exif-gps-hint">{exifGpsHint}</p> : null}
              <label className="brog-manage-form__menu-block">
                <div className="brog-manage-form__menu-heading">
                  <span className="brog-manage-form__menu-heading-text" id="brog-manage-menu-label">
                    메뉴 목록 (최대 {MAX_MENU_LINES}줄)
                  </span>
                  <input
                    ref={menuPhotoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="visually-hidden"
                    aria-hidden
                    onChange={handleMenuPhotoChange}
                  />
                  <button
                    type="button"
                    className="brog-manage-icon-btn"
                    title={ocrBusy ? '메뉴 인식 중' : '메뉴 사진 불러오기'}
                    aria-label={ocrBusy ? '메뉴 사진 인식 중' : '메뉴 사진 불러오기'}
                    disabled={ocrBusy}
                    onClick={() => menuPhotoInputRef.current?.click()}
                  >
                    {ocrBusy ? (
                      <span className="brog-manage-icon-btn__spinner" aria-hidden />
                    ) : (
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4 16l4.586-4.586a2 2 0 0 1 2.828 0L16 16m-2-2 1.586-1.586a2 2 0 0 1 2.828 0L20 14M4 20h16V8l-5-5H4v17z"
                        />
                        <circle cx="9" cy="7" r="1.5" fill="currentColor" stroke="none" />
                      </svg>
                    )}
                  </button>
                </div>
                <textarea
                  rows={10}
                  value={menuLinesText}
                  onChange={(e) => setMenuLinesText(clampMenuTextLineCount(e.target.value))}
                  placeholder={'수육국밥 : 9000\n순대 : 5000\n막국수 : 8000'}
                  spellCheck={false}
                  aria-labelledby="brog-manage-menu-label"
                />
              </label>
              <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? '저장 중…' : '저장'}
              </button>
            </form>
          ) : null}

          {error ? <p className="error">{error}</p> : null}
        </section>
      </div>
    </div>
  )
}
