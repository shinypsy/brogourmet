import { lazy, Suspense, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

const FreeShareBoardPage = lazy(() =>
  import('./FreeShareBoardPage').then((m) => ({ default: m.FreeShareBoardPage })),
)

type QnaTab = 'faq' | 'qna'

export function QnaHubPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: QnaTab = searchParams.get('tab') === 'faq' ? 'faq' : 'qna'

  const setTab = useCallback(
    (next: QnaTab) => {
      setSearchParams(next === 'faq' ? { tab: 'faq' } : { tab: 'qna' }, { replace: true })
    },
    [setSearchParams],
  )

  return (
    <div className="home-layout home-layout--hub app-route-hub">
      <nav className="game-hub-tabs" aria-label="FAQ · Q&A">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'faq'}
          className={'game-hub-tabs__btn' + (tab === 'faq' ? ' game-hub-tabs__btn--active' : '')}
          onClick={() => setTab('faq')}
        >
          FAQ
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'qna'}
          className={'game-hub-tabs__btn' + (tab === 'qna' ? ' game-hub-tabs__btn--active' : '')}
          onClick={() => setTab('qna')}
        >
          Q&A
        </button>
      </nav>

      <Suspense fallback={<p className="route-fallback">불러오는 중…</p>}>
        <FreeShareBoardPage boardVariant={tab === 'faq' ? 'faq' : 'qna'} />
      </Suspense>
    </div>
  )
}
