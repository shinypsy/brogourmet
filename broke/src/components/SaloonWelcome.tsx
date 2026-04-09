import { useCallback, useLayoutEffect, useRef, useState } from 'react'

import { BrokeGourmetLogoMark, BrokeGourmetWordmark } from './BrokeGourmetLogoMark'

type Phase = 'welcome' | 'opening' | 'closed'

const SALOON_SEEN_KEY = 'brogourmet_saloon_seen'

/** 이미 입장(탭)했거나 접근성으로 건너뛴 경우에만 생략. 로그인 여부와 무관 — 첫 방문은 항상 인트로 가능. */
function shouldSkipSaloonIntro(): boolean {
  if (typeof window === 'undefined') return true
  try {
    if (localStorage.getItem(SALOON_SEEN_KEY) === '1') return true
  } catch {
    /* private mode 등 */
  }
  return false
}

export function SaloonWelcome() {
  const [phase, setPhase] = useState<Phase>(() => (shouldSkipSaloonIntro() ? 'closed' : 'welcome'))
  const [heroImgFailed, setHeroImgFailed] = useState(false)
  const enterStartedRef = useRef(false)
  const overlayRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  /* React Strict Mode 이중 마운트 등으로 saloon-overlay-in 이 스킵되는 경우 대비 */
  useLayoutEffect(() => {
    if (phase !== 'welcome' || reducedMotion.current) return
    const el = overlayRef.current
    if (!el) return
    el.style.animation = 'none'
    void el.offsetWidth
    el.style.removeProperty('animation')
  }, [phase])

  const finish = useCallback(() => {
    try {
      localStorage.setItem(SALOON_SEEN_KEY, '1')
    } catch {
      /* ignore */
    }
    setPhase('closed')
  }, [])

  const handleEnter = useCallback(() => {
    if (enterStartedRef.current) return
    enterStartedRef.current = true
    if (reducedMotion.current) {
      finish()
      return
    }
    setPhase('opening')
    window.setTimeout(finish, 1500)
  }, [finish])

  if (phase === 'closed') return null

  const opening = phase === 'opening'

  return (
    <div
      ref={overlayRef}
      className={`saloon-overlay${opening ? ' saloon-overlay--opening' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="saloon-welcome-title"
      aria-describedby="saloon-since-line"
    >
      <div className="saloon-overlay__brick" aria-hidden />
      <div className="saloon-scene">
        <div className="saloon-door saloon-door--left" aria-hidden>
          <span className="saloon-door__plank" />
          <span className="saloon-door__hinge saloon-door__hinge--left" />
        </div>
        <div className="saloon-door saloon-door--right" aria-hidden>
          <span className="saloon-door__plank" />
          <span className="saloon-door__hinge saloon-door__hinge--right" />
        </div>

        <div className="saloon-center">
          <h1 id="saloon-welcome-title" className="visually-hidden">
            Broke Gourmet에 오신 것을 환영합니다
          </h1>

          <button
            type="button"
            className="saloon-tap-target"
            onClick={handleEnter}
            disabled={opening}
            aria-label="Broke Gourmet, 탭하여 입장"
          >
            <div className="saloon-storefront">
              <div className="saloon-lintel" aria-hidden />
              <div className="saloon-storefront-row">
                <div className="saloon-pillar saloon-pillar--frame saloon-pillar--frame-left" aria-hidden />
                <div className="saloon-storefront-main">
                  <div className="saloon-facade-panel">
                    <div className="saloon-logo-frame saloon-logo-frame--hero">
                      {!heroImgFailed ? (
                        <img
                          className="saloon-hero-full"
                          src="/brand/broke-gourmet-hero.png"
                          alt="Broke Gourmet — Elevated Eats"
                          width={480}
                          height={520}
                          draggable={false}
                          onError={() => setHeroImgFailed(true)}
                        />
                      ) : (
                        <>
                          <BrokeGourmetLogoMark className="saloon-logo-svg saloon-logo-svg--base" />
                          <BrokeGourmetWordmark />
                        </>
                      )}
                    </div>
                  </div>
                  <span id="saloon-since-line" className="saloon-since saloon-since--lower">
                    <span className="saloon-since__label">Since</span>
                    <span className="saloon-since__year">2026</span>
                  </span>
                </div>
                <div className="saloon-pillar saloon-pillar--frame saloon-pillar--frame-right" aria-hidden />
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
