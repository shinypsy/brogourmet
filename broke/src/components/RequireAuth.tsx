import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { ACCESS_TOKEN_KEY } from '../api/auth'

function readToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

/** JWT 없으면 `/login` 으로 — `state.from` 으로 로그인 후 복귀 경로 전달. 공개: `/`, `/restaurants/:id`(BroG 상세). */
export function RequireAuth() {
  const location = useLocation()
  if (!readToken()) {
    const from = `${location.pathname}${location.search}`
    return <Navigate to="/login" replace state={{ from }} />
  }
  return <Outlet />
}
