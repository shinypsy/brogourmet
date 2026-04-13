import type { KnownRestaurantPost } from '../api/community'
import type { RestaurantListItem } from '../api/restaurants'
import type { BrogCategory } from './brogCategories'
import { haversineMeters } from './haversine'

export const SADARI_SLOT_COUNT = 6
const MYG_RADIUS_M = 1000
const BROG_RADIUS_M = 2000

export type SadariCandidate = {
  key: string
  label: string
  source: 'myg' | 'brog'
  href: string
  distanceM: number
}

export type BuildSadariOptions = {
  /** BroG 카테고리와 일치하는 글·매장을 같은 반경 안에서 먼저 채웁니다. */
  preferredCategory?: BrogCategory | null
}

function normName(s: string): string {
  return s.trim().toLowerCase()
}

/** 선호 카테고리 일치 행을 거리순으로 앞에 두고, 나머지를 거리순으로 이어 붙입니다. */
function orderByTasteThenDistance<T>(
  rows: { row: T; d: number }[],
  getCategory: (t: T) => string | null | undefined,
  preferred: BrogCategory | null,
): { row: T; d: number }[] {
  if (!preferred) {
    return rows.slice().sort((a, b) => a.d - b.d)
  }
  const match = rows.filter((x) => getCategory(x.row) === preferred).sort((a, b) => a.d - b.d)
  const rest = rows.filter((x) => getCategory(x.row) !== preferred).sort((a, b) => a.d - b.d)
  return [...match, ...rest]
}

/**
 * MyG 1km 이내 → 부족분은 BroG 2km 이내.
 * 선호 카테고리가 있으면 같은 반경·거리 규칙 안에서 해당 종류를 우선합니다.
 * 6칸을 채우기 위해 부족하면 이미 뽑은 목록을 순환해 채웁니다.
 */
export function buildSadariCandidates(
  userLat: number,
  userLng: number,
  myg: KnownRestaurantPost[],
  brog: RestaurantListItem[],
  options?: BuildSadariOptions,
): SadariCandidate[] {
  const preferred = options?.preferredCategory ?? null
  const usedNames = new Set<string>()
  const picked: SadariCandidate[] = []

  const mygScoredRows = myg
    .filter((p) => p.latitude != null && p.longitude != null)
    .map((post) => ({
      row: post,
      d: haversineMeters(userLat, userLng, post.latitude!, post.longitude!),
    }))
    .filter((x) => x.d <= MYG_RADIUS_M)

  const mygScored = orderByTasteThenDistance(mygScoredRows, (p) => p.category, preferred)

  for (const { row: post, d } of mygScored) {
    if (picked.length >= SADARI_SLOT_COUNT) break
    const n = normName(post.restaurant_name)
    if (usedNames.has(n)) continue
    usedNames.add(n)
    picked.push({
      key: `myg-${post.id}`,
      label: post.restaurant_name,
      source: 'myg',
      href: `/known-restaurants/${post.id}`,
      distanceM: Math.round(d),
    })
  }

  const brogScoredRows = brog
    .filter((r) => r.latitude != null && r.longitude != null)
    .map((r) => ({
      row: r,
      d: haversineMeters(userLat, userLng, r.latitude!, r.longitude!),
    }))
    .filter((x) => x.d <= BROG_RADIUS_M)

  const brogScored = orderByTasteThenDistance(brogScoredRows, (r) => r.category, preferred)

  for (const { row: r, d } of brogScored) {
    if (picked.length >= SADARI_SLOT_COUNT) break
    const n = normName(r.name)
    if (usedNames.has(n)) continue
    usedNames.add(n)
    picked.push({
      key: `brog-${r.id}`,
      label: r.name,
      source: 'brog',
      href: `/restaurants/${r.id}`,
      distanceM: Math.round(d),
    })
  }

  const base = picked.slice()
  let i = 0
  while (picked.length < SADARI_SLOT_COUNT && base.length > 0) {
    const b = base[i % base.length]
    picked.push({
      ...b,
      key: `${b.key}~dup${picked.length}`,
      distanceM: b.distanceM,
    })
    i += 1
  }

  while (picked.length < SADARI_SLOT_COUNT) {
    picked.push({
      key: `empty-${picked.length}`,
      label: '주변 추천 없음',
      source: 'brog',
      href: '/',
      distanceM: 0,
    })
  }

  return picked.slice(0, SADARI_SLOT_COUNT)
}
