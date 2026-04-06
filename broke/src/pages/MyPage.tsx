import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe } from '../api/auth'
import type { User } from '../api/auth'

export function MyPage() {
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY)

    if (!token) {
      setError('저장된 토큰이 없습니다. 먼저 로그인해주세요.')
      setIsLoading(false)
      return
    }

    async function loadUser(accessToken: string) {
      try {
        const me = await fetchMe(accessToken)
        setUser(me)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : '내 정보를 불러오지 못했습니다.')
      } finally {
        setIsLoading(false)
      }
    }

    void loadUser(token)
  }, [])

  return (
    <section className="card">
      <h1>내 정보</h1>
      <p className="description">백엔드의 `/users/me` 응답을 그대로 확인하는 화면입니다.</p>

      {isLoading ? <p>불러오는 중...</p> : null}

      {user ? (
        <>
          <dl className="profile">
            <div>
              <dt>이메일</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>닉네임</dt>
              <dd>{user.nickname}</dd>
            </div>
            <div>
              <dt>권한</dt>
              <dd>{user.role}</dd>
            </div>
            <div>
              <dt>활성 여부</dt>
              <dd>{user.is_active ? '활성' : '비활성'}</dd>
            </div>
          </dl>
          {user.role === 'admin' ? (
            <p className="helper">
              <Link to="/restaurants/manage/new">BroG 작성</Link>
            </p>
          ) : null}
        </>
      ) : null}

      {error ? <p className="error">{error}</p> : null}

      <p className="helper">
        <Link to="/login">다시 로그인</Link>
      </p>
    </section>
  )
}
