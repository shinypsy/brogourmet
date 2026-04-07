import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, login } from '../api/auth'
import { API_BASE_URL } from '../api/config'
import { notifyAuthChange } from '../authEvents'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const result = await login({ email, password })
      localStorage.setItem(ACCESS_TOKEN_KEY, result.access_token)
      notifyAuthChange()
      navigate('/me')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '로그인 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="card">
      <h1>로그인</h1>
      <p className="description">
        JWT로 로그인합니다. 접속이 안 되면 백엔드(gourmet)를 먼저 실행하고,{' '}
        <code>.env</code>의 <code>VITE_API_BASE_URL</code>이 API 포트(예: <code>:8001</code>)를 가리키는지
        확인하세요. (프론트 <code>:5173</code>와 같으면 안 됩니다.)
      </p>
      {import.meta.env.DEV ? (
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          개발: API 요청 → <code>{API_BASE_URL}</code>
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
