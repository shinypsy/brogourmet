import { requestJson } from './http'

export type RestaurantEngagement = {
  like_count: number
  comment_count: number
  liked_by_me: boolean
}

export type RestaurantComment = {
  id: number
  body: string
  user_id: number
  author_nickname: string
  created_at: string
}

export async function fetchRestaurantEngagement(
  restaurantId: number,
  token?: string | null,
): Promise<RestaurantEngagement> {
  const headers: Record<string, string> = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return requestJson<RestaurantEngagement>(`/restaurants/${restaurantId}/engagement`, { headers })
}

export async function fetchRestaurantComments(restaurantId: number): Promise<RestaurantComment[]> {
  return requestJson<RestaurantComment[]>(`/restaurants/${restaurantId}/comments`)
}

export async function postRestaurantComment(
  token: string,
  restaurantId: number,
  body: string,
): Promise<RestaurantComment> {
  return requestJson<RestaurantComment>(`/restaurants/${restaurantId}/comments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ body }),
  })
}

export async function deleteRestaurantComment(
  token: string,
  restaurantId: number,
  commentId: number,
): Promise<void> {
  return requestJson<void>(`/restaurants/${restaurantId}/comments/${commentId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function patchRestaurantComment(
  token: string,
  restaurantId: number,
  commentId: number,
  body: string,
): Promise<RestaurantComment> {
  return requestJson<RestaurantComment>(`/restaurants/${restaurantId}/comments/${commentId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ body }),
  })
}

export async function postRestaurantLike(token: string, restaurantId: number): Promise<void> {
  return requestJson<void>(`/restaurants/${restaurantId}/likes`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  })
}

export async function deleteRestaurantLike(token: string, restaurantId: number): Promise<void> {
  return requestJson<void>(`/restaurants/${restaurantId}/likes`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}
