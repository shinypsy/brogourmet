import { useEffect, useState } from 'react'
import { Link, Route, Routes } from 'react-router-dom'

import { ACCESS_TOKEN_KEY } from './api/auth'
import { AUTH_CHANGE_EVENT } from './authEvents'
import { FreeShareBoardPage } from './pages/FreeShareBoardPage'
import { FreeShareWritePage } from './pages/FreeShareWritePage'
import { HomePage } from './pages/HomePage'
import { KnownRestaurantsBoardPage } from './pages/KnownRestaurantsBoardPage'
import { KnownRestaurantsWritePage } from './pages/KnownRestaurantsWritePage'
import { LoginPage } from './pages/LoginPage'
import { MapPage } from './pages/MapPage'
import { MyPage } from './pages/MyPage'
import { PaymentPage } from './pages/PaymentPage'
import { RestaurantManagePage } from './pages/RestaurantManagePage'
import { RestaurantDetailPage } from './pages/RestaurantDetailPage'
import { SignupPage } from './pages/SignupPage'

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
          <Link className="main-nav-item" to="/map">
            BroG
          </Link>
          <Link className="main-nav-item" to="/known-restaurants">
            MyBro
          </Link>
          <Link className="main-nav-item" to="/free-share">
            Freebie
          </Link>
          <Link className="main-nav-item" to="/payment">
            Payment
          </Link>
          <Link className="main-nav-item" to="/me">
            Myinfo
          </Link>
          {hasToken ? (
            <button type="button" className="main-nav-item main-nav-item--button" onClick={logout}>
              Logout
            </button>
          ) : (
            <Link className="main-nav-item" to="/login">
              Login
            </Link>
          )}
        </nav>
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/restaurants/manage/new" element={<RestaurantManagePage />} />
          <Route path="/restaurants/manage/:id" element={<RestaurantManagePage />} />
          <Route path="/restaurants/:id" element={<RestaurantDetailPage />} />
          <Route path="/free-share" element={<FreeShareBoardPage />} />
          <Route path="/free-share/write" element={<FreeShareWritePage />} />
          <Route path="/known-restaurants" element={<KnownRestaurantsBoardPage />} />
          <Route path="/known-restaurants/write" element={<KnownRestaurantsWritePage />} />
          <Route path="/payment" element={<PaymentPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/me" element={<MyPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
