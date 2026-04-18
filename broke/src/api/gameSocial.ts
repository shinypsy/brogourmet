import { ACCESS_TOKEN_KEY } from './config'
import { requestJson } from './http'

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null
  if (!token) throw new Error('로그인이 필요합니다.')
  return { Authorization: `Bearer ${token}` }
}

export type OnlinePeer = {
  id: number
  nickname: string
  has_game_location: boolean
}

export type GameOnlineSummary = {
  my_location_set: boolean
  my_game_lat?: number | null
  my_game_lng?: number | null
  online_peers: OnlinePeer[]
}

export type PeerLocation = {
  id: number
  nickname: string
  lat: number
  lng: number
}

export type CloserRound = {
  peer_a: { id: number; nickname: string }
  peer_b: { id: number; nickname: string }
}

export type CloserGuessResult = {
  correct: boolean
  closer_user_id: number
  distances_km: Record<string, number>
  markers: Array<{
    id: number
    nickname: string
    lat: number
    lng: number
    kind: string
  }>
}

export async function postGamePresence(): Promise<void> {
  await requestJson<void>('/game/presence', {
    method: 'POST',
    headers: authHeaders(),
  })
}

export async function postGameLocation(lat: number, lng: number): Promise<void> {
  await requestJson<void>('/game/location', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ lat, lng }),
  })
}

export async function fetchGameOnlineSummary(): Promise<GameOnlineSummary> {
  return requestJson<GameOnlineSummary>('/game/online-summary', {
    headers: authHeaders(),
  })
}

export async function fetchPeerLocation(peerId: number): Promise<PeerLocation> {
  return requestJson<PeerLocation>(`/game/peer-location/${peerId}`, {
    headers: authHeaders(),
  })
}

export async function fetchCloserRound(): Promise<CloserRound> {
  return requestJson<CloserRound>('/game/closer-round', {
    headers: authHeaders(),
  })
}

export async function postCloserGuess(
  peerAId: number,
  peerBId: number,
  pickedUserId: number,
): Promise<CloserGuessResult> {
  return requestJson<CloserGuessResult>('/game/closer-guess', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      peer_a_id: peerAId,
      peer_b_id: peerBId,
      picked_user_id: pickedUserId,
    }),
  })
}
