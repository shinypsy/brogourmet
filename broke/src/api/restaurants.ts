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
}

export type RestaurantListParams = {
  district?: string
  district_id?: number
  max_price?: number
  limit?: number
}

export type ExtraCardMenuPayload = { name: string; price_krw: number }

export type RestaurantWritePayload = {
  name: string
  city: string
  district_id: number
  category: BrogCategory
  summary: string
  image_url?: string | null
  /** BroG 사진 URL 최대 5개 */
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
