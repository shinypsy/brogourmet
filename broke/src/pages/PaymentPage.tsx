import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { ACCESS_TOKEN_KEY } from '../api/auth'
import { createPaymentIntent, fetchMyPayments, type PaymentIntent } from '../api/payments'

export function PaymentPage() {
  const [intents, setIntents] = useState<PaymentIntent[]>([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [amount, setAmount] = useState(10000)
  const [description, setDescription] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null

  const reload = useCallback(() => {
    if (!token) {
      setIntents([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError('')
    fetchMyPayments(token)
      .then(setIntents)
      .catch((loadError) => {
        setIntents([])
        setError(loadError instanceof Error ? loadError.message : '내역을 불러오지 못했습니다.')
      })
      .finally(() => setIsLoading(false))
  }, [token])

  useEffect(() => {
    void Promise.resolve().then(() => reload())
  }, [reload])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) {
      setSubmitError('로그인이 필요합니다.')
      return
    }
    setSubmitError('')
    setIsSubmitting(true)
    try {
      await createPaymentIntent(token, {
        amount_krw: amount,
        description: description.trim() || null,
      })
      setDescription('')
      reload()
    } catch (submitErr) {
      setSubmitError(submitErr instanceof Error ? submitErr.message : '생성에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="board-layout">
      <section className="card">
        <p className="eyebrow">Payment</p>
        <h1>결제</h1>
        <p className="description">
          PG(토스 등) 연동 전 단계입니다. 로그인한 회원만 <code>POST /payments/intents</code>로 결제 의도를 남길 수
          있으며, 상태는 <code>pending</code>으로 저장됩니다.
        </p>
        <ul className="info-list">
          <li>카드결제: 토스페이먼츠/아임포트(PortOne) 연동 후 승인 콜백으로 완료 처리</li>
          <li>간편결제: 카카오페이/네이버페이/토스페이 등은 PG사의 연동 상품으로 처리</li>
          <li>정기결제: 빌링키 발급 후 서버에서 정기 청구 스케줄 실행</li>
          <li>무통장/가상계좌: 입금 확인 웹훅 수신 후 status를 paid로 변경</li>
        </ul>
        <p className="helper">
          <Link to="/login">로그인</Link>
          {' · '}
          <Link to="/">홈으로</Link>
        </p>
      </section>

      {token ? (
        <section className="card board-form-card">
          <h2>결제 의도 생성 (목업)</h2>
          <form className="form" onSubmit={handleSubmit}>
            <label>
              금액 (원)
              <input
                type="number"
                min={100}
                max={10_000_000}
                value={amount}
                onChange={(event) => setAmount(Number(event.target.value))}
                required
              />
            </label>
            <label>
              설명 (선택)
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={500}
                placeholder="프리미엄 노출 1주 등"
              />
            </label>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? '처리 중...' : '의도 생성'}
            </button>
          </form>
          {submitError ? <p className="error">{submitError}</p> : null}
        </section>
      ) : (
        <section className="card">
          <p className="description">결제 의도를 만들려면 로그인해 주세요.</p>
        </section>
      )}

      <section className="card">
        <h2>내 결제 의도</h2>
        {token && isLoading ? <p>불러오는 중...</p> : null}
        {error ? <p className="error">{error}</p> : null}
        <ul className="post-list">
          {intents.map((intent) => (
            <li key={intent.id} className="post-list-item">
              <div className="post-list-meta">
                <strong>{intent.amount_krw.toLocaleString()}원</strong>
                <span>
                  {intent.status} · {new Date(intent.created_at).toLocaleString()}
                </span>
              </div>
              {intent.description ? <p className="post-body">{intent.description}</p> : null}
            </li>
          ))}
        </ul>
        {token && !isLoading && intents.length === 0 && !error ? <p>아직 기록이 없습니다.</p> : null}
      </section>
    </div>
  )
}
