import { requestJson } from './http'

export type RestaurantListItem = {
  id: number
  name: string
  city: string
  district: string
  category: string
  summary: string
  image_url: string | null
  latitude: number | null
  longitude: number | null
  main_menu_name: string
  main_menu_price: number
}

export type MenuItem = {
  id: number
  name: string
  price_krw: number
  is_main_menu: boolean
}

export type RestaurantDetail = {
  id: number
  name: string
  city: string
  district: string
  category: string
  summary: string
  image_url: string | null
  latitude: number | null
  longitude: number | null
  created_at: string
  menu_items: MenuItem[]
}

export type RestaurantListParams = {
  district?: string
  max_price?: number
  limit?: number
}

export type RestaurantWritePayload = {
  name: string
  city: string
  district: string
  category: string
  summary: string
  image_url?: string | null
  latitude?: number | null
  longitude?: number | null
  main_menu_name: string
  main_menu_price: number
}

export async function fetchRestaurants(params: RestaurantListParams = {}): Promise<RestaurantListItem[]> {
  const search = new URLSearchParams()
  if (params.district) {
    search.set('district', params.district)
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

export async function deleteRestaurant(token: string, id: number): Promise<void> {
  return requestJson<void>(`/restaurants/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}
