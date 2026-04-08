import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe, type User } from '../api/auth'
import {
  deleteKnownRestaurantPost,
  fetchKnownRestaurantPost,
  updateKnownRestaurantPost,
  uploadCommunityImage,
  type KnownRestaurantPost,
} from '../api/community'
import { fetchDistricts, type District } from '../api/districts'
import {
  clampMenuTextLineCount,
  MAX_MENU_LINES,
  parseMenuLinesText,
} from '../lib/menuLines'
import { coordsFieldsBothEmpty, readGpsFromImageFile } from '../lib/imageExifGps'
import { recognizeMenuImageToMenuLines } from '../lib/menuOcr'
import { BROG_CATEGORIES, type BrogCategory, isBrogCategory } from '../lib/brogCategories'
import { assumeAdminUi, canDeleteCommunityPost, canEditCommunityPost } from '../lib/roles'
import { imgReferrerPolicyForResolvedSrc, resolveMediaUrl } from '../lib/mediaUrl'

const MAX_MY_G_IMAGES = 5

function isBrogShapedPost(p: KnownRestaurantPost): boolean {
  return p.district_id != null && p.district_id >= 1
}

export function KnownRestaurantPostDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const menuPhotoInputRef = useRef<HTMLInputElement>(null)
  const brogImageInputRef = useRef<HTMLInputElement>(null)
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
  const latLngRef = useRef({ lat: null as number | null, lng: null as number | null })
  latLngRef.current = { lat: latitude, lng: longitude }
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
  const [brogImageBusy, setBrogImageBusy] = useState(false)
  const [exifGpsHint, setExifGpsHint] = useState('')
  const [ocrBusy, setOcrBusy] = useState(false)

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
    let cancelled = false
    setLoadError('')
    fetchKnownRestaurantPost(numericId)
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
            (p.menu_lines?.trim() ||
              `${p.main_menu_name} : ${p.main_menu_price}`) as string,
          )
          setLatitude(p.latitude ?? null)
          setLongitude(p.longitude ?? null)
          const imgs =
            p.image_urls && p.image_urls.length > 0
              ? p.image_urls
              : p.image_url
                ? [p.image_url]
                : []
          setImageUrls(imgs.slice(0, MAX_MY_G_IMAGES))
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
  }, [numericId])

  const canEdit = Boolean(post && canEditCommunityPost(user, post.author_id, post.district))
  const canDelete = Boolean(post && canDeleteCommunityPost(user))

  const gallery =
    post && (post.image_urls?.length ? post.image_urls : post.image_url ? [post.image_url] : [])

  async function handleBrogImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    if (!token) {
      setSaveError(assumeAdminUi() ? '테스트 UI: 업로드는 로그인 후 가능합니다.' : '로그인이 필요합니다.')
      return
    }
    if (imageUrls.length >= MAX_MY_G_IMAGES) return
    setBrogImageBusy(true)
    setSaveError('')
    setExifGpsHint('')
    const gpsPromise = readGpsFromImageFile(file)
    try {
      const url = await uploadCommunityImage(token, file)
      setImageUrls((prev) => [...prev, url].slice(0, MAX_MY_G_IMAGES))
      const gps = await gpsPromise
      if (brogMode && gps) {
        const { lat, lng } = latLngRef.current
        if (coordsFieldsBothEmpty(lat, lng)) {
          setLatitude(gps.latitude)
          setLongitude(gps.longitude)
          setExifGpsHint('사진 EXIF에 GPS가 있어 위도·경도를 채웠습니다. 필요하면 수정하세요.')
        }
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '업로드 실패')
    } finally {
      setBrogImageBusy(false)
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
    setBusy(true)
    try {
      if (brogMode) {
        if (!districtId) {
          setSaveError('구를 선택하세요.')
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
        const trimmedImages = imageUrls.map((u) => u.trim()).filter(Boolean).slice(0, MAX_MY_G_IMAGES)
        const updated = await updateKnownRestaurantPost(token, post.id, {
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
        setPost(updated)
      } else {
        const updated = await updateKnownRestaurantPost(token, post.id, {
          title: legTitle.trim(),
          body: legBody.trim(),
          restaurant_name: legRestaurant.trim(),
          district: legDistrict.trim(),
          main_menu_name: legMainName.trim(),
          main_menu_price: Number(legMainPrice),
          image_url: legImageUrl,
        })
        setPost(updated)
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setBusy(false)
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
      <div className="board-layout">
        <section className="card">
          <p className="error">{loadError}</p>
          <Link className="compact-link" to="/known-restaurants/list">
            목록
          </Link>
        </section>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="board-layout">
        <p>불러오는 중…</p>
      </div>
    )
  }

  return (
    <div className="board-layout">
      <section className="card board-form-card">
        <p className="eyebrow">Community</p>
        <h1>MyG 글</h1>
        <p className="helper">
          <Link to="/known-restaurants/list">목록</Link>
          {' · '}
          <Link to="/known-restaurants/write">새 글</Link>
        </p>
        <p className="description">
          {post.author_nickname} · {new Date(post.created_at).toLocaleString()}
          {post.category ? ` · ${post.category}` : null}
        </p>

        {canEdit ? (
          <form className="form" onSubmit={handleSave}>
            {brogMode ? (
              <>
                <label>
                  이름 (매장명)
                  <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
                </label>
                <label>
                  시·도
                  <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={100} required />
                </label>
                <label>
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
                <label>
                  카테고리
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as BrogCategory | '')}
                    required
                  >
                    <option value="" disabled>
                      선택
                    </option>
                    {BROG_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  소개
                  <textarea rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} required />
                </label>
                <label>
                  사진 (최대 {MAX_MY_G_IMAGES}장)
                  <p className="helper" style={{ marginTop: 6, marginBottom: 8 }}>
                    GPS가 포함된 JPEG 등은 위도·경도가 비어 있을 때 「파일에서 추가」로 넣으면 EXIF에서 자동으로 채웁니다.
                  </p>
                  <input
                    ref={brogImageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    style={{ display: 'none' }}
                    onChange={handleBrogImageChange}
                  />
                  <p style={{ marginBottom: 8 }}>
                    <button
                      type="button"
                      className="compact-link"
                      disabled={brogImageBusy || imageUrls.length >= MAX_MY_G_IMAGES}
                      onClick={() => brogImageInputRef.current?.click()}
                    >
                      {brogImageBusy ? '업로드 중…' : '파일에서 추가'}
                    </button>
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {imageUrls.map((url, i) => {
                      const preview = resolveMediaUrl(url.trim())
                      return (
                      <li key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                        {preview ? (
                          <img
                            src={preview}
                            alt=""
                            style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                            referrerPolicy={imgReferrerPolicyForResolvedSrc(preview)}
                          />
                        ) : null}
                        <input
                          style={{ flex: 1 }}
                          value={url}
                          onChange={(e) =>
                            setImageUrls((prev) => prev.map((u, j) => (j === i ? e.target.value : u)))
                          }
                        />
                        <button type="button" className="compact-link" onClick={() => setImageUrls((p) => p.filter((_, j) => j !== i))}>
                          제거
                        </button>
                      </li>
                      )
                    })}
                  </ul>
                  {imageUrls.length < MAX_MY_G_IMAGES ? (
                    <button
                      type="button"
                      className="compact-link"
                      onClick={() => setImageUrls((p) => [...p, ''].slice(0, MAX_MY_G_IMAGES))}
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
                {exifGpsHint ? <p className="helper form-exif-gps-hint">{exifGpsHint}</p> : null}
                <label>
                  메뉴 목록 (최대 {MAX_MENU_LINES}줄)
                  <textarea
                    rows={8}
                    value={menuLinesText}
                    onChange={(e) => setMenuLinesText(clampMenuTextLineCount(e.target.value))}
                    required
                  />
                  <input
                    ref={menuPhotoInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={async (ev) => {
                      const file = ev.target.files?.[0]
                      ev.target.value = ''
                      if (!file?.type.startsWith('image/')) return
                      setOcrBusy(true)
                      try {
                        setMenuLinesText(await recognizeMenuImageToMenuLines(file))
                      } catch (e) {
                        setSaveError(e instanceof Error ? e.message : 'OCR 실패')
                      } finally {
                        setOcrBusy(false)
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="compact-link"
                    disabled={ocrBusy}
                    onClick={() => menuPhotoInputRef.current?.click()}
                  >
                    {ocrBusy ? '읽는 중…' : '메뉴판 사진에서 불러오기'}
                  </button>
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
                  삭제(관리자)
                </button>
              ) : null}
            </p>
          </form>
        ) : (
          <>
            <h2>{post.title}</h2>
            <p className="post-body">
              {post.restaurant_name} ({post.district}) · {post.main_menu_name}{' '}
              {post.main_menu_price > 0 ? `${post.main_menu_price.toLocaleString()}원` : ''}
            </p>
            {post.summary ? <p className="post-body">{post.summary}</p> : <p className="post-body">{post.body}</p>}
            {gallery && gallery.length > 0 ? (
              <div>
                {gallery.map((url, i) => {
                  const src = resolveMediaUrl(url)
                  return (
                  <img
                    key={i}
                    className="post-image"
                    src={src}
                    alt=""
                    loading="lazy"
                    referrerPolicy={imgReferrerPolicyForResolvedSrc(src)}
                  />
                  )
                })}
              </div>
            ) : null}
            {token && canDelete && !canEdit ? (
              <p className="helper">
                <button type="button" className="compact-link danger-text" disabled={busy} onClick={handleDelete}>
                  삭제(관리자)
                </button>
              </p>
            ) : null}
          </>
        )}
        {saveError ? <p className="error">{saveError}</p> : null}
      </section>
    </div>
  )
}
