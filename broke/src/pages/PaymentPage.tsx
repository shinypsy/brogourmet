import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe } from '../api/auth'
import { registerKcpPayment, submitKcpMobileForm, type KcpRegisterResponse } from '../api/kcpPayments'
import { createPaymentIntent, fetchMyPayments, type PaymentIntent } from '../api/payments'
import { notifyUserProfileRefresh } from '../authEvents'

const TAB_USER = 'user'
const TAB_MERCHANT = 'merchant'

/** 1만 원 단위 포인트 충전 (원 = 적립 P 1:1) */
const POINT_CHARGE_OPTIONS_WON = [10_000, 20_000, 30_000, 40_000, 50_000, 100_000, 200_000, 300_000] as const

export function PaymentPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [intents, setIntents] = useState<PaymentIntent[]>([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [amount, setAmount] = useState(10000)
  const [description, setDescription] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [kcpError, setKcpError] = useState('')
  const [isKcpSubmitting, setIsKcpSubmitting] = useState(false)
  const [lastKcp, setLastKcp] = useState<KcpRegisterResponse | null>(null)
  const [pointChargeWon, setPointChargeWon] = useState<number>(10_000)
  const [pointIntentError, setPointIntentError] = useState('')
  const [pointKcpError, setPointKcpError] = useState('')
  const [isPointIntentSubmitting, setIsPointIntentSubmitting] = useState(false)
  const [isPointKcpSubmitting, setIsPointKcpSubmitting] = useState(false)
  const [lastPointKcp, setLastPointKcp] = useState<KcpRegisterResponse | null>(null)
  const [pointsBalance, setPointsBalance] = useState<number | null>(null)

  const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null

  /** `?tab=user` 일 때만 구독 탭. 그 외(파라미터 없음 포함)는 가맹점 결제 — 예전 /payment 와 동일 진입 경험. */
  const activeTab = useMemo(() => {
    const raw = (searchParams.get('tab') || '').toLowerCase()
    if (raw === TAB_USER) return TAB_USER
    return TAB_MERCHANT
  }, [searchParams])

  function setTab(next: typeof TAB_USER | typeof TAB_MERCHANT) {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('tab', next)
    setSearchParams(nextParams, { replace: true })
  }

  const kcpOk = searchParams.get('kcp') === 'ok'
  const kcpFail = searchParams.get('kcp') === 'fail'
  const kcpIntentId = searchParams.get('intent_id')
  const kcpFailReason = searchParams.get('reason') || ''

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

  useEffect(() => {
    if (!token || activeTab !== TAB_USER) return
    void fetchMe(token)
      .then((u) => setPointsBalance(u.points_balance ?? 0))
      .catch(() => setPointsBalance(null))
  }, [token, activeTab])

  useEffect(() => {
    if (!kcpOk || !token) return
    notifyUserProfileRefresh()
    void fetchMe(token)
      .then((u) => setPointsBalance(u.points_balance ?? 0))
      .catch(() => {})
  }, [kcpOk, token])

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
        intent_kind: 'merchant',
      })
      setDescription('')
      reload()
    } catch (submitErr) {
      setSubmitError(submitErr instanceof Error ? submitErr.message : '생성에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleKcpPrepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) {
      setKcpError('로그인이 필요합니다.')
      return
    }
    setKcpError('')
    setIsKcpSubmitting(true)
    setLastKcp(null)
    try {
      const res = await registerKcpPayment(token, {
        amount_krw: amount,
        description: description.trim() || null,
        good_name: description.trim() || null,
        intent_kind: 'merchant',
      })
      setLastKcp(res)
      reload()
    } catch (err) {
      setKcpError(err instanceof Error ? err.message : 'KCP 거래등록에 실패했습니다.')
    } finally {
      setIsKcpSubmitting(false)
    }
  }

  function openKcpMobilePay() {
    if (!lastKcp?.kcp?.encoding_submit_url || !lastKcp.kcp.mobile_form) return
    submitKcpMobileForm(lastKcp.kcp.encoding_submit_url, lastKcp.kcp.mobile_form)
  }

  async function handlePointIntentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) {
      setPointIntentError('로그인이 필요합니다.')
      return
    }
    setPointIntentError('')
    setIsPointIntentSubmitting(true)
    try {
      await createPaymentIntent(token, {
        amount_krw: pointChargeWon,
        description: '포인트 충전',
        intent_kind: 'point_charge',
      })
      reload()
    } catch (err) {
      setPointIntentError(err instanceof Error ? err.message : '의도 생성에 실패했습니다.')
    } finally {
      setIsPointIntentSubmitting(false)
    }
  }

  async function handlePointKcpPrepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) {
      setPointKcpError('로그인이 필요합니다.')
      return
    }
    setPointKcpError('')
    setIsPointKcpSubmitting(true)
    setLastPointKcp(null)
    try {
      const res = await registerKcpPayment(token, {
        amount_krw: pointChargeWon,
        description: '포인트 충전',
        good_name: '포인트 충전',
        intent_kind: 'point_charge',
      })
      setLastPointKcp(res)
      reload()
    } catch (err) {
      setPointKcpError(err instanceof Error ? err.message : 'KCP 거래등록에 실패했습니다.')
    } finally {
      setIsPointKcpSubmitting(false)
    }
  }

  function openKcpPointPay() {
    if (!lastPointKcp?.kcp?.encoding_submit_url || !lastPointKcp.kcp.mobile_form) return
    submitKcpMobileForm(lastPointKcp.kcp.encoding_submit_url, lastPointKcp.kcp.mobile_form)
  }

  const pointChargeIntents = intents.filter((i) => i.intent_kind === 'point_charge')
  const merchantIntents = intents.filter((i) => i.intent_kind !== 'point_charge')

  return (
    <div className="board-layout payment-page">
      {kcpOk ? (
        <section className="card" style={{ borderColor: 'var(--ok, #2d7a4f)' }}>
          <p className="description">
            KCP 결제가 완료되었습니다.
            {kcpIntentId ? ` (의도 id: ${kcpIntentId})` : null}
            {searchParams.get('tab') === 'user'
              ? ' 포인트 충전 건이면 잔액이 갱신되었습니다(상단바 P 동기화).'
              : null}
          </p>
        </section>
      ) : null}
      {kcpFail ? (
        <section className="card">
          <p className="error">
            KCP 결제 실패: {kcpFailReason ? decodeURIComponent(kcpFailReason) : '사유 없음'}
          </p>
        </section>
      ) : null}

      <section className="card payment-page__header">
        <div className="payment-mode-tabs" role="tablist" aria-label="결제 구분">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === TAB_USER}
            className={`payment-mode-tabs__btn${activeTab === TAB_USER ? ' is-active' : ''}`}
            onClick={() => setTab(TAB_USER)}
          >
            일반 회원 · 매월 구독
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === TAB_MERCHANT}
            className={`payment-mode-tabs__btn${activeTab === TAB_MERCHANT ? ' is-active' : ''}`}
            onClick={() => setTab(TAB_MERCHANT)}
          >
            가맹점 · 이벤트 등 결제
          </button>
        </div>
        <p className="payment-page__active-label" role="status">
          {activeTab === TAB_USER ? '현재: 일반 회원 · 매월 구독' : '현재: 가맹점 · 이벤트 등 결제'}
        </p>
        <p className="eyebrow">Payment</p>
        <h1>결제</h1>
        <p className="description">
          위 두 탭으로 화면을 나눕니다. 구독만 보려면 <code>?tab=user</code>, 주소에 <code>tab</code>이 없으면 기본은
          가맹점 결제입니다.
        </p>
        <p className="helper">
          <Link to="/login">로그인</Link>
          {' · '}
          <Link to="/">홈으로</Link>
        </p>
      </section>

      {activeTab === TAB_USER ? (
        <>
          <section className="card board-form-card">
            <h2>포인트 충전</h2>
            <p className="description">
              <strong>1만 원 단위</strong>로만 충전할 수 있습니다. 결제가 완료되면( KCP 승인 성공 시 ){' '}
              <strong>결제 금액과 동일한 수의 포인트</strong>가 적립됩니다. (예: 3만 원 결제 → 30,000 P)
            </p>
            {!token ? (
              <p className="description">
                로그인 후 이용해 주세요. <Link to="/login">로그인</Link>
              </p>
            ) : (
              <>
                <p className="helper">
                  현재 보유 포인트:{' '}
                  <strong>{pointsBalance === null ? '…' : `${pointsBalance.toLocaleString()} P`}</strong>
                </p>
                <form className="form" onSubmit={handlePointIntentSubmit}>
                  <label>
                    충전 금액 (1만 원 단위)
                    <select
                      value={pointChargeWon}
                      onChange={(e) => setPointChargeWon(Number(e.target.value))}
                    >
                      {POINT_CHARGE_OPTIONS_WON.map((w) => (
                        <option key={w} value={w}>
                          {w.toLocaleString()}원 → {w.toLocaleString()} P
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" disabled={isPointIntentSubmitting}>
                    {isPointIntentSubmitting ? '처리 중...' : '충전 의도 생성'}
                  </button>
                </form>
                {pointIntentError ? <p className="error">{pointIntentError}</p> : null}
                <form className="form" onSubmit={handlePointKcpPrepare} style={{ marginTop: '1rem' }}>
                  <p className="description">
                    같은 금액으로 KCP 거래등록 후 결제창에서 결제하면, 승인 완료 시 포인트가 자동 적립됩니다.
                  </p>
                  <button type="submit" disabled={isPointKcpSubmitting}>
                    {isPointKcpSubmitting ? 'KCP 등록 중...' : 'KCP로 결제 진행'}
                  </button>
                </form>
                {pointKcpError ? <p className="error">{pointKcpError}</p> : null}
                {lastPointKcp ? (
                  <div style={{ marginTop: '1rem' }}>
                    <p className="description">
                      등록됨 — intent #{lastPointKcp.intent.id},{' '}
                      <code>{lastPointKcp.intent.merchant_order_id ?? '—'}</code>
                    </p>
                    <button type="button" onClick={openKcpPointPay}>
                      모바일 결제창으로 이동
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </section>

          <section className="card">
            <h2>포인트 충전 내역</h2>
            {token && isLoading ? <p>불러오는 중...</p> : null}
            {error ? <p className="error">{error}</p> : null}
            {!token ? (
              <p className="description">로그인 후 내역을 볼 수 있습니다.</p>
            ) : (
              <ul className="post-list">
                {pointChargeIntents.map((intent) => (
                  <li key={intent.id} className="post-list-item">
                    <div className="post-list-meta">
                      <strong>{intent.amount_krw.toLocaleString()}원</strong>
                      <span>
                        {intent.status} · {new Date(intent.created_at).toLocaleString()}
                        {intent.paid_at ? (
                          <> · 적립 {intent.amount_krw.toLocaleString()} P</>
                        ) : null}
                      </span>
                    </div>
                    {intent.description ? <p className="post-body">{intent.description}</p> : null}
                  </li>
                ))}
              </ul>
            )}
            {token && !isLoading && pointChargeIntents.length === 0 && !error ? (
              <p>아직 포인트 충전 기록이 없습니다.</p>
            ) : null}
          </section>

          <section className="card">
            <h2>매월 구독</h2>
            <p className="description">
              BroGourmet <strong>일반 회원</strong>을 위한 월 구독(자동결제) 영역입니다. PG <strong>빌링키·정기
              과금</strong> API와 구독 상태 DB가 붙으면 여기서 플랜 선택·동의·다음 결제일·해지를 다룹니다.
            </p>
            <ul className="info-list">
              <li>현재: 백엔드 정기 청구·빌링 연동 <strong>준비 전</strong> — UI만 구획해 둔 상태입니다.</li>
              <li>예정: 플랜(금액·혜택), 결제수단 등록, 다음 청구일, 실패 시 알림·유예, 구독 해지.</li>
              <li>가맹점(식당) 쪽 이벤트·노출 비용 결제는 두 번째 탭(가맹점)에서 진행합니다.</li>
            </ul>
            {!token ? (
              <p className="description">
                구독 기능이 열리면 로그인 후 이용할 수 있습니다.{' '}
                <Link to="/login">로그인</Link>
              </p>
            ) : (
              <p className="helper">로그인됨 — 구독 API 연동 후 이 탭이 활성화됩니다.</p>
            )}
          </section>
        </>
      ) : (
        <>
          <section className="card">
            <h2>가맹점 결제 안내</h2>
            <p className="description">
              <strong>가맹점(등록 식당 등)</strong>이 이벤트 게시·유료 노출 등을 신청할 때 쓰는 결제 흐름입니다. 내부
              목업(<code>POST /payments/intents</code>)과, 설정 시 <strong>NHN KCP 모바일 거래등록 → 결제창 → Ret_URL →
              서버 승인</strong>을 사용합니다.
            </p>
            <ul className="info-list">
              <li>
                KCP: <code>POST /payments/kcp/register</code> (로그인 필요) 후 결제창 URL로 폼 POST
              </li>
              <li>
                <code>BROG_KCP_RETURN_URL</code> 은 공개 gourmet 주소(HTTPS 권장).
              </li>
              <li>카드 외 수단·<code>KCP_PAY_TYPE</code> 은 KCP 문서·환경변수 기준.</li>
            </ul>
          </section>

          {token ? (
            <section className="card board-form-card">
              <h2>결제 의도 생성 (목업)</h2>
              <p className="description">이벤트·노출 등 건별 금액을 남길 때 사용합니다.</p>
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
                    placeholder="이벤트 게시비, 프리미엄 노출 1주 등"
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
              <p className="description">가맹점 결제 의도를 만들려면 로그인해 주세요.</p>
            </section>
          )}

          {token ? (
            <section className="card board-form-card">
              <h2>NHN KCP (모바일 거래등록)</h2>
              <p className="description">
                위와 동일한 금액·설명으로 KCP 거래등록. 서버에 <code>KCP_SITE_CD</code>,{' '}
                <code>BROG_KCP_RETURN_URL</code> 필요. 승인까지 하려면 <code>KCP_CERT_INFO</code> 또는{' '}
                <code>KCP_CERT_INFO_PATH</code>.
              </p>
              <form className="form" onSubmit={handleKcpPrepare}>
                <p className="helper">금액·설명은 위 목업 폼과 공유합니다. (현재 {amount.toLocaleString()}원)</p>
                <button type="submit" disabled={isKcpSubmitting}>
                  {isKcpSubmitting ? 'KCP 등록 중...' : 'KCP 거래등록'}
                </button>
              </form>
              {kcpError ? <p className="error">{kcpError}</p> : null}
              {lastKcp ? (
                <div style={{ marginTop: '1rem' }}>
                  <p className="description">
                    등록됨 — intent #{lastKcp.intent.id}, 주문번호{' '}
                    <code>{lastKcp.intent.merchant_order_id ?? '—'}</code>
                  </p>
                  <button type="button" onClick={openKcpMobilePay}>
                    모바일 결제창으로 이동 (폼 POST)
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="card">
            <h2>내 결제 의도 (가맹점 건)</h2>
            {token && isLoading ? <p>불러오는 중...</p> : null}
            {error ? <p className="error">{error}</p> : null}
            <ul className="post-list">
              {merchantIntents.map((intent) => (
                <li key={intent.id} className="post-list-item">
                  <div className="post-list-meta">
                    <strong>{intent.amount_krw.toLocaleString()}원</strong>
                    <span>
                      {intent.status} · {new Date(intent.created_at).toLocaleString()}
                      {intent.merchant_order_id ? (
                        <>
                          {' · '}
                          <code>{intent.merchant_order_id}</code>
                        </>
                      ) : null}
                      {intent.paid_at ? <> · paid {new Date(intent.paid_at).toLocaleString()}</> : null}
                    </span>
                  </div>
                  {intent.description ? <p className="post-body">{intent.description}</p> : null}
                </li>
              ))}
            </ul>
            {token && !isLoading && merchantIntents.length === 0 && !error ? <p>아직 기록이 없습니다.</p> : null}
          </section>
        </>
      )}
    </div>
  )
}
