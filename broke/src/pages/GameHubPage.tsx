import { lazy, Suspense, useState } from 'react'

const SadariPage = lazy(() => import('./SadariPage').then((m) => ({ default: m.SadariPage })))
const FriendFinderGame = lazy(() =>
  import('./FriendFinderGame').then((m) => ({ default: m.FriendFinderGame })),
)

type GameTab = 'sadari' | 'friend'

export function GameHubPage() {
  const [tab, setTab] = useState<GameTab>('sadari')

  return (
    <div className="home-layout home-layout--hub home-layout--map-home app-route-hub">
      <nav className="game-hub-tabs" aria-label="게임 종류">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'sadari'}
          className={'game-hub-tabs__btn' + (tab === 'sadari' ? ' game-hub-tabs__btn--active' : '')}
          onClick={() => setTab('sadari')}
        >
          사다리 점메추
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'friend'}
          className={'game-hub-tabs__btn' + (tab === 'friend' ? ' game-hub-tabs__btn--active' : '')}
          onClick={() => setTab('friend')}
        >
          친구 찾기
        </button>
      </nav>

      <Suspense fallback={<p className="route-fallback">불러오는 중…</p>}>
        {tab === 'sadari' ? <SadariPage /> : <FriendFinderGame />}
      </Suspense>
    </div>
  )
}
