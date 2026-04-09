import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe, type User } from '../api/auth'
import type { RestaurantListItem } from '../api/restaurants'
import { deleteKnownRestaurantPost, fetchKnownRestaurantPosts, type KnownRestaurantPost } from '../api/community'
import { BrogRankCard } from '../components/BrogRankCard'
import {
  clampStage1District,
  isStage1LimitedDistricts,
  mygDistrictOptionsForUi,
  STAGE1_DEFAULT_DISTRICT,
} from '../lib/deployStage1'
import { canDeleteCommunityPost, canEditCommunityPost } from '../lib/roles'

const MYG_DISTRICT_ALL = 'all' as const

function mygPostToRestaurantListItem(post: KnownRestaurantPost): RestaurantListItem {
  const city = (post.city ?? '서울특별시').trim() || '서울특별시'
  return {
    id: post.id,
    name: post.restaurant_name,
    city,
    district_id: post.district_id ?? 0,
    district: post.district,
    category: post.category ?? '',
    summary: post.summary ?? '',
    image_url: post.image_url,
    image_urls: post.image_urls ?? undefined,
    latitude: post.latitude ?? null,
    longitude: post.longitude ?? null,
    main_menu_name: post.main_menu_name,
    main_menu_price: post.main_menu_price,
    points_eligible: true,
    is_franchise: post.is_franchise,
  }
}

export function KnownRestaurantsBoardPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [posts, setPosts] = useState<KnownRestaurantPost[]>([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)

  const hasToken =
    typeof window !== 'undefined' && Boolean(localStorage.getItem(ACCESS_TOKEN_KEY))

  const districtRaw = searchParams.get('district')
  const districtFilter =
    !districtRaw || districtRaw === MYG_DISTRICT_ALL ? MYG_DISTRICT_ALL : clampStage1District(districtRaw)

  useEffect(() => {
    if (!isStage1LimitedDistricts() || !districtRaw || districtRaw === MYG_DISTRICT_ALL) return
    const next = clampStage1District(districtRaw)
    if (next !== districtRaw) {
      setSearchParams({ district: next }, { replace: true })
    }
  }, [districtRaw, setSearchParams])

  const setDistrictFilter = useCallback(
    (gu: string) => {
      if (gu === MYG_DISTRICT_ALL) {
        setSearchParams({}, { replace: true })
        return
      }
      setSearchParams({ district: clampStage1District(gu) }, { replace: true })
    },
    [setSearchParams],
  )

  const reload = useCallback(() => {
    setIsLoading(true)
    setError('')
    const t = localStorage.getItem(ACCESS_TOKEN_KEY)
    fetchKnownRestaurantPosts(t)
      .then(setPosts)
      .catch((loadError) => {
        setPosts([])
        setError(loadError instanceof Error ? loadError.message : '목록을 불러오지 못했습니다.')
      })
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    void Promise.resolve().then(() => reload())
  }, [reload])

  useEffect(() => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY)
    if (!token) return
    void fetchMe(token).then(setUser).catch(() => {})
  }, [])

  async function handleDelete(postId: number) {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY)
    if (!token) return
    if (!window.confirm('이 글을 삭제할까요?')) return
    try {
      await deleteKnownRestaurantPost(token, postId)
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제에 실패했습니다.')
    }
  }

  const filteredPosts = useMemo(() => {
    if (districtFilter === MYG_DISTRICT_ALL) return posts
    return posts.filter((p) => (p.district ?? '').trim() === districtFilter)
  }, [posts, districtFilter])

  const pageTitle =
    districtFilter === MYG_DISTRICT_ALL ? '전체 구 · 내 글' : `${districtFilter} · 내 글`
  const districtLabel = districtFilter === MYG_DISTRICT_ALL ? '전체 구' : districtFilter
  const mapDistrict = districtFilter === MYG_DISTRICT_ALL ? STAGE1_DEFAULT_DISTRICT : districtFilter

  const emptyHint =
    districtFilter === MYG_DISTRICT_ALL
      ? '아직 작성한 글이 없으면 「작성」에서 새 글을 추가해 보세요. 다른 구를 고르면 해당 구 글만 볼 수 있습니다.'
      : `이 구에 해당하는 내 글이 없습니다. 구 필터를 「전체 구」로 바꾸거나 작성해 보세요.`

  return (
    <div className="brog-screen brog-screen--list">
      <header className="brog-screen__header">
        <div>
          <p className="eyebrow">MyG · 리스트</p>
          <h1 className="brog-screen__title">{pageTitle}</h1>
          <p className="brog-screen__meta">
            서울특별시 · {districtLabel} · 가격 상한 없음 · 본인 작성 글만
          </p>
        </div>
        <div className="brog-screen__header-actions">
          <Link
            className="ghost-button"
            to={`/known-restaurants/map?district=${encodeURIComponent(mapDistrict)}`}
          >
            지도
          </Link>
          <Link className="brog-screen__cta" to="/known-restaurants/write">
            작성
          </Link>
        </div>
      </header>

      <section className="brog-list-body" aria-label="MyG 목록">
        <div className="brog-screen__toolbar brog-screen__toolbar--list map-card">
          <label className="price-filter brog-list-toolbar__filter">
            <span className="brog-list-toolbar__label">가격 상한</span>
            <select value="none" disabled aria-readonly>
              <option value="none">제한 없음 (MyG)</option>
            </select>
          </label>
          <label className="price-filter brog-list-toolbar__filter">
            <span className="brog-list-toolbar__label">서울시 구</span>
            <select
              value={districtFilter}
              onChange={(e) => {
                const v = e.target.value
                setDistrictFilter(v === MYG_DISTRICT_ALL ? MYG_DISTRICT_ALL : clampStage1District(v))
              }}
            >
              <option value={MYG_DISTRICT_ALL}>전체 구</option>
              {mygDistrictOptionsForUi().map((gu) => (
                <option key={gu} value={gu}>
                  {gu}
                </option>
              ))}
            </select>
          </label>
          <div className="brog-list-toolbar__notes">
            <p className="helper brog-list-toolbar__note">
              MyG는 개인공간입니다. 이 목록에는 <strong>로그인한 본인이 작성한 글만</strong> 보입니다. 글 작성은 로그인 후
              가능합니다. 수정은 작성자 본인·해당 구 지역 담당·최종 관리자만 할 수 있고, 삭제는 최종 관리자만 할 수
              있습니다.
            </p>
            <p className="helper brog-list-toolbar__note brog-list-toolbar__note--muted">
              카드를 누르면 상세로 이동합니다. 상세에서 본인 글은 BroG로 옮기거나(본인만), 권한이 있으면 수정·삭제할 수
              있습니다.
              {isStage1LimitedDistricts()
                ? ' 1단계: 구 선택은 BroG와 동일하게 6개 구로 한정됩니다.'
                : ''}
            </p>
          </div>
        </div>

        {!isLoading && !error ? (
          <p className="brog-list-body__count" role="status">
            <strong>{filteredPosts.length}</strong>건
            {districtFilter === MYG_DISTRICT_ALL ? '' : ` · ${districtFilter}`}
          </p>
        ) : null}

        {error ? <p className="error brog-list-body__error">{error}</p> : null}
        {isLoading ? <p className="brog-rank-loading">목록을 불러오는 중…</p> : null}
        {!isLoading && filteredPosts.length > 0 ? (
          <ul className="brog-rank-grid">
            {filteredPosts.map((post, index) => {
              const row = mygPostToRestaurantListItem(post)
              const showFooter =
                canEditCommunityPost(user, post.author_id, post.district) || canDeleteCommunityPost(user)
              return (
                <li key={post.id}>
                  <BrogRankCard
                    restaurant={row}
                    rank={index + 1}
                    detailTo={`/known-restaurants/${post.id}`}
                    footer={
                      showFooter ? (
                        <>
                          {canEditCommunityPost(user, post.author_id, post.district) ? (
                            <button
                              type="button"
                              className="brog-rank-card__delete-btn"
                              onClick={() => navigate(`/known-restaurants/${post.id}`)}
                            >
                              상세·수정
                            </button>
                          ) : null}
                          {canDeleteCommunityPost(user) ? (
                            <button
                              type="button"
                              className="brog-rank-card__delete-btn"
                              onClick={() => void handleDelete(post.id)}
                            >
                              삭제(관리자)
                            </button>
                          ) : null}
                        </>
                      ) : null
                    }
                  />
                </li>
              )
            })}
          </ul>
        ) : null}
        {!isLoading && filteredPosts.length === 0 && !error ? (
          <article className="brog-rank-card brog-rank-card--empty">
            <p className="brog-rank-card__name brog-rank-card__name--primary">표시할 내 글이 없습니다</p>
            {!hasToken ? (
              <p className="helper brog-list-body__empty-hint" style={{ marginBottom: 8 }}>
                로그인하면 작성한 MyG 글 목록이 표시됩니다.
              </p>
            ) : null}
            <p className="brog-rank-section__sub brog-list-body__empty-hint">{emptyHint}</p>
            <p className="helper" style={{ marginTop: 12 }}>
              <Link className="compact-link" to="/known-restaurants/write">
                MyG 작성하기
              </Link>
            </p>
          </article>
        ) : null}
      </section>
    </div>
  )
}
