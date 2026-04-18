import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  fetchCloserRound,
  fetchGameOnlineSummary,
  fetchPeerLocation,
  postCloserGuess,
  postGameLocation,
  postGamePresence,
  type CloserGuessResult,
  type CloserRound,
  type GameOnlineSummary,
  type PeerLocation,
} from '../api/gameSocial'
import { ACCESS_TOKEN_KEY } from '../api/auth'
import { AUTH_CHANGE_EVENT } from '../authEvents'
import { KAKAO_MAP_APP_KEY } from '../api/config'
import { BrogKakaoMap } from '../components/BrogKakaoMap'
import type { BrogKakaoMapPin } from '../components/BrogKakaoMap'
import { geolocationFailureMessage, requestGeolocation } from '../lib/requestGeolocation'

export function FriendFinderGame() {
  const [token, setToken] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null,
  )
  const [summary, setSummary] = useState<GameOnlineSummary | null>(null)
  const [summaryError, setSummaryError] = useState('')
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [round, setRound] = useState<CloserRound | null>(null)
  const [roundError, setRoundError] = useState('')
  const [result, setResult] = useState<CloserGuessResult | null>(null)
  const [guessBusy, setGuessBusy] = useState(false)
  const [peerPreview, setPeerPreview] = useState<PeerLocation | null>(null)
  const [peerPreviewBusy, setPeerPreviewBusy] = useState(false)
  const [peerPreviewError, setPeerPreviewError] = useState('')
  const [selectedGamePeerId, setSelectedGamePeerId] = useState<number | null>(null)

  const hasToken = Boolean(token)

  const loadSummary = useCallback(async () => {
    if (!hasToken) return
    setSummaryError('')
    try {
      const s = await fetchGameOnlineSummary()
      setSummary(s)
    } catch (e) {
      setSummary(null)
      setSummaryError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
    }
  }, [hasToken])

  useEffect(() => {
    function onStorage() {
      setToken(localStorage.getItem(ACCESS_TOKEN_KEY))
    }
    function onAuth() {
      setToken(localStorage.getItem(ACCESS_TOKEN_KEY))
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener(AUTH_CHANGE_EVENT, onAuth)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(AUTH_CHANGE_EVENT, onAuth)
    }
  }, [])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary])

  useEffect(() => {
    if (summary == null) return
    if (summary.online_peers.length !== 1) {
      setPeerPreview(null)
      setPeerPreviewError('')
      setSelectedGamePeerId(null)
    }
  }, [summary])

  useEffect(() => {
    if (!hasToken) return
    const id = window.setInterval(() => {
      void postGamePresence().catch(() => {})
      void loadSummary()
    }, 25_000)
    void postGamePresence().catch(() => {})
    return () => window.clearInterval(id)
  }, [hasToken, loadSummary])

  const statusUserCoords = useMemo(() => {
    if (summary?.my_game_lat == null || summary.my_game_lng == null) return null
    return { lat: summary.my_game_lat, lng: summary.my_game_lng }
  }, [summary])

  const setGameLocationFromMap = useCallback(
    async (lat: number, lng: number) => {
      setLocationError('')
      try {
        await postGameLocation(lat, lng)
        setRound(null)
        setResult(null)
        await loadSummary()
      } catch (e) {
        setLocationError(e instanceof Error ? e.message : '위치를 저장하지 못했습니다.')
      }
    },
    [loadSummary],
  )

  const registerMyLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setLocationError(geolocationFailureMessage(new Error('unsupported')))
      return
    }
    setLocating(true)
    setLocationError('')
    try {
      const c = await requestGeolocation()
      await postGameLocation(c.latitude, c.longitude)
      setRound(null)
      setResult(null)
      await loadSummary()
    } catch (e) {
      setLocationError(geolocationFailureMessage(e))
    } finally {
      setLocating(false)
    }
  }, [loadSummary])

  const startRound = useCallback(async () => {
    setRoundError('')
    setRound(null)
    setResult(null)
    try {
      const r = await fetchCloserRound()
      setRound(r)
    } catch (e) {
      setRoundError(e instanceof Error ? e.message : '라운드를 만들 수 없습니다.')
    }
  }, [])

  const loadPeerPreview = useCallback(async () => {
    const p = summary?.online_peers[0]
    if (!p) return
    setPeerPreviewBusy(true)
    setPeerPreviewError('')
    try {
      const loc = await fetchPeerLocation(p.id)
      setPeerPreview(loc)
    } catch (e) {
      setPeerPreview(null)
      setPeerPreviewError(e instanceof Error ? e.message : '위치를 불러오지 못했습니다.')
    } finally {
      setPeerPreviewBusy(false)
    }
  }, [summary])

  const selectGamePeer = useCallback(() => {
    const p = summary?.online_peers[0]
    if (!p) return
    setSelectedGamePeerId(p.id)
  }, [summary])

  const submitPick = useCallback(
    async (pickedId: number) => {
      if (!round) return
      setGuessBusy(true)
      setRoundError('')
      try {
        const res = await postCloserGuess(round.peer_a.id, round.peer_b.id, pickedId)
        setResult(res)
        setRound(null)
      } catch (e) {
        setRoundError(e instanceof Error ? e.message : '채점에 실패했습니다.')
      } finally {
        setGuessBusy(false)
      }
    },
    [round],
  )

  const peerPreviewPins: BrogKakaoMapPin[] = useMemo(() => {
    if (!peerPreview) return []
    return [
      {
        id: peerPreview.id,
        title: peerPreview.nickname,
        latitude: peerPreview.lat,
        longitude: peerPreview.lng,
        rank: 1,
        markerKind: 'brog' as const,
        mapSpeechLabel: peerPreview.nickname,
      },
    ]
  }, [peerPreview])

  const peerPreviewUserCoords = useMemo(() => {
    if (statusUserCoords) return statusUserCoords
    if (!peerPreview) return null
    return { lat: peerPreview.lat, lng: peerPreview.lng }
  }, [statusUserCoords, peerPreview])

  const mapPins: BrogKakaoMapPin[] = useMemo(() => {
    if (!result) return []
    return result.markers.map((m, i) => ({
      id: m.id,
      title: m.nickname,
      latitude: m.lat,
      longitude: m.lng,
      rank: i + 1,
      markerKind: m.kind === 'me' ? 'myg' : 'brog',
      mapSpeechLabel: m.nickname,
    }))
  }, [result])

  const userCoords = useMemo(() => {
    if (!result) return null
    const me = result.markers.find((x) => x.kind === 'me')
    if (!me) return null
    return { lat: me.lat, lng: me.lng }
  }, [result])

  if (!hasToken) {
    return (
      <section className="page game-page friend-finder friend-finder--guest" aria-label="친구 찾기 게임">
        <p className="muted">친구찾기(접속·거리 테스트)는 로그인 후 이용할 수 있습니다.</p>
        <p>
          <Link to="/login" className="compact-link">
            로그인
          </Link>
        </p>
      </section>
    )
  }

  return (
    <section className="page game-page friend-finder" aria-label="친구 찾기 게임">
      <header className="friend-finder__head">
        <h2 className="friend-finder__title">친구 찾기 (테스트)</h2>
        <p className="muted friend-finder__lead">
          접속 중인 다른 회원과 게임용 위치를 올리면, 반경 5km 안에서 가까운 두 명을 골라
          <strong> 누가 더 가까운지</strong> 맞출 수 있습니다.
        </p>
      </header>

      <section className="friend-finder__panel friend-finder__panel--status">
        <h3 className="friend-finder__sub">내 상태</h3>
        <p className="muted">
          게임 위치: {summary?.my_location_set ? '등록됨' : '미등록'}
          {summary ? ` · 접속 중 다른 회원 ${summary.online_peers.length}명` : null}
        </p>
        <div className="friend-finder__actions">
          <button type="button" className="ghost-button" disabled={locating} onClick={() => void registerMyLocation()}>
            {locating ? '위치 확인 중…' : 'GPS로 내 위치 등록'}
          </button>
          <button type="button" className="ghost-button" onClick={() => void loadSummary()}>
            목록 새로고침
          </button>
        </div>
        {locationError ? <p className="error">{locationError}</p> : null}
        {summaryError ? <p className="error">{summaryError}</p> : null}

        {KAKAO_MAP_APP_KEY ? (
          <>
            <h4 className="friend-finder__map-block-title">게임 위치 (지도)</h4>
            <p className="friend-finder__map-block-hint muted">
              지도에서 <strong>우클릭</strong>하거나 <strong>길게 눌러</strong> 그 지점을 게임용 내 위치로 저장합니다.
            </p>
            <div className="friend-finder__map">
              <BrogKakaoMap
                userCoords={statusUserCoords}
                pins={[]}
                locating={locating}
                onMyLocationClick={() => void registerMyLocation()}
                onPickUserLocationOnMap={(lat, lng) => void setGameLocationFromMap(lat, lng)}
                pickLocationHint={
                  <>
                    <strong>우클릭</strong> 또는 <strong>길게 누름</strong> 시 <strong>내위치 설정</strong> 말풍선이
                    뜨고, 그 좌표가 게임 위치로 저장됩니다.
                  </>
                }
                pickLocationRightClickBubbleText="내위치 설정"
                getDetailPath={() => '/game'}
                mapAriaLabel="친구찾기 게임 위치 지도"
                shellClassName="kakao-map-embed"
                canvasClassName="kakao-map-container kakao-map-container--below"
                mapRelayoutKey={summary ? `${summary.my_location_set}-${summary.my_game_lat ?? 0}` : '0'}
                showInteractionHints
                autoRefitWhenPinsChange={Boolean(statusUserCoords)}
              />
            </div>
          </>
        ) : (
          <p className="muted friend-finder__map-missing-key">
            <code>VITE_KAKAO_MAP_APP_KEY</code>가 있으면 여기에 BroG와 같은 지도가 표시됩니다.
          </p>
        )}
      </section>

      {summary && summary.online_peers.length > 0 ? (
        <section className="friend-finder__panel">
          <h3 className="friend-finder__sub">접속 중 (최근 약 2분)</h3>
          <ul className="friend-finder__peers">
            {summary.online_peers.map((p) => (
              <li key={p.id}>
                <span className="friend-finder__nick">{p.nickname}</span>
                <span className="muted">{p.has_game_location ? ' · 위치 등록' : ' · 위치 없음'}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="friend-finder__panel">
        <h3 className="friend-finder__sub">누가 더 가까울까요?</h3>
        {!round && !result && summary ? (
          summary.online_peers.length >= 2 ? (
            <button type="button" className="ghost-button friend-finder__primary" onClick={() => void startRound()}>
              라운드 받기 (가까운 두 명)
            </button>
          ) : summary.online_peers.length === 1 ? (
            <>
              <div className="friend-finder__one-peer-actions">
                <button
                  type="button"
                  className="ghost-button friend-finder__action-half"
                  disabled={peerPreviewBusy}
                  onClick={() => void loadPeerPreview()}
                >
                  {peerPreviewBusy ? '불러오는 중…' : '1명 위치보기'}
                </button>
                <button
                  type="button"
                  className="ghost-button friend-finder__action-half friend-finder__primary"
                  onClick={() => selectGamePeer()}
                >
                  친구 선택하기(게임)
                </button>
              </div>
              {peerPreviewError ? <p className="error">{peerPreviewError}</p> : null}
              {selectedGamePeerId != null ? (
                <p className="muted friend-finder__one-peer-note">
                  선택한 친구를 게임 대상으로 고정했습니다. 접속 중인 친구가 2명 이상이 되면 「라운드 받기」로 이어갈 수
                  있습니다.
                </p>
              ) : null}
              {peerPreview && KAKAO_MAP_APP_KEY ? (
                <div className="friend-finder__map">
                  <BrogKakaoMap
                    userCoords={peerPreviewUserCoords}
                    pins={peerPreviewPins}
                    locating={false}
                    onMyLocationClick={() => {}}
                    getDetailPath={() => '/game'}
                    mapAriaLabel="친구 1명 위치 미리보기"
                    shellClassName="kakao-map-embed"
                    canvasClassName="kakao-map-container kakao-map-container--below"
                    mapRelayoutKey={`${peerPreview.lat}-${peerPreview.lng}`}
                    showInteractionHints={false}
                    autoRefitWhenPinsChange
                  />
                </div>
              ) : null}
            </>
          ) : (
            <p className="muted">
              반경 5km 안·접속 중·위치를 등록한 다른 회원이 2명 이상일 때 라운드를 시작할 수 있습니다. (현재 0명 — 위
              「목록 새로고침」으로 갱신)
            </p>
          )
        ) : null}
        {roundError ? <p className="error">{roundError}</p> : null}
        {round ? (
          <div className="friend-finder__round">
            <p className="friend-finder__question">누가 더 가까운 곳에 있을까요?</p>
            <div className="friend-finder__pick-row">
              <button
                type="button"
                className="friend-finder__pick"
                disabled={guessBusy}
                onClick={() => void submitPick(round.peer_a.id)}
              >
                {round.peer_a.nickname}
              </button>
              <button
                type="button"
                className="friend-finder__pick"
                disabled={guessBusy}
                onClick={() => void submitPick(round.peer_b.id)}
              >
                {round.peer_b.nickname}
              </button>
            </div>
          </div>
        ) : null}
        {result ? (
          <div className="friend-finder__result">
            <p className={result.correct ? 'friend-finder__verdict friend-finder__verdict--ok' : 'friend-finder__verdict'}>
              {result.correct ? '정답입니다.' : '아쉽습니다, 틀렸습니다.'}
            </p>
            <ul className="friend-finder__dist">
              {Object.entries(result.distances_km).map(([uid, km]) => (
                <li key={uid}>
                  회원 #{uid}: <strong>{km} km</strong>
                </li>
              ))}
            </ul>
            <p className="muted">더 가까운 쪽: 회원 #{result.closer_user_id}</p>
            {KAKAO_MAP_APP_KEY && userCoords ? (
              <div className="friend-finder__map">
                <BrogKakaoMap
                  userCoords={userCoords}
                  pins={mapPins}
                  locating={false}
                  onMyLocationClick={() => {}}
                  getDetailPath={() => '/game'}
                  mapSpeechBubbles
                  mapAriaLabel="친구찾기 결과 지도"
                  shellClassName="kakao-map-embed"
                  canvasClassName="kakao-map-container kakao-map-container--below"
                  mapRelayoutKey={result ? `${result.closer_user_id}-${result.correct}` : '0'}
                  showInteractionHints={false}
                  autoRefitWhenPinsChange={mapPins.length > 0}
                />
              </div>
            ) : (
              <p className="muted">지도를 보려면 카카오맵 키가 필요합니다.</p>
            )}
            <button type="button" className="ghost-button" onClick={() => void startRound()}>
              다시 하기
            </button>
          </div>
        ) : null}
      </section>
    </section>
  )
}
