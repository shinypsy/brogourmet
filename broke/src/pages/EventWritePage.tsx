import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe, type User } from '../api/auth'
import {
  createSiteEvent,
  deactivateSiteEvent,
  deleteSiteEvent,
  listSiteEvents,
  SITE_EVENT_UPDATED,
  type SiteEventRead,
} from '../api/events'
import { canMutateSiteEvent, canWriteSiteEvents } from '../lib/roles'

export function EventWritePage() {
  const [user, setUser] = useState<User | null>(null)
  const [body, setBody] = useState('')
  /** 비우면 상단 티커 전역. 숫자면 해당 BroG 메인 리스트 스티커 + 상세 본문 */
  const [restaurantIdInput, setRestaurantIdInput] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [events, setEvents] = useState<SiteEventRead[]>([])
  const [listError, setListError] = useState('')
  const [listBusy, setListBusy] = useState(false)
  const [rowBusyId, setRowBusyId] = useState<number | null>(null)
  const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null

  const canWrite = Boolean(token) && canWriteSiteEvents(user)

  const refreshList = useCallback(async () => {
    if (!token || !canWriteSiteEvents(user)) {
      setEvents([])
      return
    }
    setListError('')
    setListBusy(true)
    try {
      const rows = await listSiteEvents(token)
      setEvents(rows)
    } catch (err) {
      setListError(err instanceof Error ? err.message : '목록을 불러오지 못했습니다.')
      setEvents([])
    } finally {
      setListBusy(false)
    }
  }, [token, user])

  useEffect(() => {
    if (!token) {
      setUser(null)
      return
    }
    let cancelled = false
    void fetchMe(token)
      .then((me) => {
        if (!cancelled) setUser(me)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    void refreshList()
  }, [refreshList])

  function notifyTickerUpdated() {
    window.dispatchEvent(new Event(SITE_EVENT_UPDATED))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token || !canWrite) {
      setSubmitError('로그인 후 최종 관리자 또는 담당 구가 있는 지역 담당자만 등록할 수 있습니다.')
      return
    }
    setSubmitError('')
    setIsSubmitting(true)
    try {
      const ridRaw = restaurantIdInput.trim()
      let restaurant_id: number | null = null
      if (ridRaw !== '') {
        const n = Number.parseInt(ridRaw, 10)
        if (!Number.isFinite(n) || n < 1) {
          setSubmitError('BroG ID는 비우거나 1 이상의 정수로 입력하세요.')
          return
        }
        restaurant_id = n
      }
      await createSiteEvent(token, body.trim(), { restaurant_id })
      setBody('')
      setRestaurantIdInput('')
      notifyTickerUpdated()
      await refreshList()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '등록에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeactivate(id: number) {
    if (!token) return
    setRowBusyId(id)
    setListError('')
    try {
      await deactivateSiteEvent(token, id)
      notifyTickerUpdated()
      await refreshList()
    } catch (err) {
      setListError(err instanceof Error ? err.message : '비활성화에 실패했습니다.')
    } finally {
      setRowBusyId(null)
    }
  }

  async function handleDelete(id: number) {
    if (!token) return
    if (!window.confirm('이 이벤트를 DB에서 삭제할까요? (복구되지 않습니다)')) {
      return
    }
    setRowBusyId(id)
    setListError('')
    try {
      await deleteSiteEvent(token, id)
      notifyTickerUpdated()
      await refreshList()
    } catch (err) {
      setListError(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setRowBusyId(null)
    }
  }

  return (
    <div className="home-layout home-layout--hub app-route-hub">
    <div className="board-layout">
      <section className="card board-form-card">
        <p className="eyebrow">Site</p>
        <h1>이벤트 작성</h1>
        <p className="helper">
          <strong>전역</strong>: BroG 번호를 비우면 문구가 <strong>상단 헤더 티커</strong>에만 나갑니다.{' '}
          <strong>가맹점</strong>: 번호를 넣으면 티커에는 안 나가고, <strong>BroG 메인 리스트·지도 옆 목록</strong> 카드
          사진에 「이벤트」스티커가 붙으며, 상세 화면에서는 이벤트 본문만 보입니다. 최종 관리자 또는{' '}
          <strong>담당 구가 지정된</strong> 지역 담당자만 등록·관리할 수 있습니다.{' '}
          <Link to="/">홈</Link>
          {' · '}
          <Link to="/login">로그인</Link>
        </p>

        {!token ? (
          <p className="helper">로그인이 필요합니다.</p>
        ) : !canWriteSiteEvents(user) ? (
          <p className="helper">
            이벤트 등록은 최종 관리자(super_admin) 또는 담당 구가 있는 지역 담당자(regional_manager)만 할 수 있습니다.
          </p>
        ) : (
          <form className="form" onSubmit={handleSubmit}>
            <label>
              이벤트 문구
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                maxLength={2000}
                required
                placeholder="예: 봄 시즌 할인 안내"
              />
            </label>
            <label>
              맛집 BroG 번호 (선택)
              <input
                type="text"
                inputMode="numeric"
                value={restaurantIdInput}
                onChange={(e) => setRestaurantIdInput(e.target.value.replace(/\D/g, ''))}
                placeholder="비움=헤더 티커만 · 숫자=그 맛집 전용(/restaurants/번호)"
                autoComplete="off"
                aria-describedby="event-write-brog-id-hint"
              />
            </label>
            <p id="event-write-brog-id-hint" className="helper event-write-brog-id-hint">
              등록된 맛집(BroG)마다 붙는 <strong>고유 숫자 id</strong>입니다. 상세 주소가{' '}
              <code>/restaurants/42</code>이면 <strong>42</strong>를 넣습니다. 비우면{' '}
              사이트 전체 상단 티커용(전역)입니다.
            </p>
            <button type="submit" disabled={isSubmitting || !body.trim()}>
              {isSubmitting ? '등록 중…' : '등록'}
            </button>
          </form>
        )}

        {submitError ? <p className="form-error">{submitError}</p> : null}
      </section>

      {token && canWriteSiteEvents(user) ? (
        <section className="card board-form-card site-event-list-card">
          <h2 className="site-event-list-card__title">등록된 이벤트</h2>
          <p className="helper">
            비활성화하면 노출만 숨기고, 삭제하면 DB에서 제거됩니다. 지역 담당자는 본인이 등록한 항목만 바꿀 수 있습니다. BroG
            ID가 있는 항목은 상단 티커가 아니라 해당 음식점 상세에만 연결됩니다.
          </p>
          {listError ? <p className="form-error">{listError}</p> : null}
          {listBusy && events.length === 0 ? <p className="helper">불러오는 중…</p> : null}
          {!listBusy && events.length === 0 ? <p className="helper">아직 등록된 이벤트가 없습니다.</p> : null}
          <ul className="site-event-list">
            {events.map((ev) => {
              const canMutate = canMutateSiteEvent(user, ev)
              const busy = rowBusyId === ev.id
              return (
                <li key={ev.id} className="site-event-list__item">
                  <div className="site-event-list__meta">
                    <span
                      className={
                        ev.restaurant_id != null
                          ? 'site-event-list__badge site-event-list__badge--brog'
                          : 'site-event-list__badge'
                      }
                    >
                      {ev.restaurant_id != null ? `BroG #${ev.restaurant_id}` : '상단 티커'}
                    </span>
                    <span className={ev.is_active ? 'site-event-list__badge site-event-list__badge--on' : 'site-event-list__badge'}>
                      {ev.is_active ? '노출 중' : '비활성'}
                    </span>
                    <time className="site-event-list__time" dateTime={ev.created_at}>
                      {new Date(ev.created_at).toLocaleString('ko-KR')}
                    </time>
                  </div>
                  <p className="site-event-list__body" title={ev.body}>
                    {ev.body}
                  </p>
                  {canMutate ? (
                    <div className="site-event-list__actions">
                      {ev.is_active ? (
                        <button
                          type="button"
                          className="compact-link"
                          disabled={busy}
                          onClick={() => void handleDeactivate(ev.id)}
                        >
                          {busy ? '처리 중…' : '비활성화'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="compact-link danger-text"
                        disabled={busy}
                        onClick={() => void handleDelete(ev.id)}
                      >
                        {busy ? '처리 중…' : '삭제'}
                      </button>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </div>
    </div>
  )
}
