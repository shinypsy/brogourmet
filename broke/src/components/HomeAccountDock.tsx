import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { ACCESS_TOKEN_KEY } from '../api/auth'
import { AUTH_CHANGE_EVENT } from '../authEvents'

/** 홈 하단: Myinfo만 노출. 회원 탈퇴는 /me(Myinfo)에서 진행합니다. */
export function HomeAccountDock() {
  const [hasToken, setHasToken] = useState(
    () => typeof window !== 'undefined' && Boolean(localStorage.getItem(ACCESS_TOKEN_KEY)),
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

  return (
    <div className="home-account-dock" role="navigation" aria-label="계정">
      <Link
        className="home-account-dock__btn home-account-dock__btn--myinfo"
        to="/me"
        title={hasToken ? 'Myinfo — 내 정보' : 'Myinfo — 로그인'}
        aria-label="Myinfo"
      >
        <span className="home-account-dock__icon" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
            />
          </svg>
        </span>
        <span className="home-account-dock__label">Myinfo</span>
      </Link>
    </div>
  )
}
