import { useCallback, useRef, useState } from 'react'

import { BrokeGourmetLogoMark, BrokeGourmetWordmark } from './BrokeGourmetLogoMark'

type Phase = 'welcome' | 'opening' | 'closed'

export function SaloonWelcome() {
  const [phase, setPhase] = useState<Phase>('welcome')
  const [heroImgFailed, setHeroImgFailed] = useState(false)
  const enterStartedRef = useRef(false)
  const reducedMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  const finish = useCallback(() => {
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
