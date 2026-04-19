import type { KnownRestaurantPost } from '../api/community'
import type { RestaurantListItem } from '../api/restaurants'
import type { BrogCategory } from './brogCategories'
import { haversineMeters } from './haversine'

export const SADARI_SLOT_COUNT = 6

/** MyG·BroG 동일: 내 위치 기준 1km */
export const SADARI_RADIUS_M = 1000

export type SadariCandidate = {
  key: string
  label: string
  source: 'myg' | 'brog'
  href: string
  distanceM: number
}

export type BuildSadariOptions = {
  /** BroG 카테고리와 일치하는 글·매장을 우선(취향 선택 시 최소 3칸까지 가능하면 반영) */
  preferredCategory?: BrogCategory | null
}

function normName(s: string): string {
  return s.trim().toLowerCase()
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

type MygRow = { row: KnownRestaurantPost; d: number }
type BrogRow = { row: RestaurantListItem; d: number }

function mygCategory(p: KnownRestaurantPost): string | null | undefined {
  return p.category
}

function toMygCandidate(post: KnownRestaurantPost, d: number): SadariCandidate {
  return {
    key: `myg-${post.id}`,
    label: post.restaurant_name,
    source: 'myg',
    href: `/known-restaurants/${post.id}`,
    distanceM: Math.round(d),
  }
}

function toBrogCandidate(r: RestaurantListItem, d: number): SadariCandidate {
  return {
    key: `brog-${r.id}`,
    label: r.name,
    source: 'brog',
    href: `/restaurants/${r.id}`,
    distanceM: Math.round(d),
  }
}

/**
 * 반경 1km, MyG → BroG 순·거리순으로 최대 6곳(후보가 적으면 그만큼만).
 * 취향 선택 시: 같은 분류가 풀에 3곳 이상이면 최종 6칸 중 최소 3칸은 그 분류로 맞추고,
 * 분류 일치가 3곳 미만이면 일치분 전부 + 나머지는 거리순(일치 부족 시 나머지 풀은 셔플).
 */
export function buildSadariCandidates(
  userLat: number,
  userLng: number,
  myg: KnownRestaurantPost[],
  brog: RestaurantListItem[],
  options?: BuildSadariOptions,
): SadariCandidate[] {
  const preferred = options?.preferredCategory ?? null
  const R = SADARI_RADIUS_M

  const mygScored: MygRow[] = myg
    .filter((p) => p.latitude != null && p.longitude != null)
    .map((post) => ({
      row: post,
      d: haversineMeters(userLat, userLng, post.latitude!, post.longitude!),
    }))
    .filter((x) => x.d <= R)
    .sort((a, b) => a.d - b.d)

  const brogScored: BrogRow[] = brog
    .filter((r) => r.latitude != null && r.longitude != null)
    .map((r) => ({
      row: r,
      d: haversineMeters(userLat, userLng, r.latitude!, r.longitude!),
    }))
    .filter((x) => x.d <= R)
    .sort((a, b) => a.d - b.d)

  const usedNames = new Set<string>()

  function tryPushMyg(x: MygRow): boolean {
    const n = normName(x.row.restaurant_name)
    if (usedNames.has(n)) return false
    usedNames.add(n)
    return true
  }

  function tryPushBrog(x: BrogRow): boolean {
    const n = normName(x.row.name)
    if (usedNames.has(n)) return false
    usedNames.add(n)
    return true
  }

  const picked: SadariCandidate[] = []

  function pushMyg(x: MygRow) {
    if (picked.length >= SADARI_SLOT_COUNT) return
    if (!tryPushMyg(x)) return
    picked.push(toMygCandidate(x.row, x.d))
  }

  function pushBrog(x: BrogRow) {
    if (picked.length >= SADARI_SLOT_COUNT) return
    if (!tryPushBrog(x)) return
    picked.push(toBrogCandidate(x.row, x.d))
  }

  if (!preferred) {
    for (const x of mygScored) {
      if (picked.length >= SADARI_SLOT_COUNT) break
      pushMyg(x)
    }
    for (const x of brogScored) {
      if (picked.length >= SADARI_SLOT_COUNT) break
      pushBrog(x)
    }
    return picked
  }

  const matchMyg = mygScored.filter((x) => mygCategory(x.row) === preferred)
  const nonMyg = mygScored.filter((x) => mygCategory(x.row) !== preferred)
  const matchBrog = brogScored.filter((x) => x.row.category === preferred)
  const nonBrog = brogScored.filter((x) => x.row.category !== preferred)

  const matchPool: Array<MygRow | BrogRow> = [...matchMyg, ...matchBrog]
  const nonPool: Array<MygRow | BrogRow> = [...nonMyg, ...nonBrog]

  let mi = 0
  while (picked.length < 3 && mi < matchPool.length) {
    const x = matchPool[mi++]
    if ('restaurant_name' in x.row) pushMyg(x as MygRow)
    else pushBrog(x as BrogRow)
  }

  const remainingMatches = matchPool.slice(mi)
  let rest: Array<MygRow | BrogRow> = [...remainingMatches, ...nonPool]

  if (matchPool.length < 3) {
    rest = shuffle(rest)
  }

  for (const x of rest) {
    if (picked.length >= SADARI_SLOT_COUNT) break
    if ('restaurant_name' in x.row) pushMyg(x as MygRow)
    else pushBrog(x as BrogRow)
  }

  return picked
}
