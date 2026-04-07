import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { signup } from '../api/auth'

export function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [devVerificationToken, setDevVerificationToken] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    setDevVerificationToken(null)
    setIsSubmitting(true)

    try {
      const { user, email_verification_token: devToken } = await signup({ email, password, nickname })
      setMessage(
        `회원가입 완료: ${user.nickname} (${user.email}). 이메일 인증 후 로그인할 수 있습니다.`,
      )
      setDevVerificationToken(devToken ?? null)
      setEmail('')
      setPassword('')
      setNickname('')
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : '회원가입 중 오류가 발생했습니다.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="card">
      <h1>회원가입</h1>
      <p className="description">Brogourmet 계정을 만들고 JWT 인증 흐름을 시작합니다.</p>

      <form className="form" onSubmit={handleSubmit}>
        <label>
          이메일
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
          />
        </label>

        <label>
          비밀번호
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="8자 이상"
            minLength={8}
            required
          />
        </label>

        <label>
          닉네임
          <input
            type="text"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="닉네임"
            minLength={2}
            required
          />
        </label>

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? '가입 중...' : '회원가입'}
        </button>
      </form>

      {message ? <p className="success">{message}</p> : null}
      {devVerificationToken ? (
        <p className="description">
          개발용 인증 토큰(서버에 <code>DEV_RETURN_EMAIL_VERIFICATION_TOKEN=true</code>일 때만 노출):
          <br />
          <Link to={`/verify-email?token=${encodeURIComponent(devVerificationToken)}`}>
            인증 페이지로 이동
          </Link>
          <textarea readOnly rows={3} className="dev-token-preview" value={devVerificationToken} />
        </p>
      ) : null}
      {error ? <p className="error">{error}</p> : null}

      <p className="helper">
        이미 계정이 있나요? <Link to="/login">로그인으로 이동</Link> ·{' '}
        <Link to="/verify-email">이메일 인증</Link>
      </p>
    </section>
  )
}
