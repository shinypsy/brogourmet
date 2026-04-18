import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import {
  ACCESS_TOKEN_KEY,
  confirmPasswordChange,
  fetchMe,
  patchMyNickname,
  requestPasswordChangeCode,
} from '../api/auth'
import { notifyUserProfileRefresh } from '../authEvents'
import type { User } from '../api/auth'
import {
  fetchManageRestaurantList,
  restoreRestaurant,
  type RestaurantManageRow,
} from '../api/restaurants'
import { WithdrawAccountSection } from '../components/WithdrawAccountSection'
import { assumeAdminUi, isSuperAdmin, ROLE_REGIONAL_MANAGER } from '../lib/roles'
import { TEST_UI_SUPER_ADMIN_PERSONA } from '../lib/testUiAdminPersona'

export function MyPage() {
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [brogRows, setBrogRows] = useState<RestaurantManageRow[]>([])
  const [brogListError, setBrogListError] = useState('')
  const [brogListLoading, setBrogListLoading] = useState(false)
  const [includeHiddenBrogs, setIncludeHiddenBrogs] = useState(false)
  const [pwdCode, setPwdCode] = useState('')
  const [pwdNew, setPwdNew] = useState('')
  const [pwdConfirm, setPwdConfirm] = useState('')
  const [pwdCodeBusy, setPwdCodeBusy] = useState(false)
  const [pwdSubmitBusy, setPwdSubmitBusy] = useState(false)
  const [pwdMessage, setPwdMessage] = useState('')
  const [pwdError, setPwdError] = useState('')
  const [nickDraft, setNickDraft] = useState('')
  const [nickBusy, setNickBusy] = useState(false)
  const [nickMessage, setNickMessage] = useState('')
  const [nickError, setNickError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY)

    if (!token) {
      if (assumeAdminUi()) {
        setUser(TEST_UI_SUPER_ADMIN_PERSONA)
        setNickDraft(TEST_UI_SUPER_ADMIN_PERSONA.nickname)
        setError('')
        setIsLoading(false)
        return
      }
      setError('저장된 토큰이 없습니다. 먼저 로그인해주세요.')
      setIsLoading(false)
      return
    }

    async function loadUser(accessToken: string) {
      try {
        const me = await fetchMe(accessToken)
        setUser(me)
        setNickDraft(me.nickname)
        setNickMessage('')
        setNickError('')
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : '내 정보를 불러오지 못했습니다.')
      } finally {
        setIsLoading(false)
      }
    }

    void loadUser(token)
  }, [])

  useEffect(() => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY)
    if (!user || !token) {
      setBrogRows([])
      return
    }
    setBrogListError('')
    setBrogListLoading(true)
    void fetchManageRestaurantList(token, {
      includeDeleted: isSuperAdmin(user.role) && includeHiddenBrogs,
    })
      .then(setBrogRows)
      .catch((e) => setBrogListError(e instanceof Error ? e.message : 'BroG 목록을 불러오지 못했습니다.'))
      .finally(() => setBrogListLoading(false))
  }, [user, includeHiddenBrogs])

  const accessToken = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null
  const showPasswordChange = Boolean(user && accessToken)
  const canEditNickname = Boolean(user && accessToken?.trim())

  async function handleNicknameSubmit(e: FormEvent) {
    e.preventDefault()
    const t = localStorage.getItem(ACCESS_TOKEN_KEY)
    if (!t || !user) return
    const next = nickDraft.trim()
    setNickError('')
    setNickMessage('')
    if (next.length < 2) {
      setNickError('닉네임은 공백 제외 2자 이상이어야 합니다.')
      return
    }
    if (next === user.nickname.trim()) {
      setNickMessage('변경 내용이 없습니다.')
      return
    }
    setNickBusy(true)
    try {
      const me = await patchMyNickname(t, next)
      setUser(me)
      setNickDraft(me.nickname)
      setNickMessage('닉네임이 저장되었습니다.')
      notifyUserProfileRefresh()
    } catch (err) {
      setNickError(err instanceof Error ? err.message : '닉네임 저장에 실패했습니다.')
    } finally {
      setNickBusy(false)
    }
  }

  async function handleRequestPasswordCode() {
    const t = localStorage.getItem(ACCESS_TOKEN_KEY)
    if (!t) return
    setPwdError('')
    setPwdMessage('')
    setPwdCodeBusy(true)
    try {
      const res = await requestPasswordChangeCode(t)
      if (res.dev_password_change_code) {
        setPwdMessage(
          `개발 모드: 인증코드 ${res.dev_password_change_code} (이메일 미발송 시 화면에만 표시됩니다.)`,
        )
      } else {
        setPwdMessage('등록하신 이메일로 6자리 인증코드를 보냈습니다. 몇 분 내로 도착하지 않으면 스팸함을 확인해 주세요.')
      }
    } catch (e) {
      setPwdError(e instanceof Error ? e.message : String(e))
    } finally {
      setPwdCodeBusy(false)
    }
  }

  async function handlePasswordChangeSubmit(event: FormEvent) {
    event.preventDefault()
    const t = localStorage.getItem(ACCESS_TOKEN_KEY)
    if (!t) return
    setPwdError('')
    setPwdMessage('')
    if (pwdNew !== pwdConfirm) {
      setPwdError('새 비밀번호 확인이 일치하지 않습니다.')
      return
    }
    if (pwdNew.length < 8) {
      setPwdError('새 비밀번호는 8자 이상이어야 합니다.')
      return
    }
    setPwdSubmitBusy(true)
    try {
      await confirmPasswordChange(t, { code: pwdCode.trim(), new_password: pwdNew })
      setPwdCode('')
      setPwdNew('')
      setPwdConfirm('')
      setPwdMessage('비밀번호가 변경되었습니다. 다음 로그인부터 새 비밀번호를 사용하세요.')
    } catch (e) {
      setPwdError(e instanceof Error ? e.message : String(e))
    } finally {
      setPwdSubmitBusy(false)
    }
  }

  async function handleRestoreBroG(rowId: number) {
    const t = localStorage.getItem(ACCESS_TOKEN_KEY)
    if (!t || !user || !isSuperAdmin(user.role)) return
    if (!window.confirm('이 BroG를 지도·목록에 다시 보이게 할까요?')) return
    setBrogListError('')
    try {
      await restoreRestaurant(t, rowId)
      const rows = await fetchManageRestaurantList(t, {
        includeDeleted: includeHiddenBrogs,
      })
      setBrogRows(rows)
    } catch (e) {
      setBrogListError(e instanceof Error ? e.message : '복구에 실패했습니다.')
    }
  }

  return (
    <section className="card my-page">
      <h1>Myinfo</h1>

      {isLoading ? <p>불러오는 중...</p> : null}

      {user ? (
        <>
          {!user.email_verified_at ? (
            <div className="my-page__verify-callout" role="status">
              <p className="my-page__verify-callout-title">이메일 인증이 필요합니다</p>
              <p className="helper" style={{ margin: '6px 0 0' }}>
                <Link to="/verify-email">이메일 인증하기</Link>
              </p>
            </div>
          ) : null}
          <dl className="profile">
            <div>
              <dt>이메일</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>닉네임</dt>
              <dd>
                {canEditNickname ? (
                  <form className="my-page__nickname-form" onSubmit={(ev) => void handleNicknameSubmit(ev)}>
                    <div className="my-page__nickname-row">
                      <input
                        type="text"
                        value={nickDraft}
                        onChange={(e) => setNickDraft(e.target.value)}
                        maxLength={100}
                        autoComplete="nickname"
                        spellCheck={false}
                        aria-label="닉네임"
                      />
                      <button type="submit" className="button-secondary" disabled={nickBusy}>
                        {nickBusy ? '저장 중…' : '저장'}
                      </button>
                    </div>
                    {nickMessage ? (
                      <p className="helper" role="status" style={{ margin: '6px 0 0' }}>
                        {nickMessage}
                      </p>
                    ) : null}
                    {nickError ? (
                      <p className="error" role="alert" style={{ margin: '6px 0 0' }}>
                        {nickError}
                      </p>
                    ) : null}
                  </form>
                ) : (
                  user.nickname
                )}
              </dd>
            </div>
            <div>
              <dt>권한</dt>
              <dd>{user.role}</dd>
            </div>
            {user.managed_district_name ? (
              <div>
                <dt>담당 구</dt>
                <dd>
                  {user.managed_district_name}
                  {user.managed_district_id != null ? ` (id ${user.managed_district_id})` : ''}
                </dd>
              </div>
            ) : null}
            <div>
              <dt>활성 여부</dt>
              <dd>{user.is_active ? '활성' : '비활성'}</dd>
            </div>
            <div>
              <dt>이메일 인증</dt>
              <dd>
                {user.email_verified_at
                  ? `완료 (${user.email_verified_at})`
                  : '미완료 — 로그인 제한이 켜져 있으면 /verify-email 에서 인증하세요.'}
              </dd>
            </div>
          </dl>
          {!user.email_verified_at ? (
            <p className="helper">
              <Link to="/verify-email">이메일 인증하기</Link>
            </p>
          ) : null}
          {showPasswordChange ? (
            <div className="my-page__password-change">
              <h2 style={{ fontSize: '1.1rem', marginTop: '1.25rem' }}>비밀번호 변경</h2>
              <p style={{ marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="button-secondary"
                  disabled={pwdCodeBusy}
                  onClick={() => void handleRequestPasswordCode()}
                >
                  {pwdCodeBusy ? '발송 중…' : '인증코드 받기'}
                </button>
              </p>
              {pwdMessage ? (
                <p className="helper" role="status" style={{ marginTop: '0.5rem' }}>
                  {pwdMessage}
                </p>
              ) : null}
              {pwdError ? <p className="error" style={{ marginTop: '0.5rem' }}>{pwdError}</p> : null}
              <form className="my-page__password-change-form" onSubmit={handlePasswordChangeSubmit}>
                <label className="my-page__password-change-label">
                  이메일 인증코드 (6자리)
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={8}
                    value={pwdCode}
                    onChange={(e) => setPwdCode(e.target.value)}
                    placeholder="123456"
                  />
                </label>
                <label className="my-page__password-change-label">
                  새 비밀번호
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={pwdNew}
                    onChange={(e) => setPwdNew(e.target.value)}
                    minLength={8}
                  />
                </label>
                <label className="my-page__password-change-label">
                  새 비밀번호 확인
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={pwdConfirm}
                    onChange={(e) => setPwdConfirm(e.target.value)}
                    minLength={8}
                  />
                </label>
                <button type="submit" className="button-primary" disabled={pwdSubmitBusy}>
                  {pwdSubmitBusy ? '변경 중…' : '비밀번호 변경'}
                </button>
              </form>
            </div>
          ) : null}
          <p className="helper">
            <Link to="/restaurants/manage/new">BroG 작성</Link>
          </p>
          {isSuperAdmin(user.role) ? (
            <label className="helper" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <input
                type="checkbox"
                checked={includeHiddenBrogs}
                onChange={(e) => setIncludeHiddenBrogs(e.target.checked)}
              />
              숨긴 BroG 포함 (슈퍼만)
            </label>
          ) : null}
          {brogListError ? <p className="error">{brogListError}</p> : null}
          {brogListLoading ? <p className="helper">BroG 목록 불러오는 중...</p> : null}
          {brogRows.length > 0 ? (
            <>
              <h2 style={{ fontSize: '1.1rem', marginTop: '1.25rem' }}>
                {isSuperAdmin(user.role) || user.role === ROLE_REGIONAL_MANAGER
                  ? 'BroG 관리 목록'
                  : '내가 등록한 BroG'}
              </h2>
              <ul className="compact-list" style={{ marginTop: '0.5rem', paddingLeft: '1.1rem' }}>
                {brogRows.map((row) => (
                  <li key={row.id} style={{ marginBottom: '0.35rem' }}>
                    <Link to={`/restaurants/manage/${row.id}`}>
                      {row.name}
                    </Link>{' '}
                    <span className="muted" style={{ fontSize: '0.85rem' }}>
                      · {row.district} · {row.status === 'draft' ? '초안' : '공개'}
                      {row.is_deleted ? ' · 숨김' : ''}
                    </span>
                    {isSuperAdmin(user.role) && row.is_deleted ? (
                      <>
                        {' '}
                        <button
                          type="button"
                          className="compact-link"
                          style={{ fontSize: '0.8rem', padding: '2px 8px', marginLeft: 4 }}
                          onClick={() => void handleRestoreBroG(row.id)}
                        >
                          다시 공개
                        </button>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <p className="helper my-page__footer-link">
            <Link to="/">홈으로</Link>
          </p>
          <WithdrawAccountSection />
        </>
      ) : null}

      {error ? <p className="error">{error}</p> : null}

      {!user && !isLoading ? (
        <p className="helper">
          <Link to="/login">로그인하기</Link>
        </p>
      ) : null}
    </section>
  )
}
