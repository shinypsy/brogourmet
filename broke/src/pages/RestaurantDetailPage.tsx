import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe, type User } from '../api/auth'
import {
  deleteRestaurantComment,
  deleteRestaurantLike,
  fetchRestaurantComments,
  fetchRestaurantEngagement,
  patchRestaurantComment,
  postRestaurantComment,
  postRestaurantLike,
  type RestaurantComment,
  type RestaurantEngagement,
} from '../api/restaurantEngagement'
import {
  deleteRestaurant,
  fetchRestaurant,
  purgeRestaurantPermanent,
  type RestaurantDetail,
} from '../api/restaurants'
import { FoodPhotoWithMenuOverlay } from '../components/FoodPhotoWithMenuOverlay'
import { imgReferrerPolicyForResolvedSrc, resolveMediaUrl } from '../lib/mediaUrl'
import { copyBrogToMyGPost } from '../api/community'
import { BROG_ONLY } from '../config/features'
import {
  brogListRefreshNavigateState,
  getBrogListNavigatePath,
} from '../lib/brogListNavigation'
import { brogSubmitterRoleLabel } from '../lib/brogSubmitter'
import { isBrogPhase1Restricted } from '../lib/brogPhase1'
import { restaurantDistrictVisibleInStage1 } from '../lib/deployStage1'
import {
  assumeAdminUi,
  canAccessBrogManageForRestaurant,
  canDeleteRestaurantComment,
  canEditRestaurantComment,
  isSuperAdmin,
} from '../lib/roles'

export function RestaurantDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [restaurant, setRestaurant] = useState<RestaurantDetail | null>(null)
  const [engagement, setEngagement] = useState<RestaurantEngagement | null>(null)
  const [comments, setComments] = useState<RestaurantComment[]>([])
  const [commentDraft, setCommentDraft] = useState('')
  /** 맛집 자체를 못 불러온 경우에만 사용 (이 값이 있으면 상세 화면 대신 오류 카드) */
  const [loadError, setLoadError] = useState('')
  /** 좋아요·댓글·삭제 등 — 상세는 유지하고 본문 상단에만 표시 */
  const [actionError, setActionError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [likeBusy, setLikeBusy] = useState(false)
  const [commentBusy, setCommentBusy] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null)
  const [commentEditText, setCommentEditText] = useState('')
  const [commentEditBusy, setCommentEditBusy] = useState(false)
  const [heroImgFailed, setHeroImgFailed] = useState(false)
  /** 다중 사진일 때 상단 히어로에 보여 줄 이미지 인덱스 */
  const [heroGalleryIndex, setHeroGalleryIndex] = useState(0)
  /** 히어로 클릭 시 같은 URL을 전체 화면에 표시 */
  const [heroLightboxOpen, setHeroLightboxOpen] = useState(false)
  const [mygCopyBusy, setMygCopyBusy] = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null

  useEffect(() => {
    if (!token) {
      setUser(null)
      return
    }
    void fetchMe(token).then(setUser).catch(() => setUser(null))
  }, [token])

  const reloadSocial = useCallback(
    async (restaurantId: number) => {
      const [eng, list] = await Promise.all([
        fetchRestaurantEngagement(restaurantId, token),
        fetchRestaurantComments(restaurantId),
      ])
      setEngagement(eng)
      setComments(list)
    },
    [token],
  )

  useEffect(() => {
    const numericId = Number(id)
    if (!Number.isFinite(numericId)) {
      setLoadError('잘못된 맛집 ID입니다.')
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setLoadError('')

    fetchRestaurant(numericId)
      .then(async (data) => {
        if (cancelled) return
        setRestaurant(data)
        try {
          await reloadSocial(numericId)
        } catch {
          if (!cancelled) {
            setEngagement({ like_count: 0, comment_count: 0, liked_by_me: false })
            setComments([])
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setRestaurant(null)
          setLoadError(err instanceof Error ? err.message : '맛집 정보를 불러오지 못했습니다.')
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id, reloadSocial, token])

  useEffect(() => {
    setHeroImgFailed(false)
    setHeroGalleryIndex(0)
  }, [restaurant?.id])

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

  async function handleSoftRemove() {
    if (!restaurant) return
    if (!token) {
      window.alert(
        assumeAdminUi() ? '테스트 UI: 목록 숨김은 로그인 후 API 호출이 필요합니다.' : '로그인 후 삭제할 수 있습니다.',
      )
      return
    }
    if (
      !window.confirm(
        '지도·목록에서 이 BroG를 숨길까요? (데이터는 DB에 남으며, 슈퍼 관리자만 영구 삭제할 수 있습니다.)',
      )
    ) {
      return
    }
    try {
      await deleteRestaurant(token, restaurant.id)
      navigate(getBrogListNavigatePath(), { replace: true, state: brogListRefreshNavigateState() })
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '삭제에 실패했습니다.')
    }
  }

  async function handleCopyBrogToMyG() {
    if (!restaurant || !token) {
      window.alert(
        assumeAdminUi() ? '테스트 UI: MyG 복사는 로그인 후 API 호출이 필요합니다.' : '로그인 후 이용할 수 있습니다.',
      )
      return
    }
    setMygCopyBusy(true)
    setActionError('')
    try {
      const post = await copyBrogToMyGPost(token, restaurant.id)
      navigate(`/known-restaurants/${post.id}`)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'MyG로 내려받지 못했습니다.')
    } finally {
      setMygCopyBusy(false)
    }
  }

  async function handlePurgePermanent() {
    if (!restaurant) return
    if (!token) {
      window.alert(
        assumeAdminUi() ? '테스트 UI: 영구 삭제는 로그인 후 가능합니다.' : '로그인 후 이용할 수 있습니다.',
      )
      return
    }
    if (!window.confirm('DB에서 이 BroG와 메뉴 행을 완전히 지웁니다. 되돌릴 수 없습니다. 계속할까요?')) {
      return
    }
    try {
      await purgeRestaurantPermanent(token, restaurant.id)
      navigate(getBrogListNavigatePath(), { replace: true, state: brogListRefreshNavigateState() })
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '영구 삭제에 실패했습니다.')
    }
  }

  async function toggleLike() {
    if (!restaurant) return
    if (!token) {
      window.alert(assumeAdminUi() ? '테스트 UI: 좋아요는 로그인 후 가능합니다.' : '로그인 후 좋아요할 수 있습니다.')
      return
    }
    setLikeBusy(true)
    setActionError('')
    try {
      if (engagement?.liked_by_me) {
        await deleteRestaurantLike(token, restaurant.id)
      } else {
        await postRestaurantLike(token, restaurant.id)
      }
      await reloadSocial(restaurant.id)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '좋아요 처리에 실패했습니다.')
    } finally {
      setLikeBusy(false)
    }
  }

  async function submitComment(event: FormEvent) {
    event.preventDefault()
    if (!restaurant) return
    if (!token) {
      window.alert(assumeAdminUi() ? '테스트 UI: 댓글 등록은 로그인 후 가능합니다.' : '로그인 후 댓글을 쓸 수 있습니다.')
      return
    }
    const text = commentDraft.trim()
    if (!text) return
    setCommentBusy(true)
    setActionError('')
    try {
      const created = await postRestaurantComment(token, restaurant.id, text)
      setCommentDraft('')
      setComments((prev) => {
        if (prev.some((c) => c.id === created.id)) return prev
        return [...prev, created]
      })
      setEngagement((e) =>
        e
          ? { ...e, comment_count: e.comment_count + 1 }
          : { like_count: 0, comment_count: 1, liked_by_me: false },
      )
      try {
        await reloadSocial(restaurant.id)
      } catch {
        /* 서버에는 반영됨 — 목록은 위에서 이미 반영 */
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '댓글 등록에 실패했습니다.')
    } finally {
      setCommentBusy(false)
    }
  }

  async function removeComment(commentId: number) {
    if (!restaurant) return
    if (!token) {
      window.alert(assumeAdminUi() ? '테스트 UI: 댓글 삭제는 로그인 후 가능합니다.' : '로그인 후 이용할 수 있습니다.')
      return
    }
    if (!window.confirm('이 댓글을 삭제할까요?')) return
    setActionError('')
    try {
      await deleteRestaurantComment(token, restaurant.id, commentId)
      setEditingCommentId((id) => (id === commentId ? null : id))
      setComments((prev) => prev.filter((c) => c.id !== commentId))
      setEngagement((e) =>
        e ? { ...e, comment_count: Math.max(0, e.comment_count - 1) } : e,
      )
      try {
        await reloadSocial(restaurant.id)
      } catch {
        /* 낙관적 갱신 유지 */
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '댓글 삭제에 실패했습니다.')
    }
  }

  async function saveCommentEdit(commentId: number) {
    if (!restaurant) return
    if (!token) {
      window.alert(assumeAdminUi() ? '테스트 UI: 댓글 수정은 로그인 후 가능합니다.' : '로그인 후 이용할 수 있습니다.')
      return
    }
    const text = commentEditText.trim()
    if (!text) return
    setCommentEditBusy(true)
    setActionError('')
    try {
      const updated = await patchRestaurantComment(token, restaurant.id, commentId, text)
      setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)))
      setEditingCommentId(null)
      setCommentEditText('')
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '댓글 수정에 실패했습니다.')
    } finally {
      setCommentEditBusy(false)
    }
  }

  if (isLoading) {
    return (
      <div className="brog-detail brog-detail--loading">
        <p>불러오는 중...</p>
      </div>
    )
  }

  if (!restaurant) {
    return (
      <div className="brog-detail brog-detail--error card">
        <h1>맛집을 찾을 수 없습니다</h1>
        <p className="description">{loadError || '목록에서 다시 선택해 주세요.'}</p>
        <Link className="compact-link brog-detail__error-list-link" to={getBrogListNavigatePath()}>
          BroG 리스트
        </Link>
      </div>
    )
  }

  if (isBrogPhase1Restricted() && !restaurantDistrictVisibleInStage1(restaurant.district)) {
    return (
      <div className="brog-detail brog-detail--error card">
        <h1>1단계에서 아직 공개하지 않는 구의 BroG입니다</h1>
        <p className="description">
          현재 서비스 구역에 포함되지 않은 구의 BroG입니다. 지역은 서울 25개 자치구 중에서 선택할 수 있습니다.
        </p>
        <Link className="compact-link brog-detail__error-list-link" to={getBrogListNavigatePath()}>
          BroG 리스트
        </Link>
      </div>
    )
  }

  const mainItem = restaurant.menu_items.find((item) => item.is_main_menu)
  const heroMenuName = mainItem?.name ?? restaurant.menu_items[0]?.name ?? '대표 메뉴'
  const heroMenuPrice = mainItem?.price_krw ?? restaurant.menu_items[0]?.price_krw ?? 0
  const canManage = canAccessBrogManageForRestaurant(user, restaurant)
  const galleryUrls =
    restaurant.image_urls && restaurant.image_urls.length > 0
      ? restaurant.image_urls
      : restaurant.image_url
        ? [restaurant.image_url]
        : []
  const heroIdx =
    galleryUrls.length > 0 ? Math.min(heroGalleryIndex, galleryUrls.length - 1) : 0
  const heroRawUrl = galleryUrls[heroIdx] ?? ''
  const heroSrc = heroRawUrl ? resolveMediaUrl(heroRawUrl) : ''
  const showHeroImg = Boolean(heroSrc) && !heroImgFailed
  const siteEventBodies = (restaurant.active_site_event_bodies ?? [])
    .map((x) => (typeof x === 'string' ? x : x == null ? '' : String(x)))
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  const registrarRoleLabel = brogSubmitterRoleLabel(restaurant.submitted_by_role)

  return (
    <div className="brog-detail">
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
          <p className="brog-detail__eyebrow">BroG</p>
          <h1
            className={
              restaurant.points_eligible !== false
                ? 'brog-detail__name brog-detail__name--primary'
                : 'brog-detail__name'
            }
          >
            {restaurant.name}
          </h1>
          <p className="brog-detail__main-menu">
            {heroMenuName} · {Math.max(0, heroMenuPrice).toLocaleString()}원 이하
          </p>
          <p className="brog-detail__sub">
            {restaurant.district} · {restaurant.category}
          </p>
        </div>
      </div>

      {galleryUrls.length > 1 ? (
        <div className="brog-detail__gallery" role="tablist" aria-label="BroG 사진 선택">
          {galleryUrls.map((u, idx) => {
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

      {siteEventBodies.length > 0 ? (
        <section className="brog-detail__section brog-detail__section--site-events" aria-label="이벤트">
          <h2>이벤트</h2>
          <ul className="brog-detail__site-event-bodies">
            {siteEventBodies.map((text, i) => (
              <li key={`${i}-${text.slice(0, 32)}`} className="brog-detail__site-event-item">
                <p className="brog-detail__site-event-text">{text}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="brog-detail__body">
        {actionError ? (
          <p className="error brog-detail__action-error" role="alert">
            {actionError}
          </p>
        ) : null}
        {restaurant.submitted_by_user_id != null ? (
          <section className="brog-detail__section brog-detail__registrar" aria-label="BroG 등록자">
            <h2>등록 정보</h2>
            <p className="brog-detail__registrar-line">
              <span className="muted">등록자</span>{' '}
              <strong className="brog-detail__registrar-nick">
                {restaurant.submitted_by_nickname?.trim() ||
                  `회원 #${restaurant.submitted_by_user_id}`}
              </strong>
              {registrarRoleLabel ? <span className="muted"> · {registrarRoleLabel}</span> : null}
              <span className="muted">
                {' '}
                · 등록일{' '}
                <time dateTime={restaurant.created_at}>
                  {Number.isNaN(Date.parse(restaurant.created_at))
                    ? restaurant.created_at
                    : new Date(restaurant.created_at).toLocaleString('ko-KR', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                </time>
              </span>
            </p>
            <p className="helper" style={{ marginTop: 8 }}>
              포인트 정산 시 위 등록자(닉네임·계정)을 기준으로 합니다. 댓글 작성자는 각 댓글에 표시됩니다.
            </p>
          </section>
        ) : null}
        {restaurant.summary || (!BROG_ONLY && token) ? (
          <section className="brog-detail__section">
            <h2>소개</h2>
            <table className="brog-detail__intro-table">
              <tbody>
                <tr>
                  <td className="brog-detail__intro-col-text">
                    {restaurant.summary ? (
                      <p className="brog-detail__summary">{restaurant.summary}</p>
                    ) : (
                      <p className="brog-detail__summary brog-detail__summary--empty">등록된 소개가 없습니다.</p>
                    )}
                  </td>
                  {!BROG_ONLY && token ? (
                    <td className="brog-detail__intro-col-action">
                      <button
                        type="button"
                        className="compact-link brog-detail__myg-copy-btn"
                        disabled={mygCopyBusy}
                        onClick={() => void handleCopyBrogToMyG()}
                      >
                        {mygCopyBusy ? '내려받는 중…' : 'MyG로  내려받기'}
                      </button>
                    </td>
                  ) : null}
                </tr>
              </tbody>
            </table>
          </section>
        ) : null}

        <section className="brog-detail__section brog-detail__engagement">
          <div className="brog-detail__engagement-row">
            <button
              type="button"
              className={`brog-detail__like-btn${engagement?.liked_by_me ? ' brog-detail__like-btn--on' : ''}`}
              onClick={() => void toggleLike()}
              disabled={likeBusy}
            >
              좋아요 {engagement?.like_count ?? 0}
            </button>
            <span className="brog-detail__comment-count">댓글 {engagement?.comment_count ?? 0}</span>
          </div>
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
              {restaurant.menu_items.map((item) => (
                <tr key={item.id}>
                  <td>{item.is_main_menu ? '대표' : '부메뉴'}</td>
                  <td>{item.name}</td>
                  <td>{item.price_krw.toLocaleString()}원</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="brog-detail__section">
          <h2>댓글</h2>
          <ul className="brog-detail__comments">
            {comments.map((c) => {
              const canEditComment = canEditRestaurantComment(
                user,
                c.user_id,
                restaurant.district_id,
              )
              const canDelComment = canDeleteRestaurantComment(user)
              return (
                <li key={c.id} className="brog-detail__comment">
                  <div className="brog-detail__comment-head">
                    <strong className="brog-detail__comment-author">
                      {c.author_nickname?.trim() || `회원 #${c.user_id}`}
                    </strong>
                    <time
                      className="muted brog-detail__comment-time"
                      dateTime={c.created_at}
                      title={c.created_at}
                    >
                      {Number.isNaN(Date.parse(c.created_at))
                        ? c.created_at
                        : new Date(c.created_at).toLocaleString('ko-KR', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                    </time>
                    {canEditComment && editingCommentId !== c.id ? (
                      <button
                        type="button"
                        className="brog-detail__comment-del"
                        onClick={() => {
                          setEditingCommentId(c.id)
                          setCommentEditText(c.body)
                        }}
                      >
                        수정
                      </button>
                    ) : null}
                    {canDelComment && editingCommentId !== c.id ? (
                      <button
                        type="button"
                        className="brog-detail__comment-del"
                        onClick={() => void removeComment(c.id)}
                      >
                        삭제
                      </button>
                    ) : null}
                    {canEditComment && editingCommentId === c.id ? (
                      <>
                        <button
                          type="button"
                          className="brog-detail__comment-del"
                          disabled={commentEditBusy || !commentEditText.trim()}
                          onClick={() => void saveCommentEdit(c.id)}
                        >
                          {commentEditBusy ? '저장 중…' : '저장'}
                        </button>
                        <button
                          type="button"
                          className="brog-detail__comment-del"
                          disabled={commentEditBusy}
                          onClick={() => {
                            setEditingCommentId(null)
                            setCommentEditText('')
                          }}
                        >
                          취소
                        </button>
                      </>
                    ) : null}
                  </div>
                  {editingCommentId === c.id ? (
                    <label className="brog-detail__comment-edit">
                      <span className="visually-hidden">댓글 수정</span>
                      <textarea
                        rows={3}
                        value={commentEditText}
                        onChange={(e) => setCommentEditText(e.target.value)}
                        maxLength={2000}
                      />
                    </label>
                  ) : (
                    <p>{c.body}</p>
                  )}
                </li>
              )
            })}
          </ul>
          {token || assumeAdminUi() ? (
            <form className="form brog-detail__comment-form" onSubmit={submitComment}>
              <p className="visually-hidden">댓글 작성 후 오른쪽에서 저장합니다.</p>
              <div className="brog-detail__comment-row">
                <label
                  className="brog-detail__comment-label brog-detail__comment-label-cell"
                  htmlFor={`brog-comment-${restaurant.id}`}
                >
                  댓글 작성
                </label>
                <textarea
                  id={`brog-comment-${restaurant.id}`}
                  className="brog-detail__comment-textarea-cell"
                  rows={3}
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  maxLength={2000}
                  placeholder="맛·분위기 등을 남겨 보세요."
                />
                <div className="brog-detail__comment-row-save">
                  <button
                    type="submit"
                    className="brog-detail__comment-save-btn"
                    disabled={commentBusy || !commentDraft.trim()}
                    aria-label={commentBusy ? '댓글 저장 중' : '댓글 저장'}
                  >
                    <span className="brog-detail__comment-save-btn__text">
                      {commentBusy ? (
                        <>
                          <span className="brog-detail__comment-save-line">저장</span>
                          <span className="brog-detail__comment-save-line">중…</span>
                        </>
                      ) : (
                        <>
                          <span className="brog-detail__comment-save-line">댓글</span>
                          <span className="brog-detail__comment-save-line">저장</span>
                        </>
                      )}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          ) : null}
        </section>

        <section className="brog-detail__section brog-detail__admin">
          <h2>관리</h2>
          <div className="compact-links">
            {canManage ? (
              <>
                <Link className="compact-link" to={`/restaurants/manage/${restaurant.id}`}>
                  수정
                </Link>
                <button type="button" className="compact-link" onClick={handleSoftRemove}>
                  목록에서 숨기기
                </button>
                {isSuperAdmin(user?.role) ? (
                  <button type="button" className="compact-link danger-text" onClick={handlePurgePermanent}>
                    DB 영구 삭제
                  </button>
                ) : null}
              </>
            ) : null}
            <Link className="compact-link" to="/events/write" title="이벤트 작성">
              이벤트
            </Link>
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
