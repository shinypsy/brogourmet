import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe, type User } from './api/auth'
import { AUTH_CHANGE_EVENT, USER_PROFILE_REFRESH_EVENT } from './authEvents'
import { EventTicker } from './components/EventTicker'
import { RequireAuth } from './components/RequireAuth'
import { TestUiAdminBanner } from './components/TestUiAdminBanner'
import { BROG_ONLY } from './config/features'
import { QNA_BOARD_NAV } from './lib/communityBoardNav'
import { canWriteSiteEvents, isSuperAdmin } from './lib/roles'
import { HomePage } from './pages/HomePage'

const BrogListPage = lazy(() =>
  import('./pages/BrogListPage').then((m) => ({ default: m.BrogListPage })),
)
const MapPage = lazy(() => import('./pages/MapPage').then((m) => ({ default: m.MapPage })))
const RestaurantManagePage = lazy(() =>
  import('./pages/RestaurantManagePage').then((m) => ({ default: m.RestaurantManagePage })),
)
const RestaurantDetailPage = lazy(() =>
  import('./pages/RestaurantDetailPage').then((m) => ({ default: m.RestaurantDetailPage })),
)
const FreeShareBoardPage = lazy(() =>
  import('./pages/FreeShareBoardPage').then((m) => ({ default: m.FreeShareBoardPage })),
)
const FreeShareWritePage = lazy(() =>
  import('./pages/FreeShareWritePage').then((m) => ({ default: m.FreeShareWritePage })),
)
const FreeSharePostDetailPage = lazy(() =>
  import('./pages/FreeSharePostDetailPage').then((m) => ({ default: m.FreeSharePostDetailPage })),
)
const FreeShareMapPage = lazy(() =>
  import('./pages/FreeShareMapPage').then((m) => ({ default: m.FreeShareMapPage })),
)
const KnownRestaurantsBoardPage = lazy(() =>
  import('./pages/KnownRestaurantsBoardPage').then((m) => ({ default: m.KnownRestaurantsBoardPage })),
)
const KnownRestaurantsMapPage = lazy(() =>
  import('./pages/KnownRestaurantsMapPage').then((m) => ({ default: m.KnownRestaurantsMapPage })),
)
const KnownRestaurantsWritePage = lazy(() =>
  import('./pages/KnownRestaurantsWritePage').then((m) => ({ default: m.KnownRestaurantsWritePage })),
)
const KnownRestaurantPostDetailPage = lazy(() =>
  import('./pages/KnownRestaurantPostDetailPage').then((m) => ({
    default: m.KnownRestaurantPostDetailPage,
  })),
)
const KnownRestaurantPostEditPage = lazy(() =>
  import('./pages/KnownRestaurantPostEditPage').then((m) => ({
    default: m.KnownRestaurantPostEditPage,
  })),
)
const PaymentPage = lazy(() => import('./pages/PaymentPage').then((m) => ({ default: m.PaymentPage })))
const EventWritePage = lazy(() => import('./pages/EventWritePage').then((m) => ({ default: m.EventWritePage })))
const SadariPage = lazy(() => import('./pages/SadariPage').then((m) => ({ default: m.SadariPage })))
const SignupPage = lazy(() => import('./pages/SignupPage').then((m) => ({ default: m.SignupPage })))
const VerifyEmailPage = lazy(() =>
  import('./pages/VerifyEmailPage').then((m) => ({ default: m.VerifyEmailPage })),
)
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const MyPage = lazy(() => import('./pages/MyPage').then((m) => ({ default: m.MyPage })))
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })))

/** 호버·포커스 시 다음 화면 청크 미리 받기 */
const prefetch = {
  brogList: () => void import('./pages/BrogListPage'),
  map: () => void import('./pages/MapPage'),
  game: () => void import('./pages/SadariPage'),
  mygList: () => void import('./pages/KnownRestaurantsBoardPage'),
  mygMap: () => void import('./pages/KnownRestaurantsMapPage'),
  freeShare: () => void import('./pages/FreeShareBoardPage'),
  freeShareMap: () => void import('./pages/FreeShareMapPage'),
  qna: () => void import('./pages/FreeShareBoardPage'),
  payment: () => void import('./pages/PaymentPage'),
  eventWrite: () => void import('./pages/EventWritePage'),
  login: () => void import('./pages/LoginPage'),
  admin: () => void import('./pages/AdminPage'),
} as const

function RouteFallback() {
  return <p className="route-fallback">불러오는 중…</p>
}

function App() {
  const [hasToken, setHasToken] = useState(() =>
    typeof window !== 'undefined' ? Boolean(localStorage.getItem(ACCESS_TOKEN_KEY)) : false,
  )
  const [navUser, setNavUser] = useState<User | null>(null)

  useEffect(() => {
    function sync() {
      setHasToken(Boolean(localStorage.getItem(ACCESS_TOKEN_KEY)))
    }
    window.addEventListener(AUTH_CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  useEffect(() => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY)
    if (!token) {
      setNavUser(null)
      return
    }
    let cancelled = false
    void fetchMe(token)
      .then((me) => {
        if (!cancelled) setNavUser(me)
      })
      .catch(() => {
        if (!cancelled) setNavUser(null)
      })
    return () => {
      cancelled = true
    }
  }, [hasToken])

  useEffect(() => {
    function refreshProfile() {
      const token = localStorage.getItem(ACCESS_TOKEN_KEY)
      if (!token) return
      void fetchMe(token).then(setNavUser).catch(() => setNavUser(null))
    }
    window.addEventListener(USER_PROFILE_REFRESH_EVENT, refreshProfile)
    return () => window.removeEventListener(USER_PROFILE_REFRESH_EVENT, refreshProfile)
  }, [])

  function logout() {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT))
    window.location.href = '/'
  }

  const navWarm = {
    onMouseEnter: prefetch.brogList,
    onFocus: prefetch.brogList,
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar__brand">
          <p className="eyebrow">Broke Gourmet</p>
          <h1>고단한 미식가</h1>
          {navUser ? (
            <div className="topbar__user-line">
              <Link to="/me" className="topbar__user-line__link">
                <span className="topbar__user-line__nick">{navUser.nickname}</span>
                <span className="topbar__user-line__sep" aria-hidden>
                  ·
                </span>
                <span className="topbar__user-line__points">{navUser.points_balance ?? 0}P</span>
              </Link>
            </div>
          ) : null}
        </div>
        <nav className="main-nav" aria-label="주 메뉴">
          <div className="main-nav__grid">
            <Link className="main-nav-item" to="/">
              Home
            </Link>
            <Link className="main-nav-item" to="/brog" {...navWarm}>
              BroG
            </Link>
            {!BROG_ONLY ? (
              <Link
                className="main-nav-item"
                to="/known-restaurants"
                onMouseEnter={() => {
                  prefetch.mygList()
                  prefetch.mygMap()
                }}
                onFocus={() => {
                  prefetch.mygList()
                  prefetch.mygMap()
                }}
              >
                MyG
              </Link>
            ) : null}
            <Link className="main-nav-item" to="/game" onMouseEnter={prefetch.game} onFocus={prefetch.game}>
              Game
            </Link>
            {!BROG_ONLY ? (
              <>
                <Link
                  className="main-nav-item"
                  to="/free-share"
                  onMouseEnter={() => {
                    prefetch.freeShare()
                    prefetch.freeShareMap()
                  }}
                  onFocus={() => {
                    prefetch.freeShare()
                    prefetch.freeShareMap()
                  }}
                >
                  Free
                </Link>
                <Link
                  className="main-nav-item"
                  to="/payment"
                  onMouseEnter={prefetch.payment}
                  onFocus={prefetch.payment}
                >
                  Pay
                </Link>
                <Link
                  className="main-nav-item main-nav-item--qna"
                  to="/qna"
                  onMouseEnter={prefetch.qna}
                  onFocus={prefetch.qna}
                  title="Q&A 게시판"
                  aria-label="Q&A 게시판"
                >
                  <span className="main-nav-item__qna-inner">
                    <svg
                      className="main-nav-item__qna-icon"
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      aria-hidden
                    >
                      <path
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z"
                      />
                      <path
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        d="M9.5 9a2.5 2.5 0 0 1 4.2-1.8A2.4 2.4 0 0 1 14 11c0 1.2-.8 1.8-1.3 2.1-.3.2-.7.4-.7 1.1V15"
                      />
                      <circle cx="12" cy="17.5" r="0.75" fill="currentColor" stroke="none" />
                    </svg>
                    <span className="main-nav-item__qna-text">Q&A</span>
                  </span>
                </Link>
              </>
            ) : null}
            {navUser && canWriteSiteEvents(navUser) ? (
              <Link
                className="main-nav-item"
                to="/events/write"
                onMouseEnter={prefetch.eventWrite}
                onFocus={prefetch.eventWrite}
              >
                이벤트
              </Link>
            ) : null}
            {navUser && isSuperAdmin(navUser.role) ? (
              <Link
                className="main-nav-item"
                to="/admin"
                onMouseEnter={prefetch.admin}
                onFocus={prefetch.admin}
              >
                관리자
              </Link>
            ) : null}
          </div>
          <div className="main-nav__auth">
            {hasToken ? (
              <button
                type="button"
                className="main-nav-item main-nav-item--button main-nav-item--auth"
                onClick={logout}
                title="Logout"
              >
                Logout
              </button>
            ) : (
              <Link
                className="main-nav-item main-nav-item--auth"
                to="/login"
                title="Login"
                onMouseEnter={prefetch.login}
                onFocus={prefetch.login}
              >
                Login
              </Link>
            )}
          </div>
        </nav>
      </header>

      <EventTicker />

      <TestUiAdminBanner />

      <main className="content">
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            {/* 공개 BroG 상세 — 홈 8칸·게스트 진입 */}
            <Route path="/restaurants/:id" element={<RestaurantDetailPage />} />
            <Route element={<RequireAuth />}>
              <Route path="/brog" element={<Navigate to="/brog/list" replace />} />
              <Route path="/brog/list" element={<BrogListPage />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/restaurants/manage/new" element={<RestaurantManagePage />} />
              <Route path="/restaurants/manage/:id" element={<RestaurantManagePage />} />
              <Route path="/events/write" element={<EventWritePage />} />
              {!BROG_ONLY ? (
                <>
                  <Route path="/free-share" element={<FreeShareBoardPage />} />
                  <Route path="/free-share/map" element={<FreeShareMapPage />} />
                  <Route path="/free-share/write" element={<FreeShareWritePage />} />
                  <Route path="/free-share/:id" element={<FreeSharePostDetailPage />} />
                  <Route path="/qna" element={<FreeShareBoardPage boardVariant="qna" />} />
                  <Route path="/qna/write" element={<FreeShareWritePage boardVariant="qna" />} />
                  <Route path="/qna/:id" element={<FreeSharePostDetailPage boardNav={QNA_BOARD_NAV} />} />
                  <Route path="/known-restaurants" element={<Navigate to="/known-restaurants/list" replace />} />
                  <Route path="/known-restaurants/list" element={<KnownRestaurantsBoardPage />} />
                  <Route path="/known-restaurants/map" element={<KnownRestaurantsMapPage />} />
                  <Route path="/known-restaurants/write" element={<KnownRestaurantsWritePage />} />
                  <Route path="/known-restaurants/:id/edit" element={<KnownRestaurantPostEditPage />} />
                  <Route path="/known-restaurants/:id" element={<KnownRestaurantPostDetailPage />} />
                  <Route path="/payment" element={<PaymentPage />} />
                </>
              ) : null}
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/me" element={<MyPage />} />
              <Route path="/game" element={<SadariPage />} />
              <Route path="/sadari" element={<Navigate to="/game" replace />} />
            </Route>
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}

export default App
