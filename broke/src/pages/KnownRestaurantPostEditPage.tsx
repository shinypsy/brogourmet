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
import { KAKAO_MAP_APP_KEY, KAKAO_REST_API_KEY } from '../api/config'
import { createRestaurantFromMyGPost } from '../api/restaurants'
import { fetchDistricts, type District } from '../api/districts'
import { BrogKakaoMap } from '../components/BrogKakaoMap'
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
import { fetchKakaoKeywordFirstPlace } from '../lib/kakaoKeywordSearch'
import { assumeAdminUi, canDeleteKnownRestaurantPost, canEditCommunityPost } from '../lib/roles'
import { STAGE1_DEFAULT_DISTRICT } from '../lib/deployStage1'

const MAX_IMAGES = 5

function isBrogShapedPost(p: KnownRestaurantPost): boolean {
  return p.district_id != null && p.district_id >= 1
}

function mygListHref(post: KnownRestaurantPost | null): string {
  const d = post?.district?.trim()
  return d ? `/known-restaurants/list?district=${encodeURIComponent(d)}` : '/known-restaurants/list'
}

function mygMapHref(post: KnownRestaurantPost | null): string {
  const d = post?.district?.trim() || STAGE1_DEFAULT_DISTRICT
  return `/known-restaurants/map?district=${encodeURIComponent(d)}`
}

export function KnownRestaurantPostEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const menuPhotoInputRef = useRef<HTMLInputElement>(null)
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
      navigate('/known-restaurants/list')
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
          <h2>BroG 상세의 「수정」처럼 별도 화면에서 편집합니다</h2>
          <p className="helper" style={{ marginTop: 8 }}>
            저장 후 자동으로 상세 화면으로 돌아갑니다.
          </p>
        </section>

        <section className="brog-detail__section card board-form-card">
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
              {' — '}이 글의 매장 정보·메뉴·사진을 그대로 반영해 <strong>공개 BroG</strong>에 새 맛집으로 올립니다.
              (본인 글만 가능 · BroG 규칙: 대표메뉴 1만원 이하·표준 카테고리·메뉴 줄 형식)
            </p>
          ) : null}

          <form className="form" onSubmit={handleSave}>
            {brogMode ? (
              <>
                <p className="helper" style={{ marginTop: 0 }}>
                  편집 필드는 MyG 작성·BroG 등록과 같은 순서입니다. 저장은 <strong>MyG DB</strong>이며, 새로 올리는 파일은{' '}
                  <code>/uploads/myg/</code> 경로로 저장됩니다.
                </p>
                <label>
                  이름
                  <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
                  <p className="helper" style={{ marginTop: 6 }}>
                    BroG 등록 화면과 같은 필드입니다. MyG에 저장되며, BroG 등록 시 BroG 쪽 규칙이 적용될 수 있습니다.
                  </p>
                </label>
                <p className="helper">
                  시·도는 지도에서 위치를 고르면 함께 맞춰지며, 기본값은 <strong>서울특별시</strong>입니다. (BroG 등록과
                  동일하게 폼에는 별도 입력 칸을 두지 않습니다.)
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
                    첫 장이 목록·지도 대표 썸네일입니다. 한 번에 최대 {MAX_IMAGES}장까지 선택해 동시에 올릴 수 있습니다. 서버
                    저장(최대 5MB/장) 또는 URL 입력. GPS가 있으면 위도·경도가 비어 있을 때 EXIF로 채웁니다. 파일은{' '}
                    <strong>MyG 전용</strong> 업로드(<code>/uploads/myg/</code>)입니다.
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
                      getDetailPath={() => `/known-restaurants/${post.id}`}
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
                      onChange={(e) => setLatitude(e.target.value === '' ? null : Number(e.target.value))}
                    />
                  </label>
                  <label>
                    경도
                    <input
                      type="number"
                      step="any"
                      value={longitude ?? ''}
                      onChange={(e) => setLongitude(e.target.value === '' ? null : Number(e.target.value))}
                    />
                  </label>
                </div>
                {exifGpsHint ? <p className="helper form-exif-gps-hint">{exifGpsHint}</p> : null}
                <label>
                  메뉴 목록 (최대 {MAX_MENU_LINES}줄)
                  <p className="helper" style={{ marginTop: 6, marginBottom: 8 }}>
                    한 줄에 <code>메뉴이름 : 가격</code> 형식. 첫 줄은 대표 메뉴(BroG 전환 시 10,000원 이하). MyG 저장 시
                    가격 상한 없음.
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
                    onChange={handleMenuPhotoChangeBrog}
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
                    인식 결과는 메뉴 목록에 <strong>덮어씁니다</strong>. <code>VITE_USE_CLOVA_OCR=1</code> 및 서버 CLOVA
                    키가 있으면 JPEG/PNG는 CLOVA 우선, 실패·WebP 등은 Tesseract. <code>메뉴명 : 가격</code> 형식을 확인하세요.
                  </p>
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
  )
}
