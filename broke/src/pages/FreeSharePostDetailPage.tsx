import { type ChangeEvent, type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe, type User } from '../api/auth'
import {
  createFreeShareComment,
  deleteFreeShareComment,
  deleteFreeSharePost,
  fetchFreeShareComments,
  fetchFreeSharePost,
  updateFreeSharePost,
  uploadCommunityImage,
  type FreeShareComment,
  type FreeSharePost,
} from '../api/community'
import {
  assumeAdminUi,
  canDeleteCommunityPost,
  canEditCommunityPost,
  canModerateCommunityPost,
} from '../lib/roles'
import { FREE_SHARE_BOARD_NAV, type CommunityBoardNav } from '../lib/communityBoardNav'
import {
  FREE_SHARE_CATEGORY_LABELS,
  FREE_SHARE_CATEGORY_VALUES,
  normalizeFreeShareCategory,
  type FreeShareCategoryValue,
} from '../lib/freeShareCategory'
import {
  FREE_SHARE_MAX_IMAGES,
  freeShareUrlFormRows,
  normalizeFreeShareImageUrls,
} from '../lib/freeShareImages'
import { imgReferrerPolicyForResolvedSrc, resolveMediaUrl } from '../lib/mediaUrl'
import { FreeSharePlacePicker } from '../components/FreeSharePlacePicker'

function galleryFromPost(p: FreeSharePost): string[] {
  return normalizeFreeShareImageUrls([...(p.image_urls ?? []), p.image_url])
}

function sharePlaceApiFields(lat: number | null, lng: number | null, label: string) {
  if (lat == null || lng == null) {
    return {
      share_latitude: null as number | null,
      share_longitude: null as number | null,
      share_place_label: null as string | null,
    }
  }
  const t = label.trim()
  return {
    share_latitude: lat,
    share_longitude: lng,
    share_place_label: t ? t.slice(0, 200) : null,
  }
}

export function FreeSharePostDetailPage({ boardNav }: { boardNav?: CommunityBoardNav } = {}) {
  const nav = boardNav ?? FREE_SHARE_BOARD_NAV
  const { id } = useParams()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null

  const [user, setUser] = useState<User | null>(null)
  const [post, setPost] = useState<FreeSharePost | null>(null)
  const [comments, setComments] = useState<FreeShareComment[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [resolvedDistrict, setResolvedDistrict] = useState<string | null>(null)
  const [galleryUrls, setGalleryUrls] = useState<string[]>([])
  const [editSlots, setEditSlots] = useState<string[]>(() => freeShareUrlFormRows([]))
  const [shareCompleted, setShareCompleted] = useState(false)
  const [shareCategory, setShareCategory] = useState<FreeShareCategoryValue>('other')
  const [shareLat, setShareLat] = useState<number | null>(null)
  const [shareLng, setShareLng] = useState<number | null>(null)
  const [sharePlaceLabel, setSharePlaceLabel] = useState('')
  const [editing, setEditing] = useState(false)
  const [commentDraft, setCommentDraft] = useState('')
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [commentsBusy, setCommentsBusy] = useState(false)

  const numericId = id ? Number(id) : NaN

  const reloadComments = useCallback(async () => {
    if (!Number.isFinite(numericId)) return
    try {
      const rows = await fetchFreeShareComments(numericId)
      setComments(rows)
    } catch {
      setComments([])
    }
  }, [numericId])

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
        setResolvedDistrict(p.district?.trim() ? p.district.trim() : null)
        const g = galleryFromPost(p)
        setGalleryUrls(g)
        setEditSlots(freeShareUrlFormRows(g))
        setShareCompleted(Boolean(p.share_completed))
        setShareCategory(normalizeFreeShareCategory(p.share_category))
        setShareLat(p.share_latitude ?? null)
        setShareLng(p.share_longitude ?? null)
        setSharePlaceLabel(p.share_place_label ?? '')
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : '글을 불러오지 못했습니다.')
      })
    return () => {
      cancelled = true
    }
  }, [numericId])

  useEffect(() => {
    if (!Number.isFinite(numericId) || !post) return
    void reloadComments()
  }, [numericId, post, reloadComments])

  const canEdit = Boolean(post && canEditCommunityPost(user, post.author_id, post.district))
  const canDelete = Boolean(post && canDeleteCommunityPost(user))
  const answerThread = Boolean(nav.answerThread)
  const canPostAnswer = Boolean(post && user && canModerateCommunityPost(user, post.district))

  const canRemoveComment = (c: FreeShareComment) =>
    Boolean(
      user &&
        post &&
        (c.user_id === user.id ||
          canDeleteCommunityPost(user) ||
          canModerateCommunityPost(user, post.district)),
    )

  function setEditSlot(index: number, value: string) {
    setEditSlots((prev) => prev.map((s, i) => (i === index ? value : s)))
  }

  function addEditLinkRow() {
    setEditSlots((prev) => {
      if (prev.length >= FREE_SHARE_MAX_IMAGES) return prev
      return [...prev, '']
    })
  }

  function openEdit() {
    if (!post) return
    const g = galleryFromPost(post)
    setGalleryUrls(g)
    setEditSlots(freeShareUrlFormRows(g))
    setShareLat(post.share_latitude ?? null)
    setShareLng(post.share_longitude ?? null)
    setSharePlaceLabel(post.share_place_label ?? '')
    setResolvedDistrict(post.district?.trim() ? post.district.trim() : null)
    setEditing(true)
  }

  async function handleImageFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    if (!token) {
      setSaveError(assumeAdminUi() ? '테스트 UI: 업로드는 로그인 후 가능합니다.' : '로그인이 필요합니다.')
      return
    }
    const current = normalizeFreeShareImageUrls(editSlots)
    if (current.length >= FREE_SHARE_MAX_IMAGES) {
      setSaveError(`이미지는 최대 ${FREE_SHARE_MAX_IMAGES}장까지입니다.`)
      return
    }
    setUploadBusy(true)
    setSaveError('')
    try {
      const url = await uploadCommunityImage(token, file)
      const next = normalizeFreeShareImageUrls([...current, url])
      setEditSlots(freeShareUrlFormRows(next))
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '업로드 실패')
    } finally {
      setUploadBusy(false)
    }
  }

  function clearAllImagesInEdit() {
    setEditSlots(freeShareUrlFormRows([]))
  }

  async function handleShareCompletedChange(event: ChangeEvent<HTMLInputElement>) {
    if (!canEdit || !post || !token) return
    const next = event.target.checked
    const prev = shareCompleted
    const urls = galleryUrls
    setShareCompleted(next)
    setBusy(true)
    setSaveError('')
    try {
      const updated = await updateFreeSharePost(token, post.id, {
        title: title.trim(),
        body: body.trim(),
        district: resolvedDistrict,
        image_urls: urls,
        share_completed: next,
        share_category: shareCategory,
        ...sharePlaceApiFields(shareLat, shareLng, sharePlaceLabel),
      })
      setPost(updated)
      const g = galleryFromPost(updated)
      setGalleryUrls(g)
      setEditSlots(freeShareUrlFormRows(g))
      setShareCompleted(Boolean(updated.share_completed))
      setShareCategory(normalizeFreeShareCategory(updated.share_category))
      setShareLat(updated.share_latitude ?? null)
      setShareLng(updated.share_longitude ?? null)
      setSharePlaceLabel(updated.share_place_label ?? '')
      setResolvedDistrict(updated.district?.trim() ? updated.district.trim() : null)
    } catch (e) {
      setShareCompleted(prev)
      setSaveError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setBusy(false)
    }
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    if (!post) return
    if (!token) {
      setSaveError(assumeAdminUi() ? '테스트 UI: 저장은 로그인 후 가능합니다.' : '로그인이 필요합니다.')
      return
    }
    const urls = normalizeFreeShareImageUrls(editSlots)
    setSaveError('')
    setBusy(true)
    try {
      const updated = await updateFreeSharePost(token, post.id, {
        title: title.trim(),
        body: body.trim(),
        district: resolvedDistrict,
        image_urls: urls,
        share_completed: shareCompleted,
        share_category: shareCategory,
        ...sharePlaceApiFields(shareLat, shareLng, sharePlaceLabel),
      })
      setPost(updated)
      const g = galleryFromPost(updated)
      setGalleryUrls(g)
      setEditSlots(freeShareUrlFormRows(g))
      setShareCompleted(Boolean(updated.share_completed))
      setShareCategory(normalizeFreeShareCategory(updated.share_category))
      setShareLat(updated.share_latitude ?? null)
      setShareLng(updated.share_longitude ?? null)
      setSharePlaceLabel(updated.share_place_label ?? '')
      setResolvedDistrict(updated.district?.trim() ? updated.district.trim() : null)
      setEditing(false)
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
      navigate(nav.listPath)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '삭제 실패')
    } finally {
      setBusy(false)
    }
  }

  async function handleCommentSubmit(event: FormEvent) {
    event.preventDefault()
    if (!token || !post) return
    const t = commentDraft.trim()
    if (!t) return
    setCommentsBusy(true)
    setSaveError('')
    try {
      await createFreeShareComment(token, post.id, t)
      setCommentDraft('')
      await reloadComments()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '댓글 등록 실패')
    } finally {
      setCommentsBusy(false)
    }
  }

  async function handleCommentDelete(commentId: number) {
    if (!token || !post) return
    if (!window.confirm('이 댓글을 삭제할까요?')) return
    setCommentsBusy(true)
    setSaveError('')
    try {
      await deleteFreeShareComment(token, post.id, commentId)
      await reloadComments()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '댓글 삭제 실패')
    } finally {
      setCommentsBusy(false)
    }
  }

  if (loadError) {
    return (
      <div className="home-layout home-layout--hub home-layout--map-home app-route-hub">
      <div className="board-layout">
        <section className="card">
          <p className="error">{loadError}</p>
          <Link className="compact-link" to={nav.listPath}>
            목록
          </Link>
        </section>
      </div>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="home-layout home-layout--hub home-layout--map-home app-route-hub">
      <div className="board-layout">
        <p>불러오는 중…</p>
      </div>
      </div>
    )
  }

  return (
    <div className="home-layout home-layout--hub home-layout--map-home app-route-hub">
    <div className="board-layout">
      <section className="card board-form-card free-share-detail">
        <p className="eyebrow">Community · {nav.boardName}</p>
        <p className="helper free-share-detail__nav">
          <Link to={nav.listPath}>목록</Link>
          {' · '}
          <Link to={nav.writePath}>새 글</Link>
        </p>

        {!editing && galleryUrls.length > 0 ? (
          <div className="free-share-detail__gallery">
            {galleryUrls.map((u, i) => {
              const r = resolveMediaUrl(u)
              return (
                <a
                  key={`${i}-${u}`}
                  className="free-share-detail__gallery-item"
                  href={r}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img
                    className="free-share-detail__gallery-img"
                    src={r}
                    alt=""
                    referrerPolicy={imgReferrerPolicyForResolvedSrc(r)}
                  />
                </a>
              )
            })}
          </div>
        ) : null}

        <p className="free-share-detail__byline">
          <span className="free-share-detail__author">{post.author_nickname}</span>
          <span className="free-share-detail__sep"> · </span>
          <time dateTime={post.created_at}>{new Date(post.created_at).toLocaleString()}</time>
        </p>

        {!editing ? (
          <>
            <h1 className="free-share-detail__title">{post.title}</h1>
            <p className="post-body free-share-detail__body">{post.body}</p>
            <FreeSharePlacePicker
              mode="view"
              latitude={post.share_latitude ?? null}
              longitude={post.share_longitude ?? null}
              placeLabel={post.share_place_label ?? ''}
              detailPostId={post.id}
              boardBasePath={nav.placeBasePath}
            />
          </>
        ) : (
          <form className="form free-share-detail__edit-form" onSubmit={handleSave}>
            <label>
              제목
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
            </label>
            <label>
              내용
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} maxLength={8000} required />
            </label>
            <label>
              분류
              <select value={shareCategory} onChange={(e) => setShareCategory(e.target.value as FreeShareCategoryValue)}>
                {FREE_SHARE_CATEGORY_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {FREE_SHARE_CATEGORY_LABELS[v]}
                  </option>
                ))}
              </select>
            </label>
            <FreeSharePlacePicker
              mode="edit"
              latitude={shareLat}
              longitude={shareLng}
              placeLabel={sharePlaceLabel}
              detailPostId={post.id}
              boardBasePath={nav.placeBasePath}
              onPlaceChange={(la, ln, lb) => {
                setShareLat(la)
                setShareLng(ln)
                setSharePlaceLabel(lb)
              }}
              onDistrictResolved={setResolvedDistrict}
            />
            <p className="free-share-detail__upload-row">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="visually-hidden"
                onChange={handleImageFile}
              />
              <button
                type="button"
                className="compact-link"
                disabled={uploadBusy || normalizeFreeShareImageUrls(editSlots).length >= FREE_SHARE_MAX_IMAGES}
                onClick={() => fileRef.current?.click()}
              >
                {uploadBusy ? '업로드 중…' : '파일에서 이미지 추가'}
              </button>
              <button type="button" className="compact-link" disabled={!normalizeFreeShareImageUrls(editSlots).length} onClick={clearAllImagesInEdit}>
                이미지 전부 비우기
              </button>
            </p>
            <fieldset className="free-share-images-fieldset">
              <legend>이미지 URL (링크 클릭 시 새 탭 · 줄당 최대 500자 · 최대 {FREE_SHARE_MAX_IMAGES}줄)</legend>
              {editSlots.map((slot, i) => (
                <label key={i} className="free-share-images-fieldset__url">
                  링크 {i + 1}
                  <input
                    value={slot}
                    onChange={(e) => setEditSlot(i, e.target.value)}
                    placeholder="https://… 또는 /uploads/…"
                    maxLength={500}
                  />
                </label>
              ))}
              <p className="free-share-images-fieldset__add-wrap">
                <button
                  type="button"
                  className="compact-link"
                  disabled={editSlots.length >= FREE_SHARE_MAX_IMAGES}
                  onClick={addEditLinkRow}
                >
                  링크 줄 추가
                </button>
                {editSlots.length >= FREE_SHARE_MAX_IMAGES ? (
                  <span className="upload-hint"> 최대 {FREE_SHARE_MAX_IMAGES}줄입니다.</span>
                ) : null}
              </p>
            </fieldset>
            <p className="free-share-detail__form-actions">
              <button type="submit" disabled={busy}>
                {busy ? '저장 중…' : '저장'}
              </button>
              <button
                type="button"
                className="compact-link"
                disabled={busy}
                onClick={() => {
                  setTitle(post.title)
                  setBody(post.body)
                  setResolvedDistrict(post.district?.trim() ? post.district.trim() : null)
                  const g = galleryFromPost(post)
                  setGalleryUrls(g)
                  setEditSlots(freeShareUrlFormRows(g))
                  setShareCompleted(Boolean(post.share_completed))
                  setShareCategory(normalizeFreeShareCategory(post.share_category))
                  setShareLat(post.share_latitude ?? null)
                  setShareLng(post.share_longitude ?? null)
                  setSharePlaceLabel(post.share_place_label ?? '')
                  setEditing(false)
                }}
              >
                취소
              </button>
            </p>
          </form>
        )}

        <section
          className="free-share-comments"
          aria-labelledby={answerThread ? 'free-share-answers-heading' : 'free-share-comments-heading'}
        >
          <h2
            id={answerThread ? 'free-share-answers-heading' : 'free-share-comments-heading'}
            className="free-share-comments__title"
          >
            {answerThread ? '답변' : '댓글'}
          </h2>
          {comments.length === 0 ? (
            <p className="helper">{answerThread ? '아직 답변이 없습니다.' : '아직 댓글이 없습니다.'}</p>
          ) : null}
          <ul className="free-share-comments__list">
            {comments.map((c) => (
              <li key={c.id} className="free-share-comments__item">
                <div className="free-share-comments__meta">
                  <strong>{c.author_nickname}</strong>
                  <time dateTime={c.created_at}>{new Date(c.created_at).toLocaleString()}</time>
                </div>
                <p className="free-share-comments__body">{c.body}</p>
                {canRemoveComment(c) ? (
                  <button
                    type="button"
                    className="compact-link danger-text"
                    disabled={commentsBusy}
                    onClick={() => void handleCommentDelete(c.id)}
                  >
                    삭제
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {answerThread && !token ? (
            <p className="helper">답변 등록은 로그인한 최종 관리자 또는 해당 구 지역 담당자만 할 수 있습니다.</p>
          ) : null}
          {answerThread && token && !canPostAnswer ? (
            <p className="helper">답변은 최종 관리자 또는 해당 구 지역 담당자만 등록할 수 있습니다.</p>
          ) : null}
          {token && (!answerThread || canPostAnswer) ? (
            <form className="free-share-comments__form" onSubmit={(e) => void handleCommentSubmit(e)}>
              <label className="free-share-comments__label">
                {answerThread ? '답변 작성' : '댓글 작성'}
                <textarea
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder={answerThread ? '답변 내용을 입력하세요' : '댓글을 입력하세요'}
                />
              </label>
              <button type="submit" disabled={commentsBusy || !commentDraft.trim()}>
                {commentsBusy ? '등록 중…' : answerThread ? '답변 등록' : '댓글 등록'}
              </button>
            </form>
          ) : null}
        </section>

        <div className="free-share-detail__footer">
          <label className="free-share-detail__complete">
            <input
              type="checkbox"
              checked={shareCompleted}
              disabled={!canEdit || busy || editing}
              onChange={(e) => void handleShareCompletedChange(e)}
            />
            {nav.completeCheckboxLabel}
          </label>
          <div className="free-share-detail__actions">
            {canEdit && !editing ? (
              <button type="button" className="compact-link" disabled={busy} onClick={openEdit}>
                수정
              </button>
            ) : null}
            {canDelete ? (
              <button type="button" className="compact-link danger-text" disabled={busy} onClick={() => void handleDelete()}>
                삭제(관리자)
              </button>
            ) : null}
          </div>
        </div>

        {saveError ? <p className="error">{saveError}</p> : null}
      </section>
    </div>
    </div>
  )
}
