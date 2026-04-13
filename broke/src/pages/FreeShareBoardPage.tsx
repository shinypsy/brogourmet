import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe, type User } from '../api/auth'
import { AUTH_CHANGE_EVENT } from '../authEvents'
import { BrogRankGridCarousel } from '../components/BrogRankGridCarousel'
import { fetchFreeSharePosts, type FreeSharePost } from '../api/community'
import {
  FREE_SHARE_CATEGORY_LABELS,
  FREE_SHARE_CATEGORY_VALUES,
  normalizeFreeShareCategory,
  type FreeShareCategoryValue,
} from '../lib/freeShareCategory'
import { formatFreeShareListDate, formatFreeShareListPlace } from '../lib/freeShareListPlace'

const FREE_LIST_PAGE_SIZE = 10

type SearchMode = 'all' | 'nickname' | 'mine' | 'listno'

type FreeShareListRow = { post: FreeSharePost; listNo: number }

function normalizePost(p: FreeSharePost): FreeSharePost {
  return {
    ...p,
    share_completed: Boolean(p.share_completed),
    share_category: normalizeFreeShareCategory(p.share_category),
  }
}

function buildRows(
  posts: FreeSharePost[],
  categoryKey: 'all' | FreeShareCategoryValue,
  mode: SearchMode,
  nicknameApplied: string,
  listNoMaxApplied: number | null,
  userId: number | null,
): FreeShareListRow[] {
  let base = posts
  if (categoryKey !== 'all') {
    base = base.filter((p) => normalizeFreeShareCategory(p.share_category) === categoryKey)
  }
  const sorted = [...base].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
  /** 최신 글이 가장 큰 번호(작성 순서대로 증가하는 느낌). */
  let ranked: FreeShareListRow[] = sorted.map((post, i) => ({
    post,
    listNo: sorted.length - i,
  }))

  if (mode === 'nickname' && nicknameApplied.trim()) {
    const q = nicknameApplied.trim().toLowerCase()
    const sub = ranked.filter((r) => r.post.author_nickname.toLowerCase().includes(q))
    ranked = sub.map((r, i) => ({ ...r, listNo: sub.length - i }))
  }
  if (mode === 'mine') {
    if (userId == null) {
      return []
    }
    const sub = ranked.filter((r) => r.post.author_id === userId)
    ranked = sub.map((r, i) => ({ ...r, listNo: sub.length - i }))
  }
  if (mode === 'listno' && listNoMaxApplied != null && listNoMaxApplied > 0) {
    ranked = ranked.filter((r) => r.listNo <= listNoMaxApplied)
    ranked = [...ranked].sort((a, b) => b.listNo - a.listNo)
  }

  return ranked
}

export function FreeShareBoardPage() {
  const [posts, setPosts] = useState<FreeSharePost[]>([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)

  const [categoryKey, setCategoryKey] = useState<'all' | FreeShareCategoryValue>('all')
  const [searchMode, setSearchMode] = useState<SearchMode>('all')
  const [nicknameDraft, setNicknameDraft] = useState('')
  const [nicknameApplied, setNicknameApplied] = useState('')
  const [listNoDraft, setListNoDraft] = useState('')
  const [listNoApplied, setListNoApplied] = useState<number | null>(null)

  const [carouselPage, setCarouselPage] = useState({ pageIndex: 0, pageCount: 1 })
  const onCarouselPagination = useCallback(
    (info: { pageIndex: number; pageCount: number }) => {
      setCarouselPage((prev) =>
        prev.pageIndex === info.pageIndex && prev.pageCount === info.pageCount ? prev : info,
      )
    },
    [],
  )

  const reload = useCallback(() => {
    setIsLoading(true)
    setError('')
    fetchFreeSharePosts()
      .then((rows) => setPosts(rows.map(normalizePost)))
      .catch((loadError) => {
        setPosts([])
        setError(loadError instanceof Error ? loadError.message : '목록을 불러오지 못했습니다.')
      })
      .finally(() => {
        setIsLoading(false)
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

  const listNoMaxApplied = listNoApplied

  const filteredRows = useMemo(
    () => buildRows(posts, categoryKey, searchMode, nicknameApplied, listNoMaxApplied, user?.id ?? null),
    [posts, categoryKey, searchMode, nicknameApplied, listNoMaxApplied, user?.id],
  )

  const carouselResetKey = useMemo(
    () =>
      `${categoryKey}-${searchMode}-${nicknameApplied}-${listNoMaxApplied ?? ''}-${posts.map((p) => p.id).join('-')}`,
    [categoryKey, searchMode, nicknameApplied, listNoMaxApplied, posts],
  )

  function onSearchModeChange(next: SearchMode) {
    setSearchMode(next)
    if (next === 'all') {
      setNicknameApplied('')
      setListNoApplied(null)
      setNicknameDraft('')
      setListNoDraft('')
    }
    if (next === 'mine') {
      setNicknameApplied('')
      setListNoApplied(null)
      setNicknameDraft('')
      setListNoDraft('')
    }
  }

  function applyNicknameSearch() {
    setNicknameApplied(nicknameDraft.trim())
  }

  function applyListNoSearch() {
    const n = Number.parseInt(listNoDraft.trim(), 10)
    if (!Number.isFinite(n) || n < 1) {
      window.alert('리스트 번호는 1 이상의 숫자로 입력해 주세요.')
      return
    }
    setListNoApplied(n)
  }

  const showNicknameField = searchMode === 'nickname'
  const showListNoField = searchMode === 'listno'

  const mineNeedsLogin = searchMode === 'mine' && !user

  return (
    <div className="home-layout home-layout--hub app-route-hub">
    <div className="brog-screen brog-screen--list">
      <header className="brog-screen__header">
        <div>
          <p className="eyebrow">Community · 무료나눔</p>
          <h1 className="brog-screen__title">무료나눔</h1>
        </div>
        <div className="brog-screen__header-actions">
          <Link
            className="ghost-button free-share-header-map-link"
            to="/free-share/map"
            aria-label="무료나눔 지도"
            title="나눔 지도"
          >
            <svg
              className="free-share-header-map-link__icon"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 21s-8-4.5-8-11a8 8 0 0 1 16 0c0 6.5-8 11-8 11z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
            <span className="visually-hidden">지도</span>
          </Link>
          <Link className="brog-screen__cta" to="/free-share/write">
            작성
          </Link>
        </div>
      </header>

      <section className="brog-list-body" aria-label="무료나눔 목록">
        <div className="map-page-toolbar map-card free-share-board-toolbar">
          <div className="map-page-toolbar__filters-row free-share-board-toolbar__row">
            <label className="price-filter map-page-toolbar__filter">
              분류
              <select
                value={categoryKey}
                onChange={(e) =>
                  setCategoryKey(
                    e.target.value === 'all' ? 'all' : (e.target.value as FreeShareCategoryValue),
                  )
                }
              >
                <option value="all">전체</option>
                {FREE_SHARE_CATEGORY_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {FREE_SHARE_CATEGORY_LABELS[v]}
                  </option>
                ))}
              </select>
            </label>
            <label className="price-filter map-page-toolbar__filter">
              검색
              <select value={searchMode} onChange={(e) => onSearchModeChange(e.target.value as SearchMode)}>
                <option value="all">전체보기</option>
                <option value="mine">내 글</option>
                <option value="nickname">닉네임</option>
                <option value="listno">리스트 번호</option>
              </select>
            </label>
            {showNicknameField ? (
              <>
                <input
                  className="free-share-board-toolbar__input"
                  type="search"
                  value={nicknameDraft}
                  onChange={(e) => setNicknameDraft(e.target.value)}
                  placeholder="닉네임 일부"
                  maxLength={80}
                  aria-label="닉네임 검색어"
                />
                <button type="button" className="ghost-button free-share-board-toolbar__confirm" onClick={applyNicknameSearch}>
                  확인
                </button>
              </>
            ) : null}
            {showListNoField ? (
              <>
                <input
                  className="free-share-board-toolbar__input free-share-board-toolbar__input--num"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={listNoDraft}
                  onChange={(e) => setListNoDraft(e.target.value)}
                  placeholder="번호 이하"
                  aria-label="리스트 번호 이하"
                />
                <button type="button" className="ghost-button free-share-board-toolbar__confirm" onClick={applyListNoSearch}>
                  확인
                </button>
              </>
            ) : null}
          </div>
        </div>

        {!isLoading && !error ? (
          <p className="brog-list-body__count" role="status">
            <strong>{filteredRows.length}</strong>건
            {categoryKey !== 'all' ? ` · ${FREE_SHARE_CATEGORY_LABELS[categoryKey]}` : ''}
            {searchMode === 'nickname' && nicknameApplied ? ` · 닉네임 "${nicknameApplied}"` : ''}
            {searchMode === 'listno' && listNoApplied != null ? ` · 번호 ≤ ${listNoApplied}` : ''}
            {searchMode === 'mine' ? ' · 내 글' : ''}
            {carouselPage.pageCount > 1 ? (
              <>
                {' '}
                · 페이지 {carouselPage.pageIndex + 1} / {carouselPage.pageCount}
              </>
            ) : null}
          </p>
        ) : null}

        {error ? <p className="error brog-list-body__error">{error}</p> : null}
        {isLoading ? <p className="brog-rank-loading">목록을 불러오는 중…</p> : null}

        {!isLoading && mineNeedsLogin ? (
          <p className="helper">「내 글」을 보려면 로그인해 주세요.</p>
        ) : null}

        {!isLoading && !mineNeedsLogin && filteredRows.length === 0 && !error ? (
          <article className="brog-rank-card brog-rank-card--empty">
            <p className="brog-rank-card__name">표시할 글이 없습니다</p>
          </article>
        ) : null}

        {!isLoading && !mineNeedsLogin && filteredRows.length > 0 && !error ? (
          <section className="home-section map-page-brog-list-section" aria-label="무료나눔 목록">
            <h3 className="map-page-brog-list-section__title">목록</h3>
            <div className="free-share-list-board">
              <div className="free-share-list-column-header" aria-hidden>
                <div className="map-page-brog-lines__row map-page-brog-lines__row--free-share-header">
                  <span className="map-page-brog-lines__hcell">번호</span>
                  <span className="map-page-brog-lines__hcell">제목</span>
                  <span className="map-page-brog-lines__hcell">닉네임</span>
                  <span className="map-page-brog-lines__hcell">작성일</span>
                  <span className="map-page-brog-lines__hcell">나눔장소</span>
                  <span className="map-page-brog-lines__hcell">상태</span>
                </div>
              </div>
              <BrogRankGridCarousel<FreeShareListRow>
                items={filteredRows}
                pageSize={FREE_LIST_PAGE_SIZE}
                resetKey={carouselResetKey}
                getItemKey={(r) => r.post.id}
                renderPage={(page) => (
                  <ul className="map-page-brog-lines map-page-brog-lines--free-share">
                    {page.map((row) => {
                      const placeLabel = formatFreeShareListPlace(row.post)
                      const dateStr = formatFreeShareListDate(row.post.created_at)
                      return (
                        <li key={row.post.id} className="map-page-brog-lines__item">
                          <div className="map-page-brog-lines__row map-page-brog-lines__row--free-share-cols">
                            <span className="map-page-brog-lines__cell map-page-brog-lines__cell--num">
                              {row.listNo}.
                            </span>
                            <Link
                              to={`/free-share/${row.post.id}`}
                              className="map-page-brog-lines__name map-page-brog-lines__cell map-page-brog-lines__cell--title"
                            >
                              {row.post.title}
                            </Link>
                            <span className="map-page-brog-lines__cell map-page-brog-lines__cell--nick">
                              {row.post.author_nickname || '—'}
                            </span>
                            <time
                              className="map-page-brog-lines__cell map-page-brog-lines__cell--date"
                              dateTime={row.post.created_at}
                            >
                              {dateStr}
                            </time>
                            <span
                              className="map-page-brog-lines__cell map-page-brog-lines__cell--place"
                              title={placeLabel}
                            >
                              {placeLabel}
                            </span>
                            <span className="map-page-brog-lines__cell map-page-brog-lines__cell--status">
                              {row.post.share_completed ? (
                                <span className="map-page-brog-lines__tag map-page-brog-lines__tag--event">나눔완료</span>
                              ) : (
                                <span className="map-page-brog-lines__tag">진행중</span>
                              )}
                            </span>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
                ariaLabel={`무료나눔 목록, ${FREE_LIST_PAGE_SIZE}건씩`}
                onPaginationInfo={onCarouselPagination}
                carouselStepAriaUnit="건"
              />
            </div>
          </section>
        ) : null}
      </section>
    </div>
    </div>
  )
}
