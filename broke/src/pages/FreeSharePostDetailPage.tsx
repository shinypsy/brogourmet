import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe, type User } from '../api/auth'
import {
  deleteFreeSharePost,
  fetchFreeSharePost,
  updateFreeSharePost,
  uploadCommunityImage,
  type FreeSharePost,
} from '../api/community'
import { assumeAdminUi, canDeleteCommunityPost, canEditCommunityPost } from '../lib/roles'
import { imgReferrerPolicyForResolvedSrc, resolveMediaUrl } from '../lib/mediaUrl'

export function FreeSharePostDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null

  const [user, setUser] = useState<User | null>(null)
  const [post, setPost] = useState<FreeSharePost | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [district, setDistrict] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploadBusy, setUploadBusy] = useState(false)

  const numericId = id ? Number(id) : NaN

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
    fetchFreeSharePost(numericId)
      .then((p) => {
        if (cancelled) return
        setPost(p)
        setTitle(p.title)
        setBody(p.body)
        setDistrict(p.district ?? '')
        setImageUrl(p.image_url)
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

  async function handleImageFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    if (!token) {
      setSaveError(assumeAdminUi() ? '테스트 UI: 업로드는 로그인 후 가능합니다.' : '로그인이 필요합니다.')
      return
    }
    setUploadBusy(true)
    setSaveError('')
    try {
      const url = await uploadCommunityImage(token, file)
      setImageUrl(url)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '업로드 실패')
    } finally {
      setUploadBusy(false)
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
      const updated = await updateFreeSharePost(token, post.id, {
        title: title.trim(),
        body: body.trim(),
        district: district.trim() || null,
        image_url: imageUrl,
      })
      setPost(updated)
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
    setSaveError('')
    setBusy(true)
    try {
      await deleteFreeSharePost(token, post.id)
      navigate('/free-share')
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
          <Link className="compact-link" to="/free-share">
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
        <h1>Freebie 글</h1>
        <p className="helper">
          <Link to="/free-share">목록</Link>
          {' · '}
          <Link to="/free-share/write">새 글</Link>
        </p>
        <p className="description">
          {post.author_nickname} · {new Date(post.created_at).toLocaleString()}
        </p>

        {imageUrl ? (
          <p>
            <img
              className="post-image"
              src={resolveMediaUrl(imageUrl)}
              alt=""
              referrerPolicy={imgReferrerPolicyForResolvedSrc(resolveMediaUrl(imageUrl))}
            />
          </p>
        ) : null}

        {canEdit ? (
          <form className="form" onSubmit={handleSave}>
            <label>
              제목
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
            </label>
            <label>
              내용
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={8000} required />
            </label>
            <label>
              구 (선택)
              <input value={district} onChange={(e) => setDistrict(e.target.value)} maxLength={50} />
            </label>
            <label>
              이미지 URL
              <input
                value={imageUrl ?? ''}
                onChange={(e) => setImageUrl(e.target.value.trim() || null)}
                placeholder="/uploads/… 또는 비우면 제거"
              />
            </label>
            <p style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                style={{ display: 'none' }}
                onChange={handleImageFile}
              />
              <button
                type="button"
                className="compact-link"
                disabled={uploadBusy}
                onClick={() => fileRef.current?.click()}
              >
                {uploadBusy ? '업로드 중…' : '파일에서 이미지 교체'}
              </button>
              <button
                type="button"
                className="compact-link"
                onClick={() => setImageUrl(null)}
                disabled={!imageUrl}
              >
                이미지 제거
              </button>
            </p>
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
            <p className="post-body">{post.body}</p>
            {post.district ? <p className="helper">구: {post.district}</p> : null}
            {!token ? (
              <p className="helper">로그인 후 권한에 따라 수정할 수 있습니다. 삭제는 최종 관리자만 가능합니다.</p>
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
