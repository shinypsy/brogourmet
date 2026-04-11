import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'

import {
  clearUserRegionalManager,
  fetchAdminDistricts,
  fetchAdminRestaurants,
  fetchAdminSiteNotices,
  patchAdminRestaurantFranchisePin,
  fetchAdminUsers,
  putAdminSiteNotices,
  setUserRegionalManager,
  type AdminDistrictOption,
  type AdminRestaurantRow,
  type SiteNoticeDraft,
} from '../api/admin'
import {
  deleteRestaurant,
  purgeRestaurantPermanent,
  restoreRestaurant,
} from '../api/restaurants'
import { fetchMe, type User } from '../api/auth'
import { ACCESS_TOKEN_KEY } from '../api/config'
import { ROLE_REGIONAL_MANAGER, ROLE_SUPER_ADMIN, isSuperAdmin } from '../lib/roles'

export function AdminPage() {
  const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null
  const [me, setMe] = useState<User | null | undefined>(undefined)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [restaurants, setRestaurants] = useState<AdminRestaurantRow[]>([])
  const [districts, setDistricts] = useState<AdminDistrictOption[]>([])
  const [districtPick, setDistrictPick] = useState<Record<number, number>>({})
  const [busyUserId, setBusyUserId] = useState<number | null>(null)
  const [busyRestaurantId, setBusyRestaurantId] = useState<number | null>(null)
  const [busyFranchiseId, setBusyFranchiseId] = useState<number | null>(null)
  /** null = 전체 보기(필터 없음) */
  const [restaurantDistrictFilter, setRestaurantDistrictFilter] = useState<number | null>(null)
  const [noticeForm, setNoticeForm] = useState<SiteNoticeDraft[]>([
    { slot: 1, title: '', body: '' },
    { slot: 2, title: '', body: '' },
    { slot: 3, title: '', body: '' },
  ])
  const [busyNotices, setBusyNotices] = useState(false)

  useEffect(() => {
    if (!token) {
      setMe(null)
      return
    }
    let cancelled = false
    void fetchMe(token)
      .then((u) => {
        if (!cancelled) setMe(u)
      })
      .catch(() => {
        if (!cancelled) setMe(null)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const loadAll = useCallback(async () => {
    setLoadError(null)
    try {
      const [du, dr, dd, notices] = await Promise.all([
        fetchAdminUsers(),
        fetchAdminRestaurants(),
        fetchAdminDistricts(),
        fetchAdminSiteNotices(),
      ])
      setUsers(du)
      setRestaurants(dr)
      setDistricts(dd)
      setNoticeForm(
        notices
          .slice()
          .sort((a, b) => a.slot - b.slot)
          .map((n) => ({ slot: n.slot, title: n.title, body: n.body })),
      )
      setDistrictPick((prev) => {
        const next = { ...prev }
        for (const u of du) {
          if (next[u.id] === undefined && u.managed_district_id != null) {
            next[u.id] = u.managed_district_id
          }
        }
        return next
      })
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  async function handleSaveNotices() {
    setBusyNotices(true)
    setLoadError(null)
    try {
      const saved = await putAdminSiteNotices(noticeForm)
      setNoticeForm(
        saved
          .slice()
          .sort((a, b) => a.slot - b.slot)
          .map((n) => ({ slot: n.slot, title: n.title, body: n.body })),
      )
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyNotices(false)
    }
  }

  useEffect(() => {
    if (me === undefined || me === null || !isSuperAdmin(me.role)) return
    void loadAll()
  }, [me, loadAll])

  const filteredRestaurants = useMemo(() => {
    if (restaurantDistrictFilter === null) return restaurants
    return restaurants.filter((r) => r.district_id === restaurantDistrictFilter)
  }, [restaurants, restaurantDistrictFilter])

  if (!token) {
    return <Navigate to="/login" replace state={{ from: '/admin' }} />
  }

  if (me === undefined) {
    return (
      <section className="admin-page">
        <p className="route-fallback">불러오는 중…</p>
      </section>
    )
  }

  if (me === null || !isSuperAdmin(me.role)) {
    return (
      <section className="admin-page">
        <h1 className="admin-page__title">관리자</h1>
        <p className="admin-page__muted">최종 관리자(super_admin)만 이 페이지를 볼 수 있습니다.</p>
        <Link to="/">Home</Link>
      </section>
    )
  }

  async function handleAssign(userId: number) {
    const did = districtPick[userId]
    if (did === undefined || Number.isNaN(did)) {
      setLoadError('구를 선택하세요.')
      return
    }
    setBusyUserId(userId)
    setLoadError(null)
    try {
      const updated = await setUserRegionalManager(userId, did)
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)))
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyUserId(null)
    }
  }

  const adminToken = token ?? ''

  function adminRestaurantLabel(r: AdminRestaurantRow): string {
    if (r.is_deleted) return '숨김'
    if (r.status !== 'published') return '초안'
    return '공개'
  }

  async function handleRestaurantHide(id: number) {
    setBusyRestaurantId(id)
    setLoadError(null)
    try {
      await deleteRestaurant(adminToken, id)
      await loadAll()
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyRestaurantId(null)
    }
  }

  async function handleRestaurantUnhide(id: number) {
    setBusyRestaurantId(id)
    setLoadError(null)
    try {
      await restoreRestaurant(adminToken, id)
      await loadAll()
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyRestaurantId(null)
    }
  }

  async function handleRestaurantPurge(id: number, name: string) {
    if (
      !window.confirm(
        `「${name}」(id ${id})을(를) DB에서 영구 삭제합니다. 되돌릴 수 없습니다. 계속할까요?`,
      )
    ) {
      return
    }
    setBusyRestaurantId(id)
    setLoadError(null)
    try {
      await purgeRestaurantPermanent(adminToken, id)
      await loadAll()
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyRestaurantId(null)
    }
  }

  async function handleFranchisePinChange(id: number, checked: boolean) {
    setBusyFranchiseId(id)
    setLoadError(null)
    try {
      const updated = await patchAdminRestaurantFranchisePin(id, checked)
      setRestaurants((prev) => prev.map((row) => (row.id === id ? updated : row)))
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyFranchiseId(null)
    }
  }

  async function handleFranchisePinResetAuto(id: number) {
    setBusyFranchiseId(id)
    setLoadError(null)
    try {
      const updated = await patchAdminRestaurantFranchisePin(id, null)
      setRestaurants((prev) => prev.map((row) => (row.id === id ? updated : row)))
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyFranchiseId(null)
    }
  }

  async function handleClear(userId: number) {
    setBusyUserId(userId)
    setLoadError(null)
    try {
      const updated = await clearUserRegionalManager(userId)
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)))
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyUserId(null)
    }
  }

  return (
    <section className="admin-page">
      <h1 className="admin-page__title">관리자</h1>
      <p className="admin-page__lead">
        사용자 목록에서 지역 담당자(regional_manager)로 구를 지정하거나 해제할 수 있습니다. BroG 표는{' '}
        <strong>초안·숨김 포함 전체</strong>이며, 구별로 묶고 같은 구 안에서는 노출(공개) 행을 먼저 두고{' '}
        <strong>음식점명 내림차순</strong>입니다. 숨김은 목록·지도에서만 가리는 소프트 삭제이고, 삭제는 DB 영구
        삭제입니다.
      </p>

      {loadError ? <p className="admin-page__error">{loadError}</p> : null}

      <div className="admin-page__actions">
        <button type="button" className="admin-page__refresh" onClick={() => void loadAll()}>
          새로고침
        </button>
      </div>

      <h2 className="admin-page__h2">홈 공지 (슬롯 3개)</h2>
      <p className="admin-page__muted admin-page__notice-intro">
        제목·본문을 비우면 해당 슬롯은 홈에서 숨깁니다. 저장하면 즉시 반영됩니다.
      </p>
      <div className="admin-page__notice-grid">
        {noticeForm
          .slice()
          .sort((a, b) => a.slot - b.slot)
          .map((row) => (
            <div key={row.slot} className="admin-page__notice-card">
              <h3 className="admin-page__notice-card-title">슬롯 {row.slot}</h3>
              <label className="admin-page__notice-label">
                제목
                <input
                  type="text"
                  className="admin-page__notice-input"
                  maxLength={200}
                  value={row.title}
                  onChange={(ev) => {
                    const v = ev.target.value
                    setNoticeForm((prev) =>
                      prev.map((p) => (p.slot === row.slot ? { ...p, title: v } : p)),
                    )
                  }}
                />
              </label>
              <label className="admin-page__notice-label">
                본문
                <textarea
                  className="admin-page__notice-textarea"
                  rows={5}
                  maxLength={8000}
                  value={row.body}
                  onChange={(ev) => {
                    const v = ev.target.value
                    setNoticeForm((prev) =>
                      prev.map((p) => (p.slot === row.slot ? { ...p, body: v } : p)),
                    )
                  }}
                />
              </label>
            </div>
          ))}
      </div>
      <div className="admin-page__notice-actions">
        <button
          type="button"
          className="admin-page__btn"
          disabled={busyNotices}
          onClick={() => void handleSaveNotices()}
        >
          {busyNotices ? '저장 중…' : '공지 저장'}
        </button>
      </div>

      <h2 className="admin-page__h2">사용자</h2>
      <div className="admin-page__table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>이메일</th>
              <th>닉네임</th>
              <th>역할</th>
              <th>담당 구</th>
              <th>지역 담당</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.email}</td>
                <td>{u.nickname}</td>
                <td>{u.role}</td>
                <td>{u.managed_district_name ?? '—'}</td>
                <td>
                  {u.role === ROLE_SUPER_ADMIN ? (
                    <span className="admin-page__muted">—</span>
                  ) : (
                    <div className="admin-page__user-actions">
                      <select
                        className="admin-page__select"
                        aria-label={`${u.nickname} 담당 구 선택`}
                        value={districtPick[u.id] ?? ''}
                        onChange={(ev) => {
                          const raw = ev.target.value
                          if (raw === '') {
                            setDistrictPick((p) => {
                              const next = { ...p }
                              delete next[u.id]
                              return next
                            })
                          } else {
                            setDistrictPick((p) => ({ ...p, [u.id]: Number(raw) }))
                          }
                        }}
                      >
                        <option value="">구 선택…</option>
                        {districts.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="admin-page__btn"
                        disabled={busyUserId === u.id}
                        onClick={() => void handleAssign(u.id)}
                      >
                        선정
                      </button>
                      <button
                        type="button"
                        className="admin-page__btn admin-page__btn--secondary"
                        disabled={busyUserId === u.id || u.role !== ROLE_REGIONAL_MANAGER}
                        onClick={() => void handleClear(u.id)}
                      >
                        해제
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="admin-page__h2">BroG 음식점</h2>
      <div className="admin-page__filter-row">
        <label className="admin-page__filter-label" htmlFor="admin-restaurant-district">
          구 선택
        </label>
        <select
          id="admin-restaurant-district"
          className="admin-page__select admin-page__select--filter"
          value={restaurantDistrictFilter === null ? '' : String(restaurantDistrictFilter)}
          onChange={(ev) => {
            const v = ev.target.value
            setRestaurantDistrictFilter(v === '' ? null : Number(v))
          }}
        >
          <option value="">전체</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <span className="admin-page__filter-meta">
          {filteredRestaurants.length === restaurants.length
            ? `${restaurants.length}곳`
            : `${filteredRestaurants.length}곳 표시 (전체 ${restaurants.length}곳)`}
        </span>
      </div>
      <p className="admin-page__muted admin-page__franchise-hint">
        <strong>가맹</strong>은 지도·목록의 가맹 깃발과 같습니다. 체크를 바꾸면 관리자 지정으로 고정되고,{' '}
        <strong>자동</strong>은 등록 계정이 franchise 역할일 때만 가맹으로 표시됩니다.
      </p>
      <div className="admin-page__table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>구</th>
              <th>음식점명</th>
              <th>ID</th>
              <th>상태</th>
              <th>카테고리</th>
              <th>가맹</th>
              <th>목록 고정</th>
              <th>보기</th>
              <th>편집</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {filteredRestaurants.map((r) => (
              <tr key={r.id}>
                <td>{r.district_name}</td>
                <td>{r.name}</td>
                <td>{r.id}</td>
                <td>{adminRestaurantLabel(r)}</td>
                <td>{r.category}</td>
                <td className="admin-page__franchise-cell">
                  <div className="admin-page__franchise-row">
                    <input
                      type="checkbox"
                      checked={r.is_franchise}
                      disabled={busyFranchiseId === r.id}
                      title={
                        r.franchise_pin == null
                          ? '등록자 franchise 여부에 따름. 변경 시 관리자 지정으로 고정됩니다.'
                          : '관리자 지정 중. 자동으로 등록자 역할에 맡길 수 있습니다.'
                      }
                      aria-label={`${r.name} 가맹 표시`}
                      onChange={(ev) => void handleFranchisePinChange(r.id, ev.target.checked)}
                    />
                    {r.franchise_pin != null ? (
                      <button
                        type="button"
                        className="admin-page__franchise-auto"
                        disabled={busyFranchiseId === r.id}
                        title="등록자 역할에 맡김"
                        onClick={() => void handleFranchisePinResetAuto(r.id)}
                      >
                        자동
                      </button>
                    ) : null}
                  </div>
                </td>
                <td>{r.bro_list_pin != null ? `${r.bro_list_pin}위` : '—'}</td>
                <td>
                  {r.is_deleted || r.status !== 'published' ? (
                    <span className="admin-page__muted" title="공개·미삭제 맛집만 공개 상세로 열 수 있습니다.">
                      —
                    </span>
                  ) : (
                    <Link to={`/restaurants/${r.id}`}>상세</Link>
                  )}
                </td>
                <td>
                  <Link to={`/restaurants/manage/${r.id}`}>관리 화면</Link>
                </td>
                <td>
                  <div className="admin-page__rest-actions">
                    <button
                      type="button"
                      className="admin-page__btn admin-page__btn--secondary"
                      disabled={busyRestaurantId === r.id || r.is_deleted}
                      title="목록·지도에서 숨김(소프트 삭제)"
                      onClick={() => void handleRestaurantHide(r.id)}
                    >
                      숨김
                    </button>
                    <button
                      type="button"
                      className="admin-page__btn"
                      disabled={busyRestaurantId === r.id || !r.is_deleted}
                      title="숨김 해제 후 다시 공개"
                      onClick={() => void handleRestaurantUnhide(r.id)}
                    >
                      숨김해제
                    </button>
                    <button
                      type="button"
                      className="admin-page__btn admin-page__btn--danger"
                      disabled={busyRestaurantId === r.id}
                      title="행·메뉴 영구 삭제"
                      onClick={() => void handleRestaurantPurge(r.id, r.name)}
                    >
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
