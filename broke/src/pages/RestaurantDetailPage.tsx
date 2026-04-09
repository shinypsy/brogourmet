import { useCallback, useEffect, useState, type FormEvent } from 'react'
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
import { BrogListIcon } from '../components/detailScreenIcons'
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

function EventWriteIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M12 2.5l1.6 4.9h5.2l-4.2 3 1.6 5L12 15.4 7.8 15.4l1.6-5-4.2-3h5.2L12 2.5z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
        fill="rgba(212, 175, 55, 0.12)"
      />
      <path
        d="M12 8.2v4.1M9.95 10.25h4.1"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  )
}

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
  }, [id, reloadSocial])

  useEffect(() => {
    setHeroImgFailed(false)
    setHeroGalleryIndex(0)
  }, [restaurant?.id])

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
          <span className="brog-detail__error-list-link-icon" aria-hidden>
            <BrogListIcon size={18} />
          </span>
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
          현재 앱은 마포·용산·서대문·영등포·종로·중구 6개 구만 선택할 수 있습니다. 2단계에서 서울 전 구로 확장되면 다시 확인할 수 있습니다.
        </p>
        <Link className="compact-link brog-detail__error-list-link" to={getBrogListNavigatePath()}>
          <span className="brog-detail__error-list-link-icon" aria-hidden>
            <BrogListIcon size={18} />
          </span>
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
  const registrarRoleLabel = brogSubmitterRoleLabel(restaurant.submitted_by_role)

  return (
    <div className="brog-detail">
      <header className="brog-detail__topbar">
        <Link
          className="brog-detail__back"
          to={getBrogListNavigatePath()}
          title="BroG 리스트"
          aria-label="BroG 리스트로 이동"
        >
          <span className="brog-detail__back-icon" aria-hidden>
            <BrogListIcon />
          </span>
          <span className="brog-detail__back-label">BroG 리스트</span>
        </Link>
        <div className="brog-detail__topbar-links">
          <Link to="/map">지도</Link>
          {!BROG_ONLY ? <Link to="/known-restaurants/list">MyG</Link> : null}
        </div>
      </header>

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
          <div className="brog-detail__hero-placeholder">{heroSrc ? '이미지를 불러올 수 없습니다' : '사진 없음'}</div>
        )}
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

      <div className="brog-detail__body">
        {actionError ? (
          <p className="error brog-detail__action-error" role="alert">
            {actionError}
          </p>
        ) : null}
        {restaurant.points_eligible === false ? (
          <p className="helper brog-detail__no-points" role="status">
            이 매장은 같은 위치에 같은 이름으로 중복 등록된 구분 매장(이름 끝이 <code>_1</code>, <code>_2</code> 등)으로,
            <strong> 포인트 적립·정산 대상이 아닙니다.</strong>
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
              ♥ 좋아요 {engagement?.like_count ?? 0}
            </button>
            <span className="brog-detail__comment-count">댓글 {engagement?.comment_count ?? 0}</span>
          </div>
          {!token && !assumeAdminUi() ? (
            <p className="helper">좋아요·댓글은 로그인 후 이용할 수 있습니다.</p>
          ) : null}
          {!token && assumeAdminUi() ? (
            <p className="helper">테스트 UI: 좋아요·댓글 폼은 보이며, 실제 반영은 로그인 후입니다.</p>
          ) : null}
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
            ) : (
              <p className="helper">
                BroG 수정·목록 숨기기는 최종 관리자, 해당 구 지역 담당자, 또는 이 맛집을 등록한 본인만 할 수
                있습니다.
              </p>
            )}
            <Link className="compact-link compact-link--with-icon" to="/events/write" title="이벤트 작성">
              <EventWriteIcon size={20} />
              <span>이벤트</span>
            </Link>
          </div>
        </section>

      </div>
    </div>
  )
}
