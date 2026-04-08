import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { resendVerificationEmail, verifyEmail } from '../api/auth'

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const tokenFromQuery = searchParams.get('token') ?? ''
  const [token, setToken] = useState(tokenFromQuery)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resendEmail, setResendEmail] = useState('')
  const [resendBusy, setResendBusy] = useState(false)
  const [resendSuccess, setResendSuccess] = useState('')
  const [resendError, setResendError] = useState('')

  useEffect(() => {
    if (tokenFromQuery.trim()) {
      setToken(tokenFromQuery)
    }
  }, [tokenFromQuery])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsSubmitting(true)
    try {
      const user = await verifyEmail(token.trim())
      setMessage(
        `인증 완료: ${user.nickname} (${user.email}). 로그인하면 이메일이 인증된 계정은 홈(메인)으로 이동합니다.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '인증 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="card">
      <h1>이메일 인증</h1>
      <p className="description">
        가입 시 받은 인증 토큰을 아래에 입력하세요. 메일 링크에 <code>?token=...</code>가 있으면 이 페이지를 열 때
        입력란에 채워집니다. (자동 전송은 하지 않으니 <strong>인증하기</strong>를 한 번 눌러 주세요.)
      </p>

      <form className="form" onSubmit={handleSubmit}>
        <label>
          인증 토큰
          <input
            type="text"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="토큰 문자열"
            autoComplete="off"
            required
            minLength={8}
          />
        </label>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? '확인 중...' : '인증하기'}
        </button>
      </form>

      {message ? (
        <div className="verify-email-success-block">
          <p className="success">{message}</p>
          <p className="helper" style={{ marginTop: 10 }}>
            <Link className="compact-link" to="/login?verified=1">
              로그인하기 (인증 완료 안내 표시)
            </Link>
          </p>
        </div>
      ) : null}
      {error ? <p className="error">{error}</p> : null}

      <hr style={{ margin: '1.5rem 0', border: 'none', borderTop: '1px solid #f0c9d6' }} />

      <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>인증 링크 다시 받기</h2>
      <p className="description" style={{ marginBottom: '0.75rem' }}>
        가입한 이메일을 입력하면 서버에 미인증 계정이 있을 때만 새 토큰이 발급되며, gourmet의{' '}
        <code>SMTP_ENABLED=true</code>이면 인증 링크 메일이 발송됩니다. 개발용으로는{' '}
        <code>DEV_RETURN_EMAIL_VERIFICATION_TOKEN</code>으로 응답에 토큰을 넣을 수 있습니다.
      </p>
      <form
        className="form"
        onSubmit={async (event) => {
          event.preventDefault()
          setResendSuccess('')
          setResendError('')
          setResendBusy(true)
          try {
            const result = await resendVerificationEmail(resendEmail.trim())
            if (result.email_verification_token) {
              setResendSuccess(
                '개발 모드: 새 토큰이 발급되었습니다. 위 입력란에 반영되었으니 인증하기를 누르세요.',
              )
              setToken(result.email_verification_token)
            } else {
              setResendSuccess(
                '요청을 접수했습니다. 해당 이메일로 가입한 미인증 계정이 있으면 토큰이 갱신되었습니다.',
              )
            }
          } catch (err) {
            setResendError(err instanceof Error ? err.message : '요청에 실패했습니다.')
          } finally {
            setResendBusy(false)
          }
        }}
      >
        <label>
          이메일
          <input
            type="email"
            value={resendEmail}
            onChange={(event) => setResendEmail(event.target.value)}
            placeholder="가입 시 사용한 이메일"
            required
          />
        </label>
        <button type="submit" disabled={resendBusy}>
          {resendBusy ? '처리 중...' : '인증 토큰 재발급'}
        </button>
      </form>
      {resendSuccess ? <p className="success">{resendSuccess}</p> : null}
      {resendError ? <p className="error">{resendError}</p> : null}

      <p className="helper">
        <Link to="/login">로그인</Link> · <Link to="/signup">회원가입</Link>
      </p>
    </section>
  )
}
