import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe, type User } from '../api/auth'
import {
  deleteKnownRestaurantPost,
  fetchKnownRestaurantPost,
  type KnownRestaurantPost,
} from '../api/community'
import { createRestaurantFromMyGPost } from '../api/restaurants'
import { notifyUserProfileRefresh } from '../authEvents'
import { FoodPhotoWithMenuOverlay } from '../components/FoodPhotoWithMenuOverlay'
import { MAX_MENU_LINES, parseMenuLine } from '../lib/menuLines'
import { galleryUrlsFromMygPost } from '../lib/mygPostGallery'
import { assumeAdminUi, canDeleteKnownRestaurantPost, canEditCommunityPost } from '../lib/roles'
import { imgReferrerPolicyForResolvedSrc, resolveMediaUrl } from '../lib/mediaUrl'
import { getMygListNavigatePath, mygListRefreshNavigateState } from '../lib/mygListNavigation'

function isBrogShapedPost(p: KnownRestaurantPost): boolean {
  return p.district_id != null && p.district_id >= 1
}

type MygReadOnlyMenuRow = { isMain: boolean; name: string; price: number }

function menuRowsForMygReadOnly(post: KnownRestaurantPost, brogMode: boolean): MygReadOnlyMenuRow[] {
  if (brogMode && post.menu_lines?.trim()) {
    const lines = post.menu_lines
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, MAX_MENU_LINES)
    const rows: MygReadOnlyMenuRow[] = []
    lines.forEach((line, i) => {
      const p = parseMenuLine(line)
      if (p) rows.push({ isMain: i === 0, name: p.name, price: p.price_krw })
    })
    if (rows.length) return rows
  }
  return [{ isMain: true, name: post.main_menu_name, price: post.main_menu_price }]
}

export function KnownRestaurantPostDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null

  const [user, setUser] = useState<User | null>(null)
  const [post, setPost] = useState<KnownRestaurantPost | null>(null)
  const [brogMode, setBrogMode] = useState(false)

  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [brogRegisterBusy, setBrogRegisterBusy] = useState(false)
  const [heroImgFailed, setHeroImgFailed] = useState(false)
  const [heroGalleryIndex, setHeroGalleryIndex] = useState(0)
  const [heroLightboxOpen, setHeroLightboxOpen] = useState(false)

  const numericId = id ? Number(id) : NaN

  useEffect(() => {
    setHeroImgFailed(false)
    setHeroGalleryIndex(0)
    setHeroLightboxOpen(false)
  }, [post?.id])

  useEffect(() => {
    setHeroLightboxOpen(false)
  }, [heroGalleryIndex, id])

  useEffect(() => {
    if (!heroLightboxOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHeroLightboxOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [heroLightboxOpen])

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
        setBrogMode(isBrogShapedPost(p))
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : '글을 불러오지 못했습니다.')
      })
    return () => {
      cancelled = true
    }
  }, [numericId, token])

  const canEdit = Boolean(post && canEditCommunityPost(user, post.author_id, post.district))
  const canDelete = Boolean(
    post && canDeleteKnownRestaurantPost(user, post.author_id, post.district),
  )
  const isMyPost = Boolean(user && post && user.id === post.author_id)

  const gallery = useMemo(() => (post ? galleryUrlsFromMygPost(post) : []), [post])
  const menuRows = useMemo(
    () => (post ? menuRowsForMygReadOnly(post, brogMode) : []),
    [post, brogMode],
  )

  const handleBrogRegister = useCallback(async () => {
    if (!post || !token) {
      setActionError(assumeAdminUi() ? '테스트 UI: BroG 등록은 로그인 후 가능합니다.' : '로그인이 필요합니다.')
      return
    }
    if (!window.confirm('이 MyG 글 내용으로 공개 BroG 맛집을 새로 등록할까요?')) return
    setBrogRegisterBusy(true)
    setActionError('')
    try {
      const r = await createRestaurantFromMyGPost(token, post.id)
      notifyUserProfileRefresh()
      navigate(`/restaurants/${r.id}`)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'BroG 등록에 실패했습니다.')
    } finally {
      setBrogRegisterBusy(false)
    }
  }, [post, token, navigate])

  const handleDelete = useCallback(async () => {
    if (!post) return
    if (!token) {
      setActionError(assumeAdminUi() ? '테스트 UI: 삭제는 로그인 후 가능합니다.' : '로그인이 필요합니다.')
      return
    }
    if (!window.confirm('이 글을 삭제할까요?')) return
    setBusy(true)
    setActionError('')
    try {
      await deleteKnownRestaurantPost(token, post.id)
      navigate(getMygListNavigatePath(), { state: mygListRefreshNavigateState() })
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '삭제 실패')
    } finally {
      setBusy(false)
    }
  }, [post, token, navigate])

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
        <p className="description">
          MyG 글은 로그인한 작성자 본인(및 운영 권한이 있는 경우)만 볼 수 있습니다.
        </p>
        <Link className="compact-link brog-detail__error-list-link" to="/known-restaurants/list">
          MyG 목록
        </Link>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="brog-detail brog-detail--loading">
        <p>불러오는 중…</p>
      </div>
    )
  }

  const heroIdx = gallery.length > 0 ? Math.min(heroGalleryIndex, gallery.length - 1) : 0
  const heroRawUrl = gallery[heroIdx] ?? ''
  const heroSrc = heroRawUrl ? resolveMediaUrl(heroRawUrl) : ''
  const showHeroImg = Boolean(heroSrc) && !heroImgFailed
  const heroMenuName = menuRows[0]?.name ?? post.main_menu_name
  const heroMenuPrice = menuRows[0]?.price ?? post.main_menu_price

  return (
    <div className="brog-detail brog-detail--myg-post">
      <div className="brog-detail__hero">
        {showHeroImg ? (
          <img
            key={heroRawUrl || heroIdx}
            src={heroSrc}
            alt=""
            className="brog-detail__hero-img"
            referrerPolicy={imgReferrerPolicyForResolvedSrc(heroSrc)}
            onError={() => setHeroImgFailed(true)}
          />
        ) : (
          <div className="brog-detail__hero-placeholder">
            {heroSrc ? '이미지를 불러올 수 없습니다' : '사진 없음'}
          </div>
        )}
        {showHeroImg ? (
          <a
            href={heroSrc}
            target="_blank"
            rel="noopener noreferrer"
            className="brog-detail__hero-zoom-hit"
            aria-label="사진 원본 크게 보기"
            title="클릭하면 크게 보기 · 길게 눌러 새 탭에서 열기"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
              e.preventDefault()
              setHeroLightboxOpen(true)
            }}
          />
        ) : null}
        <div className="brog-detail__hero-overlay">
          <p className="brog-detail__eyebrow">MyG</p>
          <h1 className="brog-detail__name">{brogMode ? post.restaurant_name : post.title}</h1>
          <p className="brog-detail__main-menu">
            {brogMode
              ? `${heroMenuName} · ${Math.max(0, heroMenuPrice).toLocaleString()}원 이하`
              : `${post.main_menu_name}${
                  post.main_menu_price > 0 ? ` · ${post.main_menu_price.toLocaleString()}원` : ''
                }`}
          </p>
          <p className="brog-detail__sub">
            {brogMode ? (
              <>
                {post.district} · {post.category ?? '카테고리 없음'}
              </>
            ) : (
              <>
                {post.restaurant_name} · {post.district}
              </>
            )}
          </p>
        </div>
      </div>

      {gallery.length > 1 ? (
        <div className="brog-detail__gallery" role="tablist" aria-label="MyG 사진 선택">
          {gallery.map((u, idx) => {
            const thumb = resolveMediaUrl(u)
            const selected = idx === heroIdx
            return (
              <button
                key={`${idx}-${u}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-label={`사진 ${idx + 1}로 보기`}
                className={
                  'brog-detail__gallery-tap' + (selected ? ' brog-detail__gallery-tap--active' : '')
                }
                onClick={() => {
                  setHeroGalleryIndex(idx)
                  setHeroImgFailed(false)
                }}
              >
                <FoodPhotoWithMenuOverlay
                  menuName={heroMenuName}
                  priceKrw={heroMenuPrice}
                  className="brog-detail__gallery-item"
                  compact
                >
                  <img
                    src={thumb}
                    alt=""
                    className="brog-detail__gallery-thumb"
                    loading={idx > 0 ? 'lazy' : 'eager'}
                    referrerPolicy={imgReferrerPolicyForResolvedSrc(thumb)}
                  />
                </FoodPhotoWithMenuOverlay>
              </button>
            )
          })}
        </div>
      ) : null}

      <div className="brog-detail__body">
        {actionError ? (
          <p className="error brog-detail__action-error" role="alert">
            {actionError}
          </p>
        ) : null}

        <section className="brog-detail__section brog-detail__registrar" aria-label="작성자">
          <h2>작성 정보</h2>
          <p className="brog-detail__registrar-line">
            <span className="muted">작성자</span>{' '}
            <strong className="brog-detail__registrar-nick">{post.author_nickname}</strong>
            <span className="muted"> · 작성일 </span>
            <time dateTime={post.created_at}>
              {Number.isNaN(Date.parse(post.created_at))
                ? post.created_at
                : new Date(post.created_at).toLocaleString('ko-KR', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
            </time>
            {post.category && !brogMode ? <span className="muted"> · {post.category}</span> : null}
          </p>
        </section>

        {brogMode && post.title.trim() !== post.restaurant_name.trim() ? (
          <section className="brog-detail__section">
            <h2>글 제목</h2>
            <p className="brog-detail__summary">{post.title}</p>
          </section>
        ) : null}

        <section className="brog-detail__section">
          <h2>소개</h2>
          {brogMode ? (
            <p className="brog-detail__summary">{post.summary?.trim() || post.body}</p>
          ) : (
            <p className="brog-detail__summary">{post.body}</p>
          )}
        </section>

        <section className="brog-detail__section">
          <h2>메뉴 · 가격</h2>
          <table className="menu-table">
            <thead>
              <tr>
                <th>구분</th>
                <th>메뉴명</th>
                <th>가격</th>
              </tr>
            </thead>
            <tbody>
              {menuRows.map((row, idx) => (
                <tr key={`${idx}-${row.name}-${row.price}`}>
                  <td>{row.isMain ? '대표' : '부메뉴'}</td>
                  <td>{row.name}</td>
                  <td>{row.price.toLocaleString()}원</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {isMyPost && token ? (
          <section className="brog-detail__section brog-detail__admin">
            <h2>BroG 공개</h2>
            <p className="helper">
              <button
                type="button"
                className="brog-screen__cta"
                disabled={brogRegisterBusy}
                onClick={() => void handleBrogRegister()}
              >
                {brogRegisterBusy ? 'BroG 등록 중…' : 'BroG 등록'}
              </button>
            </p>
          </section>
        ) : null}

        <section className="brog-detail__section brog-detail__admin">
          <h2>관리</h2>
          <div className="compact-links">
            {canEdit ? (
              <Link className="compact-link" to={`/known-restaurants/${post.id}/edit`}>
                수정
              </Link>
            ) : null}
            {token && canDelete ? (
              <button type="button" className="compact-link danger-text" disabled={busy} onClick={handleDelete}>
                삭제
              </button>
            ) : null}
          </div>
        </section>
      </div>

      {heroLightboxOpen && heroSrc
        ? createPortal(
            <div
              className="brog-detail__lightbox"
              role="dialog"
              aria-modal="true"
              aria-label="사진 원본"
              onClick={() => setHeroLightboxOpen(false)}
            >
              <div className="brog-detail__lightbox-inner" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="brog-detail__lightbox-close"
                  aria-label="닫기"
                  onClick={() => setHeroLightboxOpen(false)}
                >
                  ×
                </button>
                <img
                  src={heroSrc}
                  alt=""
                  className="brog-detail__lightbox-img"
                  referrerPolicy={imgReferrerPolicyForResolvedSrc(heroSrc)}
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
