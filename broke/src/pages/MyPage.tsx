import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe } from '../api/auth'
import type { User } from '../api/auth'
import {
  fetchManageRestaurantList,
  restoreRestaurant,
  type RestaurantManageRow,
} from '../api/restaurants'
import { canManageBrog, isSuperAdmin } from '../lib/roles'

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
    if (!token || !user || !canManageBrog(user.role)) {
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
    <section className="card">
      <h1>Myinfo</h1>
      <p className="description">
        로그인한 사용자 정보는 <code>/users/me</code> API 응답을 그대로 보여 줍니다. BroG 담당 권한이 있으면 관리
        목록도 이 페이지에서 이어집니다.
      </p>

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
          {canManageBrog(user.role) ? (
            <>
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
                  <h2 style={{ fontSize: '1.1rem', marginTop: '1.25rem' }}>BroG 관리 목록</h2>
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
                  등록된 BroG가 없습니다.
                </p>
              ) : null}
            </>
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
