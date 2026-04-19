import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe, login } from '../api/auth'
import { notifyAuthChange } from '../authEvents'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [verifiedBanner, setVerifiedBanner] = useState(false)

  useEffect(() => {
    if (searchParams.get('verified') !== '1') return
    setVerifiedBanner(true)
    const next = new URLSearchParams(searchParams)
    next.delete('verified')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  /** 이미 로그인된 상태에서 /login 접근 시 */
  useEffect(() => {
    if (!localStorage.getItem(ACCESS_TOKEN_KEY)) return
    const from = (location.state as { from?: string } | null)?.from
    const safeFrom =
      typeof from === 'string' &&
      from.startsWith('/') &&
      !from.startsWith('/login') &&
      !from.startsWith('/signup') &&
      !from.startsWith('/verify-email')
        ? from
        : '/'
    navigate(safeFrom, { replace: true })
  }, [location.state, navigate])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const result = await login({ email, password })
      localStorage.setItem(ACCESS_TOKEN_KEY, result.access_token)
      notifyAuthChange()
      try {
        const me = await fetchMe(result.access_token)
        const from = (location.state as { from?: string } | null)?.from
        const safeFrom =
          typeof from === 'string' &&
          from.startsWith('/') &&
          !from.startsWith('/login') &&
          !from.startsWith('/signup') &&
          !from.startsWith('/verify-email')
            ? from
            : null
        if (safeFrom) {
          navigate(safeFrom, { replace: true })
        } else {
          navigate(me.email_verified_at ? '/' : '/me', { replace: true })
        }
      } catch {
        navigate('/me', { replace: true })
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '로그인 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="card">
      <h1>로그인</h1>

      {verifiedBanner ? (
        <p className="success" role="status">
          이메일 인증이 완료되었습니다. 아래에서 로그인하면 <strong>홈(메인)</strong>으로 이동합니다.
        </p>
      ) : null}

      <form className="form" onSubmit={handleSubmit}>
        <label>
          이메일
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder=" "
            required
          />
        </label>

        <label>
          비밀번호
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder=" "
            minLength={8}
            required
          />
        </label>

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? '로그인 중...' : '로그인'}
        </button>
      </form>

      {error ? <p className="error">{error}</p> : null}
      {error.includes('이메일 인증') ? (
        <p className="helper">
          <Link to="/verify-email">이메일 인증 페이지</Link>에서 토큰을 입력하거나, 가입 메일의 링크를
          사용하세요.
        </p>
      ) : null}

      <p className="helper">
        계정이 없나요? <Link to="/signup">회원가입으로 이동</Link> ·{' '}
        <Link to="/verify-email">이메일 인증</Link>
      </p>
    </section>
  )
}
