import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'

import { ACCESS_TOKEN_KEY } from './api/auth'
import { AUTH_CHANGE_EVENT } from './authEvents'
import { TestUiAdminBanner } from './components/TestUiAdminBanner'
import { BROG_ONLY } from './config/features'
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
const PaymentPage = lazy(() => import('./pages/PaymentPage').then((m) => ({ default: m.PaymentPage })))
const SadariPage = lazy(() => import('./pages/SadariPage').then((m) => ({ default: m.SadariPage })))
const SignupPage = lazy(() => import('./pages/SignupPage').then((m) => ({ default: m.SignupPage })))
const VerifyEmailPage = lazy(() =>
  import('./pages/VerifyEmailPage').then((m) => ({ default: m.VerifyEmailPage })),
)
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const MyPage = lazy(() => import('./pages/MyPage').then((m) => ({ default: m.MyPage })))

/** 호버·포커스 시 다음 화면 청크 미리 받기 */
const prefetch = {
  brogList: () => void import('./pages/BrogListPage'),
  map: () => void import('./pages/MapPage'),
  game: () => void import('./pages/SadariPage'),
  mygList: () => void import('./pages/KnownRestaurantsBoardPage'),
  mygMap: () => void import('./pages/KnownRestaurantsMapPage'),
  freeShare: () => void import('./pages/FreeShareBoardPage'),
  payment: () => void import('./pages/PaymentPage'),
  login: () => void import('./pages/LoginPage'),
} as const

function RouteFallback() {
  return <p className="route-fallback">불러오는 중…</p>
}

function App() {
  const [hasToken, setHasToken] = useState(() =>
    typeof window !== 'undefined' ? Boolean(localStorage.getItem(ACCESS_TOKEN_KEY)) : false,
  )

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
        <div>
          <p className="eyebrow">Broke Gourmet</p>
          <h1>고단한 미식가</h1>
        </div>
        <nav className="main-nav" aria-label="주 메뉴">
          <Link className="main-nav-item" to="/">
            Home
          </Link>
          <Link className="main-nav-item" to="/brog" {...navWarm}>
            BroG
          </Link>
          {!BROG_ONLY ? (
            <>
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
              <Link className="main-nav-item" to="/free-share" onMouseEnter={prefetch.freeShare} onFocus={prefetch.freeShare}>
                Free
              </Link>
              <Link className="main-nav-item" to="/payment" onMouseEnter={prefetch.payment} onFocus={prefetch.payment}>
                Pay
              </Link>
            </>
          ) : null}
          <Link className="main-nav-item" to="/game" onMouseEnter={prefetch.game} onFocus={prefetch.game}>
            Game
          </Link>
          {hasToken ? (
            <button
              type="button"
              className="main-nav-item main-nav-item--button"
              onClick={logout}
              title="Logout"
            >
              Logout
            </button>
          ) : (
            <Link className="main-nav-item" to="/login" title="Login" onMouseEnter={prefetch.login} onFocus={prefetch.login}>
              Login
            </Link>
          )}
        </nav>
      </header>

      <TestUiAdminBanner />

      <main className="content">
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/brog" element={<Navigate to="/brog/list" replace />} />
            <Route path="/brog/list" element={<BrogListPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/restaurants/manage/new" element={<RestaurantManagePage />} />
            <Route path="/restaurants/manage/:id" element={<RestaurantManagePage />} />
            <Route path="/restaurants/:id" element={<RestaurantDetailPage />} />
            {!BROG_ONLY ? (
              <>
                <Route path="/free-share" element={<FreeShareBoardPage />} />
                <Route path="/free-share/write" element={<FreeShareWritePage />} />
                <Route path="/free-share/:id" element={<FreeSharePostDetailPage />} />
                <Route path="/known-restaurants" element={<Navigate to="/known-restaurants/list" replace />} />
                <Route path="/known-restaurants/list" element={<KnownRestaurantsBoardPage />} />
                <Route path="/known-restaurants/map" element={<KnownRestaurantsMapPage />} />
                <Route path="/known-restaurants/write" element={<KnownRestaurantsWritePage />} />
                <Route path="/known-restaurants/:id" element={<KnownRestaurantPostDetailPage />} />
                <Route path="/payment" element={<PaymentPage />} />
              </>
            ) : null}
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/me" element={<MyPage />} />
            <Route path="/game" element={<SadariPage />} />
            <Route path="/sadari" element={<Navigate to="/game" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}

export default App
