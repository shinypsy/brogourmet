import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe, type User } from '../api/auth'
import { fetchDistricts, type District } from '../api/districts'
import { uploadCommunityImage } from '../api/community'
import {
  createRestaurant,
  fetchRestaurantForManage,
  purgeRestaurantPermanent,
  restoreRestaurant,
  updateRestaurant,
  type RestaurantWritePayload,
} from '../api/restaurants'
import {
  clampMenuTextLineCount,
  MAX_MENU_LINES,
  menuItemsToMenuLinesText,
  parseMenuLinesText,
} from '../lib/menuLines'
import { recognizeMenuImageToMenuLines } from '../lib/menuOcr'
import { BROG_CATEGORIES, type BrogCategory, isBrogCategory } from '../lib/brogCategories'
import {
  canManageBrog,
  canManageBrogForDistrict,
  isSuperAdmin,
  ROLE_SUPER_ADMIN,
} from '../lib/roles'

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
  const [ocrBusy, setOcrBusy] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(Boolean(id))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadedIsDeleted, setLoadedIsDeleted] = useState(false)

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
      setError('로그인이 필요합니다.')
      setIsLoading(false)
      return
    }

    let cancelled = false
    fetchMe(token)
      .then((me) => {
        if (!cancelled) {
          setUser(me)
          if (!canManageBrog(me.role)) {
            setError('슈퍼 관리자 또는 지역 담당자만 접근할 수 있습니다.')
          }
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
    if (user?.role !== ROLE_SUPER_ADMIN && user?.managed_district_id) {
      setForm((f) => ({ ...f, district_id: user.managed_district_id! }))
      return
    }
    const m = districts.find((d) => d.name === '마포구')
    if (m) setForm((f) => ({ ...f, district_id: f.district_id || m.id }))
  }, [districts, user, id])

  useEffect(() => {
    const numericId = Number(id)
    if (!id || !Number.isFinite(numericId)) {
      setIsLoading(false)
      return
    }
    if (!token) return

    let cancelled = false
    setIsLoading(true)
    fetchRestaurantForManage(token, numericId)
      .then((restaurant) => {
        if (cancelled) return
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
        if (
          user &&
          !canManageBrogForDistrict(user.role, user.managed_district_id, restaurant.district_id)
        ) {
          setError('이 맛집이 속한 구를 담당하지 않아 수정할 수 없습니다.')
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

  async function handleBrogImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !file.type.startsWith('image/') || !token) return
    if (imageUrls.length >= MAX_BROG_IMAGES) {
      setError(`사진은 최대 ${MAX_BROG_IMAGES}장까지 등록할 수 있습니다.`)
      return
    }
    setError('')
    setBrogImageBusy(true)
    try {
      const url = await uploadCommunityImage(token, file)
      setImageUrls((prev) => [...prev, url].slice(0, MAX_BROG_IMAGES))
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
      setMenuLinesText(lines)
    } catch (e) {
      setError(e instanceof Error ? e.message : '사진 인식에 실패했습니다.')
    } finally {
      setOcrBusy(false)
    }
  }

  async function handlePurgePermanent() {
    if (!token || !id || !isSuperAdmin(user?.role)) return
    if (!window.confirm('DB에서 이 BroG와 메뉴 행을 완전히 지웁니다. 되돌릴 수 없습니다. 계속할까요?')) {
      return
    }
    setError('')
    try {
      await purgeRestaurantPermanent(token, Number(id))
      navigate('/brog/list')
    } catch (e) {
      setError(e instanceof Error ? e.message : '영구 삭제에 실패했습니다.')
    }
  }

  async function handleRestoreVisible() {
    if (!token || !id || !isSuperAdmin(user?.role)) return
    if (!window.confirm('지도·목록에 이 BroG를 다시 보이게 할까요?')) return
    setError('')
    try {
      await restoreRestaurant(token, Number(id))
      setLoadedIsDeleted(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '복구에 실패했습니다.')
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token || !canManageBrog(user?.role)) {
      setError('슈퍼 관리자 또는 지역 담당자만 저장할 수 있습니다.')
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

  return (
    <section className="card">
      <h1>{id ? 'BroG 수정' : 'BroG 작성'}</h1>
      <p className="helper">
        <Link to="/me">Info</Link>
        {' · '}
        <Link to="/brog/list">BroG 리스트</Link>
        {' · '}
        <Link to="/map">지도</Link>
      </p>

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
          <label>
            카테고리
            <select
              value={form.category}
              onChange={(e) =>
                setForm({
                  ...form,
                  category: e.target.value as RestaurantManageFormState['category'],
                })
              }
              required
            >
              <option value="" disabled>
                선택
              </option>
              {form.category && !isBrogCategory(form.category) ? (
                <option value={form.category}>{form.category} (기존 값, 목록에 없음)</option>
              ) : null}
              {BROG_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
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
              첫 장이 목록·지도 대표 썸네일입니다. 업로드는 서버 저장(최대 5MB/장) 또는 아래에 URL을 직접 적어도 됩니다.
            </p>
            <input
              ref={brogImageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              style={{ display: 'none' }}
              onChange={handleBrogImageChange}
            />
            <p style={{ marginBottom: 10, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <button
                type="button"
                className="compact-link"
                disabled={brogImageBusy || imageUrls.length >= MAX_BROG_IMAGES}
                onClick={() => brogImageInputRef.current?.click()}
              >
                {brogImageBusy ? '업로드 중…' : '파일에서 추가'}
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
                {ocrBusy ? '사진에서 읽는 중…' : '메뉴판 사진에서 불러오기 (최대 10줄)'}
              </button>
            </p>
            <p className="helper" style={{ marginTop: 4 }}>
              사진 인식은 기기에서 처리됩니다. 처음에는 한글 OCR 데이터를 받아오느라 시간이 걸릴 수 있습니다. 인식 후
              줄마다 형식을 한 번씩 확인해 주세요.
            </p>
          </label>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? '저장 중...' : '저장'}
          </button>
        </form>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
    </section>
  )
}
