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
      await createSiteEvent(token, body.trim())
      setBody('')
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
    <div className="board-layout">
      <section className="card board-form-card">
        <p className="eyebrow">Site</p>
        <h1>이벤트 작성</h1>
        <p className="helper">
          상단 티커에 노출됩니다. 최종 관리자 또는 <strong>담당 구가 지정된</strong> 지역 담당자만 등록·관리할 수 있습니다.{' '}
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
            <button type="submit" disabled={isSubmitting || !body.trim()}>
              {isSubmitting ? '등록 중…' : '티커에 등록'}
            </button>
          </form>
        )}

        {submitError ? <p className="form-error">{submitError}</p> : null}
      </section>

      {token && canWriteSiteEvents(user) ? (
        <section className="card board-form-card site-event-list-card">
          <h2 className="site-event-list-card__title">등록된 이벤트</h2>
          <p className="helper">
            비활성화하면 티커에서만 숨기고, 삭제하면 DB에서 제거됩니다. 지역 담당자는 본인이 등록한 항목만 바꿀 수 있습니다.
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
                    <span className={ev.is_active ? 'site-event-list__badge site-event-list__badge--on' : 'site-event-list__badge'}>
                      {ev.is_active ? '노출 중' : '비활성'}
                    </span>
                    <time className="site-event-list__time" dateTime={ev.created_at}>
                      {new Date(ev.created_at).toLocaleString('ko-KR')}
                    </time>
                  </div>
                  <p className="site-event-list__body">{ev.body}</p>
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
  )
}
