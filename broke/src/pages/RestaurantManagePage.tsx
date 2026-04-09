import { type ChangeEvent, type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe, type User } from '../api/auth'
import { fetchDistricts, type District } from '../api/districts'
import { copyBrogToMyGPost, uploadCommunityImage } from '../api/community'
import { KAKAO_MAP_APP_KEY } from '../api/config'
import {
  createRestaurant,
  fetchRestaurant,
  fetchRestaurantForManage,
  purgeRestaurantPermanent,
  restoreRestaurant,
  updateRestaurant,
  type RestaurantWritePayload,
} from '../api/restaurants'
import { BrogKakaoMap } from '../components/BrogKakaoMap'
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

const MAX_BROG_IMAGES = 5

type RestaurantManageFormState = Omit<RestaurantWritePayload, 'category'> & {
  category: BrogCategory | ''
}

export function RestaurantManagePage() {
  const { id } = useParams()
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
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [brogImageBusy, setBrogImageBusy] = useState(false)
  const [exifGpsHint, setExifGpsHint] = useState('')
  const [ocrBusy, setOcrBusy] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(Boolean(id))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadedIsDeleted, setLoadedIsDeleted] = useState(false)
  const [mapLocateBusy, setMapLocateBusy] = useState(false)
  const [coordPickHint, setCoordPickHint] = useState('')
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
    const room = MAX_BROG_IMAGES - imageUrls.length
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
      setImageUrls((prev) => [...prev, ...urls].slice(0, MAX_BROG_IMAGES))
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

  return (
    <div className="brog-screen brog-screen--list">
      <header className="brog-screen__header">
        <div>
          <p className="eyebrow">{id ? 'BroG · 수정' : 'BroG · 작성'}</p>
          <h1 className="brog-screen__title">{id ? 'BroG 수정' : 'BroG 작성'}</h1>
          <p className="brog-screen__meta">
            {id
              ? '저장 후 공개 상세·관리에서 숨김·댓글·영구 삭제를 다룹니다.'
              : '지도·카드 맛집으로 등록합니다. 대표 메뉴 1만 원 이하.'}
          </p>
        </div>
        <div className="brog-screen__header-actions">
          <Link className="ghost-button" to="/me">
            Info
          </Link>
          <Link className="ghost-button" to="/brog/list">
            BroG 리스트
          </Link>
          <Link className="ghost-button" to="/map">
            지도
          </Link>
          {!BROG_ONLY ? (
            <Link className="brog-screen__cta" to="/known-restaurants/write">
              MyG 작성
            </Link>
          ) : null}
        </div>
      </header>

      <section className="card" aria-label={id ? 'BroG 수정 폼' : 'BroG 등록 폼'}>
      {!id ? (
        <div className="brog-screen__toolbar map-card" style={{ marginBottom: 12 }}>
          <div className="brog-list-toolbar__notes">
            <p className="helper brog-list-toolbar__note">
              공개 BroG 맛집으로 등록합니다. 대표 메뉴는 <strong>1만 원 이하</strong>, 표준 카테고리·메뉴 줄 형식을 지켜
              주세요.
            </p>
            <p className="helper brog-list-toolbar__note brog-list-toolbar__note--muted">
              개인 메모만 필요하면 MyG 작성을 이용하세요. 입력 필드 구성은 MyG와 같게 맞춰 두었습니다.
            </p>
          </div>
        </div>
      ) : null}
      {id ? (
        <p className="helper" style={{ marginTop: 8 }}>
          <Link className="compact-link" to={`/restaurants/${id}`}>
            공개 상세 보기
          </Link>
          {' — '}목록·지도에서 숨기기, 댓글 정리, DB 영구 삭제(슈퍼)는 상세 화면 「관리」에서 할 수 있습니다.
        </p>
      ) : null}
      {canCopyToMyG ? (
        <p className="helper" style={{ marginTop: 8 }}>
          <button
            type="button"
            className="compact-link"
            disabled={mygCopyBusy}
            onClick={() => void handleCopyBrogToMyG()}
          >
            {mygCopyBusy ? '내려받는 중…' : 'MyG로  내려받기'}
          </button>
          {' — '}이 BroG 내용을 그대로 복사해 내 MyG 개인 글을 새로 만듭니다. 로그인한 사용자면 누구나 사용할 수
          있습니다.
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
        <form className="form" onSubmit={handleSubmit}>
          <label>
            이름
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <p className="helper" style={{ marginTop: 6 }}>
              같은 구·비슷한 위치(위도·경도)에 같은 이름이 이미 있으면 저장 시 자동으로{' '}
              <code>이름_*</code>, <code>이름_1</code>, <code>이름_2</code>처럼 붙습니다. <code>_1</code>,{' '}
              <code>_2</code> 매장은 포인트 적립 대상이 아닙니다.
            </p>
          </label>
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
          ) : (
            <p className="helper">
              지역 담당자가 저장하면 <strong>지도·목록에 바로 반영</strong>됩니다. 삭제는 공개 상세 화면에서만 할 수
              있습니다.
            </p>
          )}
          <label>
            구 (district_id)
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
          <fieldset className="brog-category-fieldset">
            <legend>카테고리</legend>
            {form.category && !isBrogCategory(form.category) ? (
              <p className="helper" style={{ margin: 0 }}>
                저장된 값 「{form.category}」은(는) 현재 표준 목록에 없습니다. 아래에서 카테고리를 다시 골라
                주세요.
              </p>
            ) : null}
            <div className="brog-category-picker" role="group" aria-label="카테고리 선택">
              {BROG_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={
                    'brog-category-picker__btn' +
                    (form.category === c ? ' brog-category-picker__btn--active' : '')
                  }
                  onClick={() => setForm({ ...form, category: c })}
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
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              required
            />
          </label>
          <label>
            사진 (최대 {MAX_BROG_IMAGES}장)
            <p className="helper" style={{ marginTop: 6, marginBottom: 8 }}>
              첫 장이 목록·지도 대표 썸네일입니다. 한 번에 최대 {MAX_BROG_IMAGES}장까지 선택해 동시에 올릴 수 있습니다(남은
              슬롯만큼만 업로드). 서버 저장(최대 5MB/장) 또는 아래 URL 입력도 가능합니다. GPS가 있는 사진은 위도·경도가 비어 있을
              때 EXIF로 채웁니다.
            </p>
            <input
              ref={brogImageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              style={{ display: 'none' }}
              onChange={handleBrogImagesChange}
            />
            <p style={{ marginBottom: 10, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <button
                type="button"
                className="compact-link"
                disabled={brogImageBusy || imageUrls.length >= MAX_BROG_IMAGES}
                onClick={() => brogImageInputRef.current?.click()}
              >
                {brogImageBusy ? '업로드 중…' : '파일에서 추가 (여러 장 선택 가능)'}
              </button>
              <span className="helper">
                {imageUrls.length}/{MAX_BROG_IMAGES}장
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
            {imageUrls.length < MAX_BROG_IMAGES ? (
              <button
                type="button"
                className="compact-link"
                onClick={() => setImageUrls((prev) => [...prev, ''].slice(0, MAX_BROG_IMAGES))}
              >
                URL 줄 추가
              </button>
            ) : null}
          </label>
          <div className="restaurant-manage-location-map">
            <p className="helper" style={{ marginBottom: 8 }}>
              <strong>위치 지도</strong> · 메인과 비슷한 크기입니다. 지도를 <strong>길게 누르거나 우클릭</strong>하면 그
              지점의 위도·경도가 아래에 들어가고, 카카오 REST 키가 있으면 <strong>주소·구</strong>도 맞춰 집니다. 우측 하단
              「내 위치」는 GPS입니다.
            </p>
            {KAKAO_MAP_APP_KEY ? (
              <BrogKakaoMap
                userCoords={
                  form.latitude != null && form.longitude != null
                    ? { lat: form.latitude, lng: form.longitude }
                    : null
                }
                pins={[]}
                locating={mapLocateBusy}
                onMyLocationClick={() => void onMapLocateGps()}
                onPickUserLocationOnMap={(la, ln) => void onMapPickUserLocation(la, ln)}
                getDetailPath={(_id) => '/restaurants/manage/new'}
                mapAriaLabel="BroG 매장 위치 선택 지도"
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
          <label>
            위도
            <input
              type="number"
              step="any"
              value={form.latitude ?? ''}
              onChange={(e) =>
                setForm({ ...form, latitude: e.target.value === '' ? null : Number(e.target.value) })
              }
            />
          </label>
          <label>
            경도
            <input
              type="number"
              step="any"
              value={form.longitude ?? ''}
              onChange={(e) =>
                setForm({ ...form, longitude: e.target.value === '' ? null : Number(e.target.value) })
              }
            />
          </label>
          {exifGpsHint ? <p className="helper form-exif-gps-hint">{exifGpsHint}</p> : null}
          <label>
            메뉴 목록 (최대 {MAX_MENU_LINES}줄)
            <p className="helper" style={{ marginTop: 6, marginBottom: 8 }}>
              한 줄에 <code>메뉴이름 : 가격</code> 형식(콜론 <code>:</code> 또는 <code>：</code> 가능). 첫 줄은 대표
              메뉴(10,000원 이하), 2~4줄은 카드에 강조, 5~10줄은 상세 목록만.
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
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? '저장 중...' : '저장'}
          </button>
        </form>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
      </section>
    </div>
  )
}
