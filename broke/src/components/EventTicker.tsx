import { useCallback, useEffect, useState } from 'react'

import { fetchEventTicker, SITE_EVENT_UPDATED } from '../api/events'

const POLL_MS = 90_000

export function EventTicker() {
  const [text, setText] = useState('')

  const load = useCallback(async () => {
    try {
      const { text: t } = await fetchEventTicker()
      setText((t ?? '').trim())
    } catch {
      setText('')
    }
  }, [])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => void load(), POLL_MS)
    function onUpdated() {
      void load()
    }
    window.addEventListener(SITE_EVENT_UPDATED, onUpdated)
    return () => {
      window.clearInterval(id)
      window.removeEventListener(SITE_EVENT_UPDATED, onUpdated)
    }
  }, [load])

  if (!text) {
    return null
  }

  return (
    <div className="event-ticker" role="region" aria-label="이벤트 안내">
      <span className="event-ticker__label">이벤트</span>
      <div className="event-ticker__viewport">
        <div className="event-ticker__rail">
          <span className="event-ticker__segment">{text}</span>
          <span className="event-ticker__segment" aria-hidden>
            {text}
          </span>
        </div>
      </div>
    </div>
  )
}
