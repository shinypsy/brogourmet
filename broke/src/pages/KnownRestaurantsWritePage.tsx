import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe, type User } from '../api/auth'
import { createKnownRestaurantPost, uploadCommunityImage } from '../api/community'
import { fetchDistricts, type District } from '../api/districts'
import {
  clampMenuTextLineCount,
  MAX_MENU_LINES,
  parseMenuLinesText,
} from '../lib/menuLines'
import { coordsFieldsBothEmpty, readGpsFromImageFile } from '../lib/imageExifGps'
import { recognizeMenuImageToMenuLines } from '../lib/menuOcr'
import { BROG_CATEGORIES, type BrogCategory, isBrogCategory } from '../lib/brogCategories'

const MAX_MY_G_IMAGES = 5

export function KnownRestaurantsWritePage() {
  const navigate = useNavigate()
  const menuPhotoInputRef = useRef<HTMLInputElement>(null)
  const brogImageInputRef = useRef<HTMLInputElement>(null)
  const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null

  const [user, setUser] = useState<User | null>(null)
  const [districts, setDistricts] = useState<District[]>([])
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
  const [brogImageBusy, setBrogImageBusy] = useState(false)
  const [exifGpsHint, setExifGpsHint] = useState('')
  const [ocrBusy, setOcrBusy] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

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

  async function handleBrogImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !file.type.startsWith('image/') || !token) return
    if (imageUrls.length >= MAX_MY_G_IMAGES) {
      setSubmitError(`사진은 최대 ${MAX_MY_G_IMAGES}장까지 등록할 수 있습니다.`)
      return
    }
    setSubmitError('')
    setExifGpsHint('')
    setBrogImageBusy(true)
    const gpsPromise = readGpsFromImageFile(file)
    try {
      const url = await uploadCommunityImage(token, file)
      setImageUrls((prev) => [...prev, url].slice(0, MAX_MY_G_IMAGES))
      const gps = await gpsPromise
      const { lat, lng } = latLngRef.current
      if (gps && coordsFieldsBothEmpty(lat, lng)) {
        setLatitude(gps.latitude)
        setLongitude(gps.longitude)
        setExifGpsHint('사진 EXIF에 GPS가 있어 위도·경도를 채웠습니다. 필요하면 수정하세요.')
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : '이미지 업로드에 실패했습니다.')
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
    setSubmitError('')
    setOcrBusy(true)
    try {
      const lines = await recognizeMenuImageToMenuLines(file)
      setMenuLinesText(lines)
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
      setSubmitError('구를 선택하세요.')
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
      const trimmedImages = imageUrls.map((u) => u.trim()).filter(Boolean).slice(0, MAX_MY_G_IMAGES)
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
    <div className="board-layout">
      <section className="card board-form-card">
        <p className="eyebrow">Community</p>
        <h1>MyG 글쓰기</h1>
        <p className="description">
          입력 항목은 <strong>BroG 등록 화면과 동일한 구성</strong>입니다. 나중에 BroG(지도·카드 맛집)로 옮길 때 그대로
          매핑할 수 있습니다. MyG만의 차이: <strong>가격 상한 없음</strong>(BroG 전환 시 대표 메뉴는 1만 원 이하로
          다시 맞춰야 합니다).
        </p>
        <p className="helper">
          <Link to="/known-restaurants/list">목록으로</Link>
          {' · '}
          <Link to="/restaurants/manage/new">BroG 등록</Link>
          {' · '}
          <Link to="/login">로그인</Link>
        </p>

        <form className="form" onSubmit={handleSubmit}>
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
            <textarea rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} required maxLength={8000} />
          </label>
          <label>
            사진 (최대 {MAX_MY_G_IMAGES}장)
            <p className="helper" style={{ marginTop: 6, marginBottom: 8 }}>
              첫 장이 목록 썸네일입니다. BroG와 동일하게 URL 직접 입력 또는 파일 업로드할 수 있습니다. GPS가 포함된 JPEG
              등은 위도·경도가 비어 있을 때 「파일에서 추가」로 넣으면 EXIF에서 자동으로 채웁니다.
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
                disabled={brogImageBusy || imageUrls.length >= MAX_MY_G_IMAGES}
                onClick={() => brogImageInputRef.current?.click()}
              >
                {brogImageBusy ? '업로드 중…' : '파일에서 추가'}
              </button>
              <span className="helper">
                {imageUrls.length}/{MAX_MY_G_IMAGES}장
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
            {imageUrls.length < MAX_MY_G_IMAGES ? (
              <button
                type="button"
                className="compact-link"
                onClick={() => setImageUrls((prev) => [...prev, ''].slice(0, MAX_MY_G_IMAGES))}
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
          {exifGpsHint ? <p className="helper form-exif-gps-hint">{exifGpsHint}</p> : null}
          <label>
            메뉴 목록 (최대 {MAX_MENU_LINES}줄)
            <p className="helper" style={{ marginTop: 6, marginBottom: 8 }}>
              BroG와 동일: 한 줄에 <code>메뉴이름 : 가격</code>. 첫 줄이 대표 메뉴(목록·썸네일에 쓰임).
            </p>
            <textarea
              rows={10}
              value={menuLinesText}
              onChange={(e) => setMenuLinesText(clampMenuTextLineCount(e.target.value))}
              placeholder={'수육국밥 : 9000\n순대 : 5000'}
              spellCheck={false}
              required
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
                {ocrBusy ? '사진에서 읽는 중…' : '메뉴판 사진에서 불러오기'}
              </button>
            </p>
          </label>
          {user ? (
            <p className="helper">
              작성자: <strong>{user.nickname}</strong> ({user.email})
            </p>
          ) : null}
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? '등록 중...' : '등록'}
          </button>
        </form>
        {submitError ? <p className="error">{submitError}</p> : null}
      </section>
    </div>
  )
}
