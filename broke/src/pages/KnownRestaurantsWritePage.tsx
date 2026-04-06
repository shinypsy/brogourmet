import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ACCESS_TOKEN_KEY } from '../api/auth'
import { createKnownRestaurantPost, uploadCommunityImage } from '../api/community'

export function KnownRestaurantsWritePage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [restaurantName, setRestaurantName] = useState('')
  const [district, setDistrict] = useState('마포구')
  const [mainMenuName, setMainMenuName] = useState('')
  const [mainMenuPrice, setMainMenuPrice] = useState(10000)
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)

  const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) {
      setSubmitError('로그인이 필요합니다.')
      return
    }
    setSubmitError('')
    setIsSubmitting(true)
    try {
      let imageUrl: string | null = null
      if (imageFile) {
        try {
          imageUrl = await uploadCommunityImage(token, imageFile)
        } catch (uploadErr) {
          const detail = uploadErr instanceof Error ? uploadErr.message : '이미지 업로드 실패'
          const ok = window.confirm(`${detail}\n\n이미지 없이 제보만 등록할까요?`)
          if (!ok) {
            throw uploadErr
          }
        }
      }
      await createKnownRestaurantPost(token, {
        title,
        body,
        restaurant_name: restaurantName,
        district,
        main_menu_name: mainMenuName,
        main_menu_price: mainMenuPrice,
        image_url: imageUrl,
      })
      navigate('/known-restaurants')
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
        <h1>MyBro 글쓰기</h1>
        <p className="helper">
          <Link to="/known-restaurants">목록으로</Link>
          {' · '}
          <Link to="/login">로그인</Link>
        </p>

        <form className="form" onSubmit={handleSubmit}>
          <label>
            제목
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required />
          </label>
          <label>
            소개
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={4}
              maxLength={8000}
              required
            />
          </label>
          <label>
            식당 이름
            <input
              value={restaurantName}
              onChange={(event) => setRestaurantName(event.target.value)}
              maxLength={200}
              required
            />
          </label>
          <label>
            구
            <input
              value={district}
              onChange={(event) => setDistrict(event.target.value)}
              placeholder="예: 마포구"
              maxLength={50}
              required
            />
          </label>
          <label>
            대표 메뉴명
            <input
              value={mainMenuName}
              onChange={(event) => setMainMenuName(event.target.value)}
              maxLength={200}
              required
            />
          </label>
          <label>
            대표 메뉴 가격 (원, 10,000 이하)
            <input
              type="number"
              min={0}
              max={10000}
              value={mainMenuPrice}
              onChange={(event) => setMainMenuPrice(Number(event.target.value))}
              required
            />
          </label>
          <label>
            이미지 첨부 (선택)
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
            />
            <p className="upload-hint">최대 5MB, jpg/png/webp/gif</p>
          </label>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? '등록 중...' : '등록'}
          </button>
        </form>
        {submitError ? <p className="error">{submitError}</p> : null}
      </section>
    </div>
  )
}
