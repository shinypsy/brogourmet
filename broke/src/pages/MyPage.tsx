import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe } from '../api/auth'
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

  useEffect(() => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY)

    if (!token) {
      if (assumeAdminUi()) {
        setUser(TEST_UI_SUPER_ADMIN_PERSONA)
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
      <p className="description">
        로그인 계정의 프로필입니다. 이메일·닉네임·권한을 확인할 수 있고, BroG 작성 링크와 본인이 등록한 BroG 목록이
        아래에 이어집니다.
      </p>

      {isLoading ? <p>불러오는 중...</p> : null}

      {user ? (
        <>
          {!user.email_verified_at ? (
            <div className="my-page__verify-callout" role="status">
              <p className="my-page__verify-callout-title">이메일 인증이 필요합니다</p>
              <p className="helper" style={{ margin: '6px 0 0' }}>
                인증 후 로그인하면 <strong>바로 홈(메인)</strong>으로 들어갑니다.{' '}
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
              <dd>{user.nickname}</dd>
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
          ) : !brogListLoading && !brogListError ? (
            <p className="helper" style={{ marginTop: '0.5rem' }}>
              {assumeAdminUi() && !localStorage.getItem(ACCESS_TOKEN_KEY)
                ? '테스트 UI: BroG 목록은 로그인 후 API에서 불러옵니다.'
                : isSuperAdmin(user.role) || user.role === ROLE_REGIONAL_MANAGER
                  ? '등록된 BroG가 없습니다.'
                  : '아직 등록한 BroG가 없습니다.'}
            </p>
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
