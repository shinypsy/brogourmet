import { ACCESS_TOKEN_KEY } from './config'
import type { User } from './auth'
import { requestJson } from './http'

export type { SiteNoticeDraft, SiteNoticeItem } from './siteNotices'
export { fetchAdminSiteNotices, putAdminSiteNotices } from './siteNotices'

export type AdminDistrictOption = {
  id: number
  name: string
  sort_order: number
}

export type AdminRestaurantRow = {
  id: number
  name: string
  district_id: number
  district_name: string
  category: string
  status: string
  bro_list_pin: number | null
  is_deleted: boolean
  /** 지도·목록 가맹 깃발(실제 표시) */
  is_franchise: boolean
  /** null = 등록자 franchise 역할 따름 */
  franchise_pin: boolean | null
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY)
  if (!token) throw new Error('로그인이 필요합니다.')
  return { Authorization: `Bearer ${token}` }
}

export async function fetchAdminDistricts(): Promise<AdminDistrictOption[]> {
  return requestJson<AdminDistrictOption[]>('/admin/districts', { headers: authHeaders() })
}

export async function fetchAdminUsers(): Promise<User[]> {
  return requestJson<User[]>('/admin/users', { headers: authHeaders() })
}

export async function fetchAdminRestaurants(): Promise<AdminRestaurantRow[]> {
  return requestJson<AdminRestaurantRow[]>('/admin/restaurants', { headers: authHeaders() })
}

export async function patchAdminRestaurantFranchisePin(
  restaurantId: number,
  franchise_pin: boolean | null,
): Promise<AdminRestaurantRow> {
  return requestJson<AdminRestaurantRow>(`/admin/restaurants/${restaurantId}/franchise-pin`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ franchise_pin }),
  })
}

export async function setUserRegionalManager(userId: number, districtId: number): Promise<User> {
  return requestJson<User>(`/admin/users/${userId}/set-regional-manager`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ district_id: districtId }),
  })
}

export async function clearUserRegionalManager(userId: number): Promise<User> {
  return requestJson<User>(`/admin/users/${userId}/clear-regional-manager`, {
    method: 'POST',
    headers: authHeaders(),
  })
}
