import { requestJson } from './http'
import type { BrogCategory } from '../lib/brogCategories'

export type RestaurantListItem = {
  id: number
  name: string
  city: string
  district_id: number
  district: string
  category: string
  summary: string
  image_url: string | null
  image_urls?: string[]
  latitude: number | null
  longitude: number | null
  main_menu_name: string
  main_menu_price: number
  /** false면 동일 위치 중복 등록(_1, _2 …) — 목록에서 제목 굵기 약화 */
  points_eligible?: boolean
  /** true면 지도에서 가맹점용 깃발(청록). 백엔드 필드 추가 시 자동 반영 */
  is_franchise?: boolean
  submitted_by_user_id?: number | null
  /** GET /restaurants 목록에 포함 — 지도·리스트 검색(닉네임)용 */
  submitted_by_nickname?: string | null
  /** 관리자 BroG 리스트 1~4위 고정, 없으면 좋아요 순 */
  bro_list_pin?: number | null
  /** 가맹점 연동 활성 이벤트 — 메인 리스트·홈 추천 카드 사진 스티커 */
  has_active_site_event?: boolean
}

export type MenuItem = {
  id: number
  name: string
  price_krw: number
  is_main_menu: boolean
  card_slot?: number | null
}

export type RestaurantDetail = {
  id: number
  name: string
  city: string
  district_id: number
  district: string
  category: string
  summary: string
  image_url: string | null
  image_urls?: string[]
  /** false면 포인트 적립·정산 대상 아님(동일 장소 중복 매장 _1, _2 등) */
  points_eligible?: boolean
  latitude: number | null
  longitude: number | null
  status: string
  is_deleted?: boolean
  created_at: string
  menu_items: MenuItem[]
  /** BroG 최초 등록 계정 id (포인트 정산·표시) */
  submitted_by_user_id?: number | null
  submitted_by_nickname?: string | null
  /** `super_admin` | `regional_manager` | `user` 등 */
  submitted_by_role?: string | null
  /** true면 지도 가맹 깃발 */
  is_franchise?: boolean
  /** 가맹점 연동 활성 이벤트 — 메인 리스트 등 카드 사진 스티커(API 일관) */
  has_active_site_event?: boolean
  /** 이 BroG에만 연결된 활성 이벤트 본문(최신순). 헤더 티커 전역 이벤트와 별개 */
  active_site_event_bodies?: string[]
}

export type RestaurantListParams = {
  district?: string
  district_id?: number
  max_price?: number
  limit?: number
  /** BroG 거리 필터(WGS84). 셋 다 있을 때만 적용됩니다. */
  near_lat?: number
  near_lng?: number
  radius_m?: number
  /**
   * true면 반경 검색 시 district 조건 생략(클라: URL 구와 좌표 불일치 시만).
   * 구 드롭다운을 바꾼 뒤에는 false로 보내 선택 구·반경 AND.
   */
  near_ignore_district?: boolean
}

export type ExtraCardMenuPayload = { name: string; price_krw: number }

export type RestaurantWritePayload = {
  name: string
  city: string
  district_id: number
  category: BrogCategory
  summary: string
  image_url?: string | null
  /** BroG 사진 URL 최대 6개 */
  image_urls?: string[]
  latitude?: number | null
  longitude?: number | null
  main_menu_name: string
  main_menu_price: number
  extra_card_menus?: ExtraCardMenuPayload[]
  /** 카드에 안 올라가는 부메뉴 (5~10줄), 최대 6 */
  more_menu_items?: ExtraCardMenuPayload[]
  status?: 'draft' | 'published'
}

export type RestaurantManageRow = {
  id: number
  name: string
  district_id: number
  district: string
  status: string
  is_deleted?: boolean
  updated_at: string
}

export async function fetchRestaurants(params: RestaurantListParams = {}): Promise<RestaurantListItem[]> {
  const search = new URLSearchParams()
  if (params.district) {
    search.set('district', params.district)
  }
  if (params.district_id != null) {
    search.set('district_id', String(params.district_id))
  }
  if (params.max_price != null) {
    search.set('max_price', String(params.max_price))
  }
  if (params.limit != null) {
    search.set('limit', String(params.limit))
  }
  if (params.near_lat != null) {
    search.set('near_lat', String(params.near_lat))
  }
  if (params.near_lng != null) {
    search.set('near_lng', String(params.near_lng))
  }
  if (params.radius_m != null) {
    search.set('radius_m', String(params.radius_m))
  }
  if (params.near_ignore_district === true) {
    search.set('near_ignore_district', 'true')
  }
  const query = search.toString()
  return requestJson<RestaurantListItem[]>(`/restaurants${query ? `?${query}` : ''}`)
}

export async function fetchRestaurant(id: number): Promise<RestaurantDetail> {
  return requestJson<RestaurantDetail>(`/restaurants/${id}`)
}

export async function fetchRestaurantForManage(token: string, id: number): Promise<RestaurantDetail> {
  return requestJson<RestaurantDetail>(`/restaurants/manage/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function fetchManageRestaurantList(
  token: string,
  options?: { districtId?: number; includeDeleted?: boolean },
): Promise<RestaurantManageRow[]> {
  const params = new URLSearchParams()
  if (options?.districtId != null) {
    params.set('district_id', String(options.districtId))
  }
  if (options?.includeDeleted) {
    params.set('include_deleted', 'true')
  }
  const q = params.toString()
  return requestJson<RestaurantManageRow[]>(`/restaurants/manage/list${q ? `?${q}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function createRestaurant(token: string, body: RestaurantWritePayload): Promise<RestaurantDetail> {
  return requestJson<RestaurantDetail>('/restaurants', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

/** 본인 MyG 글 내용으로 공개 BroG 매장 생성 */
export async function createRestaurantFromMyGPost(token: string, mygPostId: number): Promise<RestaurantDetail> {
  return requestJson<RestaurantDetail>(`/restaurants/from-myg/${mygPostId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  })
}

export async function updateRestaurant(
  token: string,
  id: number,
  body: RestaurantWritePayload,
): Promise<RestaurantDetail> {
  return requestJson<RestaurantDetail>(`/restaurants/${id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

/** 목록·지도에서만 숨김(소프트 삭제). 담당 구 권한 또는 슈퍼. */
export async function deleteRestaurant(token: string, id: number): Promise<void> {
  return requestJson<void>(`/restaurants/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

/** BroG 목록 고정: 미고정이면 같은 구에서 비어 있는 가장 작은 슬롯(1~4), 이후 1→2→3→4→해제 순환. 슈퍼·해당 구 지역담당만. */
export async function cycleBroListPin(
  token: string,
  restaurantId: number,
): Promise<{ bro_list_pin: number | null }> {
  return requestJson<{ bro_list_pin: number | null }>(`/restaurants/${restaurantId}/cycle-bro-list-pin`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  })
}

/** 이 카드의 목록 고정만 즉시 해제(슬롯 비움). 순환 없이 1위 유지 채로 다른 곳에 1위를 주려면 먼저 이걸 누름. */
export async function clearBroListPin(
  token: string,
  restaurantId: number,
): Promise<{ bro_list_pin: number | null }> {
  return requestJson<{ bro_list_pin: number | null }>(`/restaurants/${restaurantId}/clear-bro-list-pin`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  })
}

/** DB에서 행·메뉴 영구 삭제. 슈퍼 관리자만. */
export async function purgeRestaurantPermanent(token: string, id: number): Promise<void> {
  return requestJson<void>(`/restaurants/${id}/permanent`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

/** 숨김 해제(다시 공개). 슈퍼만. */
export async function restoreRestaurant(token: string, id: number): Promise<RestaurantDetail> {
  return requestJson<RestaurantDetail>(`/restaurants/${id}/restore`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  })
}
