import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ACCESS_TOKEN_KEY } from '../api/auth'
import { createFreeSharePost, uploadCommunityImage } from '../api/community'

export function FreeShareWritePage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [district, setDistrict] = useState('마포구')
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
          const ok = window.confirm(`${detail}\n\n이미지 없이 글만 등록할까요?`)
          if (!ok) {
            throw uploadErr
          }
        }
      }
      await createFreeSharePost(token, {
        title,
        body,
        district: district.trim() || null,
        image_url: imageUrl,
      })
      navigate('/free-share')
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
        <h1>Freebie 글쓰기</h1>
        <p className="helper">
          <Link to="/free-share">목록으로</Link>
          {' · '}
          <Link to="/login">로그인</Link>
        </p>

        <form className="form" onSubmit={handleSubmit}>
          <label>
            제목
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required />
          </label>
          <label>
            내용
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={5}
              maxLength={8000}
              required
            />
          </label>
          <label>
            구 (선택)
            <input
              value={district}
              onChange={(event) => setDistrict(event.target.value)}
              placeholder="예: 마포구"
              maxLength={50}
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
