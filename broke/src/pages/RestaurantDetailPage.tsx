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
import { FoodPhotoWithMenuOverlay } from '../components/FoodPhotoWithMenuOverlay'
import { resolveMediaUrl } from '../lib/mediaUrl'
import { brogSubmitterRoleLabel } from '../lib/brogSubmitter'
import { canEditOrDeleteRestaurantComment, canManageBrogForDistrict, isSuperAdmin } from '../lib/roles'

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

  async function handleSoftRemove() {
    if (!token || !restaurant) return
    if (
      !window.confirm(
        '지도·목록에서 이 BroG를 숨길까요? (데이터는 DB에 남으며, 슈퍼 관리자만 영구 삭제할 수 있습니다.)',
      )
    ) {
      return
    }
    try {
      await deleteRestaurant(token, restaurant.id)
      navigate('/brog/list')
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '삭제에 실패했습니다.')
    }
  }

  async function handlePurgePermanent() {
    if (!token || !restaurant) return
    if (!window.confirm('DB에서 이 BroG와 메뉴 행을 완전히 지웁니다. 되돌릴 수 없습니다. 계속할까요?')) {
      return
    }
    try {
      await purgeRestaurantPermanent(token, restaurant.id)
      navigate('/brog/list')
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '영구 삭제에 실패했습니다.')
    }
  }

  async function toggleLike() {
    if (!token || !restaurant) {
      window.alert('로그인 후 좋아요할 수 있습니다.')
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
    if (!token || !restaurant) {
      window.alert('로그인 후 댓글을 쓸 수 있습니다.')
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
    if (!token || !restaurant) return
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
    if (!token || !restaurant) return
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
        <Link className="compact-link" to="/brog/list">
          BroG 리스트
        </Link>
      </div>
    )
  }

  const mainItem = restaurant.menu_items.find((item) => item.is_main_menu)
  const heroMenuName = mainItem?.name ?? restaurant.menu_items[0]?.name ?? '대표 메뉴'
  const heroMenuPrice = mainItem?.price_krw ?? restaurant.menu_items[0]?.price_krw ?? 0
  const canManage = Boolean(
    user && canManageBrogForDistrict(user.role, user.managed_district_id, restaurant.district_id),
  )
  const galleryUrls =
    restaurant.image_urls && restaurant.image_urls.length > 0
      ? restaurant.image_urls
      : restaurant.image_url
        ? [restaurant.image_url]
        : []
  const heroSrc = galleryUrls[0] ? resolveMediaUrl(galleryUrls[0]) : ''
  const registrarRoleLabel = brogSubmitterRoleLabel(restaurant.submitted_by_role)

  return (
    <div className="brog-detail">
      <header className="brog-detail__topbar">
        <Link className="brog-detail__back" to="/brog/list">
          ← 리스트
        </Link>
        <div className="brog-detail__topbar-links">
          <Link to="/map">지도</Link>
          <Link to="/">Home</Link>
        </div>
      </header>

      <div className="brog-detail__hero">
        {heroSrc ? (
          <img src={heroSrc} alt="" className="brog-detail__hero-img" />
        ) : (
          <div className="brog-detail__hero-placeholder">사진 없음</div>
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
        <div className="brog-detail__gallery">
          {galleryUrls.slice(1).map((u, i) => (
            <FoodPhotoWithMenuOverlay
              key={`${i}-${u}`}
              menuName={heroMenuName}
              priceKrw={heroMenuPrice}
              className="brog-detail__gallery-item"
            >
              <img
                src={resolveMediaUrl(u)}
                alt=""
                className="brog-detail__gallery-thumb"
                loading="lazy"
              />
            </FoodPhotoWithMenuOverlay>
          ))}
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
        {restaurant.summary ? (
          <section className="brog-detail__section">
            <h2>소개</h2>
            <p className="brog-detail__summary">{restaurant.summary}</p>
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
          {!token ? <p className="helper">좋아요·댓글은 로그인 후 이용할 수 있습니다.</p> : null}
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
              const canModerateComment = Boolean(
                user && canEditOrDeleteRestaurantComment(user, c.user_id, restaurant.district_id),
              )
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
                    {canModerateComment && editingCommentId !== c.id ? (
                      <>
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
                        <button
                          type="button"
                          className="brog-detail__comment-del"
                          onClick={() => void removeComment(c.id)}
                        >
                          삭제
                        </button>
                      </>
                    ) : null}
                    {canModerateComment && editingCommentId === c.id ? (
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
          {token ? (
            <form className="form brog-detail__comment-form" onSubmit={submitComment}>
              <label>
                댓글 작성
                <textarea
                  rows={3}
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  maxLength={2000}
                  placeholder="맛·분위기 등을 남겨 보세요."
                />
              </label>
              <button type="submit" disabled={commentBusy || !commentDraft.trim()}>
                {commentBusy ? '등록 중...' : '등록'}
              </button>
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
              <p className="helper">BroG 수정·목록 숨기기는 최종 관리자 또는 해당 구 지역 담당자만 할 수 있습니다.</p>
            )}
            <Link className="compact-link" to="/payment">
              Pay 안내
            </Link>
          </div>
        </section>

      </div>
    </div>
  )
}
