import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe, type User } from '../api/auth'
import { AUTH_CHANGE_EVENT } from '../authEvents'
import { deleteKnownRestaurantPost, fetchKnownRestaurantPosts, type KnownRestaurantPost } from '../api/community'
import { BrogRankCard } from '../components/BrogRankCard'
import { BrogRankGridCarousel } from '../components/BrogRankGridCarousel'
import type { RestaurantListItem } from '../api/restaurants'
import {
  BROG_DISTRICT_ALL,
  clampStage1District,
  isStage1LimitedDistricts,
  mygDistrictOptionsForUi,
  parseBrogDistrictUrlParam,
} from '../lib/deployStage1'
import { MYG_MAIN_MENU_PRICE_MAX_OPTIONS } from '../lib/mainMenuPriceMaxFilterOptions'
import { mygPostToRestaurantListItem } from '../lib/mygPostToRestaurantListItem'
import { canDeleteKnownRestaurantPost } from '../lib/roles'

/**
 * MyG 리스트 — 레이아웃·캐러셀은 BroG 리스트(`/brog/list`)와 동일(BrogRankCard + 8건 캐러셀).
 * 데이터만 본인 KnownRestaurant + 구 필터.
 */
export function KnownRestaurantsBoardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [hasToken, setHasToken] = useState(
    () => typeof window !== 'undefined' && Boolean(localStorage.getItem(ACCESS_TOKEN_KEY)?.trim()),
  )
  const [posts, setPosts] = useState<KnownRestaurantPost[]>([])
  const [listError, setListError] = useState('')
  const [isListLoading, setIsListLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [maxPrice, setMaxPrice] = useState(10000)
  const [carouselPage, setCarouselPage] = useState({ pageIndex: 0, pageCount: 1 })
  const onCarouselPagination = useCallback(
    (info: { pageIndex: number; pageCount: number }) => {
      setCarouselPage((prev) =>
        prev.pageIndex === info.pageIndex && prev.pageCount === info.pageCount ? prev : info,
      )
    },
    [],
  )

  const districtRaw = searchParams.get('district')

  const districtFilter = useMemo(
    () => clampStage1District(parseBrogDistrictUrlParam(districtRaw)),
    [districtRaw],
  )

  useEffect(() => {
    const next = clampStage1District(parseBrogDistrictUrlParam(districtRaw))
    if ((districtRaw ?? '') !== next) {
      setSearchParams({ district: next }, { replace: true })
    }
  }, [districtRaw, setSearchParams])

  const setDistrictFilter = useCallback(
    (gu: string) => {
      if (gu === BROG_DISTRICT_ALL) {
        setSearchParams({ district: BROG_DISTRICT_ALL }, { replace: true })
        return
      }
      setSearchParams({ district: clampStage1District(gu) }, { replace: true })
    },
    [setSearchParams],
  )

  const reload = useCallback(() => {
    setIsListLoading(true)
    setListError('')
    const t = localStorage.getItem(ACCESS_TOKEN_KEY)
    fetchKnownRestaurantPosts(t)
      .then(setPosts)
      .catch((loadError) => {
        setPosts([])
        setListError(loadError instanceof Error ? loadError.message : '목록을 불러오지 못했습니다.')
      })
      .finally(() => {
        setIsListLoading(false)
        setHasToken(Boolean(localStorage.getItem(ACCESS_TOKEN_KEY)?.trim()))
        const tok = localStorage.getItem(ACCESS_TOKEN_KEY)
        if (tok?.trim()) void fetchMe(tok).then(setUser).catch(() => setUser(null))
        else setUser(null)
      })
  }, [])

  useEffect(() => {
    void Promise.resolve().then(() => reload())
  }, [reload])

  useEffect(() => {
    function onAuth() {
      void reload()
    }
    window.addEventListener(AUTH_CHANGE_EVENT, onAuth)
    return () => window.removeEventListener(AUTH_CHANGE_EVENT, onAuth)
  }, [reload])

  async function handleDelete(postId: number) {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY)
    if (!token) return
    if (!window.confirm('이 글을 삭제할까요?')) return
    try {
      await deleteKnownRestaurantPost(token, postId)
      reload()
    } catch (e) {
      setListError(e instanceof Error ? e.message : '삭제에 실패했습니다.')
    }
  }

  const postsMatchingDistrict = useMemo(() => {
    if (districtFilter === BROG_DISTRICT_ALL) return posts
    return posts.filter((p) => (p.district ?? '').trim() === districtFilter)
  }, [posts, districtFilter])

  /** BroG 지도·목록과 동일 UI — 대표 메뉴 가격으로 클라이언트 필터 */
  const filteredPosts = useMemo(
    () => postsMatchingDistrict.filter((p) => Number(p.main_menu_price) <= maxPrice),
    [postsMatchingDistrict, maxPrice],
  )

  const restaurants = useMemo(() => filteredPosts.map(mygPostToRestaurantListItem), [filteredPosts])

  const pageTitle =
    districtFilter === BROG_DISTRICT_ALL ? '전체 보기 · 내 글' : `${districtFilter} · 내 글`
  const districtLabel = districtFilter === BROG_DISTRICT_ALL ? BROG_DISTRICT_ALL : districtFilter
  const mapDistrict = districtFilter

  const emptyHint =
    districtFilter === BROG_DISTRICT_ALL
      ? '아직 작성한 글이 없으면 「작성」에서 새 글을 추가해 보세요. 다른 구·가격 상한을 바꿔 보세요.'
      : `이 구·가격 조건에 맞는 내 글이 없습니다. 「${BROG_DISTRICT_ALL}」로 바꾸거나 가격 상한을 높여 보세요.`

  const carouselResetKey = useMemo(
    () => `${districtFilter}-${maxPrice}-${filteredPosts.map((p) => p.id).join('-')}`,
    [districtFilter, maxPrice, filteredPosts],
  )

  function renderMygRankCard(restaurant: RestaurantListItem, globalRank: number) {
    return (
      <BrogRankCard
        restaurant={restaurant}
        rank={globalRank}
        pinnedSlot={null}
        detailTo={`/known-restaurants/${restaurant.id}`}
        footer={
          user &&
          restaurant.submitted_by_user_id != null &&
          canDeleteKnownRestaurantPost(user, restaurant.submitted_by_user_id, restaurant.district) ? (
            <button
              type="button"
              className="brog-rank-card__delete-btn"
              onClick={() => void handleDelete(restaurant.id)}
            >
              삭제
            </button>
          ) : null
        }
      />
    )
  }

  return (
    <div className="brog-screen brog-screen--list">
      <header className="brog-screen__header">
        <div>
          <p className="eyebrow">MyG · 리스트</p>
          <h1 className="brog-screen__title">{pageTitle}</h1>
          <p className="brog-screen__meta">
            서울특별시 · {districtLabel} · 대표 메뉴 {maxPrice.toLocaleString()}원 이하 · 본인 작성 글만
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
        <div className="map-page-toolbar map-card myg-board-toolbar">
          <div className="map-page-toolbar__filters-row">
            <label className="price-filter map-page-toolbar__filter">
              가격 상한
              <select value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))}>
                {MYG_MAIN_MENU_PRICE_MAX_OPTIONS.map((price) => (
                  <option key={price} value={price}>
                    {price.toLocaleString()}원 이하
                  </option>
                ))}
              </select>
            </label>
            <label className="price-filter map-page-toolbar__filter">
              서울시
              <select
                value={districtFilter}
                onChange={(e) => setDistrictFilter(clampStage1District(e.target.value))}
              >
                {mygDistrictOptionsForUi().map((gu) => (
                  <option key={gu} value={gu}>
                    {gu}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="brog-list-toolbar__notes myg-board-toolbar__notes">
            <p className="helper brog-list-toolbar__note">
              <strong>BroG 리스트와 같은 카드·8건 캐러셀</strong>입니다. 카드를 누르면 MyG 상세로 이동합니다. 로그인한
              본인 글만 목록에 나옵니다.
            </p>
            <p className="helper brog-list-toolbar__note brog-list-toolbar__note--muted">
              <strong>« »</strong> 또는 카드 영역을 <strong>좌우로 드래그</strong>(휴대폰은 밀기)해 넘길 수 있습니다.
              {isStage1LimitedDistricts()
                ? ' 1단계: 구 선택은 BroG와 동일하게 6개 구로 한정됩니다.'
                : ''}
            </p>
          </div>
        </div>

        {!isListLoading && !listError ? (
          <p className="brog-list-body__count" role="status">
            <strong>{restaurants.length}</strong>건 · 가격 {maxPrice.toLocaleString()}원 이하
            {districtFilter === BROG_DISTRICT_ALL ? '' : ` · ${districtFilter}`}
            {carouselPage.pageCount > 1 ? (
              <>
                {' '}
                · 페이지 {carouselPage.pageIndex + 1} / {carouselPage.pageCount}
              </>
            ) : null}
          </p>
        ) : null}

        {listError ? <p className="error brog-list-body__error">{listError}</p> : null}
        {isListLoading ? <p className="brog-rank-loading">목록을 불러오는 중…</p> : null}

        {!isListLoading && restaurants.length === 0 && !listError ? (
          <article className="brog-rank-card brog-rank-card--empty">
            <p className="brog-rank-card__name">표시할 내 글이 없습니다</p>
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

        {!isListLoading && restaurants.length > 0 && !listError ? (
          <BrogRankGridCarousel
            items={restaurants}
            resetKey={carouselResetKey}
            getItemKey={(r) => r.id}
            renderItem={(r, globalRank) => renderMygRankCard(r, globalRank)}
            ariaLabel="MyG 카드 목록, 8건씩"
            onPaginationInfo={onCarouselPagination}
            carouselStepAriaUnit="건"
          />
        ) : null}
      </section>
    </div>
  )
}
